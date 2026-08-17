// ============================================
// ASSET REGISTRY — Kenney Nature Kit (CC0)
// Ported verbatim from legacy src/game/assets.js (paths + scales, no re-tuning).
// GLBs live in game/public/models/. The scene renders a procedural placeholder
// for any entity whose model is null/missing.
// ============================================
import type { CropId } from './sim/constants';

export const USE_KENNEY_ASSETS = true;

export const ASSET_BASE = '/models/nature-kit/';

// Farmer: Kenney Mini Characters (CC0) base, dressed up with procedural
// accessories bone-attached so they track every animation. Ported verbatim
// from legacy assets.js.
export const FARMER = {
  model: USE_KENNEY_ASSETS ? '/models/characters/character-male-a.glb' : null,
  scale: 1.4,
  y: 0,
  rot: 0,
  hat: { bone: 'head', pos: [0, 0.12, 0] as const, scale: 0.6 },
  pitchfork: { bone: 'arm-right', pos: [0, -0.18, 0.06] as const, scale: 0.5 },
};

// Crops: ordered growth stages — the LAST entry is the mature model, the
// ones before it are bucketed across the growing phase.
export const CROP_MODELS: Record<CropId, string[]> = {
  wheat: ['crops_wheatStageA.glb', 'crops_wheatStageB.glb'],
  carrot: ['crops_leafsStageA.glb', 'crops_leafsStageB.glb', 'crop_carrot.glb'],
  tomato: ['crops_leafsStageA.glb', 'crops_leafsStageB.glb', 'crop_tomato.glb'], // Kenney Food Kit fruit
  corn: ['crops_cornStageA.glb', 'crops_cornStageB.glb', 'crops_cornStageC.glb', 'crops_cornStageD.glb'],
  pumpkin: ['crops_leafsStageA.glb', 'crops_leafsStageB.glb', 'crop_pumpkin.glb'],
};

// Per-FILE scale overrides for models whose native size differs from the
// Nature Kit crop props (the Food Kit tomato is a small single fruit).
export const FILE_SCALE: Record<string, number> = {
  'crop_tomato.glb': 4.5,
};
export const fileScaleFromUrl = (url: string | null): number => {
  if (!url) return 1;
  const name = url.slice(url.lastIndexOf('/') + 1);
  return FILE_SCALE[name] ?? 1;
};

// Per-crop scale + vertical offset so models sit nicely on a 1-unit tile.
export const CROP_TRANSFORM: Record<CropId, { scale: number; y: number }> = {
  wheat: { scale: 0.62, y: 0 },
  carrot: { scale: 0.6, y: 0 },
  tomato: { scale: 0.55, y: 0 },
  corn: { scale: 0.6, y: 0 },
  pumpkin: { scale: 0.6, y: 0 },
};

// Decorative scatter around the farm (grid-agnostic world coords, origin-centered).
export interface Decoration {
  model: string;
  x: number;
  z: number;
  s: number;
  r: number;
}
export const DECORATIONS: Decoration[] = [
  { model: 'tree_default.glb', x: -8, z: -8, s: 1.4, r: 0.3 },
  { model: 'tree_detailed.glb', x: -10, z: 2, s: 1.5, r: 1.1 },
  { model: 'tree_cone.glb', x: -8.5, z: 8, s: 1.3, r: 2.0 },
  { model: 'tree_default.glb', x: 9, z: -7.5, s: 1.4, r: 0.8 },
  { model: 'tree_detailed.glb', x: 10, z: 6, s: 1.5, r: 2.6 },
  { model: 'tree_cone.glb', x: 7.5, z: 9.5, s: 1.2, r: 1.5 },
  { model: 'tree_default.glb', x: 0, z: -10, s: 1.4, r: 0.5 },
  { model: 'tree_cone.glb', x: 2, z: 10.5, s: 1.3, r: 3.0 },
  { model: 'rock_largeA.glb', x: -6.5, z: -2, s: 1.1, r: 0.4 },
  { model: 'rock_smallB.glb', x: 6.5, z: 1.5, s: 1.0, r: 1.2 },
  { model: 'rock_smallD.glb', x: -3, z: 7.5, s: 1.0, r: 2.2 },
  { model: 'rock_largeA.glb', x: 4.5, z: -8.5, s: 1.0, r: 0.9 },
  { model: 'stump_round.glb', x: -5.5, z: 5.5, s: 1.0, r: 0 },
  { model: 'mushroom_redGroup.glb', x: -6, z: 8.5, s: 1.1, r: 0.6 },
  { model: 'plant_bushLarge.glb', x: 7, z: -3.5, s: 1.1, r: 1.0 },
  { model: 'plant_bush.glb', x: -7.5, z: 1, s: 1.0, r: 2.0 },
  { model: 'grass_large.glb', x: 5.5, z: 6, s: 1.2, r: 0.3 },
  { model: 'grass_leafs.glb', x: -2, z: -7, s: 1.2, r: 1.4 },
  { model: 'flower_yellowA.glb', x: 6, z: 8, s: 1.0, r: 0.7 },
  { model: 'flower_purpleA.glb', x: -9, z: -4, s: 1.0, r: 1.9 },
  { model: 'flower_redA.glb', x: 8.5, z: 3.5, s: 1.0, r: 2.5 },
];

// Resolve a logical key to a full URL, or null when assets are disabled/unmapped.
export const modelUrl = (file: string | null): string | null => {
  if (!USE_KENNEY_ASSETS || !file) return null;
  return ASSET_BASE + file;
};

// Pick the stage model for a crop: mature → last entry; growing → the
// earlier entries bucketed evenly across progress [0..1).
export const cropModelUrl = (
  cropId: CropId,
  progress: number,
  isMature: boolean,
): string | null => {
  const stages = CROP_MODELS[cropId];
  if (!stages || stages.length === 0) return null;
  if (isMature || stages.length === 1) return modelUrl(stages[stages.length - 1]);
  const growing = stages.length - 1;
  const idx = Math.min(growing - 1, Math.floor(progress * growing));
  return modelUrl(stages[idx]);
};

// Every stage URL, for preloading (avoids a placeholder flash on stage swap).
export const allCropModelUrls = (): string[] =>
  [...new Set(Object.values(CROP_MODELS).flat())]
    .map(modelUrl)
    .filter((u): u is string => u !== null);
