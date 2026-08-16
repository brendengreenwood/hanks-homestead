import { describe, it, expect } from 'vitest';
import { World } from './World';

interface Position {
  x: number;
  y: number;
}

describe('component store add/get/has/remove via World', () => {
  it('add then get/has returns the stored data', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const e = world.spawn();

    world.add(e, Position, { x: 1, y: 2 });

    expect(world.has(e, Position)).toBe(true);
    expect(world.get(e, Position)).toEqual({ x: 1, y: 2 });
  });

  it('get/has return undefined/false for an entity without the component', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const e = world.spawn();

    expect(world.has(e, Position)).toBe(false);
    expect(world.get(e, Position)).toBeUndefined();
  });

  it('add overwrites existing component data', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const e = world.spawn();

    world.add(e, Position, { x: 1, y: 2 });
    world.add(e, Position, { x: 9, y: 9 });

    expect(world.get(e, Position)).toEqual({ x: 9, y: 9 });
  });

  it('remove clears the component; removing an absent component is a no-op', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const e = world.spawn();

    // Removing before adding must not throw.
    expect(() => world.remove(e, Position)).not.toThrow();

    world.add(e, Position, { x: 1, y: 2 });
    world.remove(e, Position);
    expect(world.has(e, Position)).toBe(false);
  });

  it('despawn removes all of an entity’s components', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const Health = world.defineComponent<number>('Health');
    const e = world.spawn();
    world.add(e, Position, { x: 1, y: 2 });
    world.add(e, Health, 100);

    world.despawn(e);

    // A recycled entity in the same slot starts with no components.
    const recycled = world.spawn();
    expect(world.has(recycled, Position)).toBe(false);
    expect(world.has(recycled, Health)).toBe(false);
  });

  it('adding a component to a dead entity throws', () => {
    const world = new World();
    const Position = world.defineComponent<Position>('Position');
    const e = world.spawn();
    world.despawn(e);

    expect(() => world.add(e, Position, { x: 0, y: 0 })).toThrow();
  });

  it('using a component type not defined on the world throws', () => {
    const worldA = new World();
    const worldB = new World();
    const Foreign = worldB.defineComponent<number>('Foreign');
    const e = worldA.spawn();

    expect(() => worldA.has(e, Foreign)).toThrow();
  });

  it('a foreign type is rejected even when its id aliases a live store', () => {
    // Both worlds define their first component, so both have a store at id 0.
    // Without a world-identity check, worldA.has(e, Foreign) would silently hit
    // worldA's own store 0 and return a wrong answer instead of throwing.
    const worldA = new World();
    const worldB = new World();
    worldA.defineComponent<Position>('Local'); // occupies id 0 in worldA
    const Foreign = worldB.defineComponent<number>('Foreign'); // id 0 in worldB
    const e = worldA.spawn();

    expect(() => worldA.has(e, Foreign)).toThrow(/different world/);
  });

  it('defining two components with the same name throws', () => {
    const world = new World();
    world.defineComponent<Position>('Position');

    expect(() => world.defineComponent<Position>('Position')).toThrow(
      /already defined/,
    );
  });
});
