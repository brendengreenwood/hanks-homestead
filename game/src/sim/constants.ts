// Simulation constants — ported VERBATIM from legacy `src/game/constants.js`.
// These values encode the shipped balance pass; any change is a recorded
// deviation per the rewrite plan.

export const FIELD_SIZE = 10; // Farmable area (FIELD_SIZE x FIELD_SIZE)
export const WORLD_SIZE = 36; // Total world grid
export const FIELD_OFFSET = 13; // Field starts here (centered in world)

export type SeasonId = 'spring' | 'summer' | 'fall' | 'winter';

export interface SeasonDef {
  name: string;
  icon: string;
  sky: { top: string; bottom: string; horizon: string };
  grass: string;
  light: string;
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  spring: {
    name: 'Spring',
    icon: '🌸',
    sky: { top: '#4A90D9', bottom: '#87CEEB', horizon: '#C5E8C5' },
    grass: '#5C8A3D',
    light: '#FFF6E0',
  },
  summer: {
    name: 'Summer',
    icon: '☀️',
    sky: { top: '#1E90FF', bottom: '#87CEEB', horizon: '#F0E68C' },
    grass: '#4A7C23',
    light: '#FFF1C9',
  },
  fall: {
    name: 'Fall',
    icon: '🍂',
    sky: { top: '#6B8CAE', bottom: '#B8A590', horizon: '#D4A574' },
    grass: '#9B8B5A',
    light: '#FFE2B8',
  },
  winter: {
    name: 'Winter',
    icon: '❄️',
    sky: { top: '#5B7C99', bottom: '#A8C0D4', horizon: '#D4E5F7' },
    grass: '#7A8B6E',
    light: '#E6F0FF',
  },
};

export type CropId = 'wheat' | 'carrot' | 'tomato' | 'corn' | 'pumpkin';

export interface CropDef {
  name: string;
  /** Days of (watered) growth needed to ripen. */
  growTime: number;
  seedPrice: number;
  /** Long-run mean the market reverts to. */
  sellPrice: number;
  /** Days a full batch survives in storage before it's gone. */
  shelfLife: number;
  color: string;
  matureColor: string;
  icon: string;
}

// Crop niches (from the legacy balance pass):
//   wheat   — carry anchor: infinite shelf, sell the spring peak; cheap, safe.
//   carrot  — budget produce: shortest summer exposure, modest fall cash.
//   tomato  — fall cash: best profit-per-gold at harvest, spoils fast.
//   corn    — second carry crop: long shelf, but holding costs real spoilage.
//   pumpkin — per-tile king: capital-gated, thirstiest, perishable fall cash.
export const CROPS: Record<CropId, CropDef> = {
  wheat: { name: 'Wheat', growTime: 6, seedPrice: 10, sellPrice: 25, shelfLife: 999, color: '#7D9A4B', matureColor: '#DAA520', icon: '🌾' },
  carrot: { name: 'Carrot', growTime: 7, seedPrice: 14, sellPrice: 42, shelfLife: 14, color: '#228B22', matureColor: '#32CD32', icon: '🥕' },
  tomato: { name: 'Tomato', growTime: 8, seedPrice: 18, sellPrice: 62, shelfLife: 6, color: '#2E8B2E', matureColor: '#DC143C', icon: '🍅' },
  corn: { name: 'Corn', growTime: 9, seedPrice: 30, sellPrice: 60, shelfLife: 60, color: '#6B8E23', matureColor: '#F4D03F', icon: '🌽' },
  pumpkin: { name: 'Pumpkin', growTime: 9, seedPrice: 55, sellPrice: 112, shelfLife: 12, color: '#2E7D32', matureColor: '#FF7518', icon: '🎃' },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

// Plant food: gold per application (+1 yield on that tile unless it withers).
export const FEED_COST = 12;

// Scorcher days: each summer day has this chance of extra evaporation (soil
// dries 2 instead of 1 that day).
export const SCORCH_CHANCE = 0.3;

// ---- Market ----------------------------------------------------------------
export const PRICE_AMP = 0.35; // seasonal swing (±35% around the mean)
export const PRICE_HISTORY_LEN = 24; // days of history kept for the chart

// How many days one watering keeps the soil moist.
export const WATER_DAYS = 3;

// Storage.
export const BASE_STORAGE = 40;
export const SILO_CAPACITY = 60;

// ---- Grain elevator intake -------------------------------------------------
export const ELEVATOR_BASE_INTAKE = 25;
export const ELEVATOR_INTAKE_PER_LEVEL = 15;

// ---- Progression / Farm Supply ---------------------------------------------
export const ROWS_PER_PLOT = 2; // extra farmland rows per plot purchased
export const SPRINKLER_COST_PER_TILE = 1;

// ---- Forward contracts -----------------------------------------------------
export const CONTRACT_SLOTS = 3;
export const CONTRACT_PENALTY = 0.25; // fraction of contract value forfeited on default

// ---- Calendar --------------------------------------------------------------
export const SEASON_ORDER: readonly SeasonId[] = ['spring', 'summer', 'fall', 'winter'];
export const SEASON_LENGTH = 6; // days per season; 4 seasons make a year

export const seasonForDay = (day: number): SeasonId =>
  SEASON_ORDER[Math.floor((day - 1) / SEASON_LENGTH) % 4];
export const yearForDay = (day: number): number =>
  Math.floor((day - 1) / (SEASON_LENGTH * 4)) + 1;
export const dayOfSeason = (day: number): number => ((day - 1) % SEASON_LENGTH) + 1;

// Seasonal supply cycle: prices bottom in fall (harvest glut) and peak in
// spring (lean season before the next harvest).
export const seasonalPriceFactor = (day: number): number => {
  const yearLen = SEASON_LENGTH * 4;
  const doy = (day - 1) % yearLen;
  return 1 + PRICE_AMP * Math.cos((2 * Math.PI * (doy - SEASON_LENGTH * 0.5)) / yearLen);
};
