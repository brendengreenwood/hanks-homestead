import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EntityId } from 'omen/ecs/types';
import type { FarmWorld } from '../sim/world';
import { CROPS, SEASONS, FIELD_SIZE, FIELD_OFFSET } from '../sim/constants';
import { gridToWorld } from '../constants';
import {
  buildBarn,
  buildSilo,
  buildHouse,
  buildChicken,
  buildStrawHat,
  buildPitchfork,
  buildProceduralFarmer,
  HOUSE_CHIMNEY_TOP,
} from './props';
import {
  DECORATIONS,
  CROP_TRANSFORM,
  cropModelUrl,
  modelUrl,
  fileScaleFromUrl,
  allCropModelUrls,
  FARMER,
} from '../assets';

// Building placements — ported from legacy Game.jsx initial state + BUILDINGS
// table in constants.js. Presentation-only props (no sim role).
const BUILDING_PLACEMENTS: { build: () => THREE.Group; x: number; y: number; w: number; h: number }[] = [
  { build: buildBarn, x: FIELD_OFFSET - 3, y: FIELD_OFFSET, w: 2, h: 2 },
  { build: buildHouse, x: FIELD_OFFSET - 3, y: FIELD_OFFSET + 7, w: 2, h: 2 },
  { build: buildSilo, x: FIELD_OFFSET + FIELD_SIZE + 1, y: FIELD_OFFSET + 2, w: 1, h: 1 },
];

// Chicken barnyard — legacy FarmScene.jsx values.
const CHICKEN_HOME = { x: -7.2, z: -1.0 };
const CHICKEN_COUNT = 5;
const YARD_R = 1.9;
const FLEE_R = 2.3;

interface ChickenState {
  x: number;
  z: number;
  tx: number;
  tz: number;
  dir: number;
  wait: number;
  phase: number;
  group: THREE.Group;
}

const SOIL_DRY = new THREE.Color('#a9834f');
const SOIL_WET = new THREE.Color('#6e4f2a');

/**
 * FarmScene — imperative three.js presentation of the sim world, rendered
 * through the omen Renderer/Loop (replaces the legacy r3f FarmScene.jsx).
 *
 * GLBs load async through a shared cache; until a model resolves (or if it
 * fails) crops render as procedural placeholder cones, so a missing asset
 * never blanks the scene — same contract as the legacy error boundaries.
 */
export class FarmScene {
  private readonly gltfLoader = FarmScene.makeLoader();

