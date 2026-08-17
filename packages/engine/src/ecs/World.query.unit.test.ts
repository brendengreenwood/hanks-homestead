import { describe, it, expect } from 'vitest';
import { World } from './World';
import type { ComponentType } from './types';

describe('World.query', () => {
  it('yields only entities having all requested components', () => {
    const world = new World();
    const A = world.defineComponent<number>('A');
    const B = world.defineComponent<number>('B');

    const onlyA = world.spawn();
    world.add(onlyA, A, 1);

    const both = world.spawn();
    world.add(both, A, 2);
    world.add(both, B, 2);

    const onlyB = world.spawn();
    world.add(onlyB, B, 3);

    expect([...world.query(A, B)]).toEqual([both]);
  });

  it('is deterministic across runs for the same mutation history', () => {
    const build = () => {
      const world = new World();
      const A = world.defineComponent<number>('A');
      const B = world.defineComponent<number>('B');
      const ids = [world.spawn(), world.spawn(), world.spawn(), world.spawn()];
      for (const id of ids) {
        world.add(id, A, 0);
        world.add(id, B, 0);
      }
      return [...world.query(A, B)];
    };
    expect(build()).toEqual(build());
  });

  it('entities entering/leaving the component set enter/leave the query', () => {
    const world = new World();
    const A = world.defineComponent<number>('A');
    const B = world.defineComponent<number>('B');
    const e = world.spawn();
    world.add(e, A, 1);

    // Missing B → not in the query.
    expect([...world.query(A, B)]).toEqual([]);

    // Gains B → enters.
    world.add(e, B, 1);
    expect([...world.query(A, B)]).toEqual([e]);

    // Loses B → leaves.
    world.remove(e, B);
    expect([...world.query(A, B)]).toEqual([]);
  });

  it('despawned entities drop out of queries', () => {
    const world = new World();
    const A = world.defineComponent<number>('A');
    const keep = world.spawn();
    const drop = world.spawn();
    world.add(keep, A, 1);
    world.add(drop, A, 1);

    world.despawn(drop);
    expect([...world.query(A)]).toEqual([keep]);
  });

  it('a zero-arg query yields every live entity', () => {
    const world = new World();
    const a = world.spawn();
    const b = world.spawn();
    expect([...world.query()]).toEqual([a, b]);
  });

  it('drives from the smallest store yet still yields correct membership', () => {
    const world = new World();
    const Big = world.defineComponent<number>('Big');
    const Small = world.defineComponent<number>('Small');

    // Many entities have Big, only two also have Small.
    const withSmall: ReturnType<World['spawn']>[] = [];
    for (let i = 0; i < 10; i++) {
      const e = world.spawn();
      world.add(e, Big, i);
      if (i === 3 || i === 7) {
        world.add(e, Small, i);
        withSmall.push(e);
      }
    }

    const result = [...world.query(Big as ComponentType<unknown>, Small as ComponentType<unknown>)];
    expect(result).toEqual(withSmall);
  });

  it('yields nothing when the driving store is empty', () => {
    const world = new World();
    const A = world.defineComponent<number>('A');
    const B = world.defineComponent<number>('B');

    // A has entities; B has none → B drives (size 0) → no matches, no error.
    const e = world.spawn();
    world.add(e, A, 1);

    expect([...world.query(A, B)]).toEqual([]);
  });

  it('intersects three component types', () => {
    const world = new World();
    const A = world.defineComponent<number>('A');
    const B = world.defineComponent<number>('B');
    const C = world.defineComponent<number>('C');

    const all = world.spawn();
    world.add(all, A, 1);
    world.add(all, B, 1);
    world.add(all, C, 1);

    const missingC = world.spawn();
    world.add(missingC, A, 1);
    world.add(missingC, B, 1);

    expect([...world.query(A, B, C)]).toEqual([all]);
  });
});
