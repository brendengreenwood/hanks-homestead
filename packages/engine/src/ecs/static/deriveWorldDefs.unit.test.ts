import { describe, expect, it } from 'vitest';
import type { EntityDef } from '../entityDef';
import { StaticEntityStore } from './StaticEntityStore';
import { STATIC_TYPES } from './STATIC_TYPES';
import { deriveWorldDefs } from './deriveWorldDefs';

const staticTypeSet: ReadonlySet<string> = new Set(STATIC_TYPES);

/** Load a fresh store with the static subset of `defs` (the caller contract). */
function loadedStore(defs: readonly EntityDef[]): StaticEntityStore {
  const store = new StaticEntityStore();
  store.load(defs.filter((def) => staticTypeSet.has(def.type)));
  return store;
}

describe('deriveWorldDefs', () => {
  it('preserves the original array order with static defs replaced in place', () => {
    const defs: EntityDef[] = [
      { id: 'c1', type: 'coin', x: 1, z: 1 },
      { id: 't1', type: 'tree', x: 2, z: 3 },
      { id: 'n1', type: 'npc', x: 4, z: 5 },
      { id: 'r1', type: 'rock', x: 6, z: 7, scale: 2 },
    ];
    const out = deriveWorldDefs(defs, loadedStore(defs));

    expect(out.map((d) => d.id)).toEqual(['c1', 't1', 'n1', 'r1']);
    expect(out[1]).toEqual({ id: 't1', type: 'tree', x: 2, z: 3 });
    expect(out[3]).toEqual({ id: 'r1', type: 'rock', x: 6, z: 7, scale: 2 });
  });

  it('replaces static defs with canonical ECS output matched by id, not index', () => {
    // Load the store from a REVERSED static subset: byId matching must still
    // pair each def with its own entity — index-zip would swap them.
    const defs: EntityDef[] = [
      { id: 't1', type: 'tree', x: 1, z: 1, y: 0 }, // explicit default y
      { id: 't2', type: 'tree', x: 9, z: 9 },
    ];
    const store = new StaticEntityStore();
    store.load([defs[1], defs[0]]);

    const out = deriveWorldDefs(defs, store);
    // Canonicalized: explicit `y: 0` omitted, position stays t1's own.
    expect(out[0]).toEqual({ id: 't1', type: 'tree', x: 1, z: 1 });
    expect(out[1]).toEqual({ id: 't2', type: 'tree', x: 9, z: 9 });
  });

  it('passes consumed types (npc) through byte-identical', () => {
    const npc: EntityDef = { id: 'n1', type: 'npc', x: 5, z: 6, pose: 'sit' };
    const defs = [npc];

    const out = deriveWorldDefs(defs, loadedStore(defs));
    // Same object reference — untouched, extras (pose) intact.
    expect(out[0]).toBe(npc);
  });

  it('passes unknown types through byte-identical (never a throw)', () => {
    const mystery = { id: 'm1', type: 'dragon', x: 0, z: 0, hoard: 9 } as unknown as EntityDef;
    const defs: EntityDef[] = [mystery, { id: 't1', type: 'tree', x: 1, z: 1 }];

    const out = deriveWorldDefs(defs, loadedStore(defs));
    expect(out[0]).toBe(mystery); // reaches World's warn-and-skip, not a boot throw
    expect(out[1]).toEqual({ id: 't1', type: 'tree', x: 1, z: 1 });
  });

  it('reordering the store load order does not reorder the output', () => {
    const defs: EntityDef[] = [
      { id: 'a', type: 'tree', x: 1, z: 1 },
      { id: 'b', type: 'rock', x: 2, z: 2 },
      { id: 'c', type: 'lamp', x: 3, z: 3 },
    ];
    const store = new StaticEntityStore();
    store.load([defs[2], defs[0], defs[1]]);

    const out = deriveWorldDefs(defs, store);
    expect(out.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((d) => d.type)).toEqual(['tree', 'rock', 'lamp']);
  });

  it('throws loudly when a static def is missing from the store', () => {
    const defs: EntityDef[] = [
      { id: 't1', type: 'tree', x: 1, z: 1 },
      { id: 't2', type: 'tree', x: 2, z: 2 },
    ];
    const store = new StaticEntityStore();
    store.load([defs[0]]); // t2 never loaded

    expect(() => deriveWorldDefs(defs, store)).toThrow(/t2/);
  });

  it('handles empty content', () => {
    expect(deriveWorldDefs([], loadedStore([]))).toEqual([]);
  });
});
