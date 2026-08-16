import type { FarmWorld, DayReport } from '../sim/world';
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
    if (report.scorcher) messages.push('Scorcher day: dry crops took damage.');
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
  }
}
