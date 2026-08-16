import * as THREE from 'three';
import { Loop } from 'omen/core/Loop';
import { createRenderer } from 'omen/core/Renderer';
import { CAMERA_FAR, CAMERA_NEAR, CAMERA_POSITION, CAMERA_ZOOM, gridToWorld } from './constants';
import { createFarmWorld } from './sim/world';
import { plant, water, feed, harvest } from './sim/actions';
import { FarmScene } from './scene/FarmScene';
import { Hud } from './ui/hud';

declare global {
  interface Window {
    __THREE_GAME_DIAGNOSTICS__?: {
      frame: number;
      /** Grid → CSS-pixel canvas coords, so proof flows can aim real clicks. */
      worldToScreen?: (gridX: number, gridY: number) => { x: number; y: number };
    };
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = createRenderer(canvas);

const scene = new THREE.Scene();

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

// Sim + presentation. `?seed=` pins the RNG for reproducible proof flows.
const seedParam = new URLSearchParams(window.location.search).get('seed');
const fw = createFarmWorld(seedParam ? Number(seedParam) : 42);
const farmScene = new FarmScene(scene, fw);
const hud = new Hud(fw);

function refresh(): void {
  farmScene.sync();
  hud.render();
}

hud.onChanged = refresh;
hud.onEndDay = () => {
  const report = fw.endDay();
  refresh();
  hud.renderDayReport(report);
};

// Left-click tile picking → active tool action.
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const tile = farmScene.pickTile(ndc, camera);
  if (tile === null) return;
  const result =
    hud.tool === 'plant'
      ? plant(fw, tile, hud.selectedCrop)
      : hud.tool === 'water'
        ? water(fw, tile)
        : hud.tool === 'feed'
          ? feed(fw, tile)
          : harvest(fw, tile);
  if (!result.ok && result.message) hud.showMessage(result.message);
  refresh();
});

const diagnostics = {
  frame: 0,
  worldToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const [wx, wz] = gridToWorld(gridX, gridY);
    const p = new THREE.Vector3(wx, 0, wz).project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((p.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - p.y) / 2) * rect.height,
    };
  },
};
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
