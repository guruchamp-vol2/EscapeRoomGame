// Seamless portals: each portal renders the view out of its linked portal into a
// render target, then draws it on its surface using screen-space UVs. Crossing a
// portal's plane teleports the player with position, yaw and momentum preserved.
//
// Portals are always vertical (rotated about Y only), which keeps the player's
// "up" stable and the teleport math to a single yaw rotation.
import * as THREE from 'three';

const FLIP = new THREE.Matrix4().makeRotationY(Math.PI);
const UP = new THREE.Vector3(0, 1, 0);
const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLANK.needsUpdate = true;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 resolution;
  uniform float oval;
  uniform float useFlat;
  uniform vec3 flatColor;
  varying vec2 vUv;
  void main() {
    if (oval > 0.5) {
      vec2 p = vUv * 2.0 - 1.0;
      if (dot(p, p) > 1.0) discard;
    }
    vec3 col = useFlat > 0.5 ? flatColor : texture2D(map, gl_FragCoord.xy / resolution).rgb;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Portal {
  constructor({ width = 1.2, height = 2.2, rimColor = null, flatColor = 0x101214, oval = false, name = '' }) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.ovalShape = oval;
    this.rotY = 0;
    this.link = null;
    this.placed = false;
    this.open = true; // external gate, e.g. a door in front of the portal
    this.ignore = []; // colliders the player may pass through while entering
    this.panel = null;

    this.group = new THREE.Group();
    this.group.name = `portal:${name}`;
    this.group.visible = false;
    // Surface and rim live in `visual` so they can animate open without scaling
    // `group`, whose matrix drives the teleport math.
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    this.opening = 1;

    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });

    this.uniforms = {
      map: { value: this.rt.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
      oval: { value: oval ? 1 : 0 },
      useFlat: { value: 1 },
      flatColor: { value: new THREE.Color(flatColor) },
    };
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader });
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    this.visual.add(this.surface);

    // A box extending behind the surface. When the camera gets close enough for
    // its near plane to slice the surface, the box keeps showing the far side.
    const depth = 0.3;
    const tunnelUniforms = { ...this.uniforms, oval: { value: 0 } };
    const tunnelMat = new THREE.ShaderMaterial({
      uniforms: tunnelUniforms, vertexShader, fragmentShader, side: THREE.DoubleSide,
    });
    const tunnelGeo = new THREE.BoxGeometry(width, height, depth).translate(0, 0, -depth / 2 - 0.002);
    this.tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    this.tunnel.visible = false;
    this.group.add(this.tunnel);

    if (rimColor !== null) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.47, 0.535, 64),
        new THREE.MeshBasicMaterial({ color: rimColor, toneMapped: false, side: THREE.DoubleSide }),
      );
      ring.scale.set(width, height, 1);
      ring.position.z = 0.004;
      this.visual.add(ring);
      const glow = new THREE.PointLight(rimColor, 1.2, 4, 2);
      glow.position.z = 0.4;
      this.visual.add(glow);
    }
  }

  get active() {
    return this.placed && this.open && !!this.link && this.link.placed && this.link.open;
  }

  place(position, rotY, ignore = [], panel = null) {
    this.rotY = rotY;
    this.group.position.copy(position);
    this.group.rotation.set(0, rotY, 0);
    this.group.updateMatrixWorld(true);
    this.ignore = ignore;
    this.panel = panel;
    this.placed = true;
    this.group.visible = true;
    this.opening = 0;
    this.visual.scale.set(0.01, 0.01, 1);
  }

  toLocal(worldPoint, out = new THREE.Vector3()) {
    return this.group.worldToLocal(out.copy(worldPoint));
  }
}

export class PortalSystem {
  constructor(scene) {
    this.scene = scene;
    this.portals = [];
    this.vcam = new THREE.PerspectiveCamera();
    this.vcam.matrixAutoUpdate = false;
    this.vcam.matrixWorldAutoUpdate = false;
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
  }

  add(portal) {
    this.portals.push(portal);
    this.scene.add(portal.group);
    return portal;
  }

  static link(a, b) {
    a.link = b;
    b.link = a;
  }

  resize(w, h) {
    for (const p of this.portals) {
      p.rt.setSize(w, h);
      p.uniforms.resolution.value.set(w, h);
    }
  }

  // World transform taking things in front of `p` to the matching spot in front of `p.link`.
  transformThrough(p, out = new THREE.Matrix4()) {
    out.copy(p.link.group.matrixWorld).multiply(FLIP);
    this._m.copy(p.group.matrixWorld).invert();
    return out.multiply(this._m);
  }

  // Pop-open animation after a portal is placed.
  animate(dt) {
    for (const p of this.portals) {
      if (p.opening >= 1) continue;
      p.opening = Math.min(1, p.opening + dt * 3.5);
      const t = p.opening - 1;
      const s = 1 + 2.7 * t * t * t + 1.7 * t * t; // ease-out-back
      p.visual.scale.set(s, s, 1);
    }
  }

