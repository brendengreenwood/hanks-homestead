import { describe, it, expect } from 'vitest';
import { World } from './World';

describe('World name index', () => {
  it('setName/findByName round-trips', () => {
    const world = new World();
    const e = world.spawn();
    world.setName(e, 'player');
    expect(world.findByName('player')).toBe(e);
  });

  it('findByName on an unknown name returns undefined', () => {
    const world = new World();
    expect(world.findByName('nobody')).toBeUndefined();
  });

  it('despawn clears the name index entry', () => {
    const world = new World();
    const e = world.spawn();
    world.setName(e, 'player');

    world.despawn(e);
    expect(world.findByName('player')).toBeUndefined();
  });

  it('renaming an entity releases its previous name', () => {
    const world = new World();
    const e = world.spawn();
    world.setName(e, 'old');
    world.setName(e, 'new');

    expect(world.findByName('old')).toBeUndefined();
    expect(world.findByName('new')).toBe(e);
  });

  it('reusing a name transfers it to the new holder', () => {
    const world = new World();
    const a = world.spawn();
    const b = world.spawn();
    world.setName(a, 'hero');
    world.setName(b, 'hero');

    expect(world.findByName('hero')).toBe(b);
    // a no longer holds any name, so despawning a leaves b's name intact.
    world.despawn(a);
    expect(world.findByName('hero')).toBe(b);
  });

  it('naming a dead entity throws', () => {
    const world = new World();
    const e = world.spawn();
    world.despawn(e);
    expect(() => world.setName(e, 'ghost')).toThrow();
  });
});
