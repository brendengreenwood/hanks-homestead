import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EntityId } from 'omen/ecs/types';
import type { FarmWorld } from '../sim/world';
import { CROPS, SEASONS, FIELD_SIZE } from '../sim/constants';
import {
  DECORATIONS,
  CROP_TRANSFORM,
  cropModelUrl,
  modelUrl,
  fileScaleFromUrl,
  allCropModelUrls,
} from '../assets';

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
  private readonly gltfLoader = new GLTFLoader();
  private readonly modelCache = new Map<string, Promise<THREE.Group | null>>();
  private readonly tileMeshes = new Map<EntityId, THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>>();
  private readonly cropGroups = new Map<EntityId, { group: THREE.Group; key: string }>();
  private readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private readonly raycaster = new THREE.Raycaster();

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

    // Soil tiles: one pickable box per Tile entity.
    const soilGeo = new THREE.BoxGeometry(0.95, 0.1, 0.95);
    for (const e of fw.world.query(fw.components.Tile)) {
      const t = fw.world.get(e, fw.components.Tile)!;
      const mesh = new THREE.Mesh(soilGeo, new THREE.MeshLambertMaterial({ color: SOIL_DRY }));
      mesh.position.set(t.worldX, 0, t.worldZ);
      mesh.receiveShadow = true;
      mesh.userData.tile = e;
      scene.add(mesh);
      this.tileMeshes.set(e, mesh);
    }

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

    this.sync();
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
      const mesh = this.tileMeshes.get(e)!;
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
