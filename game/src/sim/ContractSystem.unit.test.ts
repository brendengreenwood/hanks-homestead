import { describe, it, expect } from 'vitest';
import { createFarmWorld } from './world';
import {
  CROPS,
  CONTRACT_PENALTY,
  CONTRACT_SLOTS,
  SEASON_LENGTH,
} from './constants';

const farmOf = (fw: ReturnType<typeof createFarmWorld>) =>
  fw.world.get(fw.farm, fw.components.Farm)!;

describe('ContractSystem', () => {
  it('keeps CONTRACT_SLOTS offers on the board within legacy terms', () => {
    const fw = createFarmWorld(42);
    expect(fw.contracts.offers.length).toBe(CONTRACT_SLOTS);
    for (const o of fw.contracts.offers) {
      const base = CROPS[o.crop].sellPrice;
      expect(o.price).toBeGreaterThanOrEqual(Math.round(base * 1.08));
      expect(o.price).toBeLessThanOrEqual(Math.round(base * 1.3));
      expect(o.qty).toBeGreaterThanOrEqual(8);
      expect(o.qty).toBeLessThanOrEqual(25);
      expect(o.due).toBeGreaterThanOrEqual(fw.calendar.day + SEASON_LENGTH);
      expect(o.due).toBeLessThan(fw.calendar.day + SEASON_LENGTH * 3);
    }
  });

  it('accepting an offer moves it to active and backfills the board', () => {
    const fw = createFarmWorld(42);
    const offer = fw.contracts.offers[0];
    const accepted = fw.contracts.accept(offer.id, fw.calendar.day);
    expect(accepted).toEqual(offer);
    expect(fw.contracts.active).toContainEqual(offer);
    expect(fw.contracts.offers.length).toBe(CONTRACT_SLOTS);
    expect(fw.contracts.accept(9999, fw.calendar.day)).toBeNull();
  });

  it('delivers from storage on the due day for qty × locked price', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    const offer = fw.contracts.offers[0];
    fw.contracts.accept(offer.id, fw.calendar.day);
    farm.storage[offer.crop] = offer.qty + 3;
    const goldBefore = farm.gold;
    const events = fw.contracts.tick(offer.due);
    expect(events).toEqual([
      { type: 'delivered', contract: offer, amount: offer.qty * offer.price },
    ]);
    expect(farm.gold).toBe(goldBefore + offer.qty * offer.price);
    expect(farm.storage[offer.crop]).toBe(3);
    expect(fw.contracts.active).toHaveLength(0);
  });

  it('defaults with a CONTRACT_PENALTY fee when storage falls short', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    const offer = fw.contracts.offers[0];
    fw.contracts.accept(offer.id, fw.calendar.day);
    farm.storage[offer.crop] = offer.qty - 1;
    const goldBefore = farm.gold;
    const penalty = Math.round(offer.qty * offer.price * CONTRACT_PENALTY);
    const events = fw.contracts.tick(offer.due);
    expect(events).toEqual([{ type: 'defaulted', contract: offer, amount: -penalty }]);
    expect(farm.gold).toBe(Math.max(0, goldBefore - penalty));
    expect(farm.storage[offer.crop]).toBe(offer.qty - 1); // nothing taken
  });

  it('does not settle before the due day', () => {
    const fw = createFarmWorld(42);
    const offer = fw.contracts.offers[0];
    fw.contracts.accept(offer.id, fw.calendar.day);
    expect(fw.contracts.tick(offer.due - 1)).toEqual([]);
    expect(fw.contracts.active).toHaveLength(1);
  });

  it('refreshes the offer board on season change via endDay', () => {
    const fw = createFarmWorld(42);
    const before = fw.contracts.offers.map((o) => o.id);
    let report;
    do {
      report = fw.endDay();
    } while (!report.seasonChanged);
    const after = fw.contracts.offers.map((o) => o.id);
    expect(after.length).toBe(CONTRACT_SLOTS);
    expect(after).not.toEqual(before);
  });

  it('endDay winter→spring re-tills the field (crops cleared)', () => {
    const fw = createFarmWorld(42);
    // Plant one tile in spring, then run a full year to next spring.
    const tile = [...fw.world.query(fw.components.Tile)][0];
    fw.world.add(tile, fw.components.Crop, {
      crop: 'wheat',
      growth: 0,
      fed: false,
      harvestPenalty: false,
    });
    for (let d = 0; d < SEASON_LENGTH * 4; d++) fw.endDay();
    expect(fw.calendar.season).toBe('spring');
    expect(fw.world.has(tile, fw.components.Crop)).toBe(false);
    const t = fw.world.get(tile, fw.components.Tile)!;
    expect(t.moisture).toBe(0);
    expect(t.watered).toBe(false);
  });
});
