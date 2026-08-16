import { describe, it, expect } from 'vitest';
import { World } from '../../World';
import { registerCoreComponents } from '../components';
import type { NetInterp } from '../../bridge/components/NetInterp';
import { createRemotePlayerPrefab } from './remotePlayerPrefab';

describe('remotePlayerPrefab', () => {
  function setup() {
    const world = new World();
    const components = registerCoreComponents(world);
    const netInterp = world.defineComponent<NetInterp>('NetInterp');
    const prefab = createRemotePlayerPrefab(components, netInterp);
    return { world, components, netInterp, prefab };
  }

  it('spawns an entity with Transform + NetInterp (no PhysicsBody)', () => {
    const { world, components, netInterp, prefab } = setup();
    const entity = prefab.build(world);

    expect(world.has(entity, components.Transform)).toBe(true);
    expect(world.has(entity, netInterp)).toBe(true);
    // No Appearance, no PhysicsBody — remote avatars have no mover.
    expect(world.has(entity, components.Appearance)).toBe(false);
  });

  it('seeds Transform from params', () => {
    const { world, components, prefab } = setup();
    const entity = prefab.build(world, { x: 5, y: 1, z: -3, yaw: 1.2 });
    const xf = world.get(entity, components.Transform)!;

    expect(xf.x).toBe(5);
    expect(xf.y).toBe(1);
    expect(xf.z).toBe(-3);
    expect(xf.yaw).toBeCloseTo(1.2);
  });

  it('defaults Transform to origin when no params', () => {
    const { world, components, prefab } = setup();
    const entity = prefab.build(world);
    const xf = world.get(entity, components.Transform)!;

    expect(xf.x).toBe(0);
    expect(xf.y).toBe(0);
    expect(xf.z).toBe(0);
    expect(xf.yaw).toBe(0);
  });

  it('initialises NetInterp with an empty snapshot buffer', () => {
    const { world, netInterp, prefab } = setup();
    const entity = prefab.build(world);
    const interp = world.get(entity, netInterp)!;

    expect(interp.snapshots).toEqual([]);
  });

  it('has name "remotePlayer"', () => {
    const { prefab } = setup();
    expect(prefab.name).toBe('remotePlayer');
  });
});
