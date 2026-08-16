import { describe, it, expect } from 'vitest';
import { World } from './World';
import { entityIndex } from './Entity';

describe('World spawn/despawn/id-recycling', () => {
  it('spawn returns distinct ids and tracks entityCount', () => {
    const world = new World();
    expect(world.entityCount).toBe(0);

    const a = world.spawn();
    const b = world.spawn();
    const c = world.spawn();

    expect(new Set([a, b, c]).size).toBe(3);
    expect(world.entityCount).toBe(3);
    expect(world.isAlive(a)).toBe(true);
  });

  it('despawn frees the entity and decrements the count', () => {
    const world = new World();
    const a = world.spawn();
    const b = world.spawn();

    expect(world.despawn(a)).toBe(true);
    expect(world.isAlive(a)).toBe(false);
    expect(world.isAlive(b)).toBe(true);
    expect(world.entityCount).toBe(1);
  });

  it('recycles a freed slot on the next spawn but yields a fresh, distinct id', () => {
    const world = new World();
    const a = world.spawn();
    const freedIndex = entityIndex(a);

    world.despawn(a);
    const recycled = world.spawn();

    // Same physical slot is reused...
    expect(entityIndex(recycled)).toBe(freedIndex);
    // ...but the id differs (generation bumped), so the stale id stays dead.
    expect(recycled).not.toBe(a);
    expect(world.isAlive(a)).toBe(false);
    expect(world.isAlive(recycled)).toBe(true);
    expect(world.entityCount).toBe(1);
  });

  it('double-despawn is a safe no-op', () => {
    const world = new World();
    const a = world.spawn();

    expect(world.despawn(a)).toBe(true);
    expect(world.despawn(a)).toBe(false);
    expect(world.entityCount).toBe(0);
  });

  it('despawn of a never-spawned/stale id returns false', () => {
    const world = new World();
    const a = world.spawn();
    world.despawn(a);
    const recycled = world.spawn(); // reuses a's slot with a new generation

    // The old id is stale; despawning it must not kill the recycled entity.
    expect(world.despawn(a)).toBe(false);
    expect(world.isAlive(recycled)).toBe(true);
  });

  it('entities() yields exactly the live set in deterministic slot order', () => {
    const world = new World();
    const a = world.spawn();
    const b = world.spawn();
    const c = world.spawn();
    world.despawn(b);

    expect([...world.entities()]).toEqual([a, c]);
  });
});
