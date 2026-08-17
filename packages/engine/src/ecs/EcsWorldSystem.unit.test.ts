import { describe, it, expect } from 'vitest';
import { EcsWorldSystem } from './EcsWorldSystem';
import type { MoverLike } from './bridge';
import type { EntityDef } from './entityDef';

/**
 * Faithful plain-object mover: `solve()` integrates velocity into position, so a
 * caller can advance it exactly the way `Player.update()` drives the real one,
 * and the test can assert `EcsWorldSystem.update` mirrors the *solved* result.
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

describe('EcsWorldSystem', () => {
  it('spawns a player entity carrying Transform and PhysicsBody', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    expect(ecs.player).toBeGreaterThanOrEqual(0);
    expect(ecs.playerHasTransform()).toBe(true);
    expect(ecs.playerHasPhysicsBody()).toBe(true);
  });

  it('seeds the player Transform from the mover position', () => {
    const ecs = new EcsWorldSystem(fakeMover(5, 0, -2));
    const xf = ecs.playerTransform();
    expect(xf.x).toBe(5);
    expect(xf.z).toBe(-2);
  });

  it('update() mirrors the solved mover position into the player Transform', () => {
    const mover = fakeMover(0, 0, 0);
    const ecs = new EcsWorldSystem(mover);

    // Drive the mover the way Player.update does: write velocity, solve.
    mover.velocity.x = 3;
    mover.velocity.z = -1;
    mover.solve(1);

    // Before update, the Transform still holds the seed (0,0,0).
    expect(ecs.playerTransform().x).toBe(0);

    ecs.update(1 / 60);

    const xf = ecs.playerTransform();
    expect(xf.x).toBeCloseTo(3, 6);
    expect(xf.z).toBeCloseTo(-1, 6);
  });

  it('never writes the Transform back into the mover (mover stays authoritative)', () => {
    const mover = fakeMover(2, 0, 2);
    const ecs = new EcsWorldSystem(mover);

    // Corrupt the Transform, then run update. The mover must be untouched, and
    // the Transform must be overwritten from the mover — sync is one-directional.
    ecs.playerTransform().x = 999;
    ecs.update(1 / 60);

    expect(mover.position.x).toBe(2);
    expect(ecs.playerTransform().x).toBe(2);
  });

  it('loadStatic filters to static types and exposes count + cached probe', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    const defs: EntityDef[] = [
      { id: 'c1', type: 'coin', x: 0, z: 0 }, // consumed — not loaded
      { id: 't1', type: 'tree', x: 4, z: -7 },
      { id: 'r1', type: 'rock', x: 1, z: 2 },
    ];
    ecs.loadStatic(defs);

    expect(ecs.staticCount()).toBe(2);
    // Probe is the FIRST static def (coin skipped), identical across reads.
    expect(ecs.staticProbe()).toEqual({ id: 't1', type: 'tree', x: 4, z: -7 });
    expect(ecs.staticProbe()).toBe(ecs.staticProbe());
    // worldDefs: statics canonicalized, consumed def byte-identical.
    const out = ecs.worldDefs(defs);
    expect(out[0]).toBe(defs[0]);
    expect(out.map((d) => d.id)).toEqual(['c1', 't1', 'r1']);
  });

  it('staticProbe is null before/without static content', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    expect(ecs.staticProbe()).toBeNull();
    expect(ecs.staticCount()).toBe(0);
    ecs.loadStatic([{ id: 'c1', type: 'coin', x: 0, z: 0 }]);
    expect(ecs.staticProbe()).toBeNull();
  });

  // ---- remote player lifecycle --------------------------------------------

  it('spawnRemote creates a remote entity with Transform + NetInterp', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    const entity = ecs.spawnRemote('peer-A', 3, 1, -5, 0.5);

    expect(ecs.hasRemote('peer-A')).toBe(true);
    expect(ecs.remoteEntity('peer-A')).toBe(entity);
    expect(ecs.remoteCount).toBe(1);

    const xf = ecs.world.get(entity, ecs.transform)!;
    expect(xf.x).toBe(3);
    expect(xf.y).toBe(1);
    expect(xf.z).toBe(-5);
    expect(xf.yaw).toBeCloseTo(0.5);
  });

  it('spawnRemote assigns name remote:<peerId>', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    ecs.spawnRemote('peer-B');
    expect(ecs.world.findByName('remote:peer-B')).toBeDefined();
  });

  it('spawnRemote throws on duplicate peer id', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    ecs.spawnRemote('peer-C');
    expect(() => ecs.spawnRemote('peer-C')).toThrow(/already exists/);
  });

  it('despawnRemote removes the entity and clears the map', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    const entity = ecs.spawnRemote('peer-D');
    ecs.despawnRemote('peer-D');

    expect(ecs.hasRemote('peer-D')).toBe(false);
    expect(ecs.remoteCount).toBe(0);
    expect(ecs.world.isAlive(entity)).toBe(false);
  });

  it('despawnRemote is a no-op for unknown peer', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    expect(() => ecs.despawnRemote('nobody')).not.toThrow();
  });

  it('pushSnapshot feeds the interpolation buffer', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    const entity = ecs.spawnRemote('peer-E');

    ecs.pushSnapshot('peer-E', { t: 100, x: 1, y: 0, z: 0, yaw: 0, speed: 1 });
    ecs.pushSnapshot('peer-E', { t: 200, x: 2, y: 0, z: 0, yaw: 0, speed: 1 });

    const name = ecs.world.findByName('remote:peer-E')!;
    expect(name).toBe(entity);
  });

  it('update() with now runs NetInterp and writes Transform', () => {
    const ecs = new EcsWorldSystem(fakeMover());
    const entity = ecs.spawnRemote('peer-F', 0, 0, 0);

    // Push two snapshots bracketing renderTime = now - 120
    const now = 1000;
    ecs.pushSnapshot('peer-F', { t: 800, x: 0, y: 0, z: 0, yaw: 0, speed: 1 });
    ecs.pushSnapshot('peer-F', { t: 1000, x: 10, y: 0, z: 0, yaw: 0, speed: 1 });

    ecs.update(1 / 60, now);

    // renderTime = 1000 - 120 = 880, t ∈ [800..1000] → t = (880-800)/(1000-800) = 0.4
    const xf = ecs.world.get(entity, ecs.transform)!;
    expect(xf.x).toBeCloseTo(4, 4); // lerp(0, 10, 0.4)
  });

  it('update() without now still runs physics sync (backward compat)', () => {
    const mover = fakeMover(0, 0, 0);
    const ecs = new EcsWorldSystem(mover);

    mover.velocity.x = 5;
    mover.solve(1);
    ecs.update(1 / 60);

    expect(ecs.playerTransform().x).toBeCloseTo(5, 6);
  });
});
