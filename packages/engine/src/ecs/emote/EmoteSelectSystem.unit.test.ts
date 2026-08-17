import { describe, it, expect } from 'vitest';
import { World } from '../index';
import { SELECT_THRESHOLD } from './emoteTypes';
import {
  createEmoteSelect,
  resolveEmoteDirection,
  runEmoteSelect,
  stepEmoteSelect,
  type EmoteSelect,
  type EmoteSelectInput,
} from './EmoteSelectSystem';

/** A held, grounded, at-rest input — override fields per case. */
function input(overrides: Partial<EmoteSelectInput> = {}): EmoteSelectInput {
  return {
    held: true,
    grounded: true,
    selectX: 0,
    selectY: 0,
    mouseX: 100,
    mouseY: 100,
    keySelection: null,
    ...overrides,
  };
}

/** Open the wheel with the standard two-step open frame; returns open state. */
function openWheel(): EmoteSelect {
  const state = createEmoteSelect();
  const cmd = stepEmoteSelect(state, input());
  expect(cmd.opened).toBe(true);
  // Second (same-frame) step on origin-fresh inputs, as the caller performs
  // after applying beginEmoteSelect(). At-rest inputs → null highlight.
  stepEmoteSelect(state, input());
  return state;
}

describe('stepEmoteSelect', () => {
  // Case 1
  it('opens on held + grounded without arbitrating, seeding prevMouse', () => {
    const state = createEmoteSelect();
    const cmd = stepEmoteSelect(
      state,
      // A stale select vector from a previous session must not arbitrate on
      // the open step.
      input({ selectX: 1, selectY: 0, mouseX: 42, mouseY: 24 }),
    );
    expect(cmd).toEqual({
      opened: true,
      closed: false,
      pick: null,
      clearKeyLatch: false,
    });
    expect(state.wheelOpen).toBe(true);
    expect(state.highlighted).toBeNull();
    expect(state.prevMouseX).toBe(42);
    expect(state.prevMouseY).toBe(24);
  });

  // Case 2
  it('does not open while airborne', () => {
    const state = createEmoteSelect();
    const cmd = stepEmoteSelect(state, input({ grounded: false }));
    expect(cmd.opened).toBe(false);
    expect(state.wheelOpen).toBe(false);
  });

  // Case 3 — gamepad parity: absolute stick past threshold highlights on the
  // very open frame via the same-frame second step.
  it('two-step open frame: a deflected stick highlights immediately', () => {
    const state = createEmoteSelect();
    stepEmoteSelect(state, input());
    const cmd = stepEmoteSelect(state, input({ selectX: 0, selectY: -1 }));
    expect(state.highlighted).toBe('wave');
    expect(cmd.clearKeyLatch).toBe(false);
  });

  // Case 4 — mouse parity: fresh origin → zero delta → null on the open frame.
  it('two-step open frame: a zero select delta stays null (reset-on-open)', () => {
    const state = createEmoteSelect();
    stepEmoteSelect(state, input());
    stepEmoteSelect(state, input({ selectX: 0, selectY: 0 }));
    expect(state.highlighted).toBeNull();
  });

  // Case 5
  it('keyboard latch highlights at rest', () => {
    const state = openWheel();
    stepEmoteSelect(state, input({ keySelection: 'cheer' }));
    expect(state.highlighted).toBe('cheer');
  });

  // Case 6 — a cursor merely resting past threshold does not steal the latch.
  it('resting cursor past threshold keeps the keyboard latch', () => {
    const state = openWheel();
    // Cursor unmoved (same mouseX/Y as openWheel used) but the select delta
    // rests past threshold.
    const cmd = stepEmoteSelect(
      state,
      input({ selectX: 1, selectY: 0, keySelection: 'spin' }),
    );
    expect(state.highlighted).toBe('spin');
    expect(cmd.clearKeyLatch).toBe(false);
  });

  // Case 7 — genuine movement past threshold overrides the latch.
  it('genuine mouse movement past threshold overrides the latch', () => {
    const state = openWheel();
    const cmd = stepEmoteSelect(
      state,
      input({
        selectX: 0,
        selectY: -1,
        mouseX: 100,
        mouseY: 80, // 20px up — past the 3px epsilon
        keySelection: 'spin',
      }),
    );
    expect(state.highlighted).toBe('wave');
    expect(cmd.clearKeyLatch).toBe(true);
  });

  // Case 8 — the other half of the override AND: movement without magnitude.
  it('mouse movement below select threshold keeps the latch', () => {
    const state = openWheel();
    const cmd = stepEmoteSelect(
      state,
      input({
        selectX: 0.1,
        selectY: 0, // below SELECT_THRESHOLD
        mouseX: 120,
        mouseY: 100, // 20px moved
        keySelection: 'bow',
      }),
    );
    expect(state.highlighted).toBe('bow');
    expect(cmd.clearKeyLatch).toBe(false);
  });

  // Case 9
  it('sub-threshold select with no latch highlights nothing', () => {
    const state = openWheel();
    stepEmoteSelect(state, input({ selectX: 0.2, selectY: 0.2 }));
    expect(state.highlighted).toBeNull();
  });

  // Case 10 — grounded gates only opening, not staying open.
  it('stays open while airborne', () => {
    const state = openWheel();
    stepEmoteSelect(state, input({ grounded: false, keySelection: 'wave' }));
    expect(state.wheelOpen).toBe(true);
    expect(state.highlighted).toBe('wave');
  });

  // Case 11
  it('release with a highlight closes and picks it', () => {
    const state = openWheel();
    stepEmoteSelect(state, input({ keySelection: 'cheer' }));
    const cmd = stepEmoteSelect(state, input({ held: false }));
    expect(cmd.closed).toBe(true);
    expect(cmd.pick).toBe('cheer');
    expect(state.wheelOpen).toBe(false);
    expect(state.highlighted).toBeNull();
  });

  // Case 12
  it('release with no highlight closes with a null pick', () => {
    const state = openWheel();
    const cmd = stepEmoteSelect(state, input({ held: false }));
    expect(cmd.closed).toBe(true);
    expect(cmd.pick).toBeNull();
  });

  // Case 14 — prevMouse seeded at open: a later unmoved frame keeps the latch.
  it('open frame produces no spurious movement on the following frame', () => {
    const state = createEmoteSelect();
    stepEmoteSelect(state, input({ mouseX: 300, mouseY: 200 }));
    // Same cursor position on the next frame — movedPx must be 0, so the
    // latch holds even with a select vector resting past threshold.
    const cmd = stepEmoteSelect(
      state,
      input({
        mouseX: 300,
        mouseY: 200,
        selectX: 1,
        selectY: 0,
        keySelection: 'bow',
      }),
    );
    expect(state.highlighted).toBe('bow');
    expect(cmd.clearKeyLatch).toBe(false);
  });
});

