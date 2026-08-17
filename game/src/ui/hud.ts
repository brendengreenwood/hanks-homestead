import type { FarmWorld, DayReport } from '../sim/world';
import type { SellResult } from '../sim/MarketSystem';
import {
  CROPS,
  SEASONS,
  CROP_IDS,
  UPGRADE_IDS,
  UPGRADES,
  upgradeCost,
  FEED_COST,
  type CropId,
} from '../sim/constants';
import {
  buyFeed,
  buySeeds,
  buyUpgrade,
  storageCapacity,
  storedTotal,
  toggleSprinkler,
  type ActionResult,
} from '../sim/actions';

export type Tool = 'plant' | 'water' | 'feed' | 'harvest';

export class Hud {
  tool: Tool = 'plant';
  selectedCrop: CropId = 'wheat';
  onEndDay: (() => void) | null = null;
  onChanged: (() => void) | null = null;

  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly inventory: HTMLDivElement;
  private readonly shop: HTMLDivElement;
  private readonly market: HTMLDivElement;
  private readonly sprinkler: HTMLButtonElement;
  private readonly message: HTMLDivElement;
  private messageTimer: number | undefined;

  constructor(private readonly fw: FarmWorld) {
    const style = document.createElement('style');
    style.textContent = `
      .hud{position:fixed;inset:0;pointer-events:none;font:14px/1.4 system-ui,sans-serif;color:#fff}
      .hud .panel{pointer-events:auto;background:rgba(20,28,20,.88);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;margin:10px}
      .hud .top{position:absolute;top:0;left:0;display:flex;gap:8px;align-items:center}
      .hud .bottom{position:absolute;bottom:0;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center}
      .hud .right{position:absolute;top:0;right:0}
      .hud button,.hud select{pointer-events:auto;background:#2f5d34;color:#fff;border:1px solid #4a8a52;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}
      .hud button.active{background:#7ac142;color:#12310f;border-color:#a4e07a}
      .hud button:disabled{opacity:.55;cursor:default}
      .hud .shop{display:none;position:absolute;inset:8% 12%;overflow:auto;background:rgba(13,20,14,.97);z-index:3}
      .hud .shop.open{display:block}
      .hud .shop-head{display:flex;justify-content:space-between;align-items:center}
      .hud .shop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .hud .shop-card{border:1px solid #456b49;border-radius:8px;padding:10px}
      .hud .shop-card button{margin:4px 4px 0 0}
      .hud .msg{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(120,30,30,.92);border-radius:8px;padding:6px 12px;opacity:0;transition:opacity .2s}
      .hud .msg.show{opacity:1}
    `;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'hud';
    document.body.appendChild(this.root);

    this.status = this.make('div', 'panel top', 'hud-status');
    this.inventory = this.make('div', 'panel right', 'hud-inventory');

    const bottom = this.make('div', 'bottom');
    for (const tool of ['plant', 'water', 'feed', 'harvest'] as Tool[]) {
      const button = document.createElement('button');
      button.dataset.testid = `tool-${tool}`;
      button.textContent = tool[0].toUpperCase() + tool.slice(1);
      button.addEventListener('click', () => {
        this.tool = tool;
        this.render();
      });
      bottom.appendChild(button);
    }

    const cropSelect = document.createElement('select');
    cropSelect.dataset.testid = 'crop-select';
    for (const id of CROP_IDS) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = CROPS[id].name;
      cropSelect.appendChild(option);
    }
    cropSelect.addEventListener('change', () => {
      this.selectedCrop = cropSelect.value as CropId;
      this.render();
    });
    bottom.appendChild(cropSelect);

    const shopButton = document.createElement('button');
    shopButton.dataset.testid = 'open-shop';
    shopButton.textContent = 'Farm Supply';
    shopButton.addEventListener('click', () => this.shop.classList.add('open'));
    bottom.appendChild(shopButton);

    const marketButton = document.createElement('button');
    marketButton.dataset.testid = 'open-market';
    marketButton.textContent = 'Market';
    marketButton.addEventListener('click', () => {
      this.market.classList.add('open');
      this.render();
    });
    bottom.appendChild(marketButton);

    this.sprinkler = document.createElement('button');
    this.sprinkler.dataset.testid = 'toggle-sprinkler';
    this.sprinkler.addEventListener('click', () => {
      toggleSprinkler(this.fw);
      this.changed();
    });
    bottom.appendChild(this.sprinkler);

