import { describe, it, expect } from 'vitest';
import {
  WORLD_SIZE,
  FIELD_SIZE,
  FIELD_OFFSET,
  CROPS,
  FEED_COST,
  SCORCH_CHANCE,
  WATER_DAYS,
  SEASON_LENGTH,
  ELEVATOR_BASE_INTAKE,
  ELEVATOR_INTAKE_PER_LEVEL,
  CONTRACT_SLOTS,
  CONTRACT_PENALTY,
  PRICE_AMP,
  SPRINKLER_COST_PER_TILE,
  BASE_STORAGE,
  SILO_CAPACITY,
  seasonalPriceFactor,
} from './constants';

// Literals below are copied from the legacy src/game/constants.js — the
// shipped balance pass. Any drift here is a parity bug.
describe('ported balance constants match legacy values', () => {
  it('grid dimensions', () => {
    expect(WORLD_SIZE).toBe(36);
    expect(FIELD_SIZE).toBe(10);
    expect(FIELD_OFFSET).toBe(13);
  });

  it('crop balance values', () => {
    expect(CROPS.wheat).toMatchObject({ growTime: 6, seedPrice: 10, sellPrice: 25, shelfLife: 999 });
    expect(CROPS.carrot).toMatchObject({ growTime: 7, seedPrice: 14, sellPrice: 42, shelfLife: 14 });
    expect(CROPS.tomato).toMatchObject({ growTime: 8, seedPrice: 18, sellPrice: 62, shelfLife: 6 });
    expect(CROPS.corn).toMatchObject({ growTime: 9, seedPrice: 30, sellPrice: 60, shelfLife: 60 });
    expect(CROPS.pumpkin).toMatchObject({ growTime: 9, seedPrice: 55, sellPrice: 112, shelfLife: 12 });
  });

  it('economy knobs', () => {
    expect(FEED_COST).toBe(12);
    expect(SCORCH_CHANCE).toBe(0.3);
    expect(WATER_DAYS).toBe(3);
    expect(PRICE_AMP).toBe(0.35);
    expect(BASE_STORAGE).toBe(40);
    expect(SILO_CAPACITY).toBe(60);
    expect(ELEVATOR_BASE_INTAKE).toBe(25);
    expect(ELEVATOR_INTAKE_PER_LEVEL).toBe(15);
    expect(SPRINKLER_COST_PER_TILE).toBe(1);
    expect(CONTRACT_SLOTS).toBe(3);
    expect(CONTRACT_PENALTY).toBe(0.25);
  });

  it('calendar and price cycle', () => {
    expect(SEASON_LENGTH).toBe(6);
    // Legacy formula: 1 + 0.35 * cos(2π(doy - 3)/24). Day 4 → doy 3 → peak.
    expect(seasonalPriceFactor(4)).toBeCloseTo(1.35, 10);
    // Half a year later → trough.
    expect(seasonalPriceFactor(16)).toBeCloseTo(0.65, 10);
  });
});
