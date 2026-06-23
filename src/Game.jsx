import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  CROPS,
  FIELD_OFFSET,
  FIELD_SIZE,
  SEASON_ACTIONS,
  SEASON_ORDER,
  WORLD_SIZE,
  emptyCell,
  makeGrid,
  seasonForDay,
} from './game/constants.js';
import { buildSelectionQueue, findPath, isFarmland, isWalkable } from './game/logic.js';
import { useAmbience, useMusic, useSound } from './hooks/useAudio.js';
import FarmScene from './three/FarmScene.jsx';
import Hud from './ui/Hud.jsx';

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
    farmerPos: { x: FIELD_OFFSET + 4, y: FIELD_OFFSET + 4 },
    farmerDir: 'down',
    isMoving: false,
    actionTick: 0, // bumped on each tile action to trigger the interact animation
    grid: makeGrid(),
    buildings: [
      { type: 'farmhouse', x: FIELD_OFFSET - 3, y: FIELD_OFFSET },
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

    if (!isFarmland(x, y)) {
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
        gs.grid[y][x] = { crop: gs.selectedCrop, growth: 0, watered: false, fed: false, harvestPenalty: false };
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
        let harvestAmount = 1;
        let message = '';
        if (cell.harvestPenalty) {
          message = ' (withered - water next time!)';
        } else if (cell.fed) {
          harvestAmount = 2;
          message = ' (+1 bonus!)';
        }
        gs.inventory[cell.crop] = (gs.inventory[cell.crop] || 0) + harvestAmount;
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

  const advanceDay = () => {
    const currentSeason = seasonForDay(gs.day);
    const nextSeason = SEASON_ORDER[gs.day % 4];
    gs.day++;

    gs.selectedAction = SEASON_ACTIONS[nextSeason][0].id;
    music.changeSeason(nextSeason);
    ambience.changeSeason(nextSeason);

    if (currentSeason === 'spring' && nextSeason === 'summer') {
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("Whoo-wee, it's gettin' hot! Time to water them crops before they shrivel up!", 4000);
      }, 500);
    } else if (currentSeason === 'summer' && nextSeason === 'fall') {
      for (let y = 0; y < WORLD_SIZE; y++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
          const cell = gs.grid[y][x];
          if (cell.crop) {
            cell.growth = CROPS[cell.crop].growTime;
            if (!cell.watered) cell.harvestPenalty = true;
          }
        }
      }
      sounds.sleep();
      setTimeout(() => {
        sounds.wake();
        showSpeech("Well I'll be! Look at all them ripe crops! Time to bring in the harvest!", 4000);
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
    if (all) {
      gs.gold += count * CROPS[item].sellPrice;
      gs.inventory[item] = 0;
    } else {
      gs.inventory[item]--;
      gs.gold += CROPS[item].sellPrice;
    }
    sounds.sell();
    showNotification(`Sold ${CROPS[item].icon} ${CROPS[item].name}!`, 'success');
    requestRender();
  };

  const sellAll = () => {
    let sold = 0;
    for (const item of Object.keys(CROPS)) {
      const count = gs.inventory[item] || 0;
      gs.gold += count * CROPS[item].sellPrice;
      gs.inventory[item] = 0;
      sold += count;
    }
    if (sold > 0) sounds.sell();
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
    setTimeout(() => showSpeech("Alrighty, fresh start! Let's make this the best darn harvest yet!", 4000), 300);
    requestRender();
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

  // Welcome message
  useEffect(() => {
    const t = setTimeout(() => showSpeech("Howdy! Welcome to Hank's Homestead! It's plantin' season, partner!", 4000), 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // TILE INTERACTION (raycast picking from FarmScene)
  // ============================================
  const onTilePointerDown = (x, y) => {
    startAudioIfNeeded();
    const season = seasonForDay(gs.day);
    if ((season === 'spring' || season === 'summer' || season === 'fall') && isFarmland(x, y)) {
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

    const queue = buildSelectionQueue(gs.selectionStart, gs.selectionEnd);
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

  // ============================================
  // KEYBOARD
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      let newX = gs.farmerPos.x;
      let newY = gs.farmerPos.y;
      let newDir = gs.farmerDir;

      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': newY = Math.max(0, gs.farmerPos.y - 1); newDir = 'up'; break;
        case 's': case 'arrowdown': newY = Math.min(WORLD_SIZE - 1, gs.farmerPos.y + 1); newDir = 'down'; break;
        case 'a': case 'arrowleft': newX = Math.max(0, gs.farmerPos.x - 1); newDir = 'left'; break;
        case 'd': case 'arrowright': newX = Math.min(WORLD_SIZE - 1, gs.farmerPos.x + 1); newDir = 'right'; break;
        case 'e': e.preventDefault(); performAction(); return;
        case '1': case '2': case '3': case '4': {
          const actions = SEASON_ACTIONS[seasonForDay(gs.day)];
          const idx = parseInt(e.key, 10) - 1;
          if (idx < actions.length) {
            gs.selectedAction = actions[idx].id;
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

      if (gs.isPathing) {
        gs.isPathing = false;
        gs.pathQueue = [];
        gs.pendingActionQueue = [];
        gs.pendingActionType = null;
      }

      if (!isWalkable(gs.buildings, newX, newY)) {
        gs.farmerDir = newDir;
        requestRender();
        return;
      }

      if (newX !== gs.farmerPos.x || newY !== gs.farmerPos.y) {
        gs.isMoving = true;
        gs.farmerDir = newDir;
        gs.farmerPos = { x: newX, y: newY };
        requestRender();
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 150);
      } else {
        gs.farmerDir = newDir;
        requestRender();
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
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 80);

        if (rest.length === 0) {
          gs.isPathing = false;
          if (gs.pendingActionQueue.length > 0) {
            gs.autoActionQueue = gs.pendingActionQueue;
            gs.isAutoActing = true;
            gs.pendingActionQueue = [];
          }
        }
      }, 120);
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

      const timer = setTimeout(() => {
        const [next, ...rest] = gs.autoActionQueue;
        gs.farmerPos = next;
        gs.isMoving = true;

        const cell = gs.grid[next.y][next.x];

        if (actionType === 'plant') {
          const seedKey = `${gs.selectedCrop}_seeds`;
          if (!cell.crop && (gs.inventory[seedKey] || 0) > 0) {
            gs.inventory[seedKey]--;
            gs.grid[next.y][next.x] = { crop: gs.selectedCrop, growth: 0, watered: false, fed: false, harvestPenalty: false };
            sounds.plant();
          }
        } else if (actionType === 'water') {
          if (cell.crop && !cell.watered) {
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
            if (cell.growth >= cropData.growTime) {
              let harvestAmount = 1;
              if (!cell.harvestPenalty && cell.fed) harvestAmount = 2;
              gs.inventory[cell.crop] = (gs.inventory[cell.crop] || 0) + harvestAmount;
              gs.grid[next.y][next.x] = emptyCell();
              sounds.harvest();
            }
          }
        }

        gs.actionTick++;
        gs.autoActionQueue = rest;
        requestRender();
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 100);

        if (rest.length === 0) {
          gs.isAutoActing = false;
          gs.pendingActionType = null;
          const names = { plant: 'Planting', water: 'Watering', clean: 'Feeding', harvest: 'Harvesting' };
          showNotification(`${names[actionType] || 'Action'} complete!`, 'success');
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  });

  // ============================================
  // RENDER
  // ============================================
  const actions = {
    selectAction: (id) => { gs.selectedAction = id; requestRender(); },
    selectCrop: (id) => { gs.selectedCrop = id; requestRender(); },
    advanceDay,
    resetGame,
    buySeeds,
    sellItem,
    sellAll,
    toggleShop: () => { gs.showShop = !gs.showShop; requestRender(); },
    closeSellModal: () => { gs.showSellModal = false; showNotification('Winter has arrived!', 'success'); requestRender(); },
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
