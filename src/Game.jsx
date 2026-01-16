import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// SOUND SYSTEM
// ============================================
const useSound = () => {
  const audioCtxRef = useRef(null);
  
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((frequency, duration = 0.1, type = 'sine', volume = 0.15) => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  return {
    buy: () => { playTone(880, 0.08, 'sine', 0.1); setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 50); },
    buyBulk: () => { playTone(880, 0.06, 'sine', 0.1); setTimeout(() => playTone(1100, 0.06, 'sine', 0.1), 40); setTimeout(() => playTone(1320, 0.1, 'sine', 0.1), 80); },
    plant: () => { playTone(180, 0.08, 'sine', 0.15); setTimeout(() => playTone(120, 0.12, 'sine', 0.1), 30); },
    water: () => { playTone(600, 0.08, 'triangle', 0.08); setTimeout(() => playTone(500, 0.08, 'triangle', 0.06), 60); setTimeout(() => playTone(400, 0.1, 'triangle', 0.04), 120); },
    harvest: () => { playTone(523, 0.1, 'sine', 0.12); setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 80); setTimeout(() => playTone(784, 0.15, 'sine', 0.1), 160); },
    sell: () => { playTone(800, 0.05, 'square', 0.06); setTimeout(() => playTone(1000, 0.05, 'square', 0.06), 40); setTimeout(() => playTone(1200, 0.08, 'square', 0.05), 80); },
    error: () => { playTone(300, 0.1, 'sine', 0.12); setTimeout(() => playTone(200, 0.15, 'sine', 0.1), 80); },
    sleep: () => { playTone(440, 0.2, 'sine', 0.1); setTimeout(() => playTone(349, 0.2, 'sine', 0.08), 150); setTimeout(() => playTone(262, 0.4, 'sine', 0.06), 300); },
    wake: () => { playTone(262, 0.15, 'sine', 0.08); setTimeout(() => playTone(330, 0.15, 'sine', 0.1), 120); setTimeout(() => playTone(392, 0.2, 'sine', 0.12), 240); },
    click: () => { playTone(800, 0.03, 'sine', 0.05); },
  };
};

// ============================================
// CONSTANTS
// ============================================
const FIELD_SIZE = 10;
const WORLD_SIZE = 36;
const FIELD_OFFSET = 13;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

const WORLD_OFFSET_X = 80;
const WORLD_OFFSET_Y = 140; // Leave room for top UI
const WORLD_CENTER_X = WORLD_SIZE * TILE_WIDTH / 2;

const BUILDINGS = {
  farmhouse: { name: 'Farmhouse', color: '#6B7280', width: 2, height: 2 },
  silo: { name: 'Silo', color: '#9CA3AF', width: 1, height: 1 },
};

const SEASONS = {
  spring: { name: 'Spring', sky: { top: '#4A90D9', bottom: '#87CEEB', horizon: '#C5E8C5' }, grass: '#5C8A3D' },
  fall: { name: 'Fall', sky: { top: '#6B8CAE', bottom: '#B8A590', horizon: '#D4A574' }, grass: '#9B8B5A' },
};

const COLORS = {
  soil: { dry: '#8B5A2B', wet: '#5C4033', furrow: '#6B4423' },
  wood: { light: '#DEB887', medium: '#B8860B', dark: '#8B4513' },
  ui: {
    panel: '#F5F0E6',
    panelBorder: '#8B7355',
    button: '#E8DFD0',
    buttonHover: '#D4C8B8',
    buttonActive: '#C4B8A8',
    buttonBorder: '#8B7355',
    text: '#4A3728',
    textLight: '#8B7355',
    gold: '#D4A017',
    green: '#22C55E',
    red: '#DC2626',
    blue: '#3B82F6',
  }
};

const CROPS = {
  wheat: { name: 'Wheat', growTime: 1, seedPrice: 10, sellPrice: 25, color: '#7D9A4B', matureColor: '#DAA520', icon: '🌾' },
  carrot: { name: 'Carrot', growTime: 1, seedPrice: 15, sellPrice: 40, color: '#228B22', matureColor: '#32CD32', icon: '🥕' },
  tomato: { name: 'Tomato', growTime: 1, seedPrice: 20, sellPrice: 55, color: '#2E8B2E', matureColor: '#DC143C', icon: '🍅' },
  corn: { name: 'Corn', growTime: 1, seedPrice: 25, sellPrice: 75, color: '#6B8E23', matureColor: '#F4D03F', icon: '🌽' },
  pumpkin: { name: 'Pumpkin', growTime: 1, seedPrice: 40, sellPrice: 120, color: '#2E7D32', matureColor: '#FF7518', icon: '🎃' },
};

const TOOLS = [
  { id: 'plant', name: 'Plant', icon: '🌱', springOnly: true },
  { id: 'water', name: 'Water', icon: '💧', springOnly: true },
  { id: 'harvest', name: 'Harvest', icon: '✂️', springOnly: false },
];

// ============================================
// COORDINATE HELPERS
// ============================================
const toIso = (x, y) => ({
  isoX: (x - y) * (TILE_WIDTH / 2),
  isoY: (x + y) * (TILE_HEIGHT / 2),
});

const fromIso = (screenX, screenY, zoom, cameraX = 0, cameraY = 0, canvasWidth, canvasHeight) => {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Reverse the zoom transform
  let canvasX = (screenX - centerX) / zoom + centerX;
  let canvasY = (screenY - centerY) / zoom + centerY;
  
  // Reverse the camera offset
  canvasX -= cameraX;
  canvasY -= cameraY;
  
  const isoX = canvasX - WORLD_OFFSET_X - WORLD_CENTER_X;
  const isoY = canvasY - WORLD_OFFSET_Y;
  
  const tileX = isoX / TILE_WIDTH + isoY / TILE_HEIGHT;
  const tileY = isoY / TILE_HEIGHT - isoX / TILE_WIDTH;
  
  return { x: Math.floor(tileX), y: Math.floor(tileY) };
};

