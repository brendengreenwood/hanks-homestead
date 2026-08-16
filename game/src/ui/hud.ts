import type { FarmWorld } from '../sim/world';
import { CROPS, SEASONS, CROP_IDS, type CropId } from '../sim/constants';
import { storageCapacity, storedTotal } from '../sim/actions';

export type Tool = 'plant' | 'water' | 'harvest';

/**
 * DOM overlay HUD (replaces legacy Hud.jsx). Buttons carry data-testid
 * attributes so the playwright proof flows drive the same controls a human
 * clicks. The overlay root is pointer-events:none; widgets opt back in.
 */
export class Hud {
  tool: Tool = 'plant';
  selectedCrop: CropId = 'wheat';
  onEndDay: (() => void) | null = null;

  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly inventory: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private messageTimer: number | undefined;

  constructor(private readonly fw: FarmWorld) {
    const style = document.createElement('style');
    style.textContent = `
      .hud{position:fixed;inset:0;pointer-events:none;font:14px/1.4 system-ui,sans-serif;color:#fff}
      .hud .panel{pointer-events:auto;background:rgba(20,28,20,.82);border-radius:10px;padding:10px 14px;margin:10px}
      .hud .top{position:absolute;top:0;left:0;display:flex;gap:8px;align-items:center}
      .hud .bottom{position:absolute;bottom:0;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center}
      .hud .right{position:absolute;top:0;right:0}
      .hud button{pointer-events:auto;background:#2f5d34;color:#fff;border:1px solid #4a8a52;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}
      .hud button.active{background:#7ac142;color:#12310f;border-color:#a4e07a}
      .hud .msg{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(120,30,30,.9);border-radius:8px;padding:6px 12px;opacity:0;transition:opacity .2s}
      .hud .msg.show{opacity:1}
    `;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'hud';
    document.body.appendChild(this.root);

    this.status = this.make('div', 'panel top', 'hud-status');
    this.inventory = this.make('div', 'panel right', 'hud-inventory');

    const bottom = this.make('div', 'bottom');
    const tools: Tool[] = ['plant', 'water', 'harvest'];
    for (const tool of tools) {
      const b = document.createElement('button');
      b.dataset.testid = `tool-${tool}`;
      b.textContent = tool[0].toUpperCase() + tool.slice(1);
      b.addEventListener('click', () => {
        this.tool = tool;
        this.render();
      });
      bottom.appendChild(b);
    }
    const cropSel = document.createElement('select');
    cropSel.dataset.testid = 'crop-select';
    cropSel.style.pointerEvents = 'auto';
    for (const id of CROP_IDS) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = CROPS[id].name;
      cropSel.appendChild(o);
    }
    cropSel.addEventListener('change', () => {
      this.selectedCrop = cropSel.value as CropId;
      this.render();
    });
    bottom.appendChild(cropSel);
    const endDay = document.createElement('button');
    endDay.dataset.testid = 'end-day';
    endDay.textContent = 'End day';
    endDay.addEventListener('click', () => this.onEndDay?.());
    bottom.appendChild(endDay);

    this.message = this.make('div', 'msg', 'hud-message');
    this.render();
  }

  private make(tag: 'div', className: string, testid?: string): HTMLDivElement {
    const el = document.createElement(tag);
    el.className = className;
    if (testid) el.dataset.testid = testid;
    this.root.appendChild(el);
    return el;
  }

  showMessage(text: string): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), 2500);
  }

  render(): void {
    const cal = this.fw.calendar;
    const season = SEASONS[cal.season];
    const farm = this.fw.world.get(this.fw.farm, this.fw.components.Farm)!;
    this.status.innerHTML = `
      <span data-testid="hud-gold">💰 ${farm.gold}</span> ·
      <span data-testid="hud-day">${season.icon} ${season.name} ${cal.dayOfSeason}, Y${cal.year}</span> ·
      <span data-testid="hud-storage">🏗 ${storedTotal(farm.storage)}/${storageCapacity(farm.silos)}</span>`;
    this.inventory.innerHTML =
      CROP_IDS.map(
        (id) =>
          `<div data-testid="seeds-${id}">${CROPS[id].name}: ${farm.seeds[id]} seeds · ${farm.storage[id]} stored</div>`,
      ).join('') + `<div data-testid="plant-food">Plant food: ${farm.plantFood}</div>`;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('button[data-testid^="tool-"]')) {
      b.classList.toggle('active', b.dataset.testid === `tool-${this.tool}`);
    }
  }
}
