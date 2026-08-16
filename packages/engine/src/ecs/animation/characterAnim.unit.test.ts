import { describe, expect, it } from 'vitest';
import {
  EMOTE_DURATION,
  createAnimationState,
  createCharacterPose,
  startEmote,
  cancelEmote,
  stepAnimationState,
  evaluateCharacterPose,
  type AnimationState,
  type CharacterAnimInput,
} from './characterAnim';

/** Input with sensible defaults; override per case. */
function input(overrides: Partial<CharacterAnimInput> = {}): CharacterAnimInput {
  return { dt: 1 / 60, speed: 0, intensity: 0, grounded: true, leapIntensity: 0, ...overrides };
}

function evaluate(state: AnimationState, inp: CharacterAnimInput) {
  return evaluateCharacterPose(state, inp, createCharacterPose());
}

describe('stepAnimationState', () => {
  // Case 1 — walk phase advance: dt·(3 + speed·2.4)
  it('advances walkPhase by dt * (3 + speed * 2.4)', () => {
    const state = createAnimationState();
    stepAnimationState(state, input({ dt: 0.1, speed: 2 }));
    expect(state.walkPhase).toBeCloseTo(0.1 * (3 + 2 * 2.4), 6);
  });

  // Case 2 — swing easing: 1 − exp(−8·dt)
  it('eases swing toward intensity with 1 - exp(-8 * dt)', () => {
    const state = createAnimationState();
    stepAnimationState(state, input({ dt: 0.5, intensity: 1 }));
    expect(state.swing).toBeCloseTo(1 - Math.exp(-4), 6);
  });

  // Case 12 — stretch relaxes toward 1 with 1 − exp(−10·dt)
  it('relaxes stretch toward 1 with 1 - exp(-10 * dt)', () => {
    const state = createAnimationState();
    state.stretch = 1.18; // jump squash value
    stepAnimationState(state, input({ dt: 0.1 }));
    const blend = 1 - Math.exp(-10 * 0.1);
    expect(state.stretch).toBeCloseTo(1.18 + (1 - 1.18) * blend, 6);
  });

  it('does not advance emoteTime when no emote is active', () => {
    const state = createAnimationState();
    stepAnimationState(state, input({ dt: 0.5 }));
    expect(state.emoteTime).toBe(0);
  });
});

