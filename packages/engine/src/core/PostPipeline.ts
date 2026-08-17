import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Subtle edge darkening + a touch of saturation, applied in linear space before tone mapping. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    vignette: { value: 0.28 },
    saturation: { value: 1.06 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(gray), color.rgb, saturation);
      vec2 offset = vUv - 0.5;
      float falloff = smoothstep(0.35, 0.95, dot(offset, offset) * 2.0);
      color.rgb *= 1.0 - vignette * falloff;
      gl_FragColor = color;
    }
  `,
};

/**
 * Optional finishing pass: MSAA HDR target -> subtle bloom -> vignette/grade
 * -> tone mapping + sRGB output. Toggled by the "Fancy graphics" setting;
 * when disabled the game renders directly (Game.render falls back).
 */
export class PostPipeline {
  enabled = false;

  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) {
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x || 1, size.y || 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    // Threshold 1.0: only HDR emissives (lamps, embers) bloom — UI sprites like
    // the white NPC name tags sit at exactly 1.0 luminance and stay crisp.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), 0.32, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  get passCount(): number {
    return this.composer.passes.length;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.bloom.dispose();
  }
}
