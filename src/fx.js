// Post-processing: bloom (glowing lights, portal rims, signs) and a vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

export function createPost(renderer, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(null, camera);
  // Threshold above 1 so only emissive things (lights, strips, portal rims) glow, not white walls.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.55, 1.05);
  const vignette = new ShaderPass(VignetteShader);
  // darkness must stay at 1.0: above that the shader mixes towards negative
  // colours (blue fringes after tone mapping); below it, towards grey.
  vignette.uniforms.offset.value = 1.15;
  vignette.uniforms.darkness.value = 1.0;
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(vignette);
  composer.addPass(new OutputPass());

  return {
    setScene(scene) {
      renderPass.scene = scene;
    },
    setBloom(strength) {
      bloom.strength = strength;
    },
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
    },
    render() {
      composer.render();
    },
  };
}
