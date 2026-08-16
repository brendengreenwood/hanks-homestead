import { World } from 'omen/ecs/World';
import type { SimComponents } from './components';
import { CROPS, type SeasonId } from './constants';

/**
 * GrowthSystem — advances every planted, non-mature crop one day.
 *
 * Legacy rules (Game.jsx growCropsForDay, ported faithfully):
 *  • spring — rain keeps soil moist; crops grow freely.
 *  • summer — crops grow only when there's moisture at the start of the day;
 *    a dry day stunts the crop (harvestPenalty → reduced yield at harvest).
 *  • fall/winter — no growth (and no soil changes; SoilSystem also no-ops).
 *
 * Runs BEFORE SoilSystem on a day tick: growth is decided from the morning's
 * moisture, then the soil dries — matching the legacy per-cell sequence where
 * `growth++` follows a `moisture > 0` check made before decrement.
 */
export class GrowthSystem {
  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
  ) {}

  runDay(season: SeasonId): void {
    if (season !== 'spring' && season !== 'summer') return;
    const { Tile, Crop } = this.components;
    for (const entity of this.world.query(Tile, Crop)) {
      const tile = this.world.get(entity, Tile)!;
      const crop = this.world.get(entity, Crop)!;
      if (crop.growth >= CROPS[crop.crop].growTime) continue;
      if (season === 'spring' || tile.moisture > 0) {
        crop.growth++;
      } else {
        crop.harvestPenalty = true; // went thirsty — withers a bit
      }
    }
  }
}
