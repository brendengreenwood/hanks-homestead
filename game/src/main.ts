import * as THREE from 'three';
import { Loop } from 'omen/core/Loop';
import { createRenderer } from 'omen/core/Renderer';
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CAMERA_ZOOM,
  WORLD_SIZE,
} from './constants';

declare global {
  interface Window {
    __THREE_GAME_DIAGNOSTICS__?: {
      frame: number;
    };
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = createRenderer(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87b5dd'); // sky

// Orthographic iso camera matching the legacy drei rig: drei's `zoom` maps
// viewport pixels to world units, so frustum extents are size/zoom.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(...CAMERA_POSITION);
camera.lookAt(0, 0, 0);

function resize(): boolean {
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const needsResize =
    canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr);
  if (needsResize) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.left = -width / CAMERA_ZOOM / 2;
    camera.right = width / CAMERA_ZOOM / 2;
    camera.top = height / CAMERA_ZOOM / 2;
    camera.bottom = -height / CAMERA_ZOOM / 2;
    camera.updateProjectionMatrix();
  }
  return needsResize;
}

// Lighting: soft ambient + a sun with shadows, in the kit's flat-shaded spirit.
scene.add(new THREE.AmbientLight('#ffffff', 0.7));
const sun = new THREE.DirectionalLight('#fff3d6', 1.6);
sun.position.set(18, 30, 12);
sun.castShadow = true;
scene.add(sun);

// Flat ground plane sized to the world grid — no game logic yet.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
  new THREE.MeshLambertMaterial({ color: '#6fae4e' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const diagnostics = { frame: 0 };
window.__THREE_GAME_DIAGNOSTICS__ = diagnostics;

const loop = new Loop(
  () => {
    resize();
  },
  () => {
    renderer.render(scene, camera);
    diagnostics.frame += 1;
  },
);
loop.start();
