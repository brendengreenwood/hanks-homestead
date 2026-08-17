import { describe, it, expect } from 'vitest';
import { createFarmWorld, gridToWorld, FARM_ENTITY_NAME } from './world';
import { WORLD_SIZE, FIELD_SIZE, FIELD_OFFSET } from './constants';

describe('createFarmWorld', () => {
  it('spawns exactly FIELD_SIZE² tiles', () => {
    const fw = createFarmWorld();
    let count = 0;
    for (const _ of fw.world.query(fw.components.Tile)) count++;
    expect(count).toBe(FIELD_SIZE * FIELD_SIZE); // 100
  });

  it('places tiles at FIELD_OFFSET with the legacy world-space mapping', () => {
    const fw = createFarmWorld();
    const seen = new Set<string>();
    for (const e of fw.world.query(fw.components.Tile)) {
      const t = fw.world.get(e, fw.components.Tile)!;
      expect(t.gridX).toBeGreaterThanOrEqual(FIELD_OFFSET);
      expect(t.gridX).toBeLessThan(FIELD_OFFSET + FIELD_SIZE);
      expect(t.gridY).toBeGreaterThanOrEqual(FIELD_OFFSET);
      expect(t.gridY).toBeLessThan(FIELD_OFFSET + FIELD_SIZE);
      // worldX = gridX - WORLD_SIZE/2 + 0.5 (legacy re-centering)
      expect(t.worldX).toBe(t.gridX - WORLD_SIZE / 2 + 0.5);
      expect(t.worldZ).toBe(t.gridY - WORLD_SIZE / 2 + 0.5);
      seen.add(`${t.gridX},${t.gridY}`);
    }
    expect(seen.size).toBe(100); // all cells distinct
    // Corner spot-checks: grid 13 → world -4.5; grid 22 → world 4.5.
    expect(gridToWorld(13)).toBe(-4.5);
    expect(gridToWorld(22)).toBe(4.5);
  });

  it('spawns the Farm singleton with legacy starting gold', () => {
    const fw = createFarmWorld();
    const farm = fw.world.findByName(FARM_ENTITY_NAME);
    expect(farm).toBe(fw.farm);
    expect(fw.world.get(fw.farm, fw.components.Farm)).toEqual({ gold: 200 });
  });

  it('endDay is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const fw = createFarmWorld(seed);
      const scorchers: boolean[] = [];
      for (let i = 0; i < 48; i++) {
        fw.endDay();
        scorchers.push(fw.weather.scorcher);
      }
      return { day: fw.calendar.day, scorchers };
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42).scorchers).not.toEqual(run(7).scorchers);
  });
});
