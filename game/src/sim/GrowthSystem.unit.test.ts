import { describe, it, expect } from 'vitest';
import { createFarmWorld, type FarmWorld } from './world';
import { CROPS, SEASON_LENGTH, WATER_DAYS, type CropId } from './constants';
import type { EntityId } from 'omen/ecs/types';

function firstTile(fw: FarmWorld): EntityId {
  for (const e of fw.world.query(fw.components.Tile)) return e;
  throw new Error('no tiles');
}

function plant(fw: FarmWorld, entity: EntityId, crop: CropId) {
  fw.world.add(entity, fw.components.Crop, {
    crop,
    growth: 0,
    fed: false,
    harvestPenalty: false,
  });
}

function advanceToSummer(fw: FarmWorld) {
  while (fw.calendar.season !== 'summer') fw.endDay();
}

describe('GrowthSystem', () => {
  it('grows a spring-planted wheat crop one stage per day, to maturity and no further', () => {
    const fw = createFarmWorld(1);
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    const { growTime } = CROPS.wheat;
    for (let i = 0; i < growTime; i++) fw.endDay(); // spring lasts 6 days = wheat growTime
    const crop = fw.world.get(tile, fw.components.Crop)!;
    expect(crop.growth).toBe(growTime);
    expect(crop.harvestPenalty).toBe(false);
    // Mature crops are skipped entirely — growth never exceeds growTime.
    // (seed 1: no scorcher rolls matter; tile is skipped before soil logic.)
    fw.endDay();
    expect(crop.growth).toBe(growTime);
  });

  it('stalls and withers an unwatered crop in summer', () => {
    const fw = createFarmWorld(1);
    advanceToSummer(fw);
    const tile = firstTile(fw);
    plant(fw, tile, 'tomato');
    // Tile has 0 moisture (spring showers only wet tiles with crops).
    fw.endDay();
    const crop = fw.world.get(tile, fw.components.Crop)!;
    expect(crop.growth).toBe(0);
    expect(crop.harvestPenalty).toBe(true);
  });

  it('grows a watered crop in summer and dries the soil over WATER_DAYS', () => {
    const fw = createFarmWorld(7);
    advanceToSummer(fw);
    const entity = firstTile(fw);
    plant(fw, entity, 'tomato');
    const tile = fw.world.get(entity, fw.components.Tile)!;
    tile.moisture = WATER_DAYS; // manual watering (action layer arrives in segment 3)
    tile.watered = true;
    fw.endDay();
    const crop = fw.world.get(entity, fw.components.Crop)!;
    expect(crop.growth).toBe(1);
    expect(crop.harvestPenalty).toBe(false);
    expect(tile.moisture).toBeLessThan(WATER_DAYS); // dried by at least 1
  });

  it('does not grow crops in fall or winter', () => {
    const fw = createFarmWorld(1);
    // Advance to fall (season 3 starts on day 2*SEASON_LENGTH + 1).
    while (fw.calendar.season !== 'fall') fw.endDay();
    const tile = firstTile(fw);
    plant(fw, tile, 'wheat');
    for (let i = 0; i < SEASON_LENGTH * 2 - 1; i++) fw.endDay(); // through fall + winter
    const crop = fw.world.get(tile, fw.components.Crop)!;
    expect(crop.growth).toBe(0);
    expect(crop.harvestPenalty).toBe(false);
  });
});
