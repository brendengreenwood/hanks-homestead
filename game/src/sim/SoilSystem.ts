import { World } from 'omen/ecs/World';
import type { SimComponents } from './components';
import { CROPS, type SeasonId } from './constants';

/**
 * SoilSystem — daily moisture/watered decay on tiles with active crops.
 *
 * Legacy rules (Game.jsx growCropsForDay, soil half):
 *  • spring — showers top moisture up to 2 and mark the tile watered.
 *  • summer — moisture drops by 1 (2 on a scorcher); `watered` reflects
 *    whether any moisture remains. A dry tile is simply unwatered.
 *  • fall/winter — untouched.
 *  • tiles without a crop, or with a mature crop, are skipped (legacy loop
 *    `continue`s before touching soil).
 *
 * Runs AFTER GrowthSystem (see GrowthSystem doc for the ordering proof).
 */
export class SoilSystem {
  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
  ) {}

  runDay(season: SeasonId, scorcher: boolean): void {
    if (season !== 'spring' && season !== 'summer') return;
    const { Tile, Crop } = this.components;
    for (const entity of this.world.query(Tile, Crop)) {
      const tile = this.world.get(entity, Tile)!;
      const crop = this.world.get(entity, Crop)!;
      if (crop.growth >= CROPS[crop.crop].growTime) continue;
      if (season === 'spring') {
        tile.moisture = Math.max(tile.moisture, 2); // spring showers
        tile.watered = true;
      } else if (tile.moisture > 0) {
        tile.moisture--;
        if (scorcher) tile.moisture = Math.max(0, tile.moisture - 1); // extra evaporation
        tile.watered = tile.moisture > 0;
      } else {
        tile.watered = false;
      }
    }
  }
}
