// ============================================
// ASSET REGISTRY — Kenney Nature Kit (CC0)
// https://kenney.nl/assets/nature-kit
//
// The GLB models live in public/models/nature-kit/ (a curated subset of the
// kit — add more files there and reference them here as needed). The 3D scene
// renders a procedural placeholder for any entity whose model is null/missing,
// so the game stays runnable even if a file is absent.
//
// To disable the art pack entirely (all placeholders), set USE_KENNEY_ASSETS
// to false.
// ============================================

export const USE_KENNEY_ASSETS = true;

export const ASSET_BASE = '/models/nature-kit/';

// Logical entity -> Nature Kit filename (relative to ASSET_BASE).
export const MODELS = {
  // Buildings (nearest stand-ins in the Nature Kit — it has no barn/silo).
  farmhouse: 'tent_detailedOpen.glb',
  silo: 'tent_smallClosed.glb',

  // Farmer: Kenney Mini Characters (CC0) base, dressed up with accessories
  // (straw hat + pitchfork) in the scene. Falls back to the procedural farmer.
  farmer: null,

  // Crops: [growing sprout, mature]. The kit ships real growth-stage props.
  crop: {
    wheat: ['crops_wheatStageA.glb', 'crops_wheatStageB.glb'],
    carrot: ['crops_leafsStageA.glb', 'crop_carrot.glb'],
    tomato: ['crops_leafsStageA.glb', 'flower_redA.glb'], // no tomato model; red stand-in
    corn: ['crops_cornStageA.glb', 'crops_cornStageD.glb'],
    pumpkin: ['crops_leafsStageB.glb', 'crop_pumpkin.glb'],
  },
};

// Per-crop scale + vertical offset so models sit nicely on a 1-unit tile.
export const CROP_TRANSFORM = {
  wheat: { scale: 0.62, y: 0 },
  carrot: { scale: 0.6, y: 0 },
  tomato: { scale: 0.55, y: 0 },
  corn: { scale: 0.6, y: 0 },
  pumpkin: { scale: 0.6, y: 0 },
};

// Decorative scatter around the farm (grid-agnostic world coords, origin-centered).
// Keeps clear of the field interior (|x|,|z| < ~5) and the buildings.
export const DECORATIONS = [
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

// Farmer character (Kenney Mini Characters, CC0) — lives in its own folder since
// it's a different kit. It's dressed up in FarmScene with a procedural straw hat
// and pitchfork to read as a farmer. scale/y/rot tune the character to stand
// ~1 tile tall, feet on the ground; accessory pos/rot are in farmer-group world
// units (origin at the farmer's feet). Tweak these to taste.
// Model is ~0.67 units tall at scale 1 with feet at y=0; scale ~1.4 => ~0.94 tall.
// If the character faces away from its travel direction, set rot to Math.PI.
export const FARMER = {
  model: USE_KENNEY_ASSETS ? '/models/characters/character-male-a.glb' : null,
  scale: 1.4,
  y: 0,
  rot: 0,
  hat: { pos: [0, 0.9, 0], rot: [0, 0, 0] },
  pitchfork: { pos: [0.33, 0, 0.04], rot: [0, 0, 0.06] },
};

// Resolve a logical key to a full URL, or null when assets are disabled/unmapped.
export const modelUrl = (file) => {
  if (!USE_KENNEY_ASSETS || !file) return null;
  return ASSET_BASE + file;
};

export const cropModelUrl = (cropId, isMature) => {
  const entry = MODELS.crop[cropId];
  if (!entry) return null;
  return modelUrl(entry[isMature ? 1 : 0]);
};
