/**
 * Pure emote-select vocabulary: the emote kinds, the wheel's screen-space
 * wedge directions, and the arbitration thresholds. No imports — this is the
 * bottom of the emote-select dependency graph.
 */

export type EmoteKind = 'wave' | 'cheer' | 'spin' | 'bow';

export interface EmoteDirection {
  kind: EmoteKind;
  x: number;
  y: number;
}

/** Screen directions for each wedge: up / right / down / left. */
export const EMOTE_DIRECTIONS: EmoteDirection[] = [
  { kind: 'wave', x: 0, y: -1 },
  { kind: 'cheer', x: 1, y: 0 },
  { kind: 'bow', x: 0, y: 1 },
  { kind: 'spin', x: -1, y: 0 },
];

/** Minimum select-vector magnitude before a direction highlights a wedge. */
export const SELECT_THRESHOLD = 0.35;

/**
 * Minimum per-frame cursor movement (px) for the mouse to override a latched
 * keyboard emote selection. Above sub-pixel jitter, so a resting cursor past the
 * select threshold never keeps re-stealing the keyboard latch (last-input-wins).
 */
export const EMOTE_MOUSE_MOVE_EPSILON = 3;
