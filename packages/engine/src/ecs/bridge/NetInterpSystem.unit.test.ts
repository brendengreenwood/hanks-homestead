import { describe, it, expect } from 'vitest';
import { World } from '../index';
import { registerCoreComponents } from '../prefab/components';
import { runNetInterp } from './systems/NetInterpSystem';
import type { NetInterp, NetSnapshot } from './components/NetInterp';

function setup() {
  const world = new World();
  const { Transform } = registerCoreComponents(world);
  const NetInterp = world.defineComponent<NetInterp>('NetInterp');
  return { world, Transform, NetInterp };
}

function snap(t: number, x: number, y: number, z: number, yaw = 0, speed = 0): NetSnapshot {
  return { t, x, y, z, yaw, speed };
}

describe('NetInterpSystem', () => {
  it('interpolates between two keyframes at a render time between them', () => {
    const { world, Transform, NetInterp } = setup();
    const snapshots = [snap(0, 0, 0, 0), snap(100, 10, 20, -4)];
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, NetInterp, { snapshots });

    runNetInterp(world, NetInterp, Transform, 50); // halfway

    const xf = world.get(e, Transform)!;
    expect(xf.x).toBeCloseTo(5);
    expect(xf.y).toBeCloseTo(10);
    expect(xf.z).toBeCloseTo(-2);
  });

  it('takes the shortest arc for yaw across the +/-pi wrap', () => {
    const { world, Transform, NetInterp } = setup();
    // older near +pi, newer near -pi: shortest arc is a small step forward, not
    // a ~2pi sweep backward. Mirrors RemoteAvatar.sample()'s yawDiff math.
    const older = Math.PI - 0.1;
    const newer = -Math.PI + 0.1;
    const snapshots = [snap(0, 0, 0, 0, older), snap(100, 0, 0, 0, newer)];
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, NetInterp, { snapshots });

    runNetInterp(world, NetInterp, Transform, 50);

    const xf = world.get(e, Transform)!;
    // Halfway across a 0.2rad shortest arc lands at exactly +/-pi.
    expect(Math.abs(xf.yaw)).toBeCloseTo(Math.PI);
  });

  it('clamps to the latest snapshot at or after the newest (no extrapolation)', () => {
    const { world, Transform, NetInterp } = setup();
    const snapshots = [snap(0, 0, 0, 0), snap(100, 10, 0, 0)];
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, NetInterp, { snapshots });

    runNetInterp(world, NetInterp, Transform, 500); // well past the newest

    // Holds the latest — does NOT extrapolate to x=50.
    expect(world.get(e, Transform)!.x).toBe(10);
  });

  it('holds the oldest snapshot when render time precedes the first', () => {
    const { world, Transform, NetInterp } = setup();
    const snapshots = [snap(100, 3, 0, 0), snap(200, 9, 0, 0)];
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, NetInterp, { snapshots });

    runNetInterp(world, NetInterp, Transform, 0); // before the first snapshot

    expect(world.get(e, Transform)!.x).toBe(3);
  });

  it('holds position for a single-snapshot buffer', () => {
    const { world, Transform, NetInterp } = setup();
    const e = world.spawn();
    world.add(e, Transform, { x: 0, y: 0, z: 0, yaw: 0 });
    world.add(e, NetInterp, { snapshots: [snap(50, 4, 5, 6)] });

    runNetInterp(world, NetInterp, Transform, 50);

    expect(world.get(e, Transform)!).toMatchObject({ x: 4, y: 5, z: 6 });
  });

  it('leaves the Transform untouched for an empty snapshot buffer', () => {
    const { world, Transform, NetInterp } = setup();
    const e = world.spawn();
    world.add(e, Transform, { x: 1, y: 2, z: 3, yaw: 0.5 });
    world.add(e, NetInterp, { snapshots: [] });

    runNetInterp(world, NetInterp, Transform, 100);

    expect(world.get(e, Transform)!).toEqual({ x: 1, y: 2, z: 3, yaw: 0.5 });
  });

  it('skips entities that have no NetInterp', () => {
    const { world, Transform, NetInterp } = setup();
    const bare = world.spawn();
    world.add(bare, Transform, { x: 8, y: 8, z: 8, yaw: 0 });

    runNetInterp(world, NetInterp, Transform, 100);

    expect(world.get(bare, Transform)).toEqual({ x: 8, y: 8, z: 8, yaw: 0 });
  });
});
