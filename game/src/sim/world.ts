import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import { defineSimComponents, type SimComponents } from './components';
import { CalendarSystem } from './CalendarSystem';
import { WeatherSystem } from './WeatherSystem';
import { GrowthSystem } from './GrowthSystem';
import { SoilSystem } from './SoilSystem';
import { mulberry32, type Rng } from './rng';
import { FIELD_OFFSET, FIELD_SIZE, WORLD_SIZE } from './constants';

export const FARM_ENTITY_NAME = 'farm';
const STARTING_GOLD = 200; // legacy Game.jsx initial state

export interface FarmWorld {
  world: World;
  components: SimComponents;
  calendar: CalendarSystem;
  weather: WeatherSystem;
  growth: GrowthSystem;
  soil: SoilSystem;
  rng: Rng;
  /** Singleton Farm entity (named 'farm'). */
  farm: EntityId;
  /** Advance one day: calendar tick, weather roll, growth, then soil decay. */
  endDay(): void;
}

/** Legacy re-centering: grid cell → world-space tile center. */
export const gridToWorld = (g: number): number => g - WORLD_SIZE / 2 + 0.5;

/**
 * Spawn a fresh farm world: the 10×10 field of Tile entities at FIELD_OFFSET,
 * the Farm/Weather/Calendar singletons, and the day-tick systems wired in the
 * legacy order (weather → growth → soil).
 */
export function createFarmWorld(seed = 42): FarmWorld {
  const world = new World();
  const components = defineSimComponents(world);
  const rng = mulberry32(seed);
  const calendar = new CalendarSystem(world);
  const weather = new WeatherSystem(world, components, rng);
  const growth = new GrowthSystem(world, components);
  const soil = new SoilSystem(world, components);

  const farm = world.spawn();
  world.setName(farm, FARM_ENTITY_NAME);
  world.add(farm, components.Farm, { gold: STARTING_GOLD });

  for (let gy = FIELD_OFFSET; gy < FIELD_OFFSET + FIELD_SIZE; gy++) {
    for (let gx = FIELD_OFFSET; gx < FIELD_OFFSET + FIELD_SIZE; gx++) {
      const tile = world.spawn();
      world.add(tile, components.Tile, {
        gridX: gx,
        gridY: gy,
        worldX: gridToWorld(gx),
        worldZ: gridToWorld(gy),
        moisture: 0,
        watered: false,
      });
    }
  }

  return {
    world,
    components,
    calendar,
    weather,
    growth,
    soil,
    rng,
    farm,
    endDay(): void {
      calendar.advanceDay();
      const season = calendar.season;
      const scorcher = weather.rollDay(season);
      growth.runDay(season);
      soil.runDay(season, scorcher);
    },
  };
}
