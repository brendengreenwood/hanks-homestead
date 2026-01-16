# Code Patterns

## Add a Button

```javascript
// In getUIButtons():
buttons.push({
  id: 'my_button',
  x: 100, y: 10, w: 60, h: 28,
  render: (ctx, btn, isHovered) => {
    drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
    ctx.fillStyle = isHovered ? '#AAA' : '#CCC';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click', btn.x + btn.w/2, btn.y + btn.h/2);
  },
  onClick: () => { 
    // do something
    requestRender(); 
  },
});
```

## Add Game State

```javascript
// 1. In gameState.current initialization:
const gameState = useRef({
  // ... existing ...
  myNewState: initialValue,
});

// 2. In resetGame():
gs.myNewState = initialValue;

// 3. Use it:
gs.myNewState = newValue;
requestRender();
```

## Add a Keyboard Shortcut

```javascript
// In handleKeyDown switch:
case 'q':
  doSomething();
  requestRender();
  return;
```

## Add a Sound

```javascript
// In useSound() return object:
mySound: () => {
  playTone(440, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(550, 0.15, 'sine', 0.08), 50);
},
```

## Add a Crop

```javascript
// In CROPS constant:
strawberry: { 
  name: 'Strawberry', 
  growTime: 1, 
  seedPrice: 30, 
  sellPrice: 90, 
  color: '#228B22',      // Growing color
  matureColor: '#FF6B6B', // Ready color
  icon: '🍓' 
},
```

## Add a Building Type

```javascript
// In BUILDINGS constant:
barn: { 
  name: 'Barn', 
  color: '#8B4513', 
  width: 3,   // Tiles wide
  height: 2   // Tiles deep
},
```

## Draw an Isometric Tile

```javascript
const drawTile = (ctx, sx, sy, color) => {
  ctx.beginPath();
  ctx.moveTo(sx, sy);                           // Top
  ctx.lineTo(sx + TILE_WIDTH/2, sy + TILE_HEIGHT/2);   // Right
  ctx.lineTo(sx, sy + TILE_HEIGHT);              // Bottom
  ctx.lineTo(sx - TILE_WIDTH/2, sy + TILE_HEIGHT/2);   // Left
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
```

## Get Screen Position from Grid

```javascript
const getTileScreen = (x, y) => {
  const iso = toIso(x, y);
  return { 
    x: WORLD_OFFSET_X + iso.isoX + WORLD_CENTER_X, 
    y: WORLD_OFFSET_Y + iso.isoY 
  };
};
```

## Get Grid Position from Mouse

```javascript
const tile = fromIso(mouseX, mouseY, gs.zoom, gs.cameraX, gs.cameraY);
if (tile.x >= 0 && tile.x < WORLD_SIZE && tile.y >= 0 && tile.y < WORLD_SIZE) {
  // Valid tile
}
```

## Show Notification

```javascript
showNotification('Something happened!', 'success');  // or 'error' or 'info'
```

## Show Speech Bubble

```javascript
showSpeech('Hank says something', 2000);  // 2 second duration
```

## Draw Rounded Rectangle

```javascript
drawRoundedRect(ctx, x, y, width, height, radius);
ctx.fillStyle = '#FFF';
ctx.fill();
ctx.strokeStyle = '#000';
ctx.stroke();
```

## Draw Panel with Shadow

```javascript
drawPanel(ctx, x, y, width, height);
```
