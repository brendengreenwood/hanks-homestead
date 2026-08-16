import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import type { SimComponents, Weather } from './components';
import { SCORCH_CHANCE, type SeasonId } from './constants';
import type { Rng } from './rng';

export const WEATHER_ENTITY_NAME = 'weather';

/**
 * WeatherSystem — rolls the day's weather on the singleton Weather entity.
 * Legacy rule (Game.jsx endDay): a scorcher can only occur in summer, with
 * SCORCH_CHANCE odds. Scorchers double soil evaporation that day (applied by
 * SoilSystem); crops that go thirsty wither (applied by GrowthSystem).
 */
export class WeatherSystem {
  private readonly entity: EntityId;

  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
    private readonly rng: Rng,
  ) {
    this.entity = world.spawn();
    world.setName(this.entity, WEATHER_ENTITY_NAME);
    world.add(this.entity, components.Weather, { scorcher: false });
  }

  private get state(): Weather {
    const w = this.world.get(this.entity, this.components.Weather);
    if (!w) throw new Error('weather entity lost its Weather component');
    return w;
  }

  /** Roll the new day's weather. Returns whether today is a scorcher. */
  rollDay(season: SeasonId): boolean {
    this.state.scorcher = season === 'summer' && this.rng() < SCORCH_CHANCE;
    return this.state.scorcher;
  }

  get scorcher(): boolean {
    return this.state.scorcher;
  }
}
