import { describe, it, expect } from 'vitest';
import { createFarmWorld } from './world';
import {
  CROPS,
  CROP_IDS,
  ELEVATOR_BASE_INTAKE,
  seasonalPriceFactor,
} from './constants';

const farmOf = (fw: ReturnType<typeof createFarmWorld>) =>
  fw.world.get(fw.farm, fw.components.Farm)!;

describe('MarketSystem', () => {
  it('starts at the legacy initial prices (mean × seasonal factor on day 1)', () => {
    const fw = createFarmWorld(42);
    for (const id of CROP_IDS) {
      expect(fw.market.prices[id]).toBe(
        Math.round(CROPS[id].sellPrice * seasonalPriceFactor(1)),
      );
    }
  });

  it('keeps daily prices within the legacy 0.4×–1.9× clamp', () => {
    const fw = createFarmWorld(7);
    for (let d = 0; d < 30; d++) fw.endDay();
    for (const id of CROP_IDS) {
      const c = CROPS[id];
      expect(fw.market.prices[id]).toBeGreaterThanOrEqual(Math.round(c.sellPrice * 0.4));
      expect(fw.market.prices[id]).toBeLessThanOrEqual(Math.round(c.sellPrice * 1.9));
      expect(fw.market.priceHistory[id].length).toBeGreaterThan(0);
    }
  });

  it('selling pays the average of pre- and post-impact price and drops the price', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    farm.storage.wheat = 10;
    const before = fw.market.prices.wheat;
    const res = fw.market.sellItem('wheat', 10);
    expect(res.ok).toBe(true);
    expect(res.sold).toBe(10);
    const after = fw.market.prices.wheat;
    expect(after).toBeLessThanOrEqual(before);
    expect(res.earned).toBe(Math.round((10 * (before + after)) / 2));
    expect(farm.storage.wheat).toBe(0);
  });

  it('caps daily sales at the elevator intake and resets overnight', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    farm.storage.wheat = 60;
    const res = fw.market.sellAll();
    expect(res.sold).toBe(ELEVATOR_BASE_INTAKE); // 25 with no hauler
    expect(fw.market.elevatorRoom()).toBe(0);
    const blocked = fw.market.sellItem('wheat', 1);
    expect(blocked.ok).toBe(false);
    fw.endDay();
    expect(fw.market.elevatorRoom()).toBe(ELEVATOR_BASE_INTAKE);
  });

  it('hauler levels raise the daily intake by 15 each', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    farm.upgrades.hauler = 2;
    expect(fw.market.elevatorRoom()).toBe(ELEVATOR_BASE_INTAKE + 30);
  });

  it('spoils ceil(count / shelfLife) of perishables daily; grain keeps', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    farm.storage.tomato = 7; // shelfLife 6 → loses ceil(7/6) = 2
    farm.storage.wheat = 30; // shelfLife 999 → keeps
    const spoiled = fw.market.spoilTick();
    expect(spoiled).toBe(2);
    expect(farm.storage.tomato).toBe(5);
    expect(farm.storage.wheat).toBe(30);
  });

  it('sellAll sells highest-priced crops first', () => {
    const fw = createFarmWorld(42);
    const farm = farmOf(fw);
    farm.storage.wheat = 20; // cheapest
    farm.storage.pumpkin = 20; // priciest
    const res = fw.market.sellAll();
    expect(res.sold).toBe(25);
    expect(farm.storage.pumpkin).toBe(0); // pumpkin sold out first
    expect(farm.storage.wheat).toBe(15); // then 5 wheat
  });
});
