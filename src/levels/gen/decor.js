// Decoration for generated cells. Purely visual: decor never collides and never
// blocks interaction rays or portal shots, so it can't break a puzzle. It hugs
// the side walls and skips wall spans a module reserved (panels, sockets, signs).
import * as THREE from 'three';
import { pick, range } from '../../random.js';

function overlaps(z, spans, pad) {
  return spans.some(([a, b]) => z > Math.min(a, b) - pad && z < Math.max(a, b) + pad);
}

function screenTexture(accent, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const g = canvas.getContext('2d');
  g.fillStyle = '#05080c';
  g.fillRect(0, 0, 256, 144);
  g.strokeStyle = accent;
  g.fillStyle = accent;
  g.lineWidth = 3;
  const kind = Math.floor(rng() * 3);
  if (kind === 0) {
    for (let i = 0; i < 10; i++) g.fillRect(16 + i * 23, 120 - rng() * 90, 14, 200);
  } else if (kind === 1) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, 72 + Math.sin(x / 18 + rng() * 6) * 30 * rng());
    g.stroke();
  } else {
    g.font = 'bold 18px monospace';
    for (let i = 0; i < 7; i++) g.fillText(Array.from({ length: 18 }, () => (rng() < 0.5 ? '0' : '1')).join(''), 12, 22 + i * 18);
  }
  g.fillRect(0, 0, 256, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bookTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2a170e';
  g.fillRect(0, 0, 256, 256);
  const colors = ['#7a2a22', '#2f4f6b', '#3e5b2f', '#8a6a2a', '#5b3a6b', '#6b4a2a', '#2a5b5b'];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = 4;
    while (x < 250) {
      const w = 6 + rng() * 10;
      const h = 40 + rng() * 18;
      g.fillStyle = colors[Math.floor(rng() * colors.length)];
      g.fillRect(x, shelf * 64 + (60 - h), w - 1, h);
      x += w;
    }
    g.fillStyle = '#1a0d07';
    g.fillRect(0, shelf * 64 + 60, 256, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// `reserve`: { w: [[z0, z1], ...], e: [...] } wall spans to keep clear.
export function decorate(b, cell, rng, reserve = {}) {
  const theme = b.theme;
  const styles = theme.decor ?? ['pillars'];
  const { x0, x1, zS, zN, y0, h } = cell;
  const top = cell.hasCeiling ? y0 + h : y0 + Math.min(h, 7);
  const base = new THREE.MeshStandardMaterial({ color: theme.wallLine, roughness: 0.55, metalness: 0.35 });
  const glow = b.mat.accent;
  const glowSoft = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.accent).multiplyScalar(1.3) });
  const group = new THREE.Group();
  b.scene.add(group);
  const add = (geo, mat, x, y, z, { cast = true, ry = 0 } = {}) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const animated = [];

  // Slots along both side walls.
  const slots = [];
  for (const side of ['w', 'e']) {
    const spans = reserve[side] ?? [];
    for (let z = zS - 1.6; z > zN + 1.6; z -= range(rng, 2.6, 3.6)) {
      if (!overlaps(z, spans, 1.2)) slots.push({ side, z });
    }
  }
  const wallX = (side, inset) => (side === 'w' ? x0 + inset : x1 - inset);
  const faceRot = (side) => (side === 'w' ? Math.PI / 2 : -Math.PI / 2);

  for (const slot of slots) {
    if (rng() < 0.3) continue;
    const style = pick(rng, styles);
    const { side, z } = slot;
    switch (style) {
      case 'pillars': {
        add(new THREE.BoxGeometry(0.6, top - y0, 0.6), base, wallX(side, 0.3), y0 + (top - y0) / 2, z);
        add(new THREE.BoxGeometry(0.05, top - y0 - 0.4, 0.05), glow, wallX(side, 0.62), y0 + (top - y0) / 2, z, { cast: false });
        break;
      }
      case 'arches': {
        const ah = Math.min(top - y0 - 0.3, 3.6);
        add(new THREE.BoxGeometry(0.4, ah, 0.4), base, wallX(side, 0.2), y0 + ah / 2, z - 0.9);
        add(new THREE.BoxGeometry(0.4, ah, 0.4), base, wallX(side, 0.2), y0 + ah / 2, z + 0.9);
        add(new THREE.BoxGeometry(0.4, 0.4, 2.2), base, wallX(side, 0.2), y0 + ah, z);
        add(new THREE.BoxGeometry(0.02, ah - 0.3, 1.4), glowSoft, wallX(side, 0.02), y0 + (ah - 0.3) / 2, z, { cast: false });
        break;
      }
      case 'screens': {
        const mat = new THREE.MeshBasicMaterial({ map: screenTexture(theme.accent, rng), toneMapped: false });
        mat.color.setScalar(1.4);
        add(new THREE.PlaneGeometry(1.6, 0.9), mat, wallX(side, 0.03), y0 + range(rng, 1.8, 2.6), z, { cast: false, ry: faceRot(side) });
        break;
      }
      case 'crystals': {
        const n = 3 + Math.floor(rng() * 3);
        const cmat = new THREE.MeshStandardMaterial({
          color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.1,
          transparent: true, opacity: 0.85,
        });
        for (let i = 0; i < n; i++) {
          const s = range(rng, 0.25, 0.8);
          const m = add(new THREE.OctahedronGeometry(s), cmat, wallX(side, range(rng, 0.4, 1.0)), y0 + s * 0.8, z + range(rng, -0.7, 0.7), { cast: false });
          m.scale.y = range(rng, 1.4, 2.4);
          m.rotation.set(range(rng, -0.3, 0.3), rng() * 3, range(rng, -0.3, 0.3));
        }
        break;
      }
      case 'pipes': {
        const r = range(rng, 0.08, 0.16);
        const pipe = add(new THREE.CylinderGeometry(r, r, 2.8, 12), base, wallX(side, r + 0.05), y0 + range(rng, 2.6, Math.max(2.7, top - y0 - 0.5)), z, { cast: false });
        pipe.rotation.x = Math.PI / 2;
        add(new THREE.CylinderGeometry(r, r, top - y0, 12), base, wallX(side, r + 0.05), y0 + (top - y0) / 2, z - 1.4, { cast: false });
        break;
      }
      case 'plants': {
        const pot = new THREE.MeshStandardMaterial({ color: '#7a4a2e', roughness: 0.8 });
        const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.28 + rng() * 0.08, 0.5, 0.32), roughness: 0.7 });
        const x = wallX(side, 0.6);
        add(new THREE.CylinderGeometry(0.35, 0.25, 0.6, 14), pot, x, y0 + 0.3, z);
        const ph = range(rng, 1.2, 2.4);
        if (rng() < 0.5) add(new THREE.ConeGeometry(0.55, ph, 9), leaf, x, y0 + 0.6 + ph / 2, z);
        else {
          add(new THREE.CylinderGeometry(0.05, 0.06, ph * 0.6, 6), pot, x, y0 + 0.6 + ph * 0.3, z);
          add(new THREE.IcosahedronGeometry(0.6, 0), leaf, x, y0 + 0.6 + ph * 0.7, z);
        }
        break;
      }
      case 'shelves': {
        const mat = new THREE.MeshStandardMaterial({ map: bookTexture(rng), roughness: 0.8 });
        add(new THREE.BoxGeometry(0.4, 2.6, 1.8), mat, wallX(side, 0.2), y0 + 1.3, z);
        break;
      }
      case 'statues': {
        const x = wallX(side, 0.6);
        add(new THREE.BoxGeometry(0.8, 1.0, 0.8), base, x, y0 + 0.5, z);
        const smat = new THREE.MeshStandardMaterial({ color: '#d8d8dc', roughness: 0.4, metalness: 0.1 });
        const shapes = [
          new THREE.SphereGeometry(0.3, 18, 12), new THREE.TorusKnotGeometry(0.22, 0.07, 64, 8),
          new THREE.IcosahedronGeometry(0.34, 0), new THREE.CylinderGeometry(0.12, 0.3, 0.9, 12),
        ];
        add(pick(rng, shapes), smat, x, y0 + 1.45, z);
        break;
      }
      case 'beams': {
        if (!cell.hasCeiling) break;
        add(new THREE.BoxGeometry(cell.w, 0.35, 0.3), base, 0, y0 + h - 0.18, z, { cast: false });
        break;
      }
      case 'cables': {
        if (!cell.hasCeiling) break;
        const yTop = y0 + h - 0.1;
        const sag = range(rng, 0.6, 1.4);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x0 + 0.1, yTop, z), new THREE.Vector3(0, yTop - sag, z + 0.4), new THREE.Vector3(x1 - 0.1, yTop, z),
        ]);
        add(new THREE.TubeGeometry(curve, 24, 0.035, 6), glowSoft, 0, 0, 0, { cast: false });
        break;
      }
      case 'floating': {
        const shapes = [new THREE.TorusGeometry(0.4, 0.1, 12, 32), new THREE.OctahedronGeometry(0.45), new THREE.IcosahedronGeometry(0.4, 0), new THREE.TetrahedronGeometry(0.5)];
        const fmat = new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.25 });
        const y = Math.max(y0 + 2.8, top - 1.2 - rng() * 1.2);
        const m = add(pick(rng, shapes), fmat, wallX(side, range(rng, 0.8, 1.6)), y, z, { cast: false });
        animated.push({ m, y, phase: rng() * 6, spin: range(rng, 0.2, 0.7) });
        break;
      }
    }
  }

  if (animated.length) {
    let t = 0;
    b.updaters.push((dt) => {
      t += dt;
      for (const a of animated) {
        a.m.rotation.x += dt * a.spin;
        a.m.rotation.y += dt * a.spin * 0.7;
        a.m.position.y = a.y + Math.sin(t * 0.8 + a.phase) * 0.15;
      }
    });
  }
}

