import { describe, it, expect } from 'vitest';
import { World } from '../index';
import { registerCoreComponents } from '../prefab/components';
import type { Transform } from '../prefab/components';
import { runPhysicsSync } from './systems/PhysicsSyncSystem';
import type { PhysicsBody, MoverLike } from './components/PhysicsBody';

/**
 * A plain-object stand-in for the Box3D CharacterMover — matches the read/write
 * surface the bridge uses (`position`, `velocity`, `solve()`) so the test is
 * faithful without needing WASM. `solve()` applies velocity to position, the way
 * the real mover advances, so we can assert the system reads the *solved* value.
 */
function fakeMover(x = 0, y = 0, z = 0): MoverLike {
  const position = { x, y, z };
  return {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    solve(delta: number) {
      position.x += this.velocity.x * delta;
      position.y += this.velocity.y * delta;
      position.z += this.velocity.z * delta;
    },
  };
}

function setup() {
  const world = new World();
  const { Transform } = registerCoreComponents(world);
  const PhysicsBody = world.defineComponent<PhysicsBody>('PhysicsBody');
  return { world, Transform, PhysicsBody };
}

describe('PhysicsSyncSystem', () => {
  it('copies the solved mover position into the Transform', () => {
    const { world, Transform, PhysicsBody } = setup();
    const mover = fakeMover(0, 0, 0);
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, PhysicsBody, { mover });

    // Caller drives game-feel + solve, exactly as Player.update() does.
    mover.velocity.x = 3;
    mover.velocity.z = -1;
    mover.solve(1);

    runPhysicsSync(world, PhysicsBody, Transform);

    const xf = world.get(e, Transform)!;
    expect(xf.x).toBe(3);
    expect(xf.z).toBe(-1);
  });

  it('reads mover.position and never writes Transform back into the mover', () => {
    const { world, Transform, PhysicsBody } = setup();
    const mover = fakeMover(7, 2, 5);
    const e = world.spawn();
    // Transform starts stale/divergent — the sync must overwrite it, not the mover.
    world.add(e, Transform, { x: 99, y: 99, z: 99, yaw: 1.23 });
    world.add(e, PhysicsBody, { mover });

    runPhysicsSync(world, PhysicsBody, Transform);

    // Mover position is authoritative and untouched.
    expect(mover.position).toEqual({ x: 7, y: 2, z: 5 });
    // Transform now mirrors the mover.
    const xf = world.get(e, Transform)!;
    expect(xf.x).toBe(7);
    expect(xf.y).toBe(2);
    expect(xf.z).toBe(5);
    // yaw is not owned by the mover, so the sync leaves it alone.
    expect(xf.yaw).toBe(1.23);
  });

  it('skips entities that have no PhysicsBody', () => {
    const { world, Transform, PhysicsBody } = setup();
    const noBody = world.spawn();
    const original: Transform = { x: 1, y: 2, z: 3, yaw: 0 };
    world.add(noBody, Transform, { ...original });

    runPhysicsSync(world, PhysicsBody, Transform);

    expect(world.get(noBody, Transform)).toEqual(original);
  });
});
