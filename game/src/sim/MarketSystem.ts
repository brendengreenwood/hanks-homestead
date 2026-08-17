import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import type { SimComponents } from './components';
import type { Rng } from './rng';
import {
  CROPS,
  CROP_IDS,
  PRICE_HISTORY_LEN,
  elevatorIntake,
  seasonalPriceFactor,
  type CropId,
} from './constants';

export interface SellResult {
  ok: boolean;
  sold: number;
  earned: number;
  message?: string;
}

/**
 * Daily crop market ported from legacy Game.jsx: mean-reverting prices with
 * seasonal cycle and noise, market impact on sales, a per-day grain-elevator
 * intake cap, and daily spoilage of perishables.
 */
export class MarketSystem {
  /** Current price per crop (legacy `gs.prices`). */
  readonly prices: Record<CropId, number>;
  /** Last PRICE_HISTORY_LEN daily prices per crop (legacy `gs.priceHistory`). */
  readonly priceHistory: Record<CropId, number[]>;
  /** Bushels sold today — the elevator takes a fresh batch each day. */
  soldToday = 0;

  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
    private readonly farm: EntityId,
    private readonly rng: Rng,
  ) {
    this.prices = Object.fromEntries(
      CROP_IDS.map((id) => [id, Math.round(CROPS[id].sellPrice * seasonalPriceFactor(1))]),
    ) as Record<CropId, number>;
    this.priceHistory = Object.fromEntries(
      CROP_IDS.map((id) => [id, [] as number[]]),
    ) as Record<CropId, number[]>;
  }

  /** Reset the daily elevator intake (legacy: `gs.soldToday = 0` on day tick). */
  startDay(): void {
    this.soldToday = 0;
  }

  /** Mean-revert each crop's price toward its seasonal target, plus noise. */
  tickDay(day: number): void {
    for (const id of CROP_IDS) {
      const c = CROPS[id];
      const target = c.sellPrice * seasonalPriceFactor(day) * (0.94 + this.rng() * 0.12);
      const cur = this.prices[id];
      let next = Math.round(cur + (target - cur) * 0.4);
      next = Math.max(Math.round(c.sellPrice * 0.4), Math.min(Math.round(c.sellPrice * 1.9), next));
      this.prices[id] = next;
      const h = this.priceHistory[id];
      h.push(next);
      if (h.length > PRICE_HISTORY_LEN) h.shift();
    }
  }

  /**
   * Spoilage: perishables lose ceil(count / shelfLife) each day (grain keeps).
   * Returns the total number of crops spoiled.
   */
  spoilTick(): number {
    const farm = this.world.get(this.farm, this.components.Farm)!;
    let spoiled = 0;
    for (const id of CROP_IDS) {
      const c = CROPS[id];
      const count = farm.storage[id];
      if (count > 0 && c.shelfLife < 999) {
        const lost = Math.ceil(count / c.shelfLife);
        farm.storage[id] -= lost;
        spoiled += lost;
      }
    }
    return spoiled;
  }

  /** Remaining elevator intake for today. */
  elevatorRoom(): number {
    const farm = this.world.get(this.farm, this.components.Farm)!;
    return elevatorIntake(farm.upgrades) - this.soldToday;
  }

  /** Selling nudges the price down; it recovers via daily mean-reversion. */
  private applyMarketImpact(id: CropId, qty: number): void {
    const c = CROPS[id];
    const drop = Math.min(0.25, qty * 0.004);
    this.prices[id] = Math.max(
      Math.round(c.sellPrice * 0.4),
      Math.round(this.prices[id] * (1 - drop)),
    );
  }

  /**
   * A batch walks the price down as it fills the elevator: it sells at the
   * average of the pre- and post-impact price.
   */
  private sellRevenue(id: CropId, qty: number): number {
    const before = this.prices[id];
    this.applyMarketImpact(id, qty);
    return Math.round((qty * (before + this.prices[id])) / 2);
  }

  /** Sell up to `qty` of one crop from storage, capped by today's elevator room. */
  sellItem(id: CropId, qty = 1): SellResult {
    const farm = this.world.get(this.farm, this.components.Farm)!;
    const count = farm.storage[id];
    if (count <= 0) return { ok: false, sold: 0, earned: 0, message: `No ${CROPS[id].name} in storage.` };
    const room = this.elevatorRoom();
    if (room <= 0) {
      return {
        ok: false,
        sold: 0,
        earned: 0,
        message: `Elevator's full for today (${elevatorIntake(farm.upgrades)} bu/day) — try tomorrow!`,
      };
    }
    const n = Math.min(qty, count, room);
    const earned = this.sellRevenue(id, n);
    farm.gold += earned;
    farm.storage[id] -= n;
    this.soldToday += n;
    return { ok: true, sold: n, earned };
  }

  /** Fill today's remaining intake, highest-priced crops first (legacy `sellAll`). */
  sellAll(): SellResult {
    const farm = this.world.get(this.farm, this.components.Farm)!;
    let room = this.elevatorRoom();
    if (room <= 0) {
      return {
        ok: false,
        sold: 0,
        earned: 0,
        message: `Elevator's full for today (${elevatorIntake(farm.upgrades)} bu/day) — try tomorrow!`,
      };
    }
    let sold = 0;
    let earned = 0;
    const byPrice = [...CROP_IDS].sort((a, b) => this.prices[b] - this.prices[a]);
    for (const id of byPrice) {
      if (room <= 0) break;
      const count = farm.storage[id];
      if (count <= 0) continue;
      const n = Math.min(count, room);
      const revenue = this.sellRevenue(id, n);
      earned += revenue;
      farm.gold += revenue;
      farm.storage[id] -= n;
      room -= n;
      sold += n;
    }
    this.soldToday += sold;
    return { ok: sold > 0, sold, earned };
  }
}