// Case 13
describe('resolveEmoteDirection', () => {
  it('maps the four cardinal directions to their wedges', () => {
    expect(resolveEmoteDirection(0, -1)).toBe('wave');
    expect(resolveEmoteDirection(1, 0)).toBe('cheer');
    expect(resolveEmoteDirection(0, 1)).toBe('bow');
    expect(resolveEmoteDirection(-1, 0)).toBe('spin');
  });

  it('returns null below the select threshold', () => {
    expect(resolveEmoteDirection(SELECT_THRESHOLD * 0.9, 0)).toBeNull();
    expect(resolveEmoteDirection(0, 0)).toBeNull();
  });
});

describe('runEmoteSelect', () => {
  it('steps the component through a real World and returns the commands', () => {
    const world = new World();
    const EmoteSelectType = world.defineComponent<EmoteSelect>('EmoteSelect');
    const player = world.spawn();
    world.add(player, EmoteSelectType, createEmoteSelect());

    const opened = runEmoteSelect(world, EmoteSelectType, input());
    expect(opened.opened).toBe(true);
    runEmoteSelect(world, EmoteSelectType, input());

    runEmoteSelect(world, EmoteSelectType, input({ keySelection: 'wave' }));
    const closed = runEmoteSelect(world, EmoteSelectType, input({ held: false }));
    expect(closed.closed).toBe(true);
    expect(closed.pick).toBe('wave');
    expect(world.get(player, EmoteSelectType)!.wheelOpen).toBe(false);
  });

  it('returns no-op commands when no entity carries the component', () => {
    const world = new World();
    const EmoteSelectType = world.defineComponent<EmoteSelect>('EmoteSelect');
    const cmd = runEmoteSelect(world, EmoteSelectType, input());
    expect(cmd).toEqual({
      opened: false,
      closed: false,
      pick: null,
      clearKeyLatch: false,
    });
  });
});
