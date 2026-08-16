import type { EntityId } from 'omen/ecs/types';
import type { FarmWorld } from './world';
import { spawnFieldRows } from './world';
import {
  CROPS,
  WATER_DAYS,
  BASE_STORAGE,
  SILO_CAPACITY,
  FEED_COST,
  FIELD_OFFSET,
  FIELD_SIZE,
  ROWS_PER_PLOT,
  UPGRADES,
  upgradeCost,
  type CropId,
  type UpgradeId,
} from './constants';

/** Result of a player action — `message` is HUD-facing feedback on failure. */
export interface ActionResult {
  ok: boolean;
  message?: string;
}

const ok: ActionResult = { ok: true };
const fail = (message: string): ActionResult => ({ ok: false, message });

export const storageCapacity = (silos: number, siloUpgrades = 0): number =>
  BASE_STORAGE + (silos + siloUpgrades) * SILO_CAPACITY;

export const storedTotal = (storage: Record<CropId, number>): number =>
  Object.values(storage).reduce((a, b) => a + b, 0);

/**
 * Plant a seed on an empty tile. Legacy rules: spring only, consumes one
 * seed, crop starts at growth 0, unfed, unwithered.
 */
export function plant(fw: FarmWorld, tile: EntityId, cropId: CropId): ActionResult {
  const { world, components } = fw;
  if (fw.calendar.season !== 'spring') return fail('Planting is spring-only.');
  if (!world.has(tile, components.Tile)) return fail('Not farmland.');
  if (world.has(tile, components.Crop)) return fail('Tile already planted.');
  const farm = world.get(fw.farm, components.Farm)!;
  if ((farm.seeds[cropId] ?? 0) <= 0) return fail(`No ${CROPS[cropId].name} seeds.`);
  farm.seeds[cropId] -= 1;
  world.add(tile, components.Crop, {
    crop: cropId,
    growth: 0,
    fed: false,
    harvestPenalty: false,
  });
  return ok;
}

/**
 * Water a planted tile. Legacy rules: summer only, sets moisture to
 * WATER_DAYS and marks the soil watered.
 */
export function water(fw: FarmWorld, tile: EntityId): ActionResult {
  const { world, components } = fw;
  if (fw.calendar.season !== 'summer') return fail('Watering is summer-only.');
  const t = world.get(tile, components.Tile);
  if (!t) return fail('Not farmland.');
  if (!world.has(tile, components.Crop)) return fail('Nothing planted here.');
  if (t.watered) return fail('Already watered.');
  t.moisture = WATER_DAYS;
  t.watered = true;
  return ok;
}

/**
 * Harvest a mature crop into the silo. Legacy rules: fall only, requires
 * growth >= growTime; yield 1 if withered, else 2 if fed, else 1; blocked
 * only when the silo has no room at all — a partial yield is clamped to the
 * remaining space (legacy Game.jsx stores `min(harvestAmount, space)`).
 */
export function harvest(fw: FarmWorld, tile: EntityId): ActionResult {
  const { world, components } = fw;
  if (fw.calendar.season !== 'fall') return fail('Harvest is fall-only.');
  if (!world.has(tile, components.Tile)) return fail('Not farmland.');
  const crop = world.get(tile, components.Crop);
  if (!crop) return fail('Nothing planted here.');
  if (crop.growth < CROPS[crop.crop].growTime) return fail('Not mature yet.');
  const farm = world.get(fw.farm, components.Farm)!;
  const space =
    storageCapacity(farm.silos, farm.upgrades.silo) - storedTotal(farm.storage);
  if (space <= 0) return fail('Silo is full.');
  const yield_ = crop.harvestPenalty ? 1 : crop.fed ? 2 : 1;
  farm.storage[crop.crop] += Math.min(yield_, space);
  world.remove(tile, components.Crop);
  return ok;
}

/**
 * Apply plant food to a planted tile. Legacy rules: summer only, consumes one
 * plant food, +1 yield at harvest unless the crop withers.
 */
export function feed(fw: FarmWorld, tile: EntityId): ActionResult {
  const { world, components } = fw;
  if (fw.calendar.season !== 'summer') return fail('Feeding is summer-only.');
  if (!world.has(tile, components.Tile)) return fail('Not farmland.');
  const crop = world.get(tile, components.Crop);
  if (!crop) return fail('Nothing planted here.');
  if (crop.fed) return fail('Already fed.');
  const farm = world.get(fw.farm, components.Farm)!;
  if (farm.plantFood <= 0) return fail('No plant food.');
  farm.plantFood -= 1;
  crop.fed = true;
  return ok;
}

/** Buy plant food at FEED_COST each (legacy `buyFeed`). */
export function buyFeed(fw: FarmWorld, amount: number): ActionResult {
  const farm = fw.world.get(fw.farm, fw.components.Farm)!;
  const cost = FEED_COST * amount;
  if (farm.gold < cost) return fail('Not enough gold.');
  farm.gold -= cost;
  farm.plantFood += amount;
  return ok;
}

/** Buy seeds at the crop's seedPrice (legacy `buySeeds`). */
export function buySeeds(fw: FarmWorld, cropId: CropId, amount: number): ActionResult {
  const farm = fw.world.get(fw.farm, fw.components.Farm)!;
  const cost = CROPS[cropId].seedPrice * amount;
  if (farm.gold < cost) return fail('Not enough gold.');
  farm.gold -= cost;
  farm.seeds[cropId] += amount;
  return ok;
}

/**
 * Buy a Farm Supply upgrade (legacy `buyUpgrade`): cost scales by level,
 * capped at max. Buying the sprinkler switches it on; buying a plot spawns
 * ROWS_PER_PLOT new farmland rows below the field.
 */
export function buyUpgrade(fw: FarmWorld, key: UpgradeId): ActionResult {
  const farm = fw.world.get(fw.farm, fw.components.Farm)!;
  const lvl = farm.upgrades[key];
  if (lvl >= UPGRADES[key].max) return fail('Already at max level.');
  const cost = upgradeCost(key, lvl);
  if (farm.gold < cost) return fail('Not enough gold!');
  farm.gold -= cost;
  farm.upgrades[key] = lvl + 1;
  if (key === 'sprinkler') farm.sprinklerOn = true;
  if (key === 'plot') {
    // New rows extend the field downward: previous height → new height.
    const startGy = FIELD_OFFSET + FIELD_SIZE + lvl * ROWS_PER_PLOT;
    spawnFieldRows(fw.world, fw.components, startGy, ROWS_PER_PLOT);
  }
  return ok;
}

/** Toggle the sprinkler master switch (legacy `toggleSprinkler`). */
export function toggleSprinkler(fw: FarmWorld): boolean {
  const farm = fw.world.get(fw.farm, fw.components.Farm)!;
  farm.sprinklerOn = !farm.sprinklerOn;
  return farm.sprinklerOn;
}
