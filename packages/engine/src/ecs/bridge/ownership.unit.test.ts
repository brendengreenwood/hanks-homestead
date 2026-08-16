import { describe, it, expect } from 'vitest';
import { World } from '../index';
import { registerCoreComponents } from '../prefab/components';
import { runPhysicsSync } from './systems/PhysicsSyncSystem';
import { runNetInterp } from './systems/NetInterpSystem';
import { assertSingleTransformOwner } from './ownership';
import type { PhysicsBody, MoverLike } from './components/PhysicsBody';
import type { NetInterp, NetSnapshot } from './components/NetInterp';

function fakeMover(x: number, y: number, z: number): MoverLike {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    solve() {},
  };
}

function setup() {
  const world = new World();
  const { Transform } = registerCoreComponents(world);
  const PhysicsBody = world.defineComponent<PhysicsBody>('PhysicsBody');
  const NetInterp = world.defineComponent<NetInterp>('NetInterp');
  return { world, Transform, PhysicsBody, NetInterp };
}

describe('Transform ownership modes stay separate', () => {
  it('NetInterpSystem does not touch a physics-driven entity', () => {
    const { world, Transform, PhysicsBody, NetInterp } = setup();
    const local = world.spawn();
    world.add(local, Transform, { x: 1, y: 2, z: 3, yaw: 0 });
    world.add(local, PhysicsBody, { mover: fakeMover(9, 9, 9) });

    // A snapshot buffer exists in the world on OTHER entities, but this one has
    // no NetInterp, so the net system must not visit it.
    runNetInterp(world, NetInterp, Transform, 100);

    expect(world.get(local, Transform)).toEqual({ x: 1, y: 2, z: 3, yaw: 0 });
  });

  it('PhysicsSyncSystem does not touch a net-driven entity', () => {
    const { world, Transform, PhysicsBody, NetInterp } = setup();
    const remote = world.spawn();
    const snapshots: NetSnapshot[] = [{ t: 0, x: 5, y: 5, z: 5, yaw: 0, speed: 0 }];
    world.add(remote, Transform, { x: 5, y: 5, z: 5, yaw: 0 });
    world.add(remote, NetInterp, { snapshots });

    runPhysicsSync(world, PhysicsBody, Transform);

    expect(world.get(remote, Transform)).toEqual({ x: 5, y: 5, z: 5, yaw: 0 });
  });

  it('assertSingleTransformOwner throws when an entity has both modes', () => {
    const { world, Transform, PhysicsBody, NetInterp } = setup();
    const bad = world.spawn();
    world.add(bad, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(bad, PhysicsBody, { mover: fakeMover(0, 0, 0) });
    world.add(bad, NetInterp, { snapshots: [] });

    expect(() => assertSingleTransformOwner(world, bad, PhysicsBody, NetInterp)).toThrow(
      /both PhysicsBody and NetInterp/,
    );
  });

  it('assertSingleTransformOwner is a no-op for a single-owner entity', () => {
    const { world, Transform, PhysicsBody, NetInterp } = setup();
    const ok = world.spawn();
    world.add(ok, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(ok, PhysicsBody, { mover: fakeMover(0, 0, 0) });

    expect(() => assertSingleTransformOwner(world, ok, PhysicsBody, NetInterp)).not.toThrow();
  });
});