describe('evaluateCharacterPose — locomotion', () => {
  // Case 3 — grounded walk pose at phase π/2, swing 1
  it('grounded: legs ±sin(phase)·0.65·swing, arms counter-swing ×0.7', () => {
    const state = createAnimationState();
    state.walkPhase = Math.PI / 2;
    state.swing = 1;
    const pose = evaluate(state, input({ grounded: true }));
    expect(pose.airborne).toBe(false);
    expect(pose.leftLegX).toBeCloseTo(0.65, 6);
    expect(pose.rightLegX).toBeCloseTo(-0.65, 6);
    expect(pose.leftArmX).toBeCloseTo(-0.455, 6);
    expect(pose.rightArmX).toBeCloseTo(0.455, 6);
  });

  // Case 4 — unmirrored leap targets × leapIntensity
  it('airborne unmirrored: legs 0.3/-0.55, arms -0.95/0.6 scaled by leapIntensity', () => {
    const state = createAnimationState();
    state.leapMirrored = false;
    const pose = evaluate(state, input({ grounded: false, leapIntensity: 0.5 }));
    expect(pose.airborne).toBe(true);
    expect(pose.leapLeftLegX).toBeCloseTo(0.3 * 0.5, 6);
    expect(pose.leapRightLegX).toBeCloseTo(-0.55 * 0.5, 6);
    expect(pose.leapLeftArmX).toBeCloseTo(-0.95 * 0.5, 6);
    expect(pose.leapRightArmX).toBeCloseTo(0.6 * 0.5, 6);
  });

  // Case 5 — mirrored leap swaps the pairs
  it('airborne mirrored: lead/trail pairs swapped', () => {
    const state = createAnimationState();
    state.leapMirrored = true;
    const pose = evaluate(state, input({ grounded: false, leapIntensity: 1 }));
    expect(pose.leapLeftLegX).toBeCloseTo(-0.55, 6);
    expect(pose.leapRightLegX).toBeCloseTo(0.3, 6);
    expect(pose.leapLeftArmX).toBeCloseTo(0.6, 6);
    expect(pose.leapRightArmX).toBeCloseTo(-0.95, 6);
  });

  // Case 11 — walk bob composes with emote hop
  it('rootBobY: abs(sin(phase))·0.05·swing plus the cheer hop', () => {
    const state = createAnimationState();
    state.walkPhase = 1.0;
    state.swing = 0.8;
    startEmote(state, 'cheer');
    state.emoteTime = 0.5;
    const pose = evaluate(state, input({ grounded: true }));
    const walkBob = Math.abs(Math.sin(1.0)) * 0.05 * 0.8;
    const hop = Math.abs(Math.sin(0.5 * 7)) * 0.16;
    expect(pose.rootBobY).toBeCloseTo(walkBob + hop, 6);
  });

  it('rootBobY: no walk bob while airborne', () => {
    const state = createAnimationState();
    state.walkPhase = 1.0;
    state.swing = 1;
    const pose = evaluate(state, input({ grounded: false, leapIntensity: 1 }));
    expect(pose.rootBobY).toBe(0);
  });

  it('emits blend = 1 - exp(-10·dt)', () => {
    const state = createAnimationState();
    const pose = evaluate(state, input({ dt: 0.1 }));
    expect(pose.blend).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});

describe('evaluateCharacterPose — emotes', () => {
  // Case 6 — wave keyframe
  it('wave at t=0.5: rightArmZ = -2.2 - sin(4.5)·0.35', () => {
    const state = createAnimationState();
    startEmote(state, 'wave');
    state.emoteTime = 0.5;
    const pose = evaluate(state, input());
    expect(pose.rightArmZ).toBeCloseTo(-2.2 - Math.sin(4.5) * 0.35, 6);
    expect(pose.leftArmZ).toBe(0);
  });

  // Case 7 — cheer keyframe
  it('cheer at t=0.5: arms ±2.35, hop abs(sin(3.5))·0.16', () => {
    const state = createAnimationState();
    startEmote(state, 'cheer');
    state.emoteTime = 0.5;
    const pose = evaluate(state, input());
    expect(pose.leftArmZ).toBeCloseTo(2.35, 6);
    expect(pose.rightArmZ).toBeCloseTo(-2.35, 6);
    expect(pose.rootBobY).toBeCloseTo(Math.abs(Math.sin(3.5)) * 0.16, 6);
  });

  // Case 8 — spin keyframe; neutral on the evaluate AFTER the crossing frame
  it('spin: rootSpinY = (t/0.9)·2π; 0 on the evaluate after expiry', () => {
    const state = createAnimationState();
    startEmote(state, 'spin');
    state.emoteTime = 0.45;
    let pose = evaluate(state, input());
    expect(pose.rootSpinY).toBeCloseTo((0.45 / 0.9) * Math.PI * 2, 6);
    expect(pose.leftArmZ).toBeCloseTo(0.9, 6);
    expect(pose.rightArmZ).toBeCloseTo(-0.9, 6);

    state.emoteTime = 0.9; // crossing evaluate happens here…
    evaluate(state, input());
    pose = evaluate(state, input()); // …so this one is neutral
    expect(pose.rootSpinY).toBe(0);
  });

  // Case 9 — bow keyframe; neutral after expiry
  it('bow: rootLeanX = 0.55·sin(min(t/1.4,1)·π); 0 on the evaluate after expiry', () => {
    const state = createAnimationState();
    startEmote(state, 'bow');
    state.emoteTime = 0.7;
    let pose = evaluate(state, input());
    expect(pose.rootLeanX).toBeCloseTo(0.55 * Math.sin((0.7 / 1.4) * Math.PI), 6);

    state.emoteTime = 1.4;
    evaluate(state, input());
    pose = evaluate(state, input());
    expect(pose.rootLeanX).toBe(0);
  });

  // Case 10 — auto-clear at each pinned duration
  it('auto-clears each emote at its pinned duration (1.7/1.5/0.9/1.4)', () => {
    const expected: Record<string, number> = { wave: 1.7, cheer: 1.5, spin: 0.9, bow: 1.4 };
    for (const kind of ['wave', 'cheer', 'spin', 'bow'] as const) {
      expect(EMOTE_DURATION[kind]).toBe(expected[kind]);
      const state = createAnimationState();
      startEmote(state, kind);
      state.emoteTime = EMOTE_DURATION[kind] - 0.01;
      evaluate(state, input());
      expect(state.emote).toBe(kind); // still short of the duration
      state.emoteTime = EMOTE_DURATION[kind];
      evaluate(state, input());
      expect(state.emote).toBeNull(); // cleared once t >= duration
    }
  });

  // Case 13 — crossing frame still renders the overshoot keyframe
  it('the evaluate where emoteTime crosses the duration still renders the keyframe', () => {
    const state = createAnimationState();
    startEmote(state, 'spin');
    // One big step that jumps past the 0.9s duration in a single dt.
    state.emoteTime = 0.95;
    const crossing = evaluate(state, input());
    // The crossing evaluate renders the overshoot (past 2π)…
    expect(crossing.rootSpinY).toBeCloseTo((0.95 / 0.9) * Math.PI * 2, 6);
    expect(crossing.rootSpinY).toBeGreaterThan(Math.PI * 2);
    expect(state.emote).toBeNull(); // …and clears after computing it.
    // Only the NEXT evaluate is neutral.
    const next = evaluate(state, input());
    expect(next.rootSpinY).toBe(0);
    expect(next.leftArmZ).toBe(0);
  });

  // Case 14 — cancelEmote (the jump-cancel path) goes neutral immediately
  it('cancelEmote mid-emote: next evaluate returns neutral emote targets', () => {
    const state = createAnimationState();
    startEmote(state, 'cheer');
    state.emoteTime = 0.5;
    cancelEmote(state);
    const pose = evaluate(state, input());
    expect(pose.leftArmZ).toBe(0);
    expect(pose.rightArmZ).toBe(0);
    expect(pose.rootLeanX).toBe(0);
    expect(pose.rootSpinY).toBe(0);
    expect(pose.rootBobY).toBe(0);
  });
});
