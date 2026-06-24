// ============================================
// GAME LOGIC (renderer-agnostic, pure functions)
// ============================================
import { BASE_STORAGE, BUILDINGS, FIELD_OFFSET, FIELD_SIZE, SILO_CAPACITY, WORLD_SIZE } from './constants.js';

// Total crop storage: a base amount plus each silo building's capacity.
export const storageCapacity = (buildings) =>
  BASE_STORAGE + buildings.filter((b) => b.type === 'silo').length * SILO_CAPACITY;

export const isFarmland = (x, y) =>
  x >= FIELD_OFFSET && x < FIELD_OFFSET + FIELD_SIZE && y >= FIELD_OFFSET && y < FIELD_OFFSET + FIELD_SIZE;

export const getBuildingAt = (buildings, x, y) => {
  for (const building of buildings) {
    const bData = BUILDINGS[building.type];
    if (x >= building.x && x < building.x + bData.width && y >= building.y && y < building.y + bData.height) {
      return building;
    }
  }
  return null;
};

export const isWalkable = (buildings, x, y) => {
  if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) return false;
  if (getBuildingAt(buildings, x, y)) return false;
  return true;
};

// A* pathfinding with Manhattan heuristic. Buildings are obstacles.
export const findPath = (buildings, startX, startY, endX, endY) => {
  if (!isWalkable(buildings, endX, endY)) return [];

  const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
  const closedSet = new Set();
  const key = (x, y) => `${x},${y}`;
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

    closedSet.add(key(current.x, current.y));

    for (const neighbor of [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ]) {
      if (!isWalkable(buildings, neighbor.x, neighbor.y)) continue;
      if (closedSet.has(key(neighbor.x, neighbor.y))) continue;

      const g = current.g + 1;
      const h = heuristic(neighbor.x, neighbor.y, endX, endY);
      const f = g + h;

      const existing = openSet.find((n) => n.x === neighbor.x && n.y === neighbor.y);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        openSet.push({ x: neighbor.x, y: neighbor.y, g, h, f, parent: current });
      }
    }
  }
  return [];
};

// Build a boustrophedon ("snake") queue of farmable cells from a drag selection,
// starting near `start` so the farmer walks the field efficiently.
export const buildSelectionQueue = (start, end) => {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  const startFromLeft = start.x <= end.x;
  const startFromTop = start.y <= end.y;

  const yRange = startFromTop
    ? Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i)
    : Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i);

  const queue = [];
  yRange.forEach((py, rowIndex) => {
    const goingRight = startFromLeft ? rowIndex % 2 === 0 : rowIndex % 2 === 1;
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
  return queue;
};