// ============================================
// UI DRAWING HELPERS
// ============================================
const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawButton = (ctx, x, y, w, h, text, isHovered, isActive, isDisabled) => {
  const r = 4;
  drawRoundedRect(ctx, x, y, w, h, r);
  
  if (isDisabled) {
    ctx.fillStyle = '#CCC';
  } else if (isActive) {
    ctx.fillStyle = COLORS.ui.buttonActive;
  } else if (isHovered) {
    ctx.fillStyle = COLORS.ui.buttonHover;
  } else {
    ctx.fillStyle = COLORS.ui.button;
  }
  ctx.fill();
  
  ctx.strokeStyle = isActive ? COLORS.ui.text : COLORS.ui.buttonBorder;
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.stroke();
  
  ctx.fillStyle = isDisabled ? '#999' : COLORS.ui.text;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w/2, y + h/2);
};

const drawPanel = (ctx, x, y, w, h) => {
  const r = 6;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  drawRoundedRect(ctx, x + 2, y + 2, w, h, r);
  ctx.fill();
  
  // Panel
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = COLORS.ui.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.ui.panelBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function IsometricFarmGame() {
  const sounds = useSound();
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const canvasSizeRef = useRef({ width: window.innerWidth, height: window.innerHeight });

  // Game state refs (using refs to avoid re-render cascades)
  const gameState = useRef({
    gold: 200,
    day: 1,
    selectedTool: 'plant',
    selectedCrop: 'wheat',
    inventory: { wheat_seeds: 10, carrot_seeds: 10, tomato_seeds: 10, corn_seeds: 10, pumpkin_seeds: 10 },
    farmerPos: { x: FIELD_OFFSET + 4, y: FIELD_OFFSET + 4 },
    farmerDir: 'down',
    isMoving: false,
    grid: Array(WORLD_SIZE).fill(null).map(() =>
      Array(WORLD_SIZE).fill(null).map(() => ({ crop: null, growth: 0, watered: false }))
    ),
    buildings: [
      { type: 'farmhouse', x: FIELD_OFFSET - 3, y: FIELD_OFFSET },
      { type: 'silo', x: FIELD_OFFSET + FIELD_SIZE + 1, y: FIELD_OFFSET + 2 },
    ],
    zoom: 2.2,
    cameraX: 0,
    cameraY: 0,
    cameraInitialized: false,
    isPanning: false,
    panStartMouse: null,
    panStartCamera: null,
    hoveredTile: null,
    isDragging: false,
    selectionStart: null,
    selectionEnd: null,
    isAutoPlanting: false,
    autoPlantQueue: [],
    isPathing: false,
    pathQueue: [],
    pendingPlantQueue: [],
    speechBubble: null,
    speechTimeout: null,
    notification: null,
    notificationTimeout: null,
    showShop: false,
  });
  
  // UI state
  const uiState = useRef({
    hoveredButton: null,
    mousePos: { x: 0, y: 0 },
  });
  
  // Force re-render trigger
  const [, forceUpdate] = useState(0);
  const requestRender = useCallback(() => forceUpdate(n => n + 1), []);
  
  const gs = gameState.current;
  const ui = uiState.current;
  
  // Derived values
  const season = gs.day % 2 === 1 ? 'spring' : 'fall';
  const seasonData = SEASONS[season];
  
  // ============================================
  // GAME LOGIC
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
  
  const isFarmland = (x, y) => x >= FIELD_OFFSET && x < FIELD_OFFSET + FIELD_SIZE &&
                               y >= FIELD_OFFSET && y < FIELD_OFFSET + FIELD_SIZE;

  const getBuildingAt = (x, y) => {
    for (const building of gs.buildings) {
      const bData = BUILDINGS[building.type];
      if (x >= building.x && x < building.x + bData.width &&
          y >= building.y && y < building.y + bData.height) {
        return building;
      }
    }
    return null;
  };

  const isWalkable = (x, y) => {
    if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) return false;
    if (getBuildingAt(x, y)) return false;
    return true;
  };

  const findPath = (startX, startY, endX, endY) => {
    if (!isWalkable(endX, endY)) return [];
    
    const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
    const closedSet = new Set();
    const getKey = (x, y) => `${x},${y}`;
    const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
    
    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      
      if (current.x === endX && current.y === endY) {
        const path = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }
      
      closedSet.add(getKey(current.x, current.y));
      
      for (const neighbor of [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
      ]) {
        if (!isWalkable(neighbor.x, neighbor.y)) continue;
        if (closedSet.has(getKey(neighbor.x, neighbor.y))) continue;
        
        const g = current.g + 1;
        const h = heuristic(neighbor.x, neighbor.y, endX, endY);
        const f = g + h;
        
        const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existing) {
          if (g < existing.g) { existing.g = g; existing.f = f; existing.parent = current; }
        } else {
          openSet.push({ x: neighbor.x, y: neighbor.y, g, h, f, parent: current });
        }
      }
    }
    return [];
  };
  
  const performAction = () => {
    const { x, y } = gs.farmerPos;
    const cell = gs.grid[y][x];

    if (!isFarmland(x, y)) {
      sounds.error();
      showNotification("Can't farm here - go to the field!", 'error');
      return;
    }

    if (gs.selectedTool === 'plant' && !cell.crop) {
      if (season === 'fall') {
        sounds.error();
        showNotification("Can't plant in Fall - wait for Spring!", 'error');
        return;
      }
      const seedKey = `${gs.selectedCrop}_seeds`;
      if ((gs.inventory[seedKey] || 0) > 0) {
        gs.inventory[seedKey]--;
        gs.grid[y][x] = { crop: gs.selectedCrop, growth: 0, watered: false };
        sounds.plant();
        showNotification(`Planted ${CROPS[gs.selectedCrop].name}!`, 'success');
      } else {
        sounds.error();
        showSpeech(`Out of ${CROPS[gs.selectedCrop].name} seeds!`);
      }
    } else if (gs.selectedTool === 'water' && cell.crop && !cell.watered) {
      if (season === 'fall') {
        showNotification("No need to water in Fall!", 'info');
        return;
      }
      gs.grid[y][x].watered = true;
      sounds.water();
      showNotification('Watered!', 'success');
    } else if (gs.selectedTool === 'harvest' && cell.crop) {
      const cropData = CROPS[cell.crop];
      if (cell.growth >= cropData.growTime) {
        gs.inventory[cell.crop] = (gs.inventory[cell.crop] || 0) + 1;
        gs.grid[y][x] = { crop: null, growth: 0, watered: false };
        sounds.harvest();
        showNotification(`Harvested ${cropData.name}!`, 'success');
      } else {
        sounds.error();
        showNotification('Not ready - wait for Fall!', 'error');
      }
    } else {
      sounds.error();
    }
    requestRender();
  };
  
  const advanceDay = () => {
    const currentSeason = gs.day % 2 === 1 ? 'spring' : 'fall';
    const nextSeason = (gs.day + 1) % 2 === 1 ? 'spring' : 'fall';
    gs.day++;
    
    if (currentSeason === 'spring' && nextSeason === 'fall') {
      for (let y = 0; y < WORLD_SIZE; y++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
          if (gs.grid[y][x].crop) {
            gs.grid[y][x].growth = CROPS[gs.grid[y][x].crop].growTime;
            gs.grid[y][x].watered = false;
          }
        }
      }
      sounds.sleep();
      setTimeout(() => sounds.wake(), 500);
      showNotification('Fall has arrived! Time to harvest!', 'success');
    } else if (currentSeason === 'fall' && nextSeason === 'spring') {
      for (let y = 0; y < WORLD_SIZE; y++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
          gs.grid[y][x] = { crop: null, growth: 0, watered: false };
        }
      }
      sounds.sleep();
      setTimeout(() => sounds.wake(), 500);
      showNotification('Spring is here! Time to plant!', 'success');
    }
    requestRender();
  };
  
  const sellItem = (item) => {
    if ((gs.inventory[item] || 0) > 0) {
      gs.inventory[item]--;
      gs.gold += CROPS[item].sellPrice;
      sounds.sell();
      showNotification(`Sold ${CROPS[item].name} for ${CROPS[item].sellPrice}g!`, 'success');
      requestRender();
    }
  };
  
  const buySeeds = (cropId, amount) => {
    const crop = CROPS[cropId];
    const cost = crop.seedPrice * amount;
    if (gs.gold >= cost) {
      gs.gold -= cost;
      gs.inventory[`${cropId}_seeds`] = (gs.inventory[`${cropId}_seeds`] || 0) + amount;
      if (amount > 1) sounds.buyBulk(); else sounds.buy();
      requestRender();
    }
  };
  
  const resetGame = () => {
    gs.gold = 200;
    gs.day = 1;
    gs.selectedTool = 'plant';
    gs.selectedCrop = 'wheat';
    gs.inventory = { wheat_seeds: 10, carrot_seeds: 10, tomato_seeds: 10, corn_seeds: 10, pumpkin_seeds: 10 };
    gs.farmerPos = { x: FIELD_OFFSET + 4, y: FIELD_OFFSET + 4 };
    gs.farmerDir = 'down';
    gs.grid = Array(WORLD_SIZE).fill(null).map(() =>
      Array(WORLD_SIZE).fill(null).map(() => ({ crop: null, growth: 0, watered: false }))
    );
    gs.zoom = 2.2;
    gs.cameraX = 0;
    gs.cameraY = 0;
    gs.cameraInitialized = false;
    gs.isPathing = false;
    gs.pathQueue = [];
    gs.isAutoPlanting = false;
    gs.autoPlantQueue = [];
    gs.showShop = false;
    showNotification('Game reset! Spring has arrived.', 'info');
    requestRender();
  };
  
  // ============================================
  // UI BUTTON DEFINITIONS
  // ============================================
  
  const getUIButtons = () => {
    const CANVAS_WIDTH = canvasSizeRef.current.width;
    const CANVAS_HEIGHT = canvasSizeRef.current.height;

    if (!CANVAS_WIDTH || !CANVAS_HEIGHT) return [];

    const buttons = [];

    // Season indicator (top left)
    buttons.push({
      id: 'season',
      x: 10, y: 10, w: 60, h: 28,
      render: (ctx, btn) => {
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fillStyle = season === 'spring' ? COLORS.ui.green : '#D97706';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seasonData.name, btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: null,
    });

    // ACTION BAR - WoW style at bottom center
    const actionBarSize = 64;
    const actionBarGap = 8;
    const actionBarY = CANVAS_HEIGHT - actionBarSize - 60;
    const actionBarStartX = (CANVAS_WIDTH - (TOOLS.length * actionBarSize + (TOOLS.length - 1) * actionBarGap)) / 2;

    // Action bar background panel
    const panelPadding = 12;
    const panelX = actionBarStartX - panelPadding;
    const panelY = actionBarY - panelPadding;
    const panelW = TOOLS.length * actionBarSize + (TOOLS.length - 1) * actionBarGap + panelPadding * 2;
    const panelH = actionBarSize + panelPadding * 2;

    buttons.push({
      id: 'action_bar_panel',
      x: panelX, y: panelY, w: panelW, h: panelH,
      render: (ctx) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      },
      onClick: null,
    });

    // Action buttons (Plant, Water, Harvest)
    TOOLS.forEach((tool, i) => {
      const x = actionBarStartX + i * (actionBarSize + actionBarGap);
      const disabled = tool.springOnly && season === 'fall';
      const active = gs.selectedTool === tool.id;
      const keybind = (i + 1).toString();

      buttons.push({
        id: `tool_${tool.id}`,
        x, y: actionBarY, w: actionBarSize, h: actionBarSize,
        render: (ctx, btn, hovered) => {
          // Button background
          drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
          if (disabled) {
            ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
          } else if (active) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
          } else {
            ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
          }
          ctx.fill();

          // Border
          ctx.strokeStyle = disabled ? 'rgba(100, 100, 100, 0.5)' :
                           (active ? 'rgba(34, 197, 94, 1)' :
                           (hovered ? 'rgba(200, 200, 200, 0.8)' : 'rgba(150, 150, 150, 0.6)'));
          ctx.lineWidth = active ? 3 : 2;
          ctx.stroke();

          // Icon
          ctx.font = '32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = disabled ? 'rgba(150, 150, 150, 0.5)' : 'white';
          ctx.fillText(tool.icon, btn.x + btn.w/2, btn.y + btn.h/2 - 4);

          // Keybind
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = disabled ? 'rgba(150, 150, 150, 0.5)' : 'rgba(255, 255, 255, 0.8)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(keybind, btn.x + 4, btn.y + 4);

          // Tool name
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = disabled ? 'rgba(150, 150, 150, 0.5)' : 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(tool.name, btn.x + btn.w/2, btn.y + btn.h - 4);
        },
        onClick: disabled ? null : () => { gs.selectedTool = tool.id; requestRender(); },
      });
    });

    // Crop selector (appears above action bar when Plant is selected in spring)
    if (gs.selectedTool === 'plant' && season === 'spring') {
      const cropSize = 56;
      const cropGap = 8;
      const crops = Object.entries(CROPS);
      const cropPanelPadding = 12;
      const cropPanelWidth = crops.length * cropSize + (crops.length - 1) * cropGap + cropPanelPadding * 2;
      const cropPanelHeight = cropSize + cropPanelPadding * 2;
      const cropPanelX = (CANVAS_WIDTH - cropPanelWidth) / 2;
      const cropPanelY = actionBarY - cropPanelHeight - 16;

      // Crop panel background
      buttons.push({
        id: 'crop_panel',
        x: cropPanelX, y: cropPanelY, w: cropPanelWidth, h: cropPanelHeight,
        render: (ctx) => {
          ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
          drawRoundedRect(ctx, cropPanelX, cropPanelY, cropPanelWidth, cropPanelHeight, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        },
        onClick: null,
      });

      // Crop buttons
      crops.forEach(([cropId, crop], i) => {
        const x = cropPanelX + cropPanelPadding + i * (cropSize + cropGap);
        const y = cropPanelY + cropPanelPadding;
        const active = gs.selectedCrop === cropId;
        const seedCount = gs.inventory[`${cropId}_seeds`] || 0;

        buttons.push({
          id: `crop_${cropId}`,
          x, y, w: cropSize, h: cropSize,
          render: (ctx, btn, hovered) => {
            drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
            if (active) {
              ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
            } else if (hovered) {
              ctx.fillStyle = 'rgba(70, 70, 70, 0.9)';
            } else {
              ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
            }
            ctx.fill();

            ctx.strokeStyle = active ? 'rgba(34, 197, 94, 1)' :
                             (hovered ? 'rgba(180, 180, 180, 0.8)' : 'rgba(120, 120, 120, 0.6)');
            ctx.lineWidth = active ? 3 : 2;
            ctx.stroke();

            // Icon
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(crop.icon, btn.x + btn.w/2, btn.y + btn.h/2 - 2);

            // Seed count badge
            const badgeSize = 18;
            const badgeX = btn.x + btn.w - badgeSize - 3;
            const badgeY = btn.y + btn.h - badgeSize - 3;
            ctx.beginPath();
            ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
            ctx.fillStyle = seedCount > 0 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(100, 0, 0, 0.8)';
            ctx.fill();
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = seedCount > 0 ? 'white' : 'rgba(200, 200, 200, 0.6)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(seedCount, badgeX + badgeSize/2, badgeY + badgeSize/2);

            // Tooltip on hover
            if (hovered) {
              ctx.font = 'bold 10px sans-serif';
              const textWidth = ctx.measureText(crop.name).width;
              const tooltipX = btn.x + btn.w/2 - textWidth/2 - 6;
              const tooltipY = btn.y - 24;
              drawRoundedRect(ctx, tooltipX, tooltipY, textWidth + 12, 18, 4);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
              ctx.fill();
              ctx.fillStyle = 'white';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(crop.name, btn.x + btn.w/2, tooltipY + 9);
            }
          },
          onClick: () => { gs.selectedCrop = cropId; requestRender(); },
        });
      });
    }
    
    // Shop button (top right)
    const shopBtnX = CANVAS_WIDTH - 70;
    const shopBtnY = 10;
    const shopBtnW = 60;
    const shopBtnH = 28;
    buttons.push({
      id: 'shop',
      x: shopBtnX, y: shopBtnY, w: shopBtnW, h: shopBtnH,
      render: (ctx, btn, hovered) => {
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fillStyle = gs.showShop ? '#EAB308' : (hovered ? '#FEF08A' : '#FEF9C3');
        ctx.fill();
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = gs.showShop ? 2 : 1;
        ctx.stroke();
        
        ctx.fillStyle = '#78350F';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏪 Shop', btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: () => { gs.showShop = !gs.showShop; requestRender(); },
    });
    
    // Shop panel
    if (gs.showShop) {
      const shopX = CANVAS_WIDTH - 200;
      const shopY = 45;
      const shopW = 190;
      const shopH = 160;
      
      buttons.push({
        id: 'shop_panel',
        x: shopX, y: shopY, w: shopW, h: shopH,
        render: (ctx) => {
          drawPanel(ctx, shopX, shopY, shopW, shopH);
          
          ctx.fillStyle = COLORS.ui.text;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Buy Seeds', shopX + 10, shopY + 18);
          
          ctx.fillStyle = COLORS.ui.gold;
          ctx.textAlign = 'right';
          ctx.fillText(`${gs.gold}g`, shopX + shopW - 10, shopY + 18);
        },
        onClick: null, // Panel itself not clickable
      });
      
      // Shop items
      let itemY = shopY + 32;
      for (const [cropId, crop] of Object.entries(CROPS)) {
        const itemH = 24;
        
        // Item row background
        buttons.push({
          id: `shop_item_${cropId}`,
          x: shopX + 5, y: itemY, w: shopW - 10, h: itemH,
          render: (ctx, btn, hovered) => {
            if (hovered) {
              drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 3);
              ctx.fillStyle = 'rgba(0,0,0,0.05)';
              ctx.fill();
            }
            
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(crop.icon, btn.x + 5, btn.y + btn.h/2);
            
            ctx.fillStyle = COLORS.ui.text;
            ctx.font = '11px sans-serif';
            ctx.fillText(crop.name, btn.x + 25, btn.y + btn.h/2);
            
            ctx.fillStyle = COLORS.ui.textLight;
            ctx.fillText(`${crop.seedPrice}g`, btn.x + 70, btn.y + btn.h/2);
          },
          onClick: null,
        });
        
        // +1 button
        const canBuy1 = gs.gold >= crop.seedPrice;
        buttons.push({
          id: `shop_buy1_${cropId}`,
          x: shopX + shopW - 65, y: itemY + 2, w: 26, h: itemH - 4,
          render: (ctx, btn, hovered) => {
            drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 3);
            ctx.fillStyle = canBuy1 ? (hovered ? '#16A34A' : COLORS.ui.green) : '#CCC';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+1', btn.x + btn.w/2, btn.y + btn.h/2);
          },
          onClick: canBuy1 ? () => buySeeds(cropId, 1) : null,
        });
        
        // +5 button
        const canBuy5 = gs.gold >= crop.seedPrice * 5;
        buttons.push({
          id: `shop_buy5_${cropId}`,
          x: shopX + shopW - 35, y: itemY + 2, w: 26, h: itemH - 4,
          render: (ctx, btn, hovered) => {
            drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 3);
            ctx.fillStyle = canBuy5 ? (hovered ? '#15803D' : '#16A34A') : '#CCC';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+5', btn.x + btn.w/2, btn.y + btn.h/2);
          },
          onClick: canBuy5 ? () => buySeeds(cropId, 5) : null,
        });
        
        itemY += itemH;
      }
    }
    
    // Bottom bar
    const bottomY = CANVAS_HEIGHT - 40;
    
    // Gold display
    buttons.push({
      id: 'gold_display',
      x: 10, y: bottomY, w: 80, h: 30,
      render: (ctx, btn) => {
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fillStyle = '#FFFBEB';
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = COLORS.ui.gold;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🪙 ${gs.gold}`, btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: null,
    });
    
    // Day display
    buttons.push({
      id: 'day_display',
      x: 100, y: bottomY, w: 60, h: 30,
      render: (ctx, btn) => {
        ctx.fillStyle = COLORS.ui.textLight;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Day ${gs.day}`, btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: null,
    });
    
    // Harvested crops (sell buttons)
    let sellX = 170;
    for (const [cropId, crop] of Object.entries(CROPS)) {
      const count = gs.inventory[cropId] || 0;
      if (count > 0) {
        buttons.push({
          id: `sell_${cropId}`,
          x: sellX, y: bottomY, w: 45, h: 30,
          render: (ctx, btn, hovered) => {
            drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
            ctx.fillStyle = hovered ? '#BBF7D0' : '#DCFCE7';
            ctx.fill();
            ctx.strokeStyle = '#22C55E';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(crop.icon, btn.x + 12, btn.y + btn.h/2);
            
            ctx.fillStyle = COLORS.ui.text;
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(count, btn.x + btn.w - 12, btn.y + btn.h/2);
          },
          onClick: () => sellItem(cropId),
        });
        sellX += 50;
      }
    }
    
    // Sleep button
    buttons.push({
      id: 'sleep',
      x: CANVAS_WIDTH - 130, y: bottomY, w: 90, h: 30,
      render: (ctx, btn, hovered) => {
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fillStyle = hovered ? '#3B82F6' : '#60A5FA';
        ctx.fill();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = season === 'spring' ? '🌙 → Fall' : '☀️ → Spring';
        ctx.fillText(text, btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: advanceDay,
    });
    
    // Reset button
    buttons.push({
      id: 'reset',
      x: CANVAS_WIDTH - 35, y: bottomY, w: 25, h: 30,
      render: (ctx, btn, hovered) => {
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fillStyle = hovered ? '#E5E7EB' : '#F3F4F6';
        ctx.fill();
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = COLORS.ui.text;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↺', btn.x + btn.w/2, btn.y + btn.h/2);
      },
      onClick: resetGame,
    });
    
    return buttons;
  };
  
  // ============================================
  // RENDERING
  // ============================================
  
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const CANVAS_WIDTH = canvasSizeRef.current.width;
    const CANVAS_HEIGHT = canvasSizeRef.current.height;
    if (!CANVAS_WIDTH || !CANVAS_HEIGHT) return;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
      offscreenRef.current.width = CANVAS_WIDTH;
      offscreenRef.current.height = CANVAS_HEIGHT;
    } else if (offscreenRef.current.width !== CANVAS_WIDTH || offscreenRef.current.height !== CANVAS_HEIGHT) {
      offscreenRef.current.width = CANVAS_WIDTH;
      offscreenRef.current.height = CANVAS_HEIGHT;
    }

    const offscreen = offscreenRef.current;
    const ctx = offscreen.getContext('2d');

    // Clear with sky
    ctx.fillStyle = seasonData.sky.bottom;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    
    // Apply zoom centered, then camera offset
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(gs.zoom, gs.zoom);
    ctx.translate(-centerX, -centerY);
    ctx.translate(gs.cameraX, gs.cameraY);
    
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, -500, 0, CANVAS_HEIGHT + 500);
    skyGrad.addColorStop(0, seasonData.sky.top);
    skyGrad.addColorStop(0.6, seasonData.sky.bottom);
    skyGrad.addColorStop(1, seasonData.sky.horizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-1000, -1000, CANVAS_WIDTH + 2000, CANVAS_HEIGHT + 2000);
    
    // Draw tiles
    const getTileScreen = (x, y) => {
      const iso = toIso(x, y);
      return { x: WORLD_OFFSET_X + iso.isoX + WORLD_CENTER_X, y: WORLD_OFFSET_Y + iso.isoY };
    };
    
    const drawTile = (sx, sy, color) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + TILE_WIDTH/2, sy + TILE_HEIGHT/2);
      ctx.lineTo(sx, sy + TILE_HEIGHT);
      ctx.lineTo(sx - TILE_WIDTH/2, sy + TILE_HEIGHT/2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    
    const isInSelection = (x, y) => {
      if (!gs.selectionStart || !gs.selectionEnd) return false;
      const minX = Math.min(gs.selectionStart.x, gs.selectionEnd.x);
      const maxX = Math.max(gs.selectionStart.x, gs.selectionEnd.x);
      const minY = Math.min(gs.selectionStart.y, gs.selectionEnd.y);
      const maxY = Math.max(gs.selectionStart.y, gs.selectionEnd.y);
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    };
    
    // Draw world tiles
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (getBuildingAt(x, y)) continue;
        
        const { x: sx, y: sy } = getTileScreen(x, y);
        const isField = isFarmland(x, y);
        const cell = gs.grid[y][x];
        const selected = isInSelection(x, y) && isField;
        const hovered = gs.hoveredTile && gs.hoveredTile.x === x && gs.hoveredTile.y === y;
        
        if (!isField) {
          drawTile(sx, sy, seasonData.grass);
        } else {
          drawTile(sx, sy, cell.watered ? COLORS.soil.wet : COLORS.soil.dry);
          
          if (selected && !cell.crop) {
            ctx.globalAlpha = 0.3;
            drawTile(sx, sy, '#3B82F6');
            ctx.globalAlpha = 1;
          }
          
          if (cell.crop) {
            const cropData = CROPS[cell.crop];
            const isReady = cell.growth >= cropData.growTime;
            ctx.globalAlpha = isReady ? 0.9 : 0.7;
            ctx.beginPath();
            ctx.moveTo(sx, sy + 3);
            ctx.lineTo(sx + TILE_WIDTH/2 - 3, sy + TILE_HEIGHT/2);
            ctx.lineTo(sx, sy + TILE_HEIGHT - 3);
            ctx.lineTo(sx - TILE_WIDTH/2 + 3, sy + TILE_HEIGHT/2);
            ctx.closePath();
            ctx.fillStyle = isReady ? cropData.matureColor : cropData.color;
            ctx.fill();
            ctx.globalAlpha = 1;
            
            if (isReady) {
              ctx.beginPath();
              ctx.arc(sx, sy + TILE_HEIGHT/2, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#22C55E';
              ctx.fill();
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          
          if (cell.watered) {
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.ellipse(sx + TILE_WIDTH/2 - 12, sy + 6, 4, 5, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#3B82F6';
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        
        if (hovered) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + TILE_WIDTH/2, sy + TILE_HEIGHT/2);
          ctx.lineTo(sx, sy + TILE_HEIGHT);
          ctx.lineTo(sx - TILE_WIDTH/2, sy + TILE_HEIGHT/2);
          ctx.closePath();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    
    // Draw path
    if (gs.isPathing && gs.pathQueue.length > 0) {
      ctx.fillStyle = '#60A5FA';
      ctx.globalAlpha = 0.6;
      for (const step of gs.pathQueue) {
        const { x: sx, y: sy } = getTileScreen(step.x, step.y);
        ctx.beginPath();
        ctx.arc(sx, sy + TILE_HEIGHT/2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    
    // Draw buildings
    for (const building of gs.buildings) {
      const bData = BUILDINGS[building.type];
      const { x: sx, y: sy } = getTileScreen(building.x, building.y);
      const h = 40;
      const w = TILE_WIDTH * bData.width / 2;
      const d = TILE_HEIGHT * bData.height;
      
      // Top
      ctx.beginPath();
      ctx.moveTo(sx, sy - h);
      ctx.lineTo(sx + w, sy + d/2 - h);
      ctx.lineTo(sx, sy + d - h);
      ctx.lineTo(sx - w, sy + d/2 - h);
      ctx.closePath();
      ctx.fillStyle = bData.color;
      ctx.fill();
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Left
      ctx.beginPath();
      ctx.moveTo(sx - w, sy + d/2 - h);
      ctx.lineTo(sx, sy + d - h);
      ctx.lineTo(sx, sy + d);
      ctx.lineTo(sx - w, sy + d/2);
      ctx.closePath();
      ctx.fillStyle = bData.color;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Right
      ctx.beginPath();
      ctx.moveTo(sx + w, sy + d/2 - h);
      ctx.lineTo(sx, sy + d - h);
      ctx.lineTo(sx, sy + d);
      ctx.lineTo(sx + w, sy + d/2);
      ctx.closePath();
      ctx.fillStyle = bData.color;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bData.name, sx, sy - h - 5);
    }
    
    // Draw farmer
    const { x: fx, y: fy } = getTileScreen(gs.farmerPos.x, gs.farmerPos.y);
    
    // Direction edges
    const top = { x: fx, y: fy };
    const right = { x: fx + TILE_WIDTH/2, y: fy + TILE_HEIGHT/2 };
    const bottom = { x: fx, y: fy + TILE_HEIGHT };
    const left = { x: fx - TILE_WIDTH/2, y: fy + TILE_HEIGHT/2 };
    
    const edges = [
      { from: top, to: right, active: gs.farmerDir === 'up' },
      { from: right, to: bottom, active: gs.farmerDir === 'right' },
      { from: bottom, to: left, active: gs.farmerDir === 'down' },
      { from: left, to: top, active: gs.farmerDir === 'left' },
    ];
    
    ctx.setLineDash([5, 3]);
    for (const edge of edges) {
      ctx.beginPath();
      ctx.moveTo(edge.from.x, edge.from.y);
      ctx.lineTo(edge.to.x, edge.to.y);
      ctx.strokeStyle = edge.active ? '#22C55E' : '#F4D03F';
      ctx.lineWidth = edge.active ? 3 : 2;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    
    // Shadow
    ctx.beginPath();
    ctx.ellipse(fx, fy + TILE_HEIGHT/2 + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    
    // Body
    const bodyY = gs.isMoving ? -8 : -5;
    ctx.beginPath();
    ctx.ellipse(fx, fy + TILE_HEIGHT/2 + bodyY + 4, 8, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1E40AF';
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(fx, fy + TILE_HEIGHT/2 + bodyY - 4, 7, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(fx, fy + TILE_HEIGHT/2 + bodyY - 12, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FDBF6F';
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(fx, fy + TILE_HEIGHT/2 + bodyY - 18, 9, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.wood.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fx, fy + TILE_HEIGHT/2 + bodyY - 20, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.wood.medium;
    ctx.fill();
    
    // Tool badge
    ctx.beginPath();
    ctx.arc(fx + 14, fy + TILE_HEIGHT/2 + bodyY - 24, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = COLORS.wood.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    const toolIcon = TOOLS.find(t => t.id === gs.selectedTool)?.icon || '?';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toolIcon, fx + 14, fy + TILE_HEIGHT/2 + bodyY - 24);
    
    // Speech bubble
    if (gs.speechBubble) {
      const bubbleY = fy + TILE_HEIGHT/2 - 55;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, fx - 60, bubbleY - 15, 120, 24, 8);
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(fx - 5, bubbleY + 9);
      ctx.lineTo(fx + 5, bubbleY + 9);
      ctx.lineTo(fx, bubbleY + 16);
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.fill();
      
      ctx.fillStyle = '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gs.speechBubble, fx, bubbleY - 3);
    }
    
    ctx.restore();
    
    // ============================================
    // UI LAYER (no zoom transform)
    // ============================================
    
    const buttons = getUIButtons();
    for (const btn of buttons) {
      const hovered = ui.hoveredButton === btn.id;
      btn.render(ctx, btn, hovered);
    }
    
    // Notification
    if (gs.notification) {
      const notifW = 250;
      const notifH = 32;
      const notifX = (CANVAS_WIDTH - notifW) / 2;
      const notifY = 50;
      
      drawRoundedRect(ctx, notifX, notifY, notifW, notifH, 6);
      ctx.fillStyle = gs.notification.type === 'success' ? '#22C55E' :
                      gs.notification.type === 'error' ? '#EF4444' : '#3B82F6';
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gs.notification.msg, CANVAS_WIDTH / 2, notifY + notifH / 2);
    }
    
    // Title
    ctx.fillStyle = '#78350F';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText("🌾 Hank's Homestead 🌾", CANVAS_WIDTH - 100, 12);
    
    // Copy to visible
    const visibleCtx = canvas.getContext('2d');
    visibleCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    visibleCtx.drawImage(offscreen, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, []);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;

      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      canvasSizeRef.current = { width: displayWidth, height: displayHeight };

      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      ctx.scale(dpr, dpr);

      // Center camera on field center (18, 18) on first load
      if (!gs.cameraInitialized) {
        const worldCenterScreenX = WORLD_OFFSET_X + WORLD_CENTER_X;
        const worldCenterScreenY = WORLD_OFFSET_Y + (WORLD_SIZE * TILE_HEIGHT / 2);
        gs.cameraX = displayWidth / 2 - worldCenterScreenX;
        gs.cameraY = displayHeight / 2 - worldCenterScreenY;
        gs.cameraInitialized = true;
      }

      requestRender();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render on update
  useEffect(() => {
    render();
  });
  
  // ============================================
  // INPUT HANDLING
  // ============================================
  
  const getButtonAt = (x, y) => {
    const buttons = getUIButtons().reverse(); // Check top-most first
    for (const btn of buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        return btn;
      }
    }
    return null;
  };
  
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ui.mousePos = { x, y };

    const CANVAS_WIDTH = canvasSizeRef.current.width;
    const CANVAS_HEIGHT = canvasSizeRef.current.height;
    
    // Handle panning (spacebar + drag)
    if (gs.isPanning && gs.panStartMouse) {
      const dx = (x - gs.panStartMouse.x) / gs.zoom;
      const dy = (y - gs.panStartMouse.y) / gs.zoom;
      gs.cameraX = gs.panStartCamera.x + dx;
      gs.cameraY = gs.panStartCamera.y + dy;
      requestRender();
      return;
    }
    
    // Check UI buttons first
    const btn = getButtonAt(x, y);
    const newHovered = btn?.id || null;
    
    if (newHovered !== ui.hoveredButton) {
      ui.hoveredButton = newHovered;
      requestRender();
    }
    
    // If not over UI, check game world
    if (!btn) {
      const tile = fromIso(x, y, gs.zoom, gs.cameraX, gs.cameraY, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (tile.x >= 0 && tile.x < WORLD_SIZE && tile.y >= 0 && tile.y < WORLD_SIZE) {
        if (!gs.hoveredTile || gs.hoveredTile.x !== tile.x || gs.hoveredTile.y !== tile.y) {
          gs.hoveredTile = tile;
          if (gs.isDragging) {
            gs.selectionEnd = tile;
          }
          requestRender();
        }
      } else if (gs.hoveredTile) {
        gs.hoveredTile = null;
        requestRender();
      }
    } else if (gs.hoveredTile) {
      gs.hoveredTile = null;
      requestRender();
    }
  };
  
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const CANVAS_WIDTH = canvasSizeRef.current.width;
    const CANVAS_HEIGHT = canvasSizeRef.current.height;
    
    // Start panning if spacebar is held
    if (gs.isPanning) {
      gs.panStartMouse = { x, y };
      gs.panStartCamera = { x: gs.cameraX, y: gs.cameraY };
      return;
    }
    
    // Check UI first
    const btn = getButtonAt(x, y);
    if (btn && btn.onClick) {
      btn.onClick();
      return;
    }
    
    // Game world click
    if (e.button === 0) { // Left click
      const tile = fromIso(x, y, gs.zoom, gs.cameraX, gs.cameraY, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (tile.x >= 0 && tile.x < WORLD_SIZE && tile.y >= 0 && tile.y < WORLD_SIZE) {
        if (season === 'spring' && isFarmland(tile.x, tile.y)) {
          gs.isDragging = true;
          gs.selectionStart = tile;
          gs.selectionEnd = tile;
          requestRender();
        }
      }
    }
  };
  
  const handleMouseUp = () => {
    // End panning
    if (gs.panStartMouse) {
      gs.panStartMouse = null;
      gs.panStartCamera = null;
      return;
    }
    
    if (!gs.isDragging || !gs.selectionStart || !gs.selectionEnd) {
      gs.isDragging = false;
      return;
    }
    
    gs.isDragging = false;
    
    if (season === 'fall') {
      gs.selectionStart = null;
      gs.selectionEnd = null;
      requestRender();
      return;
    }
    
    // Build plant queue
    const minX = Math.min(gs.selectionStart.x, gs.selectionEnd.x);
    const maxX = Math.max(gs.selectionStart.x, gs.selectionEnd.x);
    const minY = Math.min(gs.selectionStart.y, gs.selectionEnd.y);
    const maxY = Math.max(gs.selectionStart.y, gs.selectionEnd.y);
    
    const startFromLeft = gs.selectionStart.x <= gs.selectionEnd.x;
    const startFromTop = gs.selectionStart.y <= gs.selectionEnd.y;
    
    const queue = [];
    const yRange = startFromTop 
      ? Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i)
      : Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i);
    
    yRange.forEach((py, rowIndex) => {
      const goingRight = startFromLeft ? (rowIndex % 2 === 0) : (rowIndex % 2 === 1);
      if (goingRight) {
        for (let px = minX; px <= maxX; px++) {
          if (isFarmland(px, py)) queue.push({ x: px, y: py });
        }
      } else {
        for (let px = maxX; px >= minX; px--) {
          if (isFarmland(px, py)) queue.push({ x: px, y: py });
        }
      }
    });
    
    gs.selectionStart = null;
    gs.selectionEnd = null;
    
    if (queue.length === 0) {
      requestRender();
      return;
    }
    
    const seedKey = `${gs.selectedCrop}_seeds`;
    if ((gs.inventory[seedKey] || 0) === 0) {
      sounds.error();
      showSpeech(`Out of ${CROPS[gs.selectedCrop].name} seeds!`);
      return;
    }
    
    // Path to first cell then plant
    const firstCell = queue[0];
    const path = findPath(gs.farmerPos.x, gs.farmerPos.y, firstCell.x, firstCell.y);
    
    if (path.length > 0) {
      gs.pathQueue = path;
      gs.isPathing = true;
      gs.pendingPlantQueue = queue;
    } else {
      gs.autoPlantQueue = queue;
      gs.isAutoPlanting = true;
    }
    
    requestRender();
  };
  
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (gs.isAutoPlanting || gs.isPanning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const CANVAS_WIDTH = canvasSizeRef.current.width;
    const CANVAS_HEIGHT = canvasSizeRef.current.height;

    // Check if over UI
    if (getButtonAt(x, y)) return;

    const tile = fromIso(x, y, gs.zoom, gs.cameraX, gs.cameraY, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (tile.x >= 0 && tile.x < WORLD_SIZE && tile.y >= 0 && tile.y < WORLD_SIZE) {
      const path = findPath(gs.farmerPos.x, gs.farmerPos.y, tile.x, tile.y);
      if (path.length > 0) {
        sounds.click();
        gs.pathQueue = path;
        gs.isPathing = true;
        gs.pendingPlantQueue = [];
        requestRender();
      }
    }
  };
  
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    gs.zoom = Math.max(1, Math.min(4, gs.zoom + delta));
    requestRender();
  };
  
  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Spacebar for panning
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gs.isPanning) {
          gs.isPanning = true;
          requestRender();
        }
        return;
      }
      
      let newX = gs.farmerPos.x;
      let newY = gs.farmerPos.y;
      let newDir = gs.farmerDir;

      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': newY = Math.max(0, gs.farmerPos.y - 1); newDir = 'up'; break;
        case 's': case 'arrowdown': newY = Math.min(WORLD_SIZE - 1, gs.farmerPos.y + 1); newDir = 'down'; break;
        case 'a': case 'arrowleft': newX = Math.max(0, gs.farmerPos.x - 1); newDir = 'left'; break;
        case 'd': case 'arrowright': newX = Math.min(WORLD_SIZE - 1, gs.farmerPos.x + 1); newDir = 'right'; break;
        case 'e': e.preventDefault(); performAction(); return;
        case '1': gs.selectedTool = 'plant'; requestRender(); return;
        case '2': gs.selectedTool = 'water'; requestRender(); return;
        case '3': gs.selectedTool = 'harvest'; requestRender(); return;
        case 'escape':
          gs.isPathing = false;
          gs.pathQueue = [];
          gs.pendingPlantQueue = [];
          gs.showShop = false;
          requestRender();
          return;
        default: return;
      }

      if (gs.isPathing) {
        gs.isPathing = false;
        gs.pathQueue = [];
        gs.pendingPlantQueue = [];
      }

      if (!isWalkable(newX, newY)) {
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
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        gs.isPanning = false;
        gs.panStartMouse = null;
        gs.panStartCamera = null;
        requestRender();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Path/auto-plant processing
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
          if (gs.pendingPlantQueue.length > 0) {
            gs.autoPlantQueue = gs.pendingPlantQueue;
            gs.isAutoPlanting = true;
            gs.pendingPlantQueue = [];
          }
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  });
  
  useEffect(() => {
    if (gs.isAutoPlanting && gs.autoPlantQueue.length > 0) {
      const seedKey = `${gs.selectedCrop}_seeds`;
      if ((gs.inventory[seedKey] || 0) <= 0) {
        gs.isAutoPlanting = false;
        gs.autoPlantQueue = [];
        sounds.error();
        showSpeech(`Out of ${CROPS[gs.selectedCrop].name} seeds!`);
        return;
      }
      
      const timer = setTimeout(() => {
        const [next, ...rest] = gs.autoPlantQueue;
        
        gs.farmerPos = next;
        gs.isMoving = true;
        
        const cell = gs.grid[next.y][next.x];
        if (!cell.crop && (gs.inventory[seedKey] || 0) > 0) {
          gs.inventory[seedKey]--;
          gs.grid[next.y][next.x] = { crop: gs.selectedCrop, growth: 0, watered: false };
          sounds.plant();
        }
        
        gs.autoPlantQueue = rest;
        requestRender();
        
        setTimeout(() => { gs.isMoving = false; requestRender(); }, 100);
        
        if (rest.length === 0) {
          gs.isAutoPlanting = false;
          showNotification('Planting complete!', 'success');
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  });
  
  // ============================================
  // COMPONENT RETURN
  // ============================================
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        cursor: gs.isPanning ? (gs.panStartMouse ? 'grabbing' : 'grab') : (ui.hoveredButton ? 'pointer' : 'default')
      }}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { gs.hoveredTile = null; ui.hoveredButton = null; requestRender(); }}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
    />
  );
}
