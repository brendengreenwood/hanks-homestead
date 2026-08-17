import { describe, expect, it } from 'vitest';
import { createFarmWorld, type FarmWorld } from './world';
import { plant, water, harvest, storageCapacity, storedTotal } from './actions';
import { CROPS, WATER_DAYS, type SeasonId } from './constants';
import type { EntityId } from 'omen/ecs/types';

function firstTile(fw: FarmWorld): EntityId {
  for (const e of fw.world.query(fw.components.Tile)) return e;
  throw new Error('no tiles');
}

function advanceToSeason(fw: FarmWorld, season: SeasonId): void {
  let guard = 0;
  while (fw.calendar.season !== season) {
    fw.endDay();
    if (++guard > 30) throw new Error('season never reached');
  }
}

const farmOf = (fw: FarmWorld) => fw.world.get(fw.farm, fw.components.Farm)!;

describe('plant', () => {
  it('consumes a seed and adds a Crop in spring', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    expect(plant(fw, tile, 'wheat').ok).toBe(true);
    expect(farmOf(fw).seeds.wheat).toBe(9);
    const crop = fw.world.get(tile, fw.components.Crop)!;
    expect(crop).toMatchObject({ crop: 'wheat', growth: 0, fed: false, harvestPenalty: false });
  });

  it('rejects double-planting and empty seed stock', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    expect(plant(fw, tile, 'wheat').ok).toBe(false);
    farmOf(fw).seeds.carrot = 0;
    const other = [...fw.world.query(fw.components.Tile)][1];
    expect(plant(fw, other, 'carrot').ok).toBe(false);
  });

  it('is spring-only', () => {
    const fw = createFarmWorld();
    advanceToSeason(fw, 'summer');
    expect(plant(fw, firstTile(fw), 'wheat').ok).toBe(false);
  });
});

/** Advance until the tile's spring moisture has drained (watered=false). */
function drainTile(fw: FarmWorld, tile: EntityId): void {
  let guard = 0;
  while (fw.world.get(tile, fw.components.Tile)!.watered) {
    fw.endDay();
    if (++guard > 10) throw new Error('tile never dried');
  }
}

describe('water', () => {
  it('sets moisture to WATER_DAYS in summer', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'corn'); // growTime 9 — still growing in summer
    advanceToSeason(fw, 'summer');
    drainTile(fw, tile);
    expect(water(fw, tile).ok).toBe(true);
    const t = fw.world.get(tile, fw.components.Tile)!;
    expect(t.moisture).toBe(WATER_DAYS);
    expect(t.watered).toBe(true);
  });

  it('rejects an already-watered tile (legacy !cell.watered guard)', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'corn');
    advanceToSeason(fw, 'summer');
    drainTile(fw, tile); // spring rain leaves the tile watered
    expect(water(fw, tile).ok).toBe(true);
    expect(water(fw, tile).ok).toBe(false);
  });

  it('rejects out-of-season and unplanted tiles', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    expect(water(fw, tile).ok).toBe(false); // spring
    advanceToSeason(fw, 'summer');
    const bare = [...fw.world.query(fw.components.Tile)][1];
    expect(water(fw, bare).ok).toBe(false);
  });
});

describe('harvest', () => {
  function matureCrop(fw: FarmWorld, tile: EntityId): void {
    plant(fw, tile, 'wheat');
    const crop = fw.world.get(tile, fw.components.Crop)!;
    crop.growth = CROPS.wheat.growTime;
    advanceToSeason(fw, 'fall');
  }

  it('yields 1 unfed, removes the crop, fills storage', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    matureCrop(fw, tile);
    expect(harvest(fw, tile).ok).toBe(true);
    expect(farmOf(fw).storage.wheat).toBe(1);
    expect(fw.world.has(tile, fw.components.Crop)).toBe(false);
  });

  it('yields 2 when fed, 1 when withered even if fed', () => {
    const fw = createFarmWorld();
    const [a, b] = [...fw.world.query(fw.components.Tile)];
    plant(fw, a, 'wheat');
    plant(fw, b, 'wheat');
    const ca = fw.world.get(a, fw.components.Crop)!;
    const cb = fw.world.get(b, fw.components.Crop)!;
    ca.growth = CROPS.wheat.growTime;
    ca.fed = true;
    cb.growth = CROPS.wheat.growTime;
    cb.fed = true;
    cb.harvestPenalty = true;
    advanceToSeason(fw, 'fall');
    harvest(fw, a);
    harvest(fw, b);
    expect(farmOf(fw).storage.wheat).toBe(3); // 2 + 1
  });

  it('rejects immature crops and full silos', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    advanceToSeason(fw, 'fall');
    const farm = farmOf(fw);
    const crop = fw.world.get(tile, fw.components.Crop)!;
    crop.growth = CROPS.wheat.growTime - 1;
    expect(harvest(fw, tile).ok).toBe(false); // immature
    crop.growth = CROPS.wheat.growTime;
    farm.storage.corn = storageCapacity(farm.silos);
    expect(harvest(fw, tile).ok).toBe(false); // full
    expect(storedTotal(farm.storage)).toBe(storageCapacity(farm.silos));
  });

  it('clamps a fed yield of 2 to the last remaining storage slot', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    const crop = fw.world.get(tile, fw.components.Crop)!;
    crop.growth = CROPS.wheat.growTime;
    crop.fed = true;
    advanceToSeason(fw, 'fall');
    const farm = farmOf(fw);
    farm.storage.corn = storageCapacity(farm.silos) - 1; // exactly one slot left
    expect(harvest(fw, tile).ok).toBe(true);
    expect(farm.storage.wheat).toBe(1); // min(2, 1)
    expect(fw.world.has(tile, fw.components.Crop)).toBe(false);
    expect(storedTotal(farm.storage)).toBe(storageCapacity(farm.silos));
  });

  it('is fall-only', () => {
    const fw = createFarmWorld();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    const crop = fw.world.get(tile, fw.components.Crop)!;
    crop.growth = CROPS.wheat.growTime;
    expect(harvest(fw, tile).ok).toBe(false); // spring
  });
});
