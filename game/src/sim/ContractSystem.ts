import { World } from 'omen/ecs/World';
import type { EntityId } from 'omen/ecs/types';
import type { SimComponents } from './components';
import type { Rng } from './rng';
import {
  CROPS,
  CROP_IDS,
  CONTRACT_PENALTY,
  CONTRACT_SLOTS,
  SEASON_LENGTH,
  type CropId,
} from './constants';

/** A forward contract: deliver `qty` of `crop` by day `due` at locked `price`. */
export interface Contract {
  id: number;
  crop: CropId;
  qty: number;
  price: number;
  due: number;
}

export interface ContractEvent {
  type: 'delivered' | 'defaulted';
  contract: Contract;
  /** Gold delta: +qty×price on delivery, −penalty on default. */
  amount: number;
}

/**
 * Forward contracts ported from legacy Game.jsx (Epic 5): three rolling
 * offers at a premium over the mean (8–30%), fresh each season; accepted
 * contracts settle on their due day — deliver from storage for the locked
 * price, or forfeit a CONTRACT_PENALTY fraction of the contract's value.
 * Deliveries bypass the elevator's daily intake cap.
 */
export class ContractSystem {
  offers: Contract[] = [];
  active: Contract[] = [];
  private seq = 1;

  constructor(
    private readonly world: World,
    private readonly components: SimComponents,
    private readonly farm: EntityId,
    private readonly rng: Rng,
  ) {}

  /** Legacy `makeContractOffer`: rng order is crop, price, qty, due. */
  private makeOffer(day: number): Contract {
    const crop = CROP_IDS[Math.floor(this.rng() * CROP_IDS.length)];
    const base = CROPS[crop].sellPrice;
    const price = Math.round(base * (1.08 + this.rng() * 0.22)); // 8–30% over mean
    const qty = 8 + Math.floor(this.rng() * 18); // 8–25
    const due = day + SEASON_LENGTH + Math.floor(this.rng() * SEASON_LENGTH * 2);
    return { id: this.seq++, crop, qty, price, due };
  }

  /** Top up the offer board to CONTRACT_SLOTS (legacy `ensureContracts`). */
  ensureOffers(day: number): void {
    while (this.offers.length < CONTRACT_SLOTS) this.offers.push(this.makeOffer(day));
  }

  /** Fresh offers each season (legacy: `gs.contractOffers = []` on transition). */
  refreshOffers(day: number): void {
    this.offers = [];
    this.ensureOffers(day);
  }

  /** Accept an offer: moves it to active and backfills the board. */
  accept(id: number, day: number): Contract | null {
    const i = this.offers.findIndex((o) => o.id === id);
    if (i < 0) return null;
    const [offer] = this.offers.splice(i, 1);
    this.active.push(offer);
    this.offers.push(this.makeOffer(day));
    return offer;
  }

  /** Settle contracts that have come due (deliver from storage, or pay a penalty). */
  tick(day: number): ContractEvent[] {
    if (this.active.length === 0) return [];
    const events: ContractEvent[] = [];
    const farm = this.world.get(this.farm, this.components.Farm)!;
    const remaining: Contract[] = [];
    for (const k of this.active) {
      if (day < k.due) {
        remaining.push(k);
        continue;
      }
      const have = farm.storage[k.crop];
      if (have >= k.qty) {
        farm.storage[k.crop] = have - k.qty;
        const amount = k.qty * k.price;
        farm.gold += amount;
        events.push({ type: 'delivered', contract: k, amount });
      } else {
        const penalty = Math.round(k.qty * k.price * CONTRACT_PENALTY);
        farm.gold = Math.max(0, farm.gold - penalty);
        events.push({ type: 'defaulted', contract: k, amount: -penalty });
      }
    }
    this.active = remaining;
    return events;
  }
}
