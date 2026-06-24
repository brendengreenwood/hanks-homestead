import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  CROPS,
  FIELD_OFFSET,
  FIELD_SIZE,
  SEASON_ACTIONS,
  CONTRACT_PENALTY,
  CONTRACT_SLOTS,
  SEASON_LENGTH,
  SEASONS,
  WATER_DAYS,
  WORLD_SIZE,
  PRICE_HISTORY_LEN,
  SPRINKLER_COST_PER_TILE,
  UPGRADES,
  dayOfSeason,
  emptyCell,
  fieldHeight,
  initialPriceHistory,
  initialPrices,
  makeGrid,
  seasonForDay,
  seasonalPriceFactor,
  speedFactor,
  storedTotal,
  upgradeCost,
} from './game/constants.js';
import { buildSelectionQueue, findPath, isFarmland, isWalkable, storageCapacity } from './game/logic.js';
import { useAmbience, useMusic, useSound } from './hooks/useAudio.js';
import FarmScene from './three/FarmScene.jsx';
import Hud from './ui/Hud.jsx';

// localStorage save: only the persistent game fields (not transient UI/anim state).
const SAVE_KEY = 'hanks-homestead-save-v1';
const PERSIST_KEYS = [
  'gold', 'day', 'selectedAction', 'selectedCrop', 'inventory',
  'farmerPos', 'farmerDir', 'grid', 'buildings', 'prices', 'priceHistory', 'upgrades', 'sprinklerOn',
  'contracts', 'contractOffers', 'contractSeq',
];

