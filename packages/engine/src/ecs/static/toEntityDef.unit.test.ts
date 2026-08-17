import { describe, it, expect } from 'vitest';
import type { EntityDef } from '../entityDef';
import { World } from '../World';
import { PrefabRegistry } from '../prefab/PrefabRegistry';
import { registerStaticComponents } from './components';
import { registerStaticPrefabs } from './registerStaticPrefabs';
import { toEntityDef } from './toEntityDef';

// Round-trips through the prefab path (the only spawn path since Segment 2).
function roundTrip(def: EntityDef): EntityDef {
  const world = new World();
  const components = registerStaticComponents(world);
  const registry = new PrefabRegistry();
  registerStaticPrefabs(registry, components);
  const entity = registry.spawn(world, def.type, { def });
  return toEntityDef(world, components, entity);
}

describe('toEntityDef', () => {
  it('round-trips a minimal def verbatim', () => {
    const def: EntityDef = { id: 'tree-1', type: 'tree', x: 1.5, z: -2 };
    expect(roundTrip(def)).toEqual(def);
  });

  it('round-trips a fully-specified def verbatim', () => {
    const def: EntityDef = {
      id: 'house-1',
      type: 'house',
      x: 1,
      y: 0.5,
      z: 2,
      rotX: 0.1,
      rotY: 1.2,
      rotZ: -0.3,
      scale: 1.4,
      bodyColor: '#aabbcc',
      roofColor: '#112233',
    };
    const out = roundTrip(def);
    expect(out).toEqual(def);
    // toEqual treats `{ y: undefined }` as `{}` — assert the key set too so an
    // unconditional `def.y = ...` assign can't sneak past as `undefined`.
    expect(Object.keys(out).sort()).toEqual(Object.keys(def).sort());
  });

  it('round-trips a tilted monolith verbatim', () => {
    const def: EntityDef = {
      id: 'mono-1',
      type: 'monolith',
      x: 3,
      z: 4,
      rotY: 0.7,
      tilt: 0.12,
    };
    expect(roundTrip(def)).toEqual(def);
  });

  it('canonicalizes explicit default values by omitting them', () => {
    // entities.json may spell defaults out (e.g. `y: 0`). The canonical def
    // omits them — consumer-equivalent because every reader applies `??`
    // defaults, but not byte-equal to the source.
    const out = roundTrip({
      id: 'rock-1',
      type: 'rock',
      x: 1,
      y: 0,
      z: 2,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
    });

    expect(out).toEqual({ id: 'rock-1', type: 'rock', x: 1, z: 2 });
    expect('y' in out).toBe(false);
    expect('scale' in out).toBe(false);
  });

  it('emits only the house color that was present', () => {
    const out = roundTrip({
      id: 'house-1',
      type: 'house',
      x: 0,
      z: 0,
      roofColor: '#112233',
    });

    expect(out).toEqual({
      id: 'house-1',
      type: 'house',
      x: 0,
      z: 0,
      roofColor: '#112233',
    });
    expect('bodyColor' in out).toBe(false);
  });

  it('throws for an entity that is not a loaded static entity', () => {
    const world = new World();
    const components = registerStaticComponents(world);
    const bare = world.spawn();

    expect(() => toEntityDef(world, components, bare)).toThrow(
      /not a loaded static entity/,
    );
  });
});