    const endDay = document.createElement('button');
    endDay.dataset.testid = 'end-day';
    endDay.textContent = 'End day';
    endDay.addEventListener('click', () => this.onEndDay?.());
    bottom.appendChild(endDay);

    this.shop = this.make('div', 'panel shop', 'farm-supply');
    this.market = this.make('div', 'panel shop', 'market');
    this.message = this.make('div', 'msg', 'hud-message');
    this.render();
  }

  private make(tag: 'div', className: string, testid?: string): HTMLDivElement {
    const element = document.createElement(tag);
    element.className = className;
    if (testid) element.dataset.testid = testid;
    this.root.appendChild(element);
    return element;
  }

  private transact(action: () => ActionResult): void {
    const result = action();
    if (!result.ok && result.message) this.showMessage(result.message);
    this.changed();
  }

  private changed(): void {
    this.render();
    this.onChanged?.();
  }

  showMessage(text: string): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), 2500);
  }

  renderDayReport(report: DayReport): void {
    const messages: string[] = [];
    if (report.sprinkler.cost > 0) messages.push(`Sprinklers watered ${report.sprinkler.watered} tiles for ${report.sprinkler.cost} gold.`);
    if (report.sprinkler.switchedOff) messages.push('Sprinklers switched off: not enough gold.');
    if (report.scorcher) messages.push("Scorcher day: the soil's drying fast.");
    if (report.spoiled > 0) messages.push(`${report.spoiled} crops spoiled in the barn overnight.`);
    for (const ev of report.contractEvents) {
      messages.push(
        ev.type === 'delivered'
          ? `Contract delivered: ${ev.contract.qty} ${CROPS[ev.contract.crop].name} for ${ev.amount} gold.`
          : `Contract defaulted: paid ${-ev.amount} gold penalty.`,
      );
    }
    if (report.seasonChanged) messages.push(`${SEASONS[report.seasonChanged].name} has arrived.`);
    if (messages.length > 0) this.showMessage(messages.join(' '));
  }

  render(): void {
    const calendar = this.fw.calendar;
    const season = SEASONS[calendar.season];
    const farm = this.fw.world.get(this.fw.farm, this.fw.components.Farm)!;
    this.status.innerHTML = `
      <span data-testid="hud-gold">💰 ${farm.gold}</span> ·
      <span data-testid="hud-day">${season.icon} ${season.name} ${calendar.dayOfSeason}, Y${calendar.year}</span> ·
      <span data-testid="hud-storage">🏗 ${storedTotal(farm.storage)}/${storageCapacity(farm.silos, farm.upgrades.silo)}</span>`;
    this.inventory.innerHTML =
      CROP_IDS.map((id) => `<div data-testid="seeds-${id}">${CROPS[id].name}: ${farm.seeds[id]} seeds · ${farm.storage[id]} stored</div>`).join('') +
      `<div data-testid="plant-food">Plant food: ${farm.plantFood}</div>`;

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button[data-testid^="tool-"]')) {
      button.classList.toggle('active', button.dataset.testid === `tool-${this.tool}`);
    }

    this.sprinkler.style.display = farm.upgrades.sprinkler > 0 ? '' : 'none';
    this.sprinkler.textContent = `Sprinklers: ${farm.sprinklerOn ? 'ON' : 'OFF'}`;
    this.sprinkler.classList.toggle('active', farm.sprinklerOn);

    this.shop.innerHTML = `
      <div class="shop-head"><h2>Farm Supply</h2><button data-testid="close-shop">Close</button></div>
      <h3>Seeds</h3><div class="shop-grid">
        ${CROP_IDS.map((id) => `<div class="shop-card"><strong>${CROPS[id].icon} ${CROPS[id].name}</strong><div>${CROPS[id].seedPrice} gold each</div>${[1, 5, 10].map((amount) => `<button data-testid="buy-${id}-${amount}">Buy ${amount}</button>`).join('')}</div>`).join('')}
      </div>
      <h3>Plant food</h3><div class="shop-card"><strong>Plant food</strong><div>${FEED_COST} gold each</div>${[1, 5, 10].map((amount) => `<button data-testid="buy-feed-${amount}">Buy ${amount}</button>`).join('')}</div>
      <h3>Equipment</h3><div class="shop-grid">
        ${UPGRADE_IDS.map((id) => {
          const level = farm.upgrades[id];
          const maxed = level >= UPGRADES[id].max;
          return `<div class="shop-card"><strong>${UPGRADES[id].icon} ${UPGRADES[id].name}</strong><div>${UPGRADES[id].desc}</div><div>Level ${level}/${UPGRADES[id].max}</div><button data-testid="buy-upgrade-${id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `Buy · ${upgradeCost(id, level)} gold`}</button></div>`;
        }).join('')}
      </div>`;

    this.shop.querySelector<HTMLButtonElement>('[data-testid="close-shop"]')!.addEventListener('click', () => this.shop.classList.remove('open'));
    for (const id of CROP_IDS) {
      for (const amount of [1, 5, 10]) {
        this.shop.querySelector<HTMLButtonElement>(`[data-testid="buy-${id}-${amount}"]`)!.addEventListener('click', () => this.transact(() => buySeeds(this.fw, id, amount)));
      }
    }
    for (const amount of [1, 5, 10]) {
      this.shop.querySelector<HTMLButtonElement>(`[data-testid="buy-feed-${amount}"]`)!.addEventListener('click', () => this.transact(() => buyFeed(this.fw, amount)));
    }
    for (const id of UPGRADE_IDS) {
      this.shop.querySelector<HTMLButtonElement>(`[data-testid="buy-upgrade-${id}"]`)!.addEventListener('click', () => this.transact(() => buyUpgrade(this.fw, id)));
    }

    this.renderMarket(farm);
  }

  private sell(action: () => SellResult): void {
    const result = action();
    if (result.ok) this.showMessage(`Sold ${result.sold} for ${result.earned} gold.`);
    else if (result.message) this.showMessage(result.message);
    this.changed();
  }

  private renderMarket(farm: { storage: Record<CropId, number> }): void {
    const market = this.fw.market;
    const contracts = this.fw.contracts;
    this.market.innerHTML = `
      <div class="shop-head"><h2>Grain Elevator</h2><button data-testid="close-market">Close</button></div>
      <div data-testid="elevator-room">Elevator intake left today: ${market.elevatorRoom()} bu</div>
      <button data-testid="sell-all">Sell all (best price first)</button>
      <h3>Today's prices</h3><div class="shop-grid">
        ${CROP_IDS.map((id) => `<div class="shop-card"><strong>${CROPS[id].icon} ${CROPS[id].name}</strong><div data-testid="price-${id}">${market.prices[id]} gold</div><div>${farm.storage[id]} stored</div><button data-testid="sell-${id}-1">Sell 1</button><button data-testid="sell-${id}-all">Sell all</button></div>`).join('')}
      </div>
      <h3>Forward contracts</h3><div class="shop-grid" data-testid="contract-offers">
        ${contracts.offers.map((o) => `<div class="shop-card"><strong>${CROPS[o.crop].icon} ${o.qty} ${CROPS[o.crop].name}</strong><div>${o.price} gold each · due day ${o.due}</div><button data-testid="accept-contract-${o.id}">Accept</button></div>`).join('')}
      </div>
      <h3>Active contracts</h3><div data-testid="active-contracts">
        ${contracts.active.length === 0 ? '<div>None.</div>' : contracts.active.map((k) => `<div data-testid="contract-${k.id}">${k.qty} ${CROPS[k.crop].name} @ ${k.price} gold · due day ${k.due}</div>`).join('')}
      </div>`;

    this.market.querySelector<HTMLButtonElement>('[data-testid="close-market"]')!.addEventListener('click', () => this.market.classList.remove('open'));
    this.market.querySelector<HTMLButtonElement>('[data-testid="sell-all"]')!.addEventListener('click', () => this.sell(() => market.sellAll()));
    for (const id of CROP_IDS) {
      this.market.querySelector<HTMLButtonElement>(`[data-testid="sell-${id}-1"]`)!.addEventListener('click', () => this.sell(() => market.sellItem(id, 1)));
      this.market.querySelector<HTMLButtonElement>(`[data-testid="sell-${id}-all"]`)!.addEventListener('click', () => this.sell(() => market.sellItem(id, farm.storage[id])));
    }
    for (const o of contracts.offers) {
      this.market.querySelector<HTMLButtonElement>(`[data-testid="accept-contract-${o.id}"]`)!.addEventListener('click', () => {
        contracts.accept(o.id, this.fw.calendar.day);
        this.showMessage('Contract accepted.');
        this.changed();
      });
    }
  }
}
