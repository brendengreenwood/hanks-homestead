import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  CROPS,
  FEED_COST,
  FIELD_OFFSET,
  FIELD_SIZE,
  SCORCH_CHANCE,
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
  elevatorIntake,
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
  'contracts', 'contractOffers', 'contractSeq', 'soldToday',
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
    upgrades: { tractor: 0, sprinkler: 0, silo: 0, plot: 0, hauler: 0 },
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
    isPathing: false,
    pathQueue: [],
    speechBubble: null,
    speechTimeout: null,
    notification: null,
    notificationTimeout: null,
    showShop: false,
    showSellModal: false,
    showStore: false,
    camAz: Math.PI / 4, // camera azimuth (mobile: snapped to fixed angles)
    camTop: false, // top-down view toggle
    jobs: [], // queued drag-jobs: { id, action, crop, tiles, total } — run in order
    activeJob: null, // the job Hank is walking to / working through
    jobSeq: 1,
    showAlmanac: false,
    almanacTopic: 'calendar',
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

  // Grid tile → world-space position for spatial SFX (matches gx/gz in FarmScene).
  const tileAt = (t) => ({ x: t.x - WORLD_SIZE / 2 + 0.5, y: 0.5, z: t.y - WORLD_SIZE / 2 + 0.5 });

  // ============================================
  // CORE ACTIONS
  // ============================================
  const performAction = () => {
    const { x, y } = gs.farmerPos;
    const season = seasonForDay(gs.day);
    const cell = gs.grid[y][x];

    // Selling happens at the elevator, not on a tile — the winter action
    // opens the market from anywhere.
    if (gs.selectedAction === 'sell') {
      gs.showSellModal = true;
      requestRender();
      return;
    }

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
        sounds.plant(tileAt(gs.farmerPos));
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
      sounds.water(tileAt(gs.farmerPos));
      gs.actionTick++;
      showNotification('Watered!', 'success');
    } else if (gs.selectedAction === 'clean' && cell.crop) {
      if (season !== 'summer') {
        showNotification('Can only feed in Summer!', 'info');
        return;
      }
      if (cell.fed) {
        showNotification('Already fed!', 'info');
      } else if (gs.gold < FEED_COST) {
        sounds.error();
        showNotification(`Plant food costs ${FEED_COST}g — not enough gold!`, 'error');
      } else {
        gs.gold -= FEED_COST;
        gs.grid[y][x].fed = true;
        sounds.water(tileAt(gs.farmerPos));
        gs.actionTick++;
        showNotification(`Applied plant food! (−${FEED_COST}g)`, 'success');
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
        sounds.harvest(tileAt(gs.farmerPos));
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
  const growCropsForDay = (season, scorcher = false) => {
    if (season !== 'spring' && season !== 'summer') return;
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const cell = gs.grid[y][x];
        if (!cell.crop || cell.growth >= CROPS[cell.crop].growTime) continue;
        if (season === 'spring') {
          cell.moisture = Math.max(cell.moisture || 0, 2); // spring showers (|| 0 heals pre-moisture saves)
          cell.watered = true;
          cell.growth++;
        } else {
          if (cell.moisture > 0) {
            cell.moisture--;
            if (scorcher) cell.moisture = Math.max(0, cell.moisture - 1); // extra evaporation
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
        // ceil, not floor: a batch drains within shelfLife days no matter how
        // small the pile — 7 tomatoes must not keep forever.
        const lost = Math.ceil(count / c.shelfLife);
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

  // A batch walks the price down as it fills the elevator: it sells at the
  // average of the pre- and post-impact price, so dumping a big pile earns
  // less per unit than spreading sales across days (the price recovers via
  // mean-reversion between sessions).
  const sellRevenue = (id, qty) => {
    const before = gs.prices[id] ?? CROPS[id].sellPrice;
    applyMarketImpact(id, qty);
    return Math.round((qty * (before + gs.prices[id])) / 2);
  };

  const ensureMarket = () => {
    if (!gs.prices) gs.prices = initialPrices();
    if (!gs.priceHistory) gs.priceHistory = initialPriceHistory();
    if (!gs.upgrades) gs.upgrades = { tractor: 0, sprinkler: 0, silo: 0, plot: 0 };
    if (gs.upgrades.sprinkler === undefined) gs.upgrades.sprinkler = 0;
    if (gs.upgrades.hauler === undefined) gs.upgrades.hauler = 0;
    if (gs.soldToday === undefined) gs.soldToday = 0;
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

  // Sprinklers: each summer day, top up THIRSTY crops (moisture < 2) for a
  // per-tile fee. Running before the day's growth tick, they cover scorchers
  // too — insurance a manual watering cadence can't match.
  const sprinklerTick = (season) => {
    if (season !== 'summer' || !gs.upgrades.sprinkler || !gs.sprinklerOn) return;
    const thirsty = (cell) => cell.crop && cell.growth < CROPS[cell.crop].growTime && cell.moisture < 2;
    let tiles = 0;
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (thirsty(gs.grid[y][x])) tiles++;
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
        if (thirsty(cell)) {
          cell.moisture = WATER_DAYS;
          cell.watered = true;
        }
      }
    }
    showNotification(`💧 Sprinklers watered ${tiles} thirsty crops (−${cost}g)`, 'info');
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
    gs.soldToday = 0; // the elevator takes a fresh batch each day
    const nextSeason = seasonForDay(gs.day);

    const scorcher = nextSeason === 'summer' && Math.random() < SCORCH_CHANCE;
    gs.scorchDay = scorcher ? gs.day : null; // scene renders a heat-wave look today
    sprinklerTick(nextSeason);
    growCropsForDay(nextSeason, scorcher);
    tickMarket();
    spoilTick();
    tickContracts();

    // A plain day within the same season: just advance, light feedback.
    if (nextSeason === currentSeason) {
      sounds.click();
      if (scorcher) {
        showNotification(`🔥 Scorcher! The soil's drying fast — check your crops.`, 'error');
      } else {
        showNotification(`${SEASONS[nextSeason].name} — Day ${dayOfSeason(gs.day)} of ${SEASON_LENGTH}`, 'info');
      }
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
        showSpeech("Whoo-wee, it's gettin' hot! Keep 'em watered — and watch for scorchers, they dry the soil double-quick!", 4500);
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

  // The elevator only takes so many bushels a day (elevatorIntake), so big
  // stockpiles must be divvied out across the price cycle. Contracts deliver
  // OUTSIDE this cap — part of what you're paying the premium for.
  const elevatorRoom = () => elevatorIntake(gs.upgrades) - (gs.soldToday || 0);

  const sellItem = (item, qty = 1) => {
    const count = gs.inventory[item] || 0;
    if (count <= 0) return;
    const room = elevatorRoom();
    if (room <= 0) {
      sounds.error();
      showNotification(`Elevator's full for today (${elevatorIntake(gs.upgrades)} bu/day) — try tomorrow!`, 'error');
      return;
    }
    const n = Math.min(qty, count, room);
    const earned = sellRevenue(item, n);
    gs.gold += earned;
    gs.inventory[item] -= n;
    gs.soldToday = (gs.soldToday || 0) + n;
    sounds.sell();
    showNotification(`Sold ${n} ${CROPS[item].icon} for ${earned}g!`, 'success');
    requestRender();
  };

  // Fill today's remaining intake, highest-priced crops first.
  const sellAll = () => {
    let room = elevatorRoom();
    if (room <= 0) {
      sounds.error();
      showNotification(`Elevator's full for today (${elevatorIntake(gs.upgrades)} bu/day) — try tomorrow!`, 'error');
      return;
    }
    let sold = 0;
    let earned = 0;
    const byPrice = Object.keys(CROPS).sort(
      (a, b) => (gs.prices[b] ?? CROPS[b].sellPrice) - (gs.prices[a] ?? CROPS[a].sellPrice)
    );
    for (const item of byPrice) {
      if (room <= 0) break;
      const count = gs.inventory[item] || 0;
      if (count <= 0) continue;
      const n = Math.min(count, room);
      const revenue = sellRevenue(item, n);
      earned += revenue;
      gs.gold += revenue;
      gs.inventory[item] -= n;
      room -= n;
      sold += n;
    }
    if (sold > 0) {
      gs.soldToday = (gs.soldToday || 0) + sold;
      sounds.sell();
      showNotification(`Sold ${sold} bushels for ${earned}g!`, 'success');
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
    if (!window.confirm('Start over? This wipes your farm, gold, upgrades, and saved game.')) return;
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
    gs.jobs = [];
    gs.activeJob = null;
    gs.jobSeq = 1;
    gs.showAlmanac = false;
    gs.showShop = false;
    gs.showSellModal = false;
    gs.showStore = false;
    gs.upgrades = { tractor: 0, sprinkler: 0, silo: 0, plot: 0, hauler: 0 };
    gs.sprinklerOn = false;
    gs.soldToday = 0;
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

  // ---- Job queue (RTS-style): each drag becomes a job that captures the
  // action AND crop at enqueue time, so the player can line up the next
  // planting while Hank works through the current one.
  const startNextJob = () => {
    if (gs.activeJob || gs.isPathing || gs.isAutoActing) return;
    const job = gs.jobs.shift();
    if (!job) return;
    gs.activeJob = job;
    const first = job.tiles[0];
    const path = findPath(gs.buildings, gs.farmerPos.x, gs.farmerPos.y, first.x, first.y);
    if (path.length > 0) {
      gs.pathQueue = path;
      gs.isPathing = true;
    } else {
      gs.autoActionQueue = job.tiles;
      gs.isAutoActing = true;
    }
    requestRender();
  };

  // Finish/abort the running job and pull the next one from the queue.
  const finishActiveJob = () => {
    gs.activeJob = null;
    gs.isAutoActing = false;
    gs.autoActionQueue = [];
    gs.isPathing = false;
    gs.pathQueue = [];
    startNextJob();
  };

  const cancelAllJobs = () => {
    gs.jobs = [];
    gs.activeJob = null;
    gs.isAutoActing = false;
    gs.autoActionQueue = [];
    gs.isPathing = false;
    gs.pathQueue = [];
  };

  // Finalize a drag selection into a queued job (snake order).
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

    gs.jobs.push({
      id: gs.jobSeq++,
      action: gs.selectedAction,
      crop: gs.selectedAction === 'plant' ? gs.selectedCrop : null,
      tiles: queue,
      total: queue.length,
    });
    startNextJob();
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

    // manual movement is a full stop: cancel the running job and the queue
    if (gs.isPathing || gs.isAutoActing || gs.activeJob || gs.jobs.length > 0) {
      cancelAllJobs();
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
          cancelAllJobs();
          gs.showShop = false;
          gs.showAlmanac = false;
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
          if (gs.activeJob) {
            gs.autoActionQueue = gs.activeJob.tiles;
            gs.isAutoActing = true;
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
    if (gs.isAutoActing && gs.autoActionQueue.length > 0 && gs.activeJob) {
      const actionType = gs.activeJob.action;
      const jobCrop = gs.activeJob.crop;

      if (actionType === 'plant') {
        const seedKey = `${jobCrop}_seeds`;
        if ((gs.inventory[seedKey] || 0) <= 0) {
          handleOutOfSeeds();
          finishActiveJob(); // skip to the next queued job
          requestRender();
          return;
        }
      }
      if (actionType === 'clean' && gs.gold < FEED_COST) {
        sounds.error();
        showNotification(`Out of gold for plant food (${FEED_COST}g each)!`, 'error');
        finishActiveJob();
        requestRender();
        return;
      }

      const sf = speedFactor(gs.upgrades);
      const timer = setTimeout(() => {
        const [next, ...rest] = gs.autoActionQueue;
        gs.farmerPos = next;
        gs.isMoving = true;

        const cell = gs.grid[next.y][next.x];

        if (actionType === 'plant') {
          const seedKey = `${jobCrop}_seeds`;
          if (!cell.crop && (gs.inventory[seedKey] || 0) > 0) {
            gs.inventory[seedKey]--;
            gs.grid[next.y][next.x] = { crop: jobCrop, growth: 0, moisture: 0, watered: false, fed: false, harvestPenalty: false };
            sounds.plant(tileAt(next));
          }
        } else if (actionType === 'water') {
          if (cell.crop && !cell.watered) {
            gs.grid[next.y][next.x].moisture = WATER_DAYS;
            gs.grid[next.y][next.x].watered = true;
            sounds.water(tileAt(next));
          }
        } else if (actionType === 'clean') {
          if (cell.crop && !cell.fed && gs.gold >= FEED_COST) {
            gs.gold -= FEED_COST;
            gs.grid[next.y][next.x].fed = true;
            sounds.water(tileAt(next));
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
              sounds.harvest(tileAt(next));
            }
          }
        }

        gs.actionTick++;
        gs.autoActionQueue = rest;
        requestRender();
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 100 / sf);

        if (rest.length === 0) {
          const names = { plant: 'Planting', water: 'Watering', clean: 'Feeding', harvest: 'Harvesting' };
          const more = gs.jobs.length > 0 ? ` (${gs.jobs.length} job${gs.jobs.length > 1 ? 's' : ''} queued)` : '';
          showNotification(`${names[actionType] || 'Action'} complete!${more}`, 'success');
          finishActiveJob(); // chains straight into the next queued job
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
    rotateCam: (dir) => { gs.camAz = (gs.camAz ?? Math.PI / 4) + dir * (Math.PI / 2); requestRender(); },
    toggleTopView: () => { gs.camTop = !gs.camTop; requestRender(); },
    openMarket: () => { gs.showSellModal = true; requestRender(); },
    closeSellModal: () => { gs.showSellModal = false; requestRender(); },
    openAlmanac: (topic) => {
      if (topic) gs.almanacTopic = topic;
      gs.showAlmanac = true;
      requestRender();
    },
    closeAlmanac: () => { gs.showAlmanac = false; requestRender(); },
    setAlmanacTopic: (topic) => { gs.almanacTopic = topic; requestRender(); },
    cancelJob: (id) => {
      gs.jobs = gs.jobs.filter((j) => j.id !== id);
      requestRender();
    },
    cancelActiveJob: () => {
      finishActiveJob();
      requestRender();
    },
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
