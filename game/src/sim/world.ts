import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import { defineSimComponents, type SimComponents } from './components';
import { CalendarSystem } from './CalendarSystem';
import { WeatherSystem } from './WeatherSystem';
import { GrowthSystem } from './GrowthSystem';
import { SoilSystem } from './SoilSystem';
import { SprinklerSystem, type SprinklerReport } from './SprinklerSystem';
import { MarketSystem } from './MarketSystem';
import { ContractSystem, type ContractEvent } from './ContractSystem';
import { mulberry32, type Rng } from './rng';
import { FIELD_OFFSET, FIELD_SIZE, WORLD_SIZE, type SeasonId } from './constants';

export const FARM_ENTITY_NAME = 'farm';
const STARTING_GOLD = 200; // legacy Game.jsx initial state

export interface FarmWorld {
  world: World;
  components: SimComponents;
  calendar: CalendarSystem;
  weather: WeatherSystem;
  growth: GrowthSystem;
  soil: SoilSystem;
  sprinkler: SprinklerSystem;
  market: MarketSystem;
  contracts: ContractSystem;
  rng: Rng;
  /** Singleton Farm entity (named 'farm'). */
  farm: EntityId;
  /**
   * Advance one day (legacy tick order): calendar tick, weather roll,
   * sprinkler pass, growth, then soil decay.
   */
  endDay(): DayReport;
}

export interface DayReport {
  scorcher: boolean;
  sprinkler: SprinklerReport;
  /** Crops lost to spoilage overnight. */
  spoiled: number;
  /** Contracts settled today (deliveries and defaults). */
  contractEvents: ContractEvent[];
  /** Set when the day tick crossed into a new season. */
  seasonChanged: SeasonId | null;
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
  // Legacy Game.jsx initial state: 10 seeds per crop, 5 plant food, one silo
  // building (capacity 40 + 60 = 100), empty storage.
  world.add(farm, components.Farm, {
    gold: STARTING_GOLD,
    seeds: { wheat: 10, carrot: 10, tomato: 10, corn: 10, pumpkin: 10 },
    plantFood: 5,
    storage: { wheat: 0, carrot: 0, tomato: 0, corn: 0, pumpkin: 0 },
    silos: 1,
    upgrades: { tractor: 0, sprinkler: 0, silo: 0, plot: 0, hauler: 0 },
    sprinklerOn: false,
  });
  const sprinkler = new SprinklerSystem(world, components, farm);
  const market = new MarketSystem(world, components, farm, rng);
  const contracts = new ContractSystem(world, components, farm, rng);

  spawnFieldRows(world, components, FIELD_OFFSET, FIELD_SIZE);
  contracts.ensureOffers(calendar.day);

  return {
    world,
    components,
    calendar,
    weather,
    growth,
    soil,
    sprinkler,
    market,
    contracts,
    rng,
    farm,
    endDay(): DayReport {
      const prevSeason = calendar.season;
      calendar.advanceDay();
      const season = calendar.season;
      // Legacy advanceDay order: soldToday reset, scorcher roll, sprinklers,
      // growth, market tick, spoilage, contract settlement.
      market.startDay();
      const scorcher = weather.rollDay(season);
      const sprinklerReport = sprinkler.runDay(season);
      growth.runDay(season);
      soil.runDay(season, scorcher);
      market.tickDay(calendar.day);
      const spoiled = market.spoilTick();
      const contractEvents = contracts.tick(calendar.day);
      const seasonChanged = season !== prevSeason ? season : null;
      if (seasonChanged) {
        // Fresh offers each season (legacy: contractOffers = [] on transition).
        contracts.refreshOffers(calendar.day);
        // Winter → spring: the field is re-tilled (legacy `gs.grid = makeGrid()`).
        if (prevSeason === 'winter' && season === 'spring') resetField(world, components);
      }
      return { scorcher, sprinkler: sprinklerReport, spoiled, contractEvents, seasonChanged };
    },
  };
}

/** Winter → spring re-till: clear all crops and reset soil (legacy `makeGrid()`). */
export function resetField(world: World, components: SimComponents): void {
  for (const tile of world.query(components.Tile)) {
    if (world.has(tile, components.Crop)) world.remove(tile, components.Crop);
    const t = world.get(tile, components.Tile)!;
    t.moisture = 0;
    t.watered = false;
  }
}

/** Spawn `rows` rows of 10-wide farmland starting at grid row `startGy`. */
export function spawnFieldRows(
  world: World,
  components: SimComponents,
  startGy: number,
  rows: number,
): void {
  for (let gy = startGy; gy < startGy + rows; gy++) {
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
}
