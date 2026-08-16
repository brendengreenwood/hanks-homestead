import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import type { SimComponents } from './components';
import {
  CROPS,
  SPRINKLER_COST_PER_TILE,
  WATER_DAYS,
  type SeasonId,
} from './constants';

export interface SprinklerReport {
  /** Tiles the sprinklers watered today. */
  watered: number;
  /** Gold spent (OpEx). */
  cost: number;
  /** True when the tick couldn't be afforded and the system switched off. */
  switchedOff: boolean;
}

/**
 * Sprinklers (legacy Game.jsx `sprinklerTick`): each summer day, before the
 * growth tick, top up THIRSTY crops (moisture < 2, not yet mature) for a
 * per-tile fee. If the fee exceeds gold on hand, the sprinklers switch off
 * instead of watering.
 */
export class SprinklerSystem {
  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
    private readonly farm: EntityId,
  ) {}

  runDay(season: SeasonId): SprinklerReport {
    const none: SprinklerReport = { watered: 0, cost: 0, switchedOff: false };
    const { Tile, Crop, Farm } = this.components;
    const farm = this.world.get(this.farm, Farm)!;
    if (season !== 'summer' || farm.upgrades.sprinkler <= 0 || !farm.sprinklerOn) {
      return none;
    }

    const thirsty: EntityId[] = [];
    for (const entity of this.world.query(Tile, Crop)) {
      const tile = this.world.get(entity, Tile)!;
      const crop = this.world.get(entity, Crop)!;
      if (crop.growth < CROPS[crop.crop].growTime && tile.moisture < 2) {
        thirsty.push(entity);
      }
    }
    if (thirsty.length === 0) return none;

    const cost = thirsty.length * SPRINKLER_COST_PER_TILE;
    if (cost > farm.gold) {
      farm.sprinklerOn = false;
      return { watered: 0, cost: 0, switchedOff: true };
    }
    farm.gold -= cost;
    for (const entity of thirsty) {
      const tile = this.world.get(entity, Tile)!;
      tile.moisture = WATER_DAYS;
      tile.watered = true;
    }
    return { watered: thirsty.length, cost, switchedOff: false };
  }
}
