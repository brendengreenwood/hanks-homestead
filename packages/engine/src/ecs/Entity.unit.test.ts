import { describe, it, expect } from 'vitest';
import {
  makeEntityId,
  entityIndex,
  entityGeneration,
  GENERATION_STRIDE,
} from './Entity';

describe('entity id packing', () => {
  it('round-trips index and generation', () => {
    const id = makeEntityId(7, 42);
    expect(entityIndex(id)).toBe(7);
    expect(entityGeneration(id)).toBe(42);
  });

  it('accepts the highest representable generation', () => {
    const id = makeEntityId(3, GENERATION_STRIDE - 1);
    expect(entityIndex(id)).toBe(3);
    expect(entityGeneration(id)).toBe(GENERATION_STRIDE - 1);
  });

  it('throws loudly when a generation would wrap into the next slot', () => {
    // Without the guard this would silently pack as slot 4, generation 0 —
    // aliasing a different entity's id space.
    expect(() => makeEntityId(3, GENERATION_STRIDE)).toThrow(/generation wrapped/);
  });
});
