import type { World } from '../World';
import type { ComponentType } from '../types';
import type { AnimationState } from './characterAnim';

/* ------------------------------------------------------------------ */
/*  Animation components — pure data, no THREE dependency.            */
/* ------------------------------------------------------------------ */

/**
 * Generic sine oscillator: `offset = sin(elapsed * frequency + phase) * amplitude`.
 *
 * Drives all procedural bob motion (e.g. NPC idle breathing). The
 * system writes `offset`; renderers read it each frame and apply it visually.
 */
export interface Oscillator {
  /** Sine frequency (radians/s of elapsed game time). */
  frequency: number;
  /** Peak offset (world units). */
  amplitude: number;
  /** Per-entity random phase in [0, 2π) so carriers don't move in lockstep. */
  phase: number;
  /** Current output offset — written by OscillatorSystem, read by renderers. */
  offset: number;
}

/**
 * Constant-rate rotation: `angle = (elapsed * speed) % 2π`.
 *
 * Pure in elapsed, like Oscillator — no state carried across frames, so it
 * is idempotent and tickable from any update path, any number of times
 * (see issue #75: animations never pause; modes gate input, not visuals).
 */
export interface Spin {
  /** Rotation speed (radians/s of elapsed game time). */
  speed: number;
  /** Current angle (radians) — written by SpinSystem, read by renderers. */
  angle: number;
}

export interface AnimationComponents {
  Oscillator: ComponentType<Oscillator>;
  Spin: ComponentType<Spin>;
  AnimationState: ComponentType<AnimationState>;
}

/** Register animation components on a World instance. Call once per world. */
export function registerAnimationComponents(world: World): AnimationComponents {
  return {
    Oscillator: world.defineComponent<Oscillator>('Oscillator'),
    Spin: world.defineComponent<Spin>('Spin'),
    AnimationState: world.defineComponent<AnimationState>('AnimationState'),
  };
}
