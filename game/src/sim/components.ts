import { World } from 'omen/ecs/World';
import type { ComponentType } from 'omen/ecs/types';
import type { CropId } from './constants';

/** One farmable cell of the 10×10 field. */
export interface Tile {
  gridX: number;
  gridY: number;
  /** Re-centered world-space coords: gridX - WORLD_SIZE/2 + 0.5 (legacy mapping). */
  worldX: number;
  worldZ: number;
  /** Days of moisture remaining (legacy `cell.moisture`). */
  moisture: number;
  /** Whether the soil counts as watered today (legacy `cell.watered`). */
  watered: boolean;
}

/** A planted crop on a tile (legacy grid-cell crop fields). */
export interface Crop {
  crop: CropId;
  /** Watered growth days accrued (legacy `cell.growth`). */
  growth: number;
  /** Plant food applied (+1 yield at harvest unless withered). */
  fed: boolean;
  /** Went thirsty on a summer day — withered, yield capped at 1. */
  harvestPenalty: boolean;
}

/** Singleton: today's weather. */
export interface Weather {
  /** Scorcher day (summer heat wave — double evaporation). */
  scorcher: boolean;
}

/** Singleton farm-wide state. */
export interface Farm {
  gold: number;
}

export interface SimComponents {
  Tile: ComponentType<Tile>;
  Crop: ComponentType<Crop>;
  Weather: ComponentType<Weather>;
  Farm: ComponentType<Farm>;
}

export function defineSimComponents(world: World): SimComponents {
  return {
    Tile: world.defineComponent<Tile>('Tile'),
    Crop: world.defineComponent<Crop>('Crop'),
    Weather: world.defineComponent<Weather>('Weather'),
    Farm: world.defineComponent<Farm>('Farm'),
  };
}