  // Colliders (walls behind portals) the player may pass through right now.
  ignoreSet(playerCenter) {
    const set = new Set();
    for (const p of this.portals) {
      if (!p.active || p.ignore.length === 0) continue;
      const l = p.toLocal(playerCenter, this._v);
      if (Math.abs(l.x) < p.width / 2 && Math.abs(l.y) < p.height / 2 + 0.6 && l.z > -1 && l.z < 0.9) {
        for (const c of p.ignore) set.add(c);
      }
    }
    return set;
  }

  // Returns the portal the player went through, if any.
  checkTeleport(player, prevEye, newEye) {
    for (const p of this.portals) {
      if (!p.active) continue;
      const a = p.toLocal(prevEye, this._v);
      const b = p.toLocal(newEye, this._v2);
      if (a.z >= 0 && b.z < 0 && Math.abs(b.x) <= p.width / 2 && Math.abs(b.y) <= p.height / 2) {
        const m = this.transformThrough(p, new THREE.Matrix4());
        player.pos.applyMatrix4(m);
        const dyaw = p.link.rotY + Math.PI - p.rotY;
        player.yaw += dyaw;
        player.vel.applyAxisAngle(UP, dyaw);
        return p;
      }
    }
    return null;
  }

  // Show the tunnel (and drop the oval mask) when the camera is about to pass through.
  _updateProximity(camPos) {
    for (const p of this.portals) {
      if (!p.placed) continue;
      const l = p.toLocal(camPos, this._v);
      const near = p.active && l.z > -0.05 && l.z < 0.6 &&
        Math.abs(l.x) < p.width / 2 + 0.2 && Math.abs(l.y) < p.height / 2 + 0.2;
      p.tunnel.visible = near;
      p.uniforms.oval.value = p.ovalShape && !near ? 1 : 0;
    }
  }

  render(renderer, scene, camera, hideDuringPasses = []) {
    camera.updateMatrixWorld();
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    this._updateProximity(camPos);
    this._frustum.setFromProjectionMatrix(
      this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );

    const toRender = this.portals.filter((p) => {
      if (!p.active || !p.group.visible) return false;
      if (p.toLocal(camPos, this._v).z < -0.05) return false;
      return this._frustum.intersectsObject(p.surface) || p.tunnel.visible;
    });

    for (const p of this.portals) p.uniforms.useFlat.value = p.active ? 0 : 1;
    if (toRender.length === 0) return;

    // During off-screen passes every portal draws flat (no recursion, and no
    // sampling a texture we're rendering into).
    const saved = this.portals.map((p) => p.uniforms.useFlat.value);
    for (const p of this.portals) {
      p.uniforms.useFlat.value = 1;
      p.uniforms.map.value = BLANK;
    }
    const hidden = hideDuringPasses.filter((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));

    for (const p of toRender) {
      this._setupVirtualCamera(p, camera);
      const linkSurface = p.link.surface.visible;
      const linkTunnel = p.link.tunnel.visible;
      p.link.surface.visible = false;
      p.link.tunnel.visible = false;
      renderer.setRenderTarget(p.rt);
      renderer.clear();
      renderer.render(scene, this.vcam);
      p.link.surface.visible = linkSurface;
      p.link.tunnel.visible = linkTunnel;
    }
    renderer.setRenderTarget(null);

    hidden.forEach((o) => (o.visible = true));
    this.portals.forEach((p, i) => {
      p.uniforms.useFlat.value = saved[i];
      p.uniforms.map.value = p.rt.texture;
    });
  }

  _setupVirtualCamera(p, camera) {
    const vcam = this.vcam;
    const m = this.transformThrough(p, new THREE.Matrix4());
    vcam.matrixWorld.multiplyMatrices(m, camera.matrixWorld);
    vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    vcam.projectionMatrix.copy(camera.projectionMatrix);

    // Oblique near plane at the exit portal so nothing behind it (its wall)
    // shows up. Technique from Lengyel, as used by three's Reflector.
    const exit = p.link.group;
    const normal = this._v.set(0, 0, 1).applyQuaternion(exit.quaternion);
    this._plane.setFromNormalAndCoplanarPoint(normal, exit.position);
    this._plane.applyMatrix4(vcam.matrixWorldInverse);
    const clip = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const e = vcam.projectionMatrix.elements;
    const q = this._q.set(
      (Math.sign(clip.x) + e[8]) / e[0],
      (Math.sign(clip.y) + e[9]) / e[5],
      -1.0,
      (1.0 + e[10]) / e[14],
    );
    clip.multiplyScalar(2.0 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1.0;
    e[14] = clip.w;
    vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
  }
}
