import type { World, ComponentType } from '../index';
import {
  EMOTE_DIRECTIONS,
  EMOTE_MOUSE_MOVE_EPSILON,
  SELECT_THRESHOLD,
  type EmoteKind,
} from './emoteTypes';

/**
 * EmoteSelect — the emote wheel's arbitration state, as a pure ECS component.
 *
 * Owns the wheel's open/closed state, the currently-highlighted wedge, and the
 * previous-frame cursor position used for genuine-movement detection. The DOM
 * wheel, the input latch, the net send, and the emote animation are all
 * *effects* applied by the caller from the commands `stepEmoteSelect` returns —
 * this module never touches them.
 */
export interface EmoteSelect {
  wheelOpen: boolean;
  highlighted: EmoteKind | null;
  prevMouseX: number;
  prevMouseY: number;
}

export function createEmoteSelect(): EmoteSelect {
  return { wheelOpen: false, highlighted: null, prevMouseX: 0, prevMouseY: 0 };
}

/** Per-frame input snapshot the caller reads from its input surface. */
export interface EmoteSelectInput {
  /** Whether the emote hold (C / gamepad Y) is currently down. */
  held: boolean;
  /** Whether the player is grounded (gates opening, not staying open). */
  grounded: boolean;
  /** Select vector: mouse delta from the select origin, or absolute stick. */
  selectX: number;
  selectY: number;
  /** Raw cursor position (px), for per-frame movement detection. */
  mouseX: number;
  mouseY: number;
  /** The latched WASD keyboard selection, if any. */
  keySelection: EmoteKind | null;
}

/** Effects for the caller to apply after a step. */
export interface EmoteSelectCommands {
  /**
   * The wheel opened this step. The open step does not arbitrate — its select
   * values predate the caller's `beginEmoteSelect()` re-snap. The caller must
   * apply the open effects (open the DOM wheel, re-snap the input origin) and
   * run a second step in the same frame with fresh inputs; that second step
   * arbitrates, so a gamepad stick already past threshold highlights on the
   * very frame the wheel opens.
   */
  opened: boolean;
  /** The wheel closed this step (hold released). */
  closed: boolean;
  /** The emote to play on close, if a wedge was highlighted. */
  pick: EmoteKind | null;
  /** Genuine mouse movement overrode the keyboard latch — clear it. */
  clearKeyLatch: boolean;
}

const NO_COMMANDS: EmoteSelectCommands = {
  opened: false,
  closed: false,
  pick: null,
  clearKeyLatch: false,
};

/**
 * Resolve a select vector to a wedge: null below the select threshold, else
 * the direction with the largest dot product.
 */
export function resolveEmoteDirection(x: number, y: number): EmoteKind | null {
  if (Math.hypot(x, y) < SELECT_THRESHOLD) return null;
  let best: EmoteKind | null = null;
  let bestDot = -Infinity;
  for (const direction of EMOTE_DIRECTIONS) {
    const dot = direction.x * x + direction.y * y;
    if (dot > bestDot) {
      bestDot = dot;
      best = direction.kind;
    }
  }
  return best;
}

/**
 * One arbitration step. Mutates `state`, returns the effects to apply.
 *
 * Last-input-wins: the mouse only overrides a latched keyboard selection on
 * genuine per-frame movement past the select threshold — a cursor merely
 * resting past threshold does not keep re-stealing the latch.
 */
export function stepEmoteSelect(
  state: EmoteSelect,
  input: EmoteSelectInput,
): EmoteSelectCommands {
  if (!state.wheelOpen) {
    if (!input.held || !input.grounded) return NO_COMMANDS;
    state.wheelOpen = true;
    state.highlighted = null;
    state.prevMouseX = input.mouseX;
    state.prevMouseY = input.mouseY;
    return { opened: true, closed: false, pick: null, clearKeyLatch: false };
  }

  if (input.held) {
    const movedPx = Math.hypot(
      input.mouseX - state.prevMouseX,
      input.mouseY - state.prevMouseY,
    );
    state.prevMouseX = input.mouseX;
    state.prevMouseY = input.mouseY;
    const mouseMoved =
      movedPx > EMOTE_MOUSE_MOVE_EPSILON &&
      Math.hypot(input.selectX, input.selectY) >= SELECT_THRESHOLD;

    if (mouseMoved) {
      state.highlighted = resolveEmoteDirection(input.selectX, input.selectY);
      return { opened: false, closed: false, pick: null, clearKeyLatch: true };
    }
    if (input.keySelection) {
      state.highlighted = input.keySelection;
    } else {
      state.highlighted = resolveEmoteDirection(input.selectX, input.selectY);
    }
    return NO_COMMANDS;
  }

  const pick = state.highlighted;
  state.wheelOpen = false;
  state.highlighted = null;
  return { opened: false, closed: true, pick, clearKeyLatch: false };
}

/**
 * Conventional system wrapper: step every entity carrying an EmoteSelect
 * component (in practice only the local player). Returns the last entity's
 * commands, or no-op commands when nothing matched.
 */
export function runEmoteSelect(
  world: World,
  emoteSelect: ComponentType<EmoteSelect>,
  input: EmoteSelectInput,
): EmoteSelectCommands {
  let commands: EmoteSelectCommands = NO_COMMANDS;
  for (const entity of world.query(emoteSelect)) {
    const state = world.get(entity, emoteSelect)!;
    commands = stepEmoteSelect(state, input);
  }
  return commands;
}
