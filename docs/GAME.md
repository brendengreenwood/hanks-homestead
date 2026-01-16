# Game Design

## The Vibe

Midwest American farmer named Hank. Honest work, simple pleasures. The satisfaction of dirt under your fingernails and a field full of crops.

## Core Loop

```
SPRING                          FALL
  │                               │
  ├─ Buy seeds (shop)             ├─ Harvest mature crops
  ├─ Plant seeds (drag-select)    ├─ Sell for gold
  ├─ Water crops                  │
  │                               │
  └─────── SLEEP ─────────────────┘
           (advances day, matures crops)
```

## Current Mechanics

### Seasons
- Odd days = Spring (plant, water)
- Even days = Fall (harvest only)
- Sleep transitions seasons
- Spring→Fall: All crops instantly mature
- Fall→Spring: Field clears completely

### Tools
| Tool | Key | Spring | Fall |
|------|-----|--------|------|
| Plant | 1 | ✓ | ✗ |
| Water | 2 | ✓ | ✗ |
| Harvest | 3 | ✗ | ✓ |

### Crops
| Crop | Seed Cost | Sell Price | Profit |
|------|-----------|------------|--------|
| Wheat | 10g | 25g | 15g |
| Carrot | 15g | 40g | 25g |
| Tomato | 20g | 55g | 35g |
| Corn | 25g | 75g | 50g |
| Pumpkin | 40g | 120g | 80g |

### Movement
- WASD / Arrows: Move one tile
- Right-click: Pathfind to tile (A* around buildings)
- Farmer shows facing direction with dashed edge

### Planting
- Select plant tool + crop type
- Drag rectangle on farmland
- Farmer walks to first tile, plants in snake pattern
- Stops if out of seeds

### Camera
- Scroll: Zoom (1x - 4x)
- Space + drag: Pan

## World Layout

```
36x36 grid
┌────────────────────────────────────┐
│                                    │
│                                    │
│     ┌──┐                           │
│     │FH│   ┌──────────┐     ┌─┐    │
│     └──┘   │          │     │S│    │
│            │  FIELD   │     └─┘    │
│            │  10x10   │            │
│            │          │            │
│            └──────────┘            │
│                                    │
│                                    │
└────────────────────────────────────┘
FH = Farmhouse (2x2)
S = Silo (1x1)
FIELD starts at (13,13)
```

## What's Missing

### Progression
- Nothing to spend gold on beyond seeds
- No goals or milestones
- No upgrades

### Feel
- Buildings are placeholder boxes
- Farmer is simple shapes
- No particles or juice
- No weather or ambient life

### Depth
- Only one field
- No tool upgrades
- No automation buildings
- No NPCs or story