function sigilTexture(color, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  g.strokeStyle = color;
  g.globalAlpha = 0.55;
  g.lineWidth = 6;
  const n = 3 + Math.floor(rng() * 5);
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(128, 128, 70 + rng() * 30, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 * (rng() < 0.5 ? 1 : 2);
    const x = 128 + Math.cos(a) * 118, y = 128 + Math.sin(a) * 118;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A landmark for the room: something big hanging or floating overhead, and an
// inlaid sigil on the floor. Visual only; kept high and out of the way.
export function centerpiece(b, cell, rng) {
  const theme = b.theme;
  const { y0, h, zS, zN } = cell;
  const cz = (zS + zN) / 2 + range(rng, -2, 2);
  const y = y0 + h - 1.3;
  const group = new THREE.Group();
  group.position.set(range(rng, -1.5, 1.5), y, cz);
  b.scene.add(group);
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.accent).multiplyScalar(1.6) });
  const metal = new THREE.MeshStandardMaterial({ color: theme.wallLine, metalness: 0.7, roughness: 0.3 });
  const kind = h < 5.2 ? 'inlay' : pick(rng, ['chandelier', 'rings', 'monolith', 'orbs', 'inlay']);
  let spin = 0;
  if (kind === 'chandelier') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 48), metal);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glow);
      bulb.position.set(Math.cos(a) * 1.1, -0.12, Math.sin(a) * 1.1);
      group.add(bulb);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), metal);
    chain.position.y = 0.65;
    group.add(chain);
    spin = 0.15;
  } else if (kind === 'rings') {
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.28, 0.035, 8, 48), i === 1 ? glow : metal);
      r.rotation.set(rng() * 3, rng() * 3, 0);
      r.userData.spin = (rng() - 0.5) * 1.2;
      group.add(r);
    }
  } else if (kind === 'monolith') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.18), metal);
    group.add(m);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.2), glow);
    edge.position.y = -0.4;
    group.add(edge);
    spin = 0.25;
  } else if (kind === 'orbs') {
    for (let i = 0; i < 5; i++) {
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + rng() * 0.14, 1), i % 2 ? glow : metal);
      o.position.set(range(rng, -1.2, 1.2), range(rng, -0.5, 0.4), range(rng, -1.2, 1.2));
      group.add(o);
    }
    spin = 0.2;
  }
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
    map: sigilTexture(theme.accent, rng), transparent: true, depthWrite: false, toneMapped: false,
  }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(group.position.x, y0 + 0.008, cz);
  const overPit = cell.floorGaps?.some(([lo, hi]) => cz > lo - 1.7 && cz < hi + 1.7);
  if (rng() < 0.7 && !overPit) b.scene.add(inlay);
  if (kind === 'inlay') return;
  let t = rng() * 10;
  b.updaters.push((dt) => {
    t += dt;
    group.rotation.y += dt * spin;
    group.position.y = y + Math.sin(t * 0.6) * 0.06;
    for (const c of group.children) if (c.userData.spin) c.rotation.y += dt * c.userData.spin;
  });
}
