// ============================================
// ASSET REGISTRY — Kenney Nature Kit (CC0)
// https://kenney.nl/assets/nature-kit
//
// HOW THE ASSET SWAP WORKS
// ------------------------
// The 3D scene renders a placeholder (procedural primitive) for every entity
// UNLESS a model is registered here AND `USE_KENNEY_ASSETS` is true. To migrate
// to the real Nature Kit art:
//
//   1. Download the Nature Kit, extract the GLB models into:
//        public/models/nature-kit/*.glb
//   2. Confirm the filenames below match the files you extracted (Kenney ships
//      files like `tree_default.glb`, `rock_largeA.glb`, `grass.glb`, etc.).
//      Adjust the strings as needed — only the strings change, never the scene.
//   3. Flip USE_KENNEY_ASSETS to true.
//
// Anything left null (or whose file is missing) keeps its placeholder, so the
// game stays runnable at every step of the swap.
//
// NOTE: The Nature Kit is an outdoor/forest pack — it has terrain, trees, rocks,
// plants and fences, but NO farmer character or barn. Those entries point at the
// closest stand-ins (a crate/tent for buildings); replace with a Farm Kit / Mini
// Characters asset later if you want exact matches.
// ============================================

export const USE_KENNEY_ASSETS = false;

export const ASSET_BASE = '/models/nature-kit/';

// Logical entity -> Nature Kit filename (relative to ASSET_BASE).
export const MODELS = {
  // Terrain
  ground_grass: 'ground_grass.glb',
  ground_soil: 'ground_riverOpen.glb', // dry tilled soil stand-in
  ground_soilWet: 'ground_riverOpen.glb',

  // Buildings (nearest stand-ins available in the Nature Kit)
  farmhouse: 'tent_detailedOpen.glb',
  silo: 'crate.glb',

  // Farmer (no character in Nature Kit — placeholder until a character kit is added)
  farmer: null,

  // Crops: [sprout-while-growing, mature]. Mapped to the closest plant props.
  crop: {
    wheat: ['plant_bushSmall.glb', 'grass_large.glb'],
    carrot: ['plant_bushSmall.glb', 'flower_redA.glb'],
    tomato: ['plant_bushSmall.glb', 'flower_redA.glb'],
    corn: ['plant_bushSmall.glb', 'grass_large.glb'],
    pumpkin: ['plant_bushSmall.glb', 'mushroom_redGroup.glb'],
  },
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
