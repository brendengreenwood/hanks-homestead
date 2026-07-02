// ============================================
// GAME CONSTANTS
// Pure data — shared by logic, 3D scene, and HUD.
// ============================================

export const FIELD_SIZE = 10; // Farmable area (FIELD_SIZE x FIELD_SIZE)
export const WORLD_SIZE = 36; // Total world grid
export const FIELD_OFFSET = 13; // Field starts here (centered in world)

export const BUILDINGS = {
  barn: { name: 'Barn', color: '#b0402c', width: 2, height: 2 },
  house: { name: "Hank's House", color: '#e8dcc0', width: 2, height: 2 },
  silo: { name: 'Silo', color: '#9CA3AF', width: 1, height: 1 },
};

export const SEASONS = {
  spring: {
    name: 'Spring',
    icon: '🌸',
    sky: { top: '#4A90D9', bottom: '#87CEEB', horizon: '#C5E8C5' },
    grass: '#5C8A3D',
    light: '#FFF6E0',
    ui: { primary: '#22C55E', secondary: '#16A34A', bg: 'rgba(34, 197, 94, 0.2)', border: '#15803D' },
  },
  summer: {
    name: 'Summer',
    icon: '☀️',
    sky: { top: '#1E90FF', bottom: '#87CEEB', horizon: '#F0E68C' },
    grass: '#4A7C23',
    light: '#FFF1C9',
    ui: { primary: '#EAB308', secondary: '#CA8A04', bg: 'rgba(234, 179, 8, 0.2)', border: '#A16207' },
  },
  fall: {
    name: 'Fall',
    icon: '🍂',
    sky: { top: '#6B8CAE', bottom: '#B8A590', horizon: '#D4A574' },
    grass: '#9B8B5A',
    light: '#FFE2B8',
    ui: { primary: '#F97316', secondary: '#EA580C', bg: 'rgba(249, 115, 22, 0.2)', border: '#C2410C' },
  },
  winter: {
    name: 'Winter',
    icon: '❄️',
    sky: { top: '#5B7C99', bottom: '#A8C0D4', horizon: '#D4E5F7' },
    grass: '#7A8B6E',
    light: '#E6F0FF',
    ui: { primary: '#3B82F6', secondary: '#2563EB', bg: 'rgba(59, 130, 246, 0.2)', border: '#1D4ED8' },
  },
};

export const COLORS = {
  soil: { dry: '#8B5A2B', wet: '#5C4033', furrow: '#6B4423' },
  wood: { light: '#DEB887', medium: '#B8860B', dark: '#8B4513' },
  ui: {
    panel: '#F5F0E6',
    panelBorder: '#8B7355',
    text: '#4A3728',
    textLight: '#8B7355',
    gold: '#D4A017',
    green: '#22C55E',
    red: '#DC2626',
    blue: '#3B82F6',
  },
};

// growTime is in DAYS of growth needed to ripen. Spring rain grows crops for
// free; summer days only count when the soil has moisture (so you must water).
// Tuned so spring growth alone isn't enough — summer watering is required.
// sellPrice is the long-run mean the market reverts to. shelfLife = days a full
// batch survives in storage before it's gone (grain keeps; produce spoils fast).
//
// Each crop has a sim-tuned niche (fed profit/tile at its optimal sell day):
//   wheat   — carry anchor: infinite shelf, sell the spring peak; cheap, safe.
//   carrot  — budget produce: shortest summer exposure, modest fall cash.
//   tomato  — fall cash: best profit-per-gold at harvest, spoils fast.
//   corn    — second carry crop: long shelf, but holding costs real spoilage.
//   pumpkin — per-tile king: capital-gated, thirstiest, perishable fall cash.
export const CROPS = {
  wheat: { name: 'Wheat', growTime: 6, seedPrice: 10, sellPrice: 25, shelfLife: 999, color: '#7D9A4B', matureColor: '#DAA520', icon: '🌾' },
  carrot: { name: 'Carrot', growTime: 7, seedPrice: 14, sellPrice: 42, shelfLife: 14, color: '#228B22', matureColor: '#32CD32', icon: '🥕' },
  tomato: { name: 'Tomato', growTime: 8, seedPrice: 18, sellPrice: 62, shelfLife: 6, color: '#2E8B2E', matureColor: '#DC143C', icon: '🍅' },
  corn: { name: 'Corn', growTime: 9, seedPrice: 30, sellPrice: 60, shelfLife: 60, color: '#6B8E23', matureColor: '#F4D03F', icon: '🌽' },
  pumpkin: { name: 'Pumpkin', growTime: 9, seedPrice: 55, sellPrice: 112, shelfLife: 12, color: '#2E7D32', matureColor: '#FF7518', icon: '🎃' },
};

// Plant food: gold per application (+1 yield on that tile unless it withers).
// Priced so feeding is a per-crop unit-economics call, not a free double.
export const FEED_COST = 12;

