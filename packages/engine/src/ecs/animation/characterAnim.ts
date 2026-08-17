import type { EmoteKind } from '../emote/emoteTypes';

/* ------------------------------------------------------------------ */
/*  Character animation state + pose evaluation — pure data/math.     */
/*                                                                    */
/*  Single source of truth for the pose constants Player.ts and       */
/*  RemotePlayers.ts used to duplicate line for line (issue #66       */
/*  step 2). All constants are +Z-native (post PR #73/#74).           */
/*                                                                    */
/*  Unlike Oscillator/Spin, `evaluateCharacterPose` is deliberately   */
/*  stateful: it clears an expired emote AFTER computing its final    */
/*  keyframe (exactly like the applyEmote it replaces), so it is      */
/*  single-call-per-frame by contract — NOT idempotent. The #75       */
/*  tick-from-any-path rule does not apply to it.                     */
/* ------------------------------------------------------------------ */

/** How long each emote plays before auto-clearing (seconds). */
export const EMOTE_DURATION: Record<EmoteKind, number> = {
  wave: 1.7,
  cheer: 1.5,
  spin: 0.9,
  bow: 1.4,
};

/**
 * Per-character animation memory: walk cycle phase, swing envelope,
 * squash/stretch, leap mirroring, and the active emote. Owned by the
 * renderer (Player / RemoteAvatar) and adopted by the ECS world as a
 * component on the matching entity.
 *
 * `stretch` and `leapMirrored` are only ever written by the local Player
 * (jump/land squash-stretch, per-jump stride mirroring); remote avatars
 * carry them at their neutral values.
 */
export interface AnimationState {
  /** Walk-cycle phase (radians), advanced by speed. */
  walkPhase: number;
  /** Swing amplitude envelope [0, 1], eased toward movement intensity. */
  swing: number;
  /** Vertical squash/stretch scale, relaxing toward 1. */
  stretch: number;
  /** Whether the current leap leads with the mirrored stride. */
  leapMirrored: boolean;
  /** Currently playing emote, if any. */
  emote: EmoteKind | null;
  /**
   * Seconds since the current emote started. Only meaningful while `emote`
   * is non-null — the auto-clear leaves it stale (matching the original
   * applyEmote); `startEmote`/`cancelEmote` reset it.
   */
  emoteTime: number;
}

/** Fresh animation state with the neutral initial values. */
export function createAnimationState(): AnimationState {
  return {
    walkPhase: 0,
    swing: 0,
    stretch: 1,
    leapMirrored: false,
    emote: null,
    emoteTime: 0,
  };
}

/** Begin playing an emote (movement lock is the caller's concern). */
export function startEmote(state: AnimationState, kind: EmoteKind): void {
  state.emote = kind;
  state.emoteTime = 0;
}

/** Cancel the active emote immediately (e.g. a jump interrupts it). */
export function cancelEmote(state: AnimationState): void {
  state.emote = null;
  state.emoteTime = 0;
}

/** Per-frame inputs the renderer derives (each side derives them differently). */
export interface CharacterAnimInput {
  /** Frame delta time (seconds). */
  dt: number;
  /** Horizontal speed (m/s) — drives the walk-cycle rate. */
  speed: number;
  /** Movement intensity [0, 1] — speed normalized by the caller's max. */
  intensity: number;
  /** Whether the character is on the ground (caller-detected). */
  grounded: boolean;
  /**
   * Leap pose scale. Player passes `intensity`; RemoteAvatar passes
   * `max(intensity, 0.4)` — the floor is a caller-side difference and
   * never lives in this module.
   */
  leapIntensity: number;
}

/**
 * Computed pose targets. Every field is one of two apply modes:
 *
 * - DIRECT-SET (renderer assigns): the grounded limb X rotations
 *   (`leftLegX`/`rightLegX`/`leftArmX`/`rightArmX`), `rootSpinY` (never
 *   lerped — easing it would break the clean 2π reset at the end of the
 *   spin emote), and `rootBobY` (walk bob + emote hop).
 * - LERP-BY-BLEND (renderer lerps current → target by `blend`): the
 *   airborne leap limb X targets (`leap*`), the emote arm Z targets
 *   (`leftArmZ`/`rightArmZ`), and `rootLeanX`.
 *
 * `airborne` selects which limb-X set applies — grounded absolutes and
 * leap targets are never both applied in one frame.
 */
export interface CharacterPose {
  /** True → apply the `leap*` lerp targets; false → set the grounded absolutes. */
  airborne: boolean;
  /** Frame smoothing factor `1 - exp(-10·dt)` for all lerped fields. */
  blend: number;
  leftLegX: number;
  rightLegX: number;
  leftArmX: number;
  rightArmX: number;
  leapLeftLegX: number;
  leapRightLegX: number;
  leapLeftArmX: number;
  leapRightArmX: number;
  leftArmZ: number;
  rightArmZ: number;
  rootLeanX: number;
  rootSpinY: number;
  rootBobY: number;
}

