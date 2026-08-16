import { describe, it, expect } from 'vitest';
import { World } from '../../index';
import { registerCoreComponents } from '../components';
import type { PhysicsBody, MoverLike } from '../../bridge';
import { createPlayerPrefab } from './playerPrefab';

/**
 * Plain-object stand-in for the Box3D CharacterMover — the same faithful fake
 * the bridge tests use. The real mover is C-heap (WASM) and only exercised in
 * the Segment 4 browser proof.
 */
function fakeMover(x = 0, y = 0, z = 0): MoverLike {
  const position = { x, y, z };
  return {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    solve(delta: number) {
      position.x += this.velocity.x * delta;
      position.z += this.velocity.z * delta;
    },
  };
}

function setup() {
  const world = new World();
  const components = registerCoreComponents(world);
  const PhysicsBody = world.defineComponent<PhysicsBody>('PhysicsBody');
  const prefab = createPlayerPrefab(components, PhysicsBody);
  return { world, components, PhysicsBody, prefab };
}

describe('playerPrefab', () => {
  it('spawns a player entity with Transform, PhysicsBody, and Appearance', () => {
    const { world, components, PhysicsBody, prefab } = setup();
    const mover = fakeMover(1, 2, 3);

    const entity = prefab.build(world, { mover });

    expect(world.has(entity, components.Transform)).toBe(true);
    expect(world.has(entity, PhysicsBody)).toBe(true);
    expect(world.has(entity, components.Appearance)).toBe(true);
    expect(world.findByName('player')).toBe(entity);
  });

  it('binds the passed mover into the PhysicsBody handle', () => {
    const { world, PhysicsBody, prefab } = setup();
    const mover = fakeMover();

    const entity = prefab.build(world, { mover });

    expect(world.get(entity, PhysicsBody)!.mover).toBe(mover);
  });

  it('seeds the Transform from the mover position so frame 0 is not the origin', () => {
    const { world, components, prefab } = setup();
    const mover = fakeMover(4, 0, -7);

    const entity = prefab.build(world, { mover, yaw: 1.5 });

    const xf = world.get(entity, components.Transform)!;
    expect(xf.x).toBe(4);
    expect(xf.z).toBe(-7);
    expect(xf.yaw).toBe(1.5);
  });

  it('throws when built without a mover (the player must be physics-bound)', () => {
    const { world, prefab } = setup();
    expect(() => prefab.build(world)).toThrow(/mover/);
  });
});