// Scorcher days: each summer day has this chance of extra evaporation (soil
// dries 2 instead of 1 that day). Punishes a lazy watering cadence and gives
// sprinklers their insurance value.
export const SCORCH_CHANCE = 0.3;

// ---- Market ----------------------------------------------------------------
export const PRICE_AMP = 0.35; // seasonal swing (±35% around the mean)
export const PRICE_HISTORY_LEN = 24; // days of history kept for the chart
// Seasonal supply cycle: prices bottom in fall (harvest glut) and peak in
// spring (lean season before the next harvest).
export const seasonalPriceFactor = (day) => {
  const yearLen = SEASON_LENGTH * 4;
  const doy = (day - 1) % yearLen;
  return 1 + PRICE_AMP * Math.cos((2 * Math.PI * (doy - SEASON_LENGTH * 0.5)) / yearLen);
};
export const initialPrices = () =>
  Object.fromEntries(Object.entries(CROPS).map(([id, c]) => [id, Math.round(c.sellPrice * seasonalPriceFactor(1))]));
export const initialPriceHistory = () => Object.fromEntries(Object.keys(CROPS).map((id) => [id, []]));

// How many days one watering keeps the soil moist.
export const WATER_DAYS = 3;

// Storage: harvested crops fill the silo(s). Capacity scales with how many silo
// buildings you own plus any bought from the Farm Supply store.
export const BASE_STORAGE = 40;
export const SILO_CAPACITY = 60;

// ---- Progression / Farm Supply --------------------------------------------
export const ROWS_PER_PLOT = 2; // extra farmland rows per plot purchased
export const UPGRADES = {
  tractor: { name: 'Tractor', icon: '🚜', max: 3, baseCost: 300, growth: 1.7, desc: 'Hank works faster' },
  sprinkler: { name: 'Sprinklers', icon: '💧', max: 1, baseCost: 500, growth: 2, desc: 'Auto-waters thirsty crops — scorcher insurance (small daily cost)' },
  silo: { name: 'Silo', icon: '🏗️', max: 6, baseCost: 220, growth: 1.55, desc: `+${SILO_CAPACITY} storage` },
  plot: { name: 'Field Plot', icon: '🟫', max: 6, baseCost: 180, growth: 1.5, desc: `+${ROWS_PER_PLOT} rows of farmland` },
};
// Operating cost: gold per crop the sprinklers water each summer day. Automation
// saves the manual watering, but the running cost eats your margin — your call.
export const SPRINKLER_COST_PER_TILE = 1;

// ---- Forward contracts -----------------------------------------------------
// Commit to deliver a quantity of a crop by a future day for a locked price
// (a premium over the mean — a hedge against a price crash, but you must
// deliver or pay a penalty).
export const CONTRACT_SLOTS = 3;
export const CONTRACT_PENALTY = 0.25; // fraction of contract value forfeited on default
export const upgradeCost = (key, level) => Math.round(UPGRADES[key].baseCost * Math.pow(UPGRADES[key].growth, level));
export const fieldHeight = (upgrades) => FIELD_SIZE + (upgrades?.plot || 0) * ROWS_PER_PLOT;
// Faster action/step timing as the tractor levels up.
export const speedFactor = (upgrades) => 1 + (upgrades?.tractor || 0) * 0.6;
export const storedTotal = (inventory) =>
  Object.keys(CROPS).reduce((sum, id) => sum + (inventory[id] || 0), 0);

export const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_ACTIONS = {
  spring: [{ id: 'plant', name: 'Plant', icon: '🌱' }],
  summer: [
    { id: 'water', name: 'Water', icon: '💧' },
    { id: 'clean', name: 'Feed', icon: '🧪' },
  ],
  fall: [{ id: 'harvest', name: 'Harvest', icon: '✂️' }],
  winter: [{ id: 'sell', name: 'Sell', icon: '💰' }],
};

// Calendar: each season spans SEASON_LENGTH days; 4 seasons make a year.
// Tunable — start short so days aren't empty; lengthen toward ~14 once storage
// and the dynamic market give in-season days purpose.
export const SEASON_LENGTH = 6;
export const seasonForDay = (day) => SEASON_ORDER[Math.floor((day - 1) / SEASON_LENGTH) % 4];
export const yearForDay = (day) => Math.floor((day - 1) / (SEASON_LENGTH * 4)) + 1;
export const dayOfSeason = (day) => ((day - 1) % SEASON_LENGTH) + 1;

// Fresh empty grid cell
export const emptyCell = () => ({ crop: null, growth: 0, moisture: 0, watered: false, fed: false, harvestPenalty: false });

export const makeGrid = () =>
  Array(WORLD_SIZE)
    .fill(null)
    .map(() => Array(WORLD_SIZE).fill(null).map(() => emptyCell()));
