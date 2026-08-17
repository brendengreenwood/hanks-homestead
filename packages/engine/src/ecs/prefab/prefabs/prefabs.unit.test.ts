import { describe, it, expect } from 'vitest';
import { World } from '../../index';
import { registerCoreComponents } from '../components';
import { createMarkerPrefab } from './markerPrefab';
import { createSpawnPointPrefab } from './spawnPointPrefab';

describe('example prefabs (built directly)', () => {
  it('marker builds a Transform + Appearance entity with defaults', () => {
    const world = new World();
    const components = registerCoreComponents(world);
    const prefab = createMarkerPrefab(components);

    expect(prefab.name).toBe('marker');

    const entity = prefab.build(world, {});
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

  it('marker builds with no params argument', () => {
    const world = new World();
    const components = registerCoreComponents(world);
    const prefab = createMarkerPrefab(components);

    // params is optional: a param-less call attaches all defaults.
    const entity = prefab.build(world);
    expect(world.has(entity, components.Transform)).toBe(true);
  });

  it('spawnPoint builds a Transform-only entity with defaults', () => {
    const world = new World();
    const components = registerCoreComponents(world);
    const prefab = createSpawnPointPrefab(components);

    expect(prefab.name).toBe('spawnPoint');

    const entity = prefab.build(world, {});
    expect(world.has(entity, components.Transform)).toBe(true);
    expect(world.has(entity, components.Appearance)).toBe(false);
    expect(world.get(entity, components.Transform)).toEqual({
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    });
  });

  it('registerCoreComponents throws if called twice on one world', () => {
    const world = new World();
    registerCoreComponents(world);
    expect(() => registerCoreComponents(world)).toThrow(/already defined/);
  });
});
