import { describe, expect, it } from 'vitest';
import { createFarmWorld, type FarmWorld } from './world';
import { plant } from './actions';
import { CROPS, SPRINKLER_COST_PER_TILE, WATER_DAYS, type SeasonId } from './constants';
import type { EntityId } from 'omen/ecs/types';

const farmOf = (fw: FarmWorld) => fw.world.get(fw.farm, fw.components.Farm)!;

function advanceToSeason(fw: FarmWorld, season: SeasonId): void {
  let guard = 0;
  while (fw.calendar.season !== season) {
    fw.endDay();
    if (++guard > 30) throw new Error('season never reached');
  }
}

/** A planted, growing, thirsty tile (moisture < 2) plus sprinklers owned+on. */
function thirstySetup(): { fw: FarmWorld; tile: EntityId } {
  const fw = createFarmWorld();
  const tile = [...fw.world.query(fw.components.Tile)][0];
  plant(fw, tile, 'corn'); // growTime 9 — still growing through summer
  advanceToSeason(fw, 'summer');
  const farm = farmOf(fw);
  farm.upgrades.sprinkler = 1;
  farm.sprinklerOn = true;
  const t = fw.world.get(tile, fw.components.Tile)!;
  t.moisture = 0;
  t.watered = false;
  return { fw, tile };
}

describe('SprinklerSystem', () => {
  it('waters thirsty growing crops in summer and charges per tile', () => {
    const { fw, tile } = thirstySetup();
    const goldBefore = farmOf(fw).gold;
    const report = fw.sprinkler.runDay('summer');
    expect(report).toEqual({ watered: 1, cost: SPRINKLER_COST_PER_TILE, switchedOff: false });
    expect(farmOf(fw).gold).toBe(goldBefore - SPRINKLER_COST_PER_TILE);
    const t = fw.world.get(tile, fw.components.Tile)!;
    expect(t.moisture).toBe(WATER_DAYS);
    expect(t.watered).toBe(true);
  });

  it('skips tiles that are not thirsty (moisture >= 2) or already mature', () => {
    const { fw, tile } = thirstySetup();
    const t = fw.world.get(tile, fw.components.Tile)!;
    t.moisture = 2; // not thirsty
    expect(fw.sprinkler.runDay('summer').watered).toBe(0);
    t.moisture = 0;
    fw.world.get(tile, fw.components.Crop)!.growth = CROPS.corn.growTime; // mature
    expect(fw.sprinkler.runDay('summer').watered).toBe(0);
  });

  it('does nothing outside summer, without the upgrade, or when switched off', () => {
    const { fw } = thirstySetup();
    expect(fw.sprinkler.runDay('spring').watered).toBe(0);
    farmOf(fw).sprinklerOn = false;
    expect(fw.sprinkler.runDay('summer').watered).toBe(0);
    farmOf(fw).sprinklerOn = true;
    farmOf(fw).upgrades.sprinkler = 0;
    expect(fw.sprinkler.runDay('summer').watered).toBe(0);
  });

  it('switches off instead of watering when the tick is unaffordable', () => {
    const { fw, tile } = thirstySetup();
    farmOf(fw).gold = 0;
    const report = fw.sprinkler.runDay('summer');
    expect(report.switchedOff).toBe(true);
    expect(farmOf(fw).sprinklerOn).toBe(false);
    expect(fw.world.get(tile, fw.components.Tile)!.watered).toBe(false);
  });

  it('runs before the growth tick in endDay (sprinkler water counts for growth)', () => {
    const { fw, tile } = thirstySetup();
    const growthBefore = fw.world.get(tile, fw.components.Crop)!.growth;
    // Roll days until a summer day passes with the sprinkler active.
    let guard = 0;
    while (fw.calendar.season === 'summer') {
      const report = fw.endDay();
      if (report.sprinkler.watered > 0) {
        expect(fw.world.get(tile, fw.components.Crop)!.growth).toBeGreaterThan(growthBefore);
        return;
      }
      if (++guard > 10) break;
    }
    throw new Error('sprinkler never watered during summer');
  });
});