export default function HanksHomestead() {
  const sounds = useSound();
  const music = useMusic(sounds.getAudioContext);
  const ambience = useAmbience(sounds.getAudioContext);
  const musicStartedRef = useRef(false);
  const ambienceStartedRef = useRef(false);

  const gameState = useRef({
    gold: 200,
    day: 1,
    selectedAction: 'plant',
    selectedCrop: 'wheat',
    inventory: { wheat_seeds: 10, carrot_seeds: 10, tomato_seeds: 10, corn_seeds: 10, pumpkin_seeds: 10 },
    prices: initialPrices(),
    priceHistory: initialPriceHistory(),
    upgrades: { tractor: 0, sprinkler: 0, silo: 0, plot: 0 },
    sprinklerOn: false,
    contracts: [],
    contractOffers: [],
    contractSeq: 1,
    farmerPos: { x: FIELD_OFFSET + 4, y: FIELD_OFFSET + 4 },
    farmerDir: 'down',
    isMoving: false,
    actionTick: 0, // bumped on each tile action to trigger the interact animation
    grid: makeGrid(),
    buildings: [
      { type: 'barn', x: FIELD_OFFSET - 3, y: FIELD_OFFSET },
      { type: 'house', x: FIELD_OFFSET - 3, y: FIELD_OFFSET + 7 },
      { type: 'silo', x: FIELD_OFFSET + FIELD_SIZE + 1, y: FIELD_OFFSET + 2 },
    ],
    hoveredTile: null,
    isDragging: false,
    selectionStart: null,
    selectionEnd: null,
    isAutoActing: false,
    autoActionQueue: [],
    pendingActionType: null,
    isPathing: false,
    pathQueue: [],
    pendingActionQueue: [],
    speechBubble: null,
    speechTimeout: null,
    notification: null,
    notificationTimeout: null,
    showShop: false,
    showSellModal: false,
    showStore: false,
  });

  const [version, forceUpdate] = useState(0);
  const requestRender = useCallback(() => forceUpdate((n) => n + 1), []);
  const gs = gameState.current;

  // ============================================
  // FEEDBACK HELPERS
  // ============================================
  const showNotification = (msg, type = 'info') => {
    if (gs.notificationTimeout) clearTimeout(gs.notificationTimeout);
    gs.notification = { msg, type };
    gs.notificationTimeout = setTimeout(() => {
      gs.notification = null;
      requestRender();
    }, 2500);
    requestRender();
  };

  const showSpeech = (msg, duration = 2000) => {
    if (gs.speechTimeout) clearTimeout(gs.speechTimeout);
    gs.speechBubble = msg;
    gs.speechTimeout = setTimeout(() => {
      gs.speechBubble = null;
      requestRender();
    }, duration);
    requestRender();
  };

  const handleOutOfSeeds = () => {
    const currentCrop = CROPS[gs.selectedCrop];
    const seedCounts = Object.entries(CROPS)
      .map(([cropId, crop]) => ({ cropId, crop, count: gs.inventory[`${cropId}_seeds`] || 0 }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    if (seedCounts.length === 0) {
      showSpeech('All out of seeds... time for bed?', 3000);
      showNotification('No seeds left! End turn to advance.', 'info');
    } else {
      const best = seedCounts[0];
      showSpeech(`Out of ${currentCrop.icon} ${currentCrop.name} seeds! Try ${best.crop.icon} ${best.crop.name}?`, 2500);
      gs.selectedCrop = best.cropId;
    }
    sounds.error();
    requestRender();
  };

  // ============================================
  // CORE ACTIONS
  // ============================================
  const performAction = () => {
    const { x, y } = gs.farmerPos;
    const season = seasonForDay(gs.day);
    const cell = gs.grid[y][x];

    if (!isFarmland(x, y, fieldHeight(gs.upgrades))) {
      sounds.error();
      showNotification("Can't farm here - go to the field!", 'error');
      return;
    }

    if (gs.selectedAction === 'plant' && !cell.crop) {
      if (season !== 'spring') {
        sounds.error();
        showNotification('Can only plant in Spring!', 'error');
        return;
      }
      const seedKey = `${gs.selectedCrop}_seeds`;
      if ((gs.inventory[seedKey] || 0) > 0) {
        gs.inventory[seedKey]--;
        gs.grid[y][x] = { crop: gs.selectedCrop, growth: 0, moisture: 0, watered: false, fed: false, harvestPenalty: false };
        sounds.plant();
        gs.actionTick++;
        showNotification(`Planted ${CROPS[gs.selectedCrop].icon} ${CROPS[gs.selectedCrop].name}!`, 'success');
      } else {
        handleOutOfSeeds();
      }
    } else if (gs.selectedAction === 'water' && cell.crop && !cell.watered) {
      if (season !== 'summer') {
        showNotification('Can only water in Summer!', 'info');
        return;
      }
      gs.grid[y][x].moisture = WATER_DAYS;
      gs.grid[y][x].watered = true;
      sounds.water();
      gs.actionTick++;
      showNotification('Watered!', 'success');
    } else if (gs.selectedAction === 'clean' && cell.crop) {
      if (season !== 'summer') {
        showNotification('Can only feed in Summer!', 'info');
        return;
      }
      if (!cell.fed) {
        gs.grid[y][x].fed = true;
        sounds.water();
        gs.actionTick++;
        showNotification('Applied plant food!', 'success');
      } else {
        showNotification('Already fed!', 'info');
      }
    } else if (gs.selectedAction === 'harvest' && cell.crop) {
      if (season !== 'fall') {
        sounds.error();
        showNotification('Can only harvest in Fall!', 'error');
        return;
      }
      const cropData = CROPS[cell.crop];
      if (cell.growth >= cropData.growTime) {
        const space = storageCapacity(gs.buildings, gs.upgrades.silo) - storedTotal(gs.inventory);
        if (space <= 0) {
          sounds.error();
          showNotification("Silo's full — sell some crops!", 'error');
          return;
        }
        let harvestAmount = 1;
        let message = '';
        if (cell.harvestPenalty) {
          message = ' (withered - water next time!)';
        } else if (cell.fed) {
          harvestAmount = 2;
          message = ' (+1 bonus!)';
        }
        gs.inventory[cell.crop] = (gs.inventory[cell.crop] || 0) + Math.min(harvestAmount, space);
        gs.grid[y][x] = emptyCell();
        sounds.harvest();
        gs.actionTick++;
        showNotification(`Harvested ${cropData.icon} ${cropData.name}!${message}`, cell.harvestPenalty ? 'info' : 'success');
      } else {
        sounds.error();
        showNotification('Not ready yet!', 'error');
      }
    } else {
      sounds.error();
    }
    requestRender();
  };

  // Advance every planted crop one day, based on the day's season:
  //  • spring — rain keeps soil moist, crops grow freely
  //  • summer — dry; crops only grow when there's moisture (so you must water).
  //    A dry day stunts the crop (reduced yield at harvest).
  //  • fall/winter — no growth.
  const growCropsForDay = (season) => {
    if (season !== 'spring' && season !== 'summer') return;
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const cell = gs.grid[y][x];
        if (!cell.crop || cell.growth >= CROPS[cell.crop].growTime) continue;
        if (season === 'spring') {
          cell.moisture = Math.max(cell.moisture, 2); // spring showers
          cell.watered = true;
          cell.growth++;
        } else {
          if (cell.moisture > 0) {
            cell.moisture--;
            cell.watered = cell.moisture > 0;
            cell.growth++;
          } else {
            cell.watered = false;
            cell.harvestPenalty = true; // went thirsty — withers a bit
          }
        }
      }
    }
  };

  // Market: mean-revert each crop's price toward its seasonal target, plus noise.
  const tickMarket = () => {
    for (const [id, c] of Object.entries(CROPS)) {
      const target = c.sellPrice * seasonalPriceFactor(gs.day) * (0.94 + Math.random() * 0.12);
      const cur = gs.prices[id] ?? c.sellPrice;
      let next = Math.round(cur + (target - cur) * 0.4);
      next = Math.max(Math.round(c.sellPrice * 0.4), Math.min(Math.round(c.sellPrice * 1.9), next));
      gs.prices[id] = next;
      const h = gs.priceHistory[id] || (gs.priceHistory[id] = []);
      h.push(next);
      if (h.length > PRICE_HISTORY_LEN) h.shift();
    }
  };

  // Spoilage: perishables lose a slice of the stockpile each day (grain keeps).
  const spoilTick = () => {
    let spoiled = 0;
    for (const [id, c] of Object.entries(CROPS)) {
      const count = gs.inventory[id] || 0;
      if (count > 0 && c.shelfLife < 999) {
        const lost = Math.floor(count / c.shelfLife);
        if (lost > 0) { gs.inventory[id] -= lost; spoiled += lost; }
      }
    }
    if (spoiled > 0) showNotification(`${spoiled} crop${spoiled > 1 ? 's' : ''} spoiled — sell perishables sooner!`, 'info');
  };

  // Selling nudges a crop's price down; it recovers via daily mean-reversion.
  const applyMarketImpact = (id, qty) => {
    const c = CROPS[id];
    const drop = Math.min(0.25, qty * 0.004);
    gs.prices[id] = Math.max(Math.round(c.sellPrice * 0.4), Math.round((gs.prices[id] ?? c.sellPrice) * (1 - drop)));
  };

  const ensureMarket = () => {
    if (!gs.prices) gs.prices = initialPrices();
    if (!gs.priceHistory) gs.priceHistory = initialPriceHistory();
    if (!gs.upgrades) gs.upgrades = { tractor: 0, sprinkler: 0, silo: 0, plot: 0 };
    if (gs.upgrades.sprinkler === undefined) gs.upgrades.sprinkler = 0;
    if (gs.sprinklerOn === undefined) gs.sprinklerOn = false;
  };

  const buyUpgrade = (key) => {
    const lvl = gs.upgrades[key] || 0;
    if (lvl >= UPGRADES[key].max) return;
    const cost = upgradeCost(key, lvl);
    if (gs.gold < cost) {
      sounds.error();
      showNotification('Not enough gold!', 'error');
      return;
    }
    gs.gold -= cost;
    gs.upgrades[key] = lvl + 1;
    if (key === 'sprinkler') gs.sprinklerOn = true;
    sounds.buyBulk();
    showNotification(`Bought ${UPGRADES[key].icon} ${UPGRADES[key].name}!`, 'success');
    requestRender();
  };

  // Sprinklers: each summer day, auto-water planted crops for a per-tile fee.
  const sprinklerTick = (season) => {
    if (season !== 'summer' || !gs.upgrades.sprinkler || !gs.sprinklerOn) return;
    let tiles = 0;
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const cell = gs.grid[y][x];
        if (cell.crop && cell.growth < CROPS[cell.crop].growTime) tiles++;
      }
    }
    if (tiles === 0) return;
    const cost = tiles * SPRINKLER_COST_PER_TILE;
    if (cost > gs.gold) {
      gs.sprinklerOn = false;
      showNotification("Can't afford the sprinklers — switched off!", 'error');
      return;
    }
    gs.gold -= cost;
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const cell = gs.grid[y][x];
        if (cell.crop && cell.growth < CROPS[cell.crop].growTime) {
          cell.moisture = WATER_DAYS;
          cell.watered = true;
        }
      }
    }
    showNotification(`💧 Sprinklers watered ${tiles} crops (−${cost}g)`, 'info');
  };

  // ---- Forward contracts ----
  const makeContractOffer = () => {
    const ids = Object.keys(CROPS);
    const crop = ids[Math.floor(Math.random() * ids.length)];
    const base = CROPS[crop].sellPrice;
    const price = Math.round(base * (1.08 + Math.random() * 0.22)); // 8–30% over mean
    const qty = 8 + Math.floor(Math.random() * 18); // 8–25
    const due = gs.day + SEASON_LENGTH + Math.floor(Math.random() * SEASON_LENGTH * 2);
    return { id: gs.contractSeq++, crop, qty, price, due };
  };
  const ensureContracts = () => {
    if (!gs.contracts) gs.contracts = [];
    if (!gs.contractOffers) gs.contractOffers = [];
    if (!gs.contractSeq) gs.contractSeq = 1;
    while (gs.contractOffers.length < CONTRACT_SLOTS) gs.contractOffers.push(makeContractOffer());
  };
  const acceptContract = (id) => {
    const i = gs.contractOffers.findIndex((o) => o.id === id);
    if (i < 0) return;
    const [offer] = gs.contractOffers.splice(i, 1);
    gs.contracts.push(offer);
    gs.contractOffers.push(makeContractOffer());
    sounds.buy();
    showNotification(`Contract signed: ${offer.qty} ${CROPS[offer.crop].icon} by day ${offer.due}`, 'success');
    requestRender();
  };
  // Settle any contracts that have come due (deliver from storage, or pay a penalty).
  const tickContracts = () => {
    if (!gs.contracts || gs.contracts.length === 0) return;
    const remaining = [];
    for (const k of gs.contracts) {
      if (gs.day < k.due) { remaining.push(k); continue; }
      const have = gs.inventory[k.crop] || 0;
      if (have >= k.qty) {
        gs.inventory[k.crop] = have - k.qty;
        gs.gold += k.qty * k.price;
        sounds.sell();
        showNotification(`📜 Delivered ${k.qty} ${CROPS[k.crop].icon} — +${k.qty * k.price}g`, 'success');
      } else {
        const penalty = Math.round(k.qty * k.price * CONTRACT_PENALTY);
        gs.gold = Math.max(0, gs.gold - penalty);
        sounds.error();
        showNotification(`📜 Contract defaulted! −${penalty}g`, 'error');
      }
    }
    gs.contracts = remaining;
  };

  const advanceDay = () => {
    const currentSeason = seasonForDay(gs.day);
    gs.day++;
    const nextSeason = seasonForDay(gs.day);

    sprinklerTick(nextSeason);
    growCropsForDay(nextSeason);
    tickMarket();
    spoilTick();
    tickContracts();

    // A plain day within the same season: just advance, light feedback.
    if (nextSeason === currentSeason) {
      sounds.click();
      showNotification(`${SEASONS[nextSeason].name} — Day ${dayOfSeason(gs.day)} of ${SEASON_LENGTH}`, 'info');
      requestRender();
      return;
    }

    // Crossed into a new season — switch the default tool, music, and run the
    // season-transition event.
    gs.selectedAction = SEASON_ACTIONS[nextSeason][0].id;
    gs.contractOffers = []; // fresh offers each season
    ensureContracts();
    music.changeSeason(nextSeason);
    ambience.changeSeason(nextSeason);

    if (currentSeason === 'spring' && nextSeason === 'summer') {
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("Whoo-wee, it's gettin' hot! Keep them crops watered or they'll wither!", 4000);
      }, 500);
    } else if (currentSeason === 'summer' && nextSeason === 'fall') {
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("Harvest time! Reap what's ripened — the well-watered ones did best.", 4000);
      }, 500);
    } else if (currentSeason === 'fall' && nextSeason === 'winter') {
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("Brrr! Winter's comin'! Better sell what we got before the snow flies!", 4000);
      }, 500);
      gs.showSellModal = true;
    } else if (currentSeason === 'winter' && nextSeason === 'spring') {
      gs.grid = makeGrid();
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("It's spring! Nothin' like fresh dirt and new seeds! Let's get plantin'!", 4000);
      }, 500);
    }
    requestRender();
  };

  const sellItem = (item, all = false) => {
    const count = gs.inventory[item] || 0;
    if (count <= 0) return;
    const qty = all ? count : 1;
    const price = gs.prices[item] ?? CROPS[item].sellPrice;
    gs.gold += price * qty;
    gs.inventory[item] -= qty;
    applyMarketImpact(item, qty);
    sounds.sell();
    showNotification(`Sold ${qty} ${CROPS[item].icon} for ${price * qty}g!`, 'success');
    requestRender();
  };

  const sellAll = () => {
    let sold = 0;
    let earned = 0;
    for (const item of Object.keys(CROPS)) {
      const count = gs.inventory[item] || 0;
      if (count <= 0) continue;
      const price = gs.prices[item] ?? CROPS[item].sellPrice;
      earned += price * count;
      gs.gold += price * count;
      gs.inventory[item] = 0;
      applyMarketImpact(item, count);
      sold += count;
    }
    if (sold > 0) {
      sounds.sell();
      showNotification(`Sold ${sold} crops for ${earned}g!`, 'success');
    }
    requestRender();
  };

  const buySeeds = (cropId, amount) => {
    const cost = CROPS[cropId].seedPrice * amount;
    if (gs.gold >= cost) {
      gs.gold -= cost;
      gs.inventory[`${cropId}_seeds`] = (gs.inventory[`${cropId}_seeds`] || 0) + amount;
      if (amount > 1) sounds.buyBulk();
      else sounds.buy();
      requestRender();
    }
  };

  const resetGame = () => {
    gs.gold = 200;
    gs.day = 1;
    gs.selectedAction = 'plant';
    gs.selectedCrop = 'wheat';
    gs.inventory = { wheat_seeds: 10, carrot_seeds: 10, tomato_seeds: 10, corn_seeds: 10, pumpkin_seeds: 10 };
    gs.farmerPos = { x: FIELD_OFFSET + 4, y: FIELD_OFFSET + 4 };
    gs.farmerDir = 'down';
    gs.grid = makeGrid();
    gs.isPathing = false;
    gs.pathQueue = [];
    gs.isAutoActing = false;
    gs.autoActionQueue = [];
    gs.pendingActionQueue = [];
    gs.pendingActionType = null;
    gs.showShop = false;
    gs.showSellModal = false;
    gs.showStore = false;
    gs.upgrades = { tractor: 0, sprinkler: 0, silo: 0, plot: 0 };
    gs.sprinklerOn = false;
    gs.contracts = [];
    gs.contractOffers = [];
    gs.contractSeq = 1;
    gs.prices = initialPrices();
    gs.priceHistory = initialPriceHistory();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    setTimeout(() => showSpeech("Alrighty, fresh start! Let's make this the best darn harvest yet!", 4000), 300);
    requestRender();
  };

  // ============================================
  // SAVE / LOAD (localStorage)
  // ============================================
  const loadedRef = useRef(false);
  const saveGame = () => {
    try {
      const snap = {};
      for (const k of PERSIST_KEYS) snap[k] = gs[k];
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    } catch (e) {}
  };
  const loadGame = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const snap = JSON.parse(raw);
      for (const k of PERSIST_KEYS) if (snap[k] !== undefined) gs[k] = snap[k];
      return true;
    } catch (e) {
      return false;
    }
  };

  // ============================================
  // AUDIO BOOTSTRAP
  // ============================================
  useEffect(() => {
    music.preloadAll();
    ambience.preloadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startAudioIfNeeded = useCallback(() => {
    const currentSeason = seasonForDay(gs.day);
    if (!musicStartedRef.current) {
      musicStartedRef.current = true;
      music.changeSeason(currentSeason, 0, 0.5);
    }
    if (!ambienceStartedRef.current) {
      ambienceStartedRef.current = true;
      ambience.changeSeason(currentSeason, 0, 0.5);
    }
  }, [music, ambience]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a saved game on mount (before the welcome plays).
  useEffect(() => {
    loadedRef.current = loadGame();
    ensureMarket();
    ensureContracts();
    if (loadedRef.current) requestRender();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave whenever state changes, plus a save on unload.
  useEffect(() => {
    const t = setTimeout(saveGame, 800);
    return () => clearTimeout(t);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('beforeunload', saveGame);
    return () => window.removeEventListener('beforeunload', saveGame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome message (only on a fresh game)
  useEffect(() => {
    const t = setTimeout(() => {
      if (loadedRef.current) showSpeech('Welcome back, partner! Right where you left off.', 3500);
      else showSpeech("Howdy! Welcome to Hank's Homestead! It's plantin' season, partner!", 4000);
    }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // TILE INTERACTION (raycast picking from FarmScene)
  // ============================================
  const onTilePointerDown = (x, y) => {
    startAudioIfNeeded();
    const season = seasonForDay(gs.day);
    if ((season === 'spring' || season === 'summer' || season === 'fall') && isFarmland(x, y, fieldHeight(gs.upgrades))) {
      gs.isDragging = true;
      gs.selectionStart = { x, y };
      gs.selectionEnd = { x, y };
      requestRender();
    }
  };

  const onTilePointerEnter = (x, y) => {
    let changed = false;
    if (!gs.hoveredTile || gs.hoveredTile.x !== x || gs.hoveredTile.y !== y) {
      gs.hoveredTile = { x, y };
      changed = true;
    }
    if (gs.isDragging) {
      gs.selectionEnd = { x, y };
      changed = true;
    }
    if (changed) requestRender();
  };

  const clearSelection = () => {
    if (gs.isDragging || gs.selectionStart) {
      gs.isDragging = false;
      gs.selectionStart = null;
      gs.selectionEnd = null;
      requestRender();
    }
  };

  // Finalize a drag selection into a path + auto-action queue (snake order).
  const finalizeSelection = () => {
    if (!gs.isDragging || !gs.selectionStart || !gs.selectionEnd) {
      gs.isDragging = false;
      return;
    }
    gs.isDragging = false;

    const season = seasonForDay(gs.day);
    if (season !== 'spring' && season !== 'summer' && season !== 'fall') {
      gs.selectionStart = null;
      gs.selectionEnd = null;
      requestRender();
      return;
    }

    const queue = buildSelectionQueue(gs.selectionStart, gs.selectionEnd, fieldHeight(gs.upgrades));
    gs.selectionStart = null;
    gs.selectionEnd = null;

    if (queue.length === 0) {
      requestRender();
      return;
    }

    if (gs.selectedAction === 'plant') {
      const seedKey = `${gs.selectedCrop}_seeds`;
      if ((gs.inventory[seedKey] || 0) === 0) {
        handleOutOfSeeds();
        return;
      }
    }

    const firstCell = queue[0];
    const path = findPath(gs.buildings, gs.farmerPos.x, gs.farmerPos.y, firstCell.x, firstCell.y);

    gs.pendingActionType = gs.selectedAction;
    if (path.length > 0) {
      gs.pathQueue = path;
      gs.isPathing = true;
      gs.pendingActionQueue = queue;
    } else {
      gs.autoActionQueue = queue;
      gs.isAutoActing = true;
    }
    requestRender();
  };

  // Global pointerup finalizes whatever selection is in progress.
  useEffect(() => {
    const onUp = () => finalizeSelection();
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }); // run each render so closure sees fresh gs (cheap; gs is a ref)

  // Move the farmer one tile in a direction (shared by keyboard + on-screen pad).
  const DIR_DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const stepFarmer = (dir) => {
    const [dx, dy] = DIR_DELTA[dir] || [0, 0];
    const newX = Math.max(0, Math.min(WORLD_SIZE - 1, gs.farmerPos.x + dx));
    const newY = Math.max(0, Math.min(WORLD_SIZE - 1, gs.farmerPos.y + dy));

    // manual movement cancels any in-progress auto path
    if (gs.isPathing) {
      gs.isPathing = false;
      gs.pathQueue = [];
      gs.pendingActionQueue = [];
      gs.pendingActionType = null;
    }

    if (!isWalkable(gs.buildings, newX, newY)) {
      gs.farmerDir = dir;
      requestRender();
      return;
    }
    if (newX !== gs.farmerPos.x || newY !== gs.farmerPos.y) {
      gs.isMoving = true;
      gs.farmerDir = dir;
      gs.farmerPos = { x: newX, y: newY };
      requestRender();
      setTimeout(() => { gs.isMoving = false; requestRender(); }, 150);
    } else {
      gs.farmerDir = dir;
      requestRender();
    }
  };

  // ============================================
  // KEYBOARD
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': stepFarmer('up'); return;
        case 's': case 'arrowdown': stepFarmer('down'); return;
        case 'a': case 'arrowleft': stepFarmer('left'); return;
        case 'd': case 'arrowright': stepFarmer('right'); return;
        case 'e': e.preventDefault(); performAction(); return;
        case '1': case '2': case '3': case '4': {
          const acts = SEASON_ACTIONS[seasonForDay(gs.day)];
          const idx = parseInt(e.key, 10) - 1;
          if (idx < acts.length) {
            gs.selectedAction = acts[idx].id;
            requestRender();
          }
          return;
        }
        case 'escape':
          gs.isPathing = false;
          gs.pathQueue = [];
          gs.pendingActionQueue = [];
          gs.pendingActionType = null;
          gs.isAutoActing = false;
          gs.autoActionQueue = [];
          gs.showShop = false;
          requestRender();
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // PATH WALKING
  // ============================================
  useEffect(() => {
    if (gs.isPathing && gs.pathQueue.length > 0) {
      const sf = speedFactor(gs.upgrades);
      const timer = setTimeout(() => {
        const [next, ...rest] = gs.pathQueue;
        const dx = next.x - gs.farmerPos.x;
        const dy = next.y - gs.farmerPos.y;
        if (dy < 0) gs.farmerDir = 'up';
        else if (dy > 0) gs.farmerDir = 'down';
        else if (dx < 0) gs.farmerDir = 'left';
        else if (dx > 0) gs.farmerDir = 'right';

        gs.farmerPos = next;
        gs.pathQueue = rest;
        gs.isMoving = true;
        requestRender();
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 80 / sf);

        if (rest.length === 0) {
          gs.isPathing = false;
          if (gs.pendingActionQueue.length > 0) {
            gs.autoActionQueue = gs.pendingActionQueue;
            gs.isAutoActing = true;
            gs.pendingActionQueue = [];
          }
        }
      }, 120 / sf);
      return () => clearTimeout(timer);
    }
  });

  // ============================================
  // AUTO-ACTING (plant/water/feed/harvest along queue)
  // ============================================
  useEffect(() => {
    if (gs.isAutoActing && gs.autoActionQueue.length > 0) {
      const actionType = gs.pendingActionType || gs.selectedAction;

      if (actionType === 'plant') {
        const seedKey = `${gs.selectedCrop}_seeds`;
        if ((gs.inventory[seedKey] || 0) <= 0) {
          gs.isAutoActing = false;
          gs.autoActionQueue = [];
          gs.pendingActionType = null;
          handleOutOfSeeds();
          return;
        }
      }

      const sf = speedFactor(gs.upgrades);
      const timer = setTimeout(() => {
        const [next, ...rest] = gs.autoActionQueue;
        gs.farmerPos = next;
        gs.isMoving = true;

        const cell = gs.grid[next.y][next.x];

        if (actionType === 'plant') {
          const seedKey = `${gs.selectedCrop}_seeds`;
          if (!cell.crop && (gs.inventory[seedKey] || 0) > 0) {
            gs.inventory[seedKey]--;
            gs.grid[next.y][next.x] = { crop: gs.selectedCrop, growth: 0, moisture: 0, watered: false, fed: false, harvestPenalty: false };
            sounds.plant();
          }
        } else if (actionType === 'water') {
          if (cell.crop && !cell.watered) {
            gs.grid[next.y][next.x].moisture = WATER_DAYS;
            gs.grid[next.y][next.x].watered = true;
            sounds.water();
          }
        } else if (actionType === 'clean') {
          if (cell.crop && !cell.fed) {
            gs.grid[next.y][next.x].fed = true;
            sounds.water();
          }
        } else if (actionType === 'harvest') {
          if (cell.crop) {
            const cropData = CROPS[cell.crop];
            const space = storageCapacity(gs.buildings, gs.upgrades.silo) - storedTotal(gs.inventory);
            if (cell.growth >= cropData.growTime && space > 0) {
              let harvestAmount = 1;
              if (!cell.harvestPenalty && cell.fed) harvestAmount = 2;
              gs.inventory[cell.crop] = (gs.inventory[cell.crop] || 0) + Math.min(harvestAmount, space);
              gs.grid[next.y][next.x] = emptyCell();
              sounds.harvest();
            }
          }
        }

        gs.actionTick++;
        gs.autoActionQueue = rest;
        requestRender();
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 100 / sf);

        if (rest.length === 0) {
          gs.isAutoActing = false;
          gs.pendingActionType = null;
          const names = { plant: 'Planting', water: 'Watering', clean: 'Feeding', harvest: 'Harvesting' };
          showNotification(`${names[actionType] || 'Action'} complete!`, 'success');
        }
      }, 150 / sf);
      return () => clearTimeout(timer);
    }
  });

  // ============================================
  // RENDER
  // ============================================
  const actions = {
    selectAction: (id) => { gs.selectedAction = id; requestRender(); },
    selectCrop: (id) => { gs.selectedCrop = id; requestRender(); },
    move: stepFarmer,
    act: performAction,
    advanceDay,
    resetGame,
    buySeeds,
    sellItem,
    sellAll,
    toggleShop: () => { gs.showShop = !gs.showShop; requestRender(); },
    toggleStore: () => { gs.showStore = !gs.showStore; requestRender(); },
    buyUpgrade,
    acceptContract,
    toggleSprinkler: () => { gs.sprinklerOn = !gs.sprinklerOn; requestRender(); },
    openMarket: () => { gs.showSellModal = true; requestRender(); },
    closeSellModal: () => { gs.showSellModal = false; requestRender(); },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <FarmScene
        gs={gs}
        version={version}
        onTilePointerDown={onTilePointerDown}
        onTilePointerEnter={onTilePointerEnter}
        onBackgroundMissed={clearSelection}
      />
      <Hud gs={gs} actions={actions} />
    </div>
  );
}
