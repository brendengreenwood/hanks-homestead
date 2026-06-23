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

export const CROPS = {
  wheat: { name: 'Wheat', growTime: 1, seedPrice: 10, sellPrice: 25, color: '#7D9A4B', matureColor: '#DAA520', icon: '🌾' },
  carrot: { name: 'Carrot', growTime: 1, seedPrice: 15, sellPrice: 40, color: '#228B22', matureColor: '#32CD32', icon: '🥕' },
  tomato: { name: 'Tomato', growTime: 1, seedPrice: 20, sellPrice: 55, color: '#2E8B2E', matureColor: '#DC143C', icon: '🍅' },
  corn: { name: 'Corn', growTime: 1, seedPrice: 25, sellPrice: 75, color: '#6B8E23', matureColor: '#F4D03F', icon: '🌽' },
  pumpkin: { name: 'Pumpkin', growTime: 1, seedPrice: 40, sellPrice: 120, color: '#2E7D32', matureColor: '#FF7518', icon: '🎃' },
};

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

export const seasonForDay = (day) => SEASON_ORDER[(day - 1) % 4];

// Fresh empty grid cell
export const emptyCell = () => ({ crop: null, growth: 0, watered: false, fed: false, harvestPenalty: false });

export const makeGrid = () =>
  Array(WORLD_SIZE)
    .fill(null)
    .map(() => Array(WORLD_SIZE).fill(null).map(() => emptyCell()));
