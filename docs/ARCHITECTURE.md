# Architecture

## Rendering: Pure Canvas

No React DOM except the `<canvas>` element. Everything draws to canvas - world, UI, text, buttons.

**Why:** Started with SVG, 36x36 grid = 10,000+ DOM nodes, browser died. Canvas draws pixels, one element, smooth 60fps.

## State: Refs Not useState

```javascript
const gameState = useRef({ gold: 200, ... });
const gs = gameState.current;

// Mutate directly
gs.gold += 100;
requestRender();  // Trigger redraw
```

**Why:** useState causes React re-renders. Re-renders cause canvas to flash white between clear and redraw. Refs don't trigger re-renders.

## Double Buffering

```javascript
// Create once
offscreenRef.current = document.createElement('canvas');

// Every frame:
const ctx = offscreenRef.current.getContext('2d');
ctx.fillRect(...);  // Draw to offscreen
// ... all drawing ...
visibleCtx.drawImage(offscreenRef.current, 0, 0);  // Atomic copy
```

**Why:** If you clear + draw directly to visible canvas, user sees the clear (white flash). Offscreen buffer means the copy is instant.

## Coordinate Systems

```
Grid (x, y)           - Tile position in world (0-35, 0-35)
     ↓ toIso()
Isometric (isoX, isoY) - Diamond projection
     ↓ + offsets + camera
Screen (screenX, screenY) - Pixel position on canvas
```

Inverse for mouse clicks:
```javascript
fromIso(screenX, screenY, zoom, cameraX, cameraY) → { x, y }
```

## Render Pipeline

```
1. Fill sky (no clearRect - prevents flash)
2. ctx.save()
3. Translate to center, scale by zoom, translate back, add camera offset
4. Draw world layer (tiles, crops, buildings, farmer)
5. ctx.restore()
6. Draw UI layer (buttons, panels, notifications) - no transforms
7. Copy offscreen → visible
```

## UI System

Buttons are data objects, not React components:

```javascript
const buttons = [
  {
    id: 'shop',
    x: 100, y: 10, w: 60, h: 28,
    render: (ctx, btn, isHovered) => {
      drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
      ctx.fillStyle = isHovered ? '#FEF08A' : '#FEF9C3';
      ctx.fill();
    },
    onClick: () => { gs.showShop = !gs.showShop; requestRender(); }
  }
];
```

Hit detection:
```javascript
const getButtonAt = (x, y) => {
  for (const btn of buttons.reverse()) {
    if (x >= btn.x && x < btn.x + btn.w && y >= btn.y && y < btn.y + btn.h) {
      return btn;
    }
  }
  return null;
};
```

## Camera

```javascript
gs.cameraX, gs.cameraY  // Offset from default view
gs.zoom                  // Scale factor (1-4)
gs.isPanning            // Spacebar held
```

Transform order in render:
```javascript
ctx.translate(centerX, centerY);
ctx.scale(zoom, zoom);
ctx.translate(-centerX, -centerY);
ctx.translate(cameraX, cameraY);
```

## Sound

Web Audio API oscillators. No audio files.

```javascript
const playTone = (frequency, duration, type, volume) => {
  const osc = audioCtx.createOscillator();
  osc.type = type;  // 'sine', 'square', 'triangle'
  osc.frequency.setValueAtTime(frequency, now);
  // ... connect, start, stop
};
```
