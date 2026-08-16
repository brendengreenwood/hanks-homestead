import type { EntityId } from './types';

// Entity ids pack an index and a generation into a single number so that a
// recycled slot can be distinguished from the id that previously occupied it.
//
//   id = index * GENERATION_STRIDE + generation
//
// index      — which slot in the world's dense arrays this entity occupies.
// generation — bumped each time the slot is freed, so an old id that captured
//              a smaller generation no longer matches the live entity.
//
// GENERATION_STRIDE bounds the number of times a single slot may be recycled
// before generations wrap. 2^20 (~1M) reuses per slot is far beyond any real
// session; index is likewise bounded only by Number.MAX_SAFE_INTEGER / stride.
// A wrap would silently alias into the next slot's id space, so makeEntityId
// throws loudly instead of packing a corrupt id.

export const GENERATION_STRIDE = 1 << 20;

export function makeEntityId(index: number, generation: number): EntityId {
  if (generation >= GENERATION_STRIDE) {
    throw new Error(
      `entity generation wrapped for slot ${index}: ` +
        `${generation} exceeds the ${GENERATION_STRIDE - 1} recycles a slot supports`,
    );
  }
  return (index * GENERATION_STRIDE + generation) as EntityId;
}

export function entityIndex(id: EntityId): number {
  return Math.floor(id / GENERATION_STRIDE);
}

export function entityGeneration(id: EntityId): number {
  return id % GENERATION_STRIDE;
}
