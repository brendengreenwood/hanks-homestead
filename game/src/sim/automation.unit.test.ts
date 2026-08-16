import { describe, expect, it } from 'vitest';
import { createFarmWorld, type FarmWorld } from './world';
import {
  plant,
  feed,
  buyFeed,
  buySeeds,
  buyUpgrade,
  toggleSprinkler,
  storageCapacity,
} from './actions';
import {
  CROPS,
  FEED_COST,
  FIELD_OFFSET,
  FIELD_SIZE,
  ROWS_PER_PLOT,
  SILO_CAPACITY,
  UPGRADES,
  upgradeCost,
  elevatorIntake,
  fieldHeight,
  type SeasonId,
} from './constants';

const farmOf = (fw: FarmWorld) => fw.world.get(fw.farm, fw.components.Farm)!;

function advanceToSeason(fw: FarmWorld, season: SeasonId): void {
  let guard = 0;
  while (fw.calendar.season !== season) {
    fw.endDay();
    if (++guard > 30) throw new Error('season never reached');
  }
}

describe('upgrade constants (legacy parity)', () => {
  it('ports the UPGRADES table verbatim', () => {
    expect(UPGRADES.tractor).toMatchObject({ max: 3, baseCost: 300, growth: 1.7 });
    expect(UPGRADES.sprinkler).toMatchObject({ max: 1, baseCost: 500, growth: 2 });
    expect(UPGRADES.silo).toMatchObject({ max: 6, baseCost: 220, growth: 1.55 });
    expect(UPGRADES.plot).toMatchObject({ max: 6, baseCost: 180, growth: 1.5 });
    expect(UPGRADES.hauler).toMatchObject({ max: 4, baseCost: 260, growth: 1.6 });
  });

  it('computes level-scaled costs (round(base * growth^level))', () => {
    expect(upgradeCost('tractor', 0)).toBe(300);
    expect(upgradeCost('tractor', 1)).toBe(510);
    expect(upgradeCost('silo', 2)).toBe(Math.round(220 * 1.55 * 1.55));
  });

  it('derives elevator intake and field height from levels', () => {
    const levels = { tractor: 0, sprinkler: 0, silo: 0, plot: 0, hauler: 0 };
    expect(elevatorIntake(levels)).toBe(25);
    expect(elevatorIntake({ ...levels, hauler: 2 })).toBe(55);
    expect(fieldHeight(levels)).toBe(FIELD_SIZE);
    expect(fieldHeight({ ...levels, plot: 3 })).toBe(FIELD_SIZE + 3 * ROWS_PER_PLOT);
  });
});

describe('buyUpgrade', () => {
  it('deducts gold and raises the level', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    farm.gold = 1000;
    expect(buyUpgrade(fw, 'hauler').ok).toBe(true);
    expect(farm.gold).toBe(1000 - 260);
    expect(farm.upgrades.hauler).toBe(1);
  });

  it('rejects when gold is short or the level is maxed', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    farm.gold = 100;
    expect(buyUpgrade(fw, 'hauler').ok).toBe(false);
    farm.gold = 100_000;
    farm.upgrades.sprinkler = UPGRADES.sprinkler.max;
    expect(buyUpgrade(fw, 'sprinkler').ok).toBe(false);
  });

  it('switches the sprinklers on when bought', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    farm.gold = 1000;
    expect(farm.sprinklerOn).toBe(false);
    buyUpgrade(fw, 'sprinkler');
    expect(farm.sprinklerOn).toBe(true);
  });

  it('raises storage capacity via the silo upgrade', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    const before = storageCapacity(farm.silos, farm.upgrades.silo);
    farm.gold = 1000;
    buyUpgrade(fw, 'silo');
    expect(storageCapacity(farm.silos, farm.upgrades.silo)).toBe(before + SILO_CAPACITY);
  });

  it('spawns ROWS_PER_PLOT new farmland rows per plot bought', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    farm.gold = 10_000;
    const count = () => [...fw.world.query(fw.components.Tile)].length;
    expect(count()).toBe(FIELD_SIZE * FIELD_SIZE);
    buyUpgrade(fw, 'plot');
    expect(count()).toBe(FIELD_SIZE * FIELD_SIZE + ROWS_PER_PLOT * FIELD_SIZE);
    // New rows sit directly below the original field.
    const rows = new Set(
      [...fw.world.query(fw.components.Tile)].map(
        (e) => fw.world.get(e, fw.components.Tile)!.gridY,
      ),
    );
    expect(rows.has(FIELD_OFFSET + FIELD_SIZE)).toBe(true);
    expect(rows.has(FIELD_OFFSET + FIELD_SIZE + 1)).toBe(true);
    buyUpgrade(fw, 'plot');
    expect(count()).toBe(FIELD_SIZE * FIELD_SIZE + 2 * ROWS_PER_PLOT * FIELD_SIZE);
    expect(rows.size).toBe(FIELD_SIZE + ROWS_PER_PLOT); // snapshot before second buy
  });
});

describe('toggleSprinkler', () => {
  it('flips the master switch', () => {
    const fw = createFarmWorld();
    expect(toggleSprinkler(fw)).toBe(true);
    expect(farmOf(fw).sprinklerOn).toBe(true);
    expect(toggleSprinkler(fw)).toBe(false);
  });
});

describe('feed', () => {
  it('consumes plant food and marks the crop fed (summer only)', () => {
    const fw = createFarmWorld();
    const tile = [...fw.world.query(fw.components.Tile)][0];
    plant(fw, tile, 'corn');
    expect(feed(fw, tile).ok).toBe(false); // spring
    advanceToSeason(fw, 'summer');
    expect(feed(fw, tile).ok).toBe(true);
    expect(farmOf(fw).plantFood).toBe(4);
    expect(fw.world.get(tile, fw.components.Crop)!.fed).toBe(true);
    expect(feed(fw, tile).ok).toBe(false); // already fed
  });

  it('rejects unplanted tiles and empty plant-food stock', () => {
    const fw = createFarmWorld();
    const [a, b] = [...fw.world.query(fw.components.Tile)];
    plant(fw, a, 'corn');
    advanceToSeason(fw, 'summer');
    expect(feed(fw, b).ok).toBe(false); // nothing planted
    farmOf(fw).plantFood = 0;
    expect(feed(fw, a).ok).toBe(false); // no stock
  });
});

describe('shop purchases', () => {
  it('buyFeed charges FEED_COST per unit', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    expect(buyFeed(fw, 3).ok).toBe(true);
    expect(farm.gold).toBe(200 - 3 * FEED_COST);
    expect(farm.plantFood).toBe(8);
    farm.gold = 0;
    expect(buyFeed(fw, 1).ok).toBe(false);
  });

  it('buySeeds charges the crop seedPrice per unit', () => {
    const fw = createFarmWorld();
    const farm = farmOf(fw);
    expect(buySeeds(fw, 'tomato', 2).ok).toBe(true);
    expect(farm.gold).toBe(200 - 2 * CROPS.tomato.seedPrice);
    expect(farm.seeds.tomato).toBe(12);
    farm.gold = 0;
    expect(buySeeds(fw, 'pumpkin', 1).ok).toBe(false);
  });
});
