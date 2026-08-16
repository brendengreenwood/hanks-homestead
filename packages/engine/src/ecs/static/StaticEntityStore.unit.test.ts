import { describe, it, expect } from 'vitest';
import type { EntityDef } from '../entityDef';
import { StaticEntityStore } from './StaticEntityStore';

const LAYOUT: EntityDef[] = [
  { id: 'tree-1', type: 'tree', x: 1, z: 2 },
  { id: 'house-1', type: 'house', x: 3, z: 4, rotY: 1.2, bodyColor: '#aabbcc' },
  { id: 'mono-1', type: 'monolith', x: 5, z: 6, tilt: 0.12 },
];

describe('StaticEntityStore', () => {
  it('loads a layout and reports the count', () => {
    const store = new StaticEntityStore();
    const ids = store.load(LAYOUT);

    expect(ids).toHaveLength(3);
    expect(store.count).toBe(3);
    expect(store.world.entityCount).toBe(3);
  });

  it('defs() returns canonical defs in the original load order', () => {
    const store = new StaticEntityStore();
    store.load([
      ...LAYOUT,
      // Explicit defaults canonicalize away on the way back out.
      { id: 'rock-1', type: 'rock', x: 7, y: 0, z: 8, scale: 1 },
    ]);

    expect(store.defs()).toEqual([
      ...LAYOUT,
      { id: 'rock-1', type: 'rock', x: 7, z: 8 },
    ]);
  });

  it('byId and placement look entities up by layout id', () => {
    const store = new StaticEntityStore();
    const ids = store.load(LAYOUT);

    expect(store.byId('house-1')).toBe(ids[1]);
    expect(store.byId('missing')).toBeUndefined();

    expect(store.placement('house-1')).toEqual({
      x: 3,
      y: 0,
      z: 4,
      rotX: 0,
      rotY: 1.2,
      rotZ: 0,
      scale: 1,
    });
    expect(store.placement('missing')).toBeUndefined();
  });

  it('is empty before load', () => {
    const store = new StaticEntityStore();
    expect(store.count).toBe(0);
    expect(store.defs()).toEqual([]);
    expect(store.byId('tree-1')).toBeUndefined();
  });

  it('throws on a second load instead of mixing layouts', () => {
    const store = new StaticEntityStore();
    store.load(LAYOUT);

    expect(() => store.load(LAYOUT)).toThrow(/only be called once/);
  });

  // Migrated from load.unit.test.ts (Segment 1): the guard now lives in
  // StaticEntityStore.load, the batch entry point the prefab path routes
  // through — same assertions, new owner.
  it('spawns one entity per def, in the original array order', () => {
    const store = new StaticEntityStore();
    const ids = store.load(LAYOUT);

    expect(ids).toHaveLength(3);
    expect(store.world.entityCount).toBe(3);
    expect(store.defs().map((def) => def.id)).toEqual([
      'tree-1',
      'house-1',
      'mono-1',
    ]);
  });

  it('names each entity with its layout id for findByName lookup', () => {
    const store = new StaticEntityStore();
    const ids = store.load(LAYOUT);

    expect(store.world.findByName('tree-1')).toBe(ids[0]);
    expect(store.world.findByName('house-1')).toBe(ids[1]);
    expect(store.world.findByName('nope')).toBeUndefined();
  });

  it('throws on a duplicate layout id', () => {
    const store = new StaticEntityStore();

    expect(() =>
      store.load([
        { id: 'tree-1', type: 'tree', x: 0, z: 0 },
        { id: 'tree-1', type: 'tree', x: 1, z: 1 },
      ]),
    ).toThrow(/duplicate layout id "tree-1"/);
  });

  it('throws on a type with no prefab, naming the type', () => {
    const store = new StaticEntityStore();

    expect(() =>
      store.load([{ id: 'npc-1', type: 'npc', x: 0, z: 0 }]),
    ).toThrow(/no static prefab for entity type "npc"/);
  });

  it('a failed load leaves the world untouched and a corrected retry works', () => {
    const store = new StaticEntityStore();

    expect(() =>
      store.load([
        { id: 'tree-1', type: 'tree', x: 0, z: 0 },
        { id: 'bad-1', type: 'npc', x: 1, z: 1 },
      ]),
    ).toThrow(/no static prefab/);

    // Validation runs before any spawn — no half-loaded prefix.
    expect(store.world.entityCount).toBe(0);
    expect(store.byId('tree-1')).toBeUndefined();

    const ids = store.load(LAYOUT);
    expect(ids).toHaveLength(3);
    expect(store.count).toBe(3);
  });

  it('two stores are fully isolated worlds', () => {
    const a = new StaticEntityStore();
    const b = new StaticEntityStore();
    a.load(LAYOUT);
    b.load([{ id: 'only-b', type: 'rock', x: 9, z: 9 }]);

    expect(a.byId('only-b')).toBeUndefined();
    expect(b.byId('tree-1')).toBeUndefined();
    expect(a.count).toBe(3);
    expect(b.count).toBe(1);
  });
});