  /**
   * The Kenney Mini Characters GLB references an external Textures/colormap.png
   * that was never shipped with the kit's GLB export (the model renders with
   * vertex/material colors). Resolve it to a 1×1 white pixel so the load is
   * clean instead of logging a texture error every boot.
   */
  private static makeLoader(): GLTFLoader {
    const WHITE_PIXEL =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => (url.endsWith('colormap.png') ? WHITE_PIXEL : url));
    return new GLTFLoader(manager);
  }
  private readonly modelCache = new Map<string, Promise<THREE.Group | null>>();
  private readonly tileMeshes = new Map<EntityId, THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>>();
  private readonly cropGroups = new Map<EntityId, { group: THREE.Group; key: string }>();
  private readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private readonly raycaster = new THREE.Raycaster();
  private static readonly soilGeometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);

  // Living props (per-frame animated in update()).
  private readonly chickens: ChickenState[] = [];
  private readonly smokePuffs: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>; t: number }[] = [];
  private smokeOrigin = new THREE.Vector3();
  private readonly farmerGroup = new THREE.Group();
  private farmerTarget = new THREE.Vector3();
  private farmerMixer: THREE.AnimationMixer | null = null;
  private farmerActions: Record<string, THREE.AnimationAction> = {};
  private farmerCurrent: string | null = null;
  private farmerInteracting = false;
  private farmerStride = 0;
  private farmerMoveAmt = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly fw: FarmWorld,
  ) {
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 64),
      new THREE.MeshLambertMaterial({ color: '#6fae4e' }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    // Soil tiles are created lazily in sync() so rows spawned later (plot
    // upgrades) get meshes too.

    // Perimeter decorations (registry-driven, fallback-safe).
    for (const d of DECORATIONS) {
      const url = modelUrl(d.model);
      if (!url) continue;
      void this.loadModel(url).then((model) => {
        if (!model) return;
        const inst = model.clone(true);
        inst.position.set(d.x, 0, d.z);
        inst.scale.setScalar(d.s * fileScaleFromUrl(url));
        inst.rotation.y = d.r;
        this.scene.add(inst);
      });
    }

    // Preload every crop stage so stage swaps don't flash placeholders.
    for (const url of allCropModelUrls()) void this.loadModel(url);

    // Buildings — barn, Hank's house, silo (legacy placements, footprint-centered).
    for (const b of BUILDING_PLACEMENTS) {
      const [wx, wz] = gridToWorld(b.x, b.y);
      const g = b.build();
      g.position.set(wx + (b.w - 1) / 2, 0, wz + (b.h - 1) / 2);
      scene.add(g);
      if (b.build === buildHouse) {
        this.smokeOrigin = new THREE.Vector3(
          g.position.x + HOUSE_CHIMNEY_TOP[0],
          HOUSE_CHIMNEY_TOP[1],
          g.position.z + HOUSE_CHIMNEY_TOP[2],
        );
        for (let i = 0; i < 3; i++) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshStandardMaterial({
              color: '#d8d4cc',
              transparent: true,
              opacity: 0.4,
              depthWrite: false,
              flatShading: true,
            }),
          );
          puff.position.copy(this.smokeOrigin);
          scene.add(puff);
          this.smokePuffs.push({ mesh: puff, t: i / 3 });
        }
      }
    }

    // Chickens — wander the barnyard, scatter when Hank gets close.
    for (let i = 0; i < CHICKEN_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * YARD_R * 0.8;
      const x = CHICKEN_HOME.x + Math.cos(a) * r;
      const z = CHICKEN_HOME.z + Math.sin(a) * r;
      const group = buildChicken();
      group.position.set(x, 0, z);
      scene.add(group);
      this.chickens.push({
        x, z, tx: x, tz: z,
        dir: Math.random() * Math.PI * 2,
        wait: Math.random() * 2,
        phase: Math.random() * 10,
        group,
      });
    }

    // Hank — Kenney Mini Character GLB with hat + pitchfork bone-attached;
    // procedural fallback if the model fails to load.
    const [fx, fz] = gridToWorld(FIELD_OFFSET + 4, FIELD_OFFSET + 4);
    this.farmerGroup.position.set(fx, 0, fz);
    this.farmerTarget.set(fx, 0, fz);
    scene.add(this.farmerGroup);
    const fallback = buildProceduralFarmer();
    this.farmerGroup.add(fallback);
    if (FARMER.model) {
      this.gltfLoader
        .loadAsync(FARMER.model)
        .then((gltf) => {
          this.farmerGroup.remove(fallback);
          const model = gltf.scene;
          model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          model.scale.setScalar(FARMER.scale);
          this.farmerGroup.add(model);

          const headBone = model.getObjectByName(FARMER.hat.bone);
          if (headBone) {
            const hat = buildStrawHat();
            hat.position.set(...FARMER.hat.pos);
            hat.scale.setScalar(FARMER.hat.scale);
            headBone.add(hat);
          }
          const handBone = model.getObjectByName(FARMER.pitchfork.bone);
          if (handBone) {
            const fork = buildPitchfork();
            fork.position.set(...FARMER.pitchfork.pos);
            fork.scale.setScalar(FARMER.pitchfork.scale);
            handBone.add(fork);
          }

          if (gltf.animations.length > 0) {
            this.farmerMixer = new THREE.AnimationMixer(model);
            for (const clip of gltf.animations) {
              this.farmerActions[clip.name] = this.farmerMixer.clipAction(clip);
            }
            this.farmerMixer.addEventListener('finished', (e) => {
              if (e.action === this.farmerActions['interact-right']) {
                this.farmerInteracting = false;
                this.farmerCurrent = null; // force a fresh idle/walk fade-in
              }
            });
          }
        })
        .catch(() => undefined); // fallback stays
    }

    this.sync();
  }

  /** Walk Hank to a tile and play the one-shot interact gesture on arrival intent. */
  notifyAction(tile: EntityId): void {
    const t = this.fw.world.get(tile, this.fw.components.Tile);
    if (!t) return;
    this.farmerTarget.set(t.worldX, 0, t.worldZ);
    const act = this.farmerActions['interact-right'];
    if (act) {
      if (this.farmerCurrent) this.farmerActions[this.farmerCurrent]?.fadeOut(0.1);
      this.farmerCurrent = null;
      this.farmerInteracting = true;
      act.reset();
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = false;
      act.fadeIn(0.05).play();
    }
  }

  /** Per-frame animation: chickens, chimney smoke, Hank's glide + anims. */
  update(dt: number): void {
    const step = Math.min(dt, 0.05); // guard against big tab-out jumps

    // Hank: eased glide toward the target tile.
    const g = this.farmerGroup;
    const px = g.position.x;
    const pz = g.position.z;
    g.position.x = THREE.MathUtils.damp(g.position.x, this.farmerTarget.x, 9, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, this.farmerTarget.z, 9, dt);
    const stepDist = Math.hypot(g.position.x - px, g.position.z - pz);
    const remaining = Math.hypot(this.farmerTarget.x - g.position.x, this.farmerTarget.z - g.position.z);
    const moving = remaining > 0.015;
    if (moving) {
      const target = Math.atan2(this.farmerTarget.x - g.position.x, this.farmerTarget.z - g.position.z);
      let d = target - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.y += d * (1 - Math.exp(-11 * dt));
    }
    this.farmerMoveAmt = THREE.MathUtils.damp(this.farmerMoveAmt, moving ? 1 : 0, 14, dt);
    this.farmerStride += stepDist * 16;
    g.position.y = Math.abs(Math.sin(this.farmerStride)) * 0.045 * this.farmerMoveAmt;

    if (this.farmerMixer) {
      this.farmerMixer.update(dt);
      if (!this.farmerInteracting) {
        const names = Object.keys(this.farmerActions);
        const want = moving && this.farmerActions.walk ? 'walk' : this.farmerActions.idle ? 'idle' : names[0];
        if (want && want !== this.farmerCurrent) {
          this.farmerActions[want]?.reset().fadeIn(0.2).play();
          if (this.farmerCurrent) this.farmerActions[this.farmerCurrent]?.fadeOut(0.2);
          this.farmerCurrent = want;
        }
      }
    }

    // Chickens: wander the yard, flee from Hank.
    const fx = g.position.x;
    const fz = g.position.z;
    for (const c of this.chickens) {
      const dfx = c.x - fx;
      const dfz = c.z - fz;
      const df = Math.hypot(dfx, dfz);
      let speed: number;
      let cMoving = true;
      if (df < FLEE_R) {
        const inv = 1 / (df || 0.001);
        c.tx = c.x + dfx * inv;
        c.tz = c.z + dfz * inv;
        speed = 2.5;
        c.wait = 0.4 + Math.random() * 0.6;
      } else {
        c.wait -= step;
        const reached = Math.hypot(c.tx - c.x, c.tz - c.z) < 0.12;
        if (reached && c.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * YARD_R;
          c.tx = CHICKEN_HOME.x + Math.cos(a) * r;
          c.tz = CHICKEN_HOME.z + Math.sin(a) * r;
          c.wait = 0.8 + Math.random() * 2.6;
        }
        cMoving = !reached;
        speed = 0.65;
      }
      if (cMoving) {
        const dx = c.tx - c.x;
        const dz = c.tz - c.z;
        const d = Math.hypot(dx, dz) || 1;
        const s = Math.min(speed * step, d);
        c.x += (dx / d) * s;
        c.z += (dz / d) * s;
        c.dir = Math.atan2(dx, dz);
        c.phase += speed * step * 16;
      }
      // keep them in the yard (slightly looser when fleeing)
      const hx = c.x - CHICKEN_HOME.x;
      const hz = c.z - CHICKEN_HOME.z;
      const hd = Math.hypot(hx, hz);
      const maxR = YARD_R + 0.7;
      if (hd > maxR) {
        c.x = CHICKEN_HOME.x + (hx / hd) * maxR;
        c.z = CHICKEN_HOME.z + (hz / hd) * maxR;
      }
      c.group.position.set(c.x, cMoving ? Math.abs(Math.sin(c.phase)) * 0.05 : 0, c.z);
      let dd = c.dir - c.group.rotation.y;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      c.group.rotation.y += dd * (1 - Math.exp(-(df < FLEE_R ? 16 : 8) * step));
    }

    // Chimney smoke: three recycling puffs drifting upward.
    for (const p of this.smokePuffs) {
      p.t += dt * 0.32;
      if (p.t > 1) p.t -= 1;
      p.mesh.position.set(
        this.smokeOrigin.x + Math.sin(p.t * 6) * 0.06,
        this.smokeOrigin.y + p.t * 0.95,
        this.smokeOrigin.z,
      );
      p.mesh.scale.setScalar(0.05 + p.t * 0.13);
      p.mesh.material.opacity = (1 - p.t) * 0.5;
    }
  }

  private loadModel(url: string): Promise<THREE.Group | null> {
    let p = this.modelCache.get(url);
    if (!p) {
      p = this.gltfLoader
        .loadAsync(url)
        .then((gltf) => {
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) o.castShadow = true;
          });
          return gltf.scene;
        })
        .catch(() => null); // fallback placeholder handles it
      this.modelCache.set(url, p);
    }
    return p;
  }

  private static placeholder(color: string): THREE.Group {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.5, 6),
      new THREE.MeshLambertMaterial({ color }),
    );
    cone.position.y = 0.25;
    cone.castShadow = true;
    g.add(cone);
    return g;
  }

  /** Sync scene to sim state — call after any sim mutation. */
  sync(): void {
    const { world, components } = this.fw;
    const season = SEASONS[this.fw.calendar.season];
    this.scene.background = new THREE.Color(season.sky.bottom);
    this.ground.material.color.set(season.grass);

    const live = new Set<EntityId>();
    for (const e of world.query(components.Tile)) {
      const t = world.get(e, components.Tile)!;
      let mesh = this.tileMeshes.get(e);
      if (!mesh) {
        mesh = new THREE.Mesh(
          FarmScene.soilGeometry,
          new THREE.MeshLambertMaterial({ color: SOIL_DRY }),
        );
        mesh.position.set(t.worldX, 0, t.worldZ);
        mesh.receiveShadow = true;
        mesh.userData.tile = e;
        this.scene.add(mesh);
        this.tileMeshes.set(e, mesh);
      }
      mesh.material.color.copy(t.watered ? SOIL_WET : SOIL_DRY);

      const crop = world.get(e, components.Crop);
      if (crop) {
        live.add(e);
        const def = CROPS[crop.crop];
        const mature = crop.growth >= def.growTime;
        const progress = Math.min(1, crop.growth / def.growTime);
        const url = cropModelUrl(crop.crop, progress, mature);
        const key = `${crop.crop}:${url}:${crop.harvestPenalty}`;
        const existing = this.cropGroups.get(e);
        if (existing?.key === key) continue;
        if (existing) this.scene.remove(existing.group);

        const group = new THREE.Group();
        const tf = CROP_TRANSFORM[crop.crop];
        group.position.set(mesh.position.x, 0.05 + tf.y, mesh.position.z);
        this.scene.add(group);
        this.cropGroups.set(e, { group, key });

        const fallback = FarmScene.placeholder(crop.harvestPenalty ? '#8a7a4a' : '#3f8f3f');
        group.add(fallback);
        if (url) {
          void this.loadModel(url).then((model) => {
            // Bail if the crop changed/was harvested while loading.
            if (this.cropGroups.get(e)?.group !== group || !model) return;
            group.remove(fallback);
            const inst = model.clone(true);
            inst.scale.setScalar(tf.scale * fileScaleFromUrl(url));
            if (crop.harvestPenalty) {
              inst.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                  const m = (o.material as THREE.MeshStandardMaterial).clone();
                  m.color.multiplyScalar(0.6);
                  o.material = m;
                }
              });
            }
            group.add(inst);
          });
        }
      }
    }
    // Remove visuals for harvested/cleared crops.
    for (const [e, entry] of this.cropGroups) {
      if (!live.has(e)) {
        this.scene.remove(entry.group);
        this.cropGroups.delete(e);
      }
    }
  }

  /** Raycast pick: NDC pointer coords → tile entity, or null. */
  pickTile(ndc: THREE.Vector2, camera: THREE.Camera): EntityId | null {
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects([...this.tileMeshes.values()], false);
    return hits.length > 0 ? (hits[0].object.userData.tile as EntityId) : null;
  }

  /** Field size, exposed for tests/debug overlays. */
  static readonly FIELD_SIZE = FIELD_SIZE;
}
