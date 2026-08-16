import { describe, it, expect } from 'vitest';
import { World } from '../index';
import { PrefabRegistry } from './PrefabRegistry';
import { registerCoreComponents } from './components';
import { createMarkerPrefab } from './prefabs/markerPrefab';
import { createSpawnPointPrefab } from './prefabs/spawnPointPrefab';

function setup() {
  const world = new World();
  const components = registerCoreComponents(world);
  const registry = new PrefabRegistry();
  registry.register(createMarkerPrefab(components));
  registry.register(createSpawnPointPrefab(components));
  return { world, components, registry };
}

describe('PrefabRegistry', () => {
  it('spawns by name an entity with exactly the declared components and defaults', () => {
    const { world, components, registry } = setup();

    const entity = registry.spawn(world, 'marker', {});

    expect(world.isAlive(entity)).toBe(true);
    expect(world.has(entity, components.Transform)).toBe(true);
    expect(world.has(entity, components.Appearance)).toBe(true);
    expect(world.get(entity, components.Transform)).toEqual({
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    });
    expect(world.get(entity, components.Appearance)).toEqual({
      model: 'marker',
      tint: 0xffffff,
    });
  });

  it('applies per-spawn params over defaults', () => {
    const { world, components, registry } = setup();

    const entity = registry.spawn(world, 'marker', {
      x: 3,
      z: -2,
      yaw: 1.5,
      model: 'flag',
      tint: 0x00ff00,
    });

    expect(world.get(entity, components.Transform)).toEqual({
      x: 3,
      y: 0,
      z: -2,
      yaw: 1.5,
    });
    expect(world.get(entity, components.Appearance)).toEqual({
      model: 'flag',
      tint: 0x00ff00,
    });
  });

  it('a single-component prefab attaches only its declared component', () => {
    const { world, components, registry } = setup();

    const entity = registry.spawn(world, 'spawnPoint', { x: 5, z: 6 });

    expect(world.has(entity, components.Transform)).toBe(true);
    expect(world.has(entity, components.Appearance)).toBe(false);
    expect(world.get(entity, components.Transform)).toEqual({
      x: 5,
      y: 0,
      z: 6,
      yaw: 0,
    });
  });

  it('forwards spawnPoint params (incl. yaw) through spawn()', () => {
    const { world, components, registry } = setup();

    const entity = registry.spawn(world, 'spawnPoint', { x: 1, z: 2, yaw: 0.75 });

    expect(world.get(entity, components.Transform)).toEqual({
      x: 1,
      y: 0,
      z: 2,
      yaw: 0.75,
    });
  });

  it('spawns param-less through spawn() with all defaults', () => {
    const { world, components, registry } = setup();

    const entity = registry.spawn(world, 'marker');

    expect(world.get(entity, components.Transform)).toEqual({
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    });
  });

  it('spawning twice yields two distinct live entities', () => {
    const { world, registry } = setup();

    const a = registry.spawn(world, 'marker', {});
    const b = registry.spawn(world, 'marker', {});

    expect(a).not.toBe(b);
    expect(world.isAlive(a)).toBe(true);
    expect(world.isAlive(b)).toBe(true);
  });

  it('has() reflects registration', () => {
    const { registry } = setup();
    expect(registry.has('marker')).toBe(true);
    expect(registry.has('spawnPoint')).toBe(true);
    expect(registry.has('nope')).toBe(false);
  });

  it('throws on spawning an unknown prefab name', () => {
    const { world, registry } = setup();
    expect(() => registry.spawn(world, 'ghost', {})).toThrow(/not registered/);
  });

  it('throws on registering a duplicate prefab name', () => {
    const { components, registry } = setup();
    expect(() => registry.register(createMarkerPrefab(components))).toThrow(
      /already registered/,
    );
  });
});
