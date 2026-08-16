import { World } from 'omen/ecs/World';
import type { ComponentType, EntityId } from 'omen/ecs/types';
import {
  SEASON_LENGTH,
  seasonForDay,
  yearForDay,
  dayOfSeason,
  type SeasonId,
} from './constants';

/** Singleton calendar state carried by one named entity in the sim world. */
export interface Calendar {
  /** 1-based absolute day (day 1 = spring 1, year 1). */
  day: number;
}

export const CALENDAR_ENTITY_NAME = 'calendar';

/**
 * CalendarSystem — owns the day/season clock on the engine `World`.
 *
 * The game advances time in whole days ("end day" in the HUD), so the tick
 * unit here is one day, not a frame: `advanceDay()` bumps the singleton
 * Calendar component and derived season/year fall out of the legacy
 * SEASON_LENGTH math (ported verbatim).
 */
export class CalendarSystem {
  readonly type: ComponentType<Calendar>;
  private readonly entity: EntityId;

  constructor(private readonly world: World) {
    this.type = world.defineComponent<Calendar>('Calendar');
    this.entity = world.spawn();
    world.setName(this.entity, CALENDAR_ENTITY_NAME);
    world.add(this.entity, this.type, { day: 1 });
  }

  private get state(): Calendar {
    const cal = this.world.get(this.entity, this.type);
    if (!cal) throw new Error('calendar entity lost its Calendar component');
    return cal;
  }

  /** Advance the clock by one day and return the new day number. */
  advanceDay(): number {
    return ++this.state.day;
  }

  get day(): number {
    return this.state.day;
  }

  get season(): SeasonId {
    return seasonForDay(this.state.day);
  }

  get year(): number {
    return yearForDay(this.state.day);
  }

  get dayOfSeason(): number {
    return dayOfSeason(this.state.day);
  }

  /** Days per season (legacy SEASON_LENGTH), exposed for HUD math. */
  static readonly SEASON_LENGTH = SEASON_LENGTH;
}
