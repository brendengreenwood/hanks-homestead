import { describe, it, expect } from 'vitest';
import { World } from 'omen/ecs/World';
import { defineSimComponents } from './components';
import { WeatherSystem, WEATHER_ENTITY_NAME } from './WeatherSystem';
import { SoilSystem } from './SoilSystem';
import { GrowthSystem } from './GrowthSystem';
import { SCORCH_CHANCE, WATER_DAYS } from './constants';
import { mulberry32 } from './rng';

function setup(rng: () => number) {
  const world = new World();
  const components = defineSimComponents(world);
  const weather = new WeatherSystem(world, components, rng);
  const growth = new GrowthSystem(world, components);
  const soil = new SoilSystem(world, components);
  return { world, components, weather, growth, soil };
}

function spawnTile(s: ReturnType<typeof setup>, moisture: number, withCrop = true) {
  const e = s.world.spawn();
  s.world.add(e, s.components.Tile, {
    gridX: 13, gridY: 13, worldX: -4.5, worldZ: -4.5,
    moisture, watered: moisture > 0,
  });
  if (withCrop) {
    s.world.add(e, s.components.Crop, { crop: 'tomato', growth: 0, fed: false, harvestPenalty: false });
  }
  return e;
}

describe('WeatherSystem', () => {
  it('never rolls a scorcher outside summer', () => {
    const s = setup(() => 0); // rng that would always scorch
    expect(s.weather.rollDay('spring')).toBe(false);
    expect(s.weather.rollDay('fall')).toBe(false);
    expect(s.weather.rollDay('winter')).toBe(false);
    expect(s.weather.rollDay('summer')).toBe(true);
  });

  it('applies SCORCH_CHANCE odds via the seeded rng', () => {
    const s = setup(mulberry32(42));
    const probe = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      expect(s.weather.rollDay('summer')).toBe(probe() < SCORCH_CHANCE);
    }
  });

  it('scorcher doubles evaporation on watered tiles (crop still grows that day)', () => {
    const s = setup(() => 0); // always scorch in summer
    const e = spawnTile(s, WATER_DAYS); // freshly watered: moisture 3
    const scorcher = s.weather.rollDay('summer');
    s.growth.runDay('summer');
    s.soil.runDay('summer', scorcher);
    const tile = s.world.get(e, s.components.Tile)!;
    const crop = s.world.get(e, s.components.Crop)!;
    expect(tile.moisture).toBe(WATER_DAYS - 2); // -1 base, -1 scorcher
    expect(tile.watered).toBe(true); // moisture 1 remains
    expect(crop.growth).toBe(1);
    expect(crop.harvestPenalty).toBe(false);
  });

  it('scorcher withers dry crops but spares tiles whose watered/moisture state is set', () => {
    const s = setup(() => 0);
    const dry = spawnTile(s, 0);
    const wet = spawnTile(s, WATER_DAYS);
    const scorcher = s.weather.rollDay('summer');
    s.growth.runDay('summer');
    s.soil.runDay('summer', scorcher);
    expect(s.world.get(dry, s.components.Crop)!.harvestPenalty).toBe(true);
    expect(s.world.get(dry, s.components.Crop)!.growth).toBe(0);
    expect(s.world.get(wet, s.components.Crop)!.harvestPenalty).toBe(false);
    expect(s.world.get(wet, s.components.Crop)!.growth).toBe(1);
  });

  it('ignores empty tiles (no crop): soil untouched, no crash', () => {
    const s = setup(() => 0);
    const e = spawnTile(s, 2, false);
    const scorcher = s.weather.rollDay('summer');
    s.growth.runDay('summer');
    s.soil.runDay('summer', scorcher);
    const tile = s.world.get(e, s.components.Tile)!;
    expect(tile.moisture).toBe(2); // legacy loop skips cells without a crop
  });

  it('exposes weather on a named singleton entity', () => {
    const s = setup(() => 0);
    const entity = s.world.findByName(WEATHER_ENTITY_NAME);
    expect(entity).toBeDefined();
    expect(s.world.get(entity!, s.components.Weather)).toEqual({ scorcher: false });
  });
});
