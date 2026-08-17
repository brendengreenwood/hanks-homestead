import { describe, it, expect } from 'vitest';
import { World } from 'omen/ecs/World';
import { CalendarSystem, CALENDAR_ENTITY_NAME } from './CalendarSystem';
import { mulberry32 } from './rng';
import { SEASON_LENGTH } from './constants';

describe('CalendarSystem', () => {
  it('starts at day 1, spring, year 1', () => {
    const cal = new CalendarSystem(new World());
    expect(cal.day).toBe(1);
    expect(cal.season).toBe('spring');
    expect(cal.year).toBe(1);
    expect(cal.dayOfSeason).toBe(1);
  });

  it('stores state on a named entity in the world', () => {
    const world = new World();
    const cal = new CalendarSystem(world);
    const entity = world.findByName(CALENDAR_ENTITY_NAME);
    expect(entity).toBeDefined();
    expect(world.get(entity!, cal.type)).toEqual({ day: 1 });
  });

  it('rolls seasons every SEASON_LENGTH days', () => {
    const cal = new CalendarSystem(new World());
    for (let i = 0; i < SEASON_LENGTH; i++) cal.advanceDay();
    expect(cal.day).toBe(SEASON_LENGTH + 1);
    expect(cal.season).toBe('summer');
    expect(cal.dayOfSeason).toBe(1);
  });

  it('rolls the year after four seasons', () => {
    const cal = new CalendarSystem(new World());
    for (let i = 0; i < SEASON_LENGTH * 4; i++) cal.advanceDay();
    expect(cal.season).toBe('spring');
    expect(cal.year).toBe(2);
  });
});

describe('mulberry32 rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds and stays in [0,1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
    for (let i = 0; i < 1000; i++) {
      const v = mulberry32(i)();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