/** A pose buffer for `evaluateCharacterPose` to write into (per renderer). */
export function createCharacterPose(): CharacterPose {
  return {
    airborne: false,
    blend: 0,
    leftLegX: 0,
    rightLegX: 0,
    leftArmX: 0,
    rightArmX: 0,
    leapLeftLegX: 0,
    leapRightLegX: 0,
    leapLeftArmX: 0,
    leapRightArmX: 0,
    leftArmZ: 0,
    rightArmZ: 0,
    rootLeanX: 0,
    rootSpinY: 0,
    rootBobY: 0,
  };
}

/**
 * Advance the animation memory one frame. Does NOT clear finished emotes —
 * `evaluateCharacterPose` does that after computing the final keyframe, so
 * the frame where the emote crosses its duration still renders it.
 */
export function stepAnimationState(
  state: AnimationState,
  input: CharacterAnimInput,
): void {
  const { dt, speed, intensity } = input;
  // Fade the swing amplitude in and out so stopping doesn't freeze limbs mid-stride.
  state.swing += (intensity - state.swing) * (1 - Math.exp(-8 * dt));
  state.walkPhase += dt * (3 + speed * 2.4);
  if (state.emote) state.emoteTime += dt;
  // Squash & stretch relaxes toward 1 (only the local Player ever perturbs it).
  state.stretch += (1 - state.stretch) * (1 - Math.exp(-10 * dt));
}

/**
 * Compute the frame's pose targets from the animation state, then clear the
 * emote if it just expired — AFTER the keyframes, exactly like the original
 * applyEmote, so the crossing frame still renders the overshoot keyframe
 * (e.g. the spin slightly past 2π that resets cleanly to 0).
 */
export function evaluateCharacterPose(
  state: AnimationState,
  input: CharacterAnimInput,
  out: CharacterPose,
): CharacterPose {
  const blend = 1 - Math.exp(-10 * input.dt);
  out.blend = blend;
  out.airborne = !input.grounded;

  if (input.grounded) {
    const legAngle = Math.sin(state.walkPhase) * 0.65 * state.swing;
    out.leftLegX = legAngle;
    out.rightLegX = -legAngle;
    out.leftArmX = -legAngle * 0.7;
    out.rightArmX = legAngle * 0.7;
    out.leapLeftLegX = 0;
    out.leapRightLegX = 0;
    out.leapLeftArmX = 0;
    out.leapRightArmX = 0;
  } else {
    // Airborne leap pose: opposite arm/leg stride, optionally mirrored.
    // Negative rotation.x swings a limb toward the +Z front.
    const leap = input.leapIntensity;
    const [legLead, legTrail] = state.leapMirrored ? [-0.55, 0.3] : [0.3, -0.55];
    const [armLead, armTrail] = state.leapMirrored ? [0.6, -0.95] : [-0.95, 0.6];
    out.leapLeftLegX = legLead * leap;
    out.leapRightLegX = legTrail * leap;
    out.leapLeftArmX = armLead * leap;
    out.leapRightArmX = armTrail * leap;
    out.leftLegX = 0;
    out.rightLegX = 0;
    out.leftArmX = 0;
    out.rightArmX = 0;
  }

  // Emote pose overrides layered after the walk/leap targets. Arm lateral
  // raise (rotation.z) and torso lean (root rotation.x) are exclusively
  // driven here, easing back to 0 whenever no emote is active.
  let leftArmZ = 0;
  let rightArmZ = 0;
  let lean = 0;
  let hop = 0;
  let spinY = 0;

  if (state.emote) {
    const t = state.emoteTime;
    switch (state.emote) {
      case 'wave':
        // Right arm (on −X, since the front is +Z) raised outward, hand
        // rocking side to side. rotation.z > 0 tips a hanging arm toward +X,
        // so raising outward on the −X side is negative.
        rightArmZ = -2.2 - Math.sin(t * 9) * 0.35;
        break;
      case 'cheer':
        leftArmZ = 2.35;
        rightArmZ = -2.35;
        hop = Math.abs(Math.sin(t * 7)) * 0.16;
        break;
      case 'spin':
        leftArmZ = 0.9;
        rightArmZ = -0.9;
        // Visual-only spin: applied to the rig root, never the authoritative
        // facing yaw — movement would unwind it afterward.
        spinY = (t / EMOTE_DURATION.spin) * Math.PI * 2;
        break;
      case 'bow':
        // Ease into the bow and back out over the duration. rotation.x tilts
        // +Y toward +Z (right-hand rule) — positive leans toward the +Z front.
        lean = 0.55 * Math.sin(Math.min(t / EMOTE_DURATION.bow, 1) * Math.PI);
        break;
    }
    if (t >= EMOTE_DURATION[state.emote]) {
      state.emote = null;
    }
  }

  out.leftArmZ = leftArmZ;
  out.rightArmZ = rightArmZ;
  out.rootLeanX = lean;
  out.rootSpinY = spinY;
  out.rootBobY =
    (input.grounded ? Math.abs(Math.sin(state.walkPhase)) * 0.05 * state.swing : 0) + hop;
  return out;
}
