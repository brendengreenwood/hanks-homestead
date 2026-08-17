import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { registerAnimationComponents } from './components';
import { runOscillator } from './systems/OscillatorSystem';
import { runSpin } from './systems/SpinSystem';

function setup() {
  const world = new World();
  const anim = registerAnimationComponents(world);
  return { world, anim };
}

describe('Oscillator system', () => {
  // Case 1 — mirror of npcs.unit.test.ts "deterministic output for a given seed and elapsed"
  it('matches the NPC idle-bob formula at its exact constants', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    const phase = 1.234;
    world.add(entity, anim.Oscillator, {
      frequency: 1.6,
      amplitude: 0.025,
      phase,
      offset: 0,
    });

    runOscillator(world, anim.Oscillator, 2.5);

    const osc = world.get(entity, anim.Oscillator)!;
    expect(osc.offset).toBeCloseTo(Math.sin(2.5 * 1.6 + phase) * 0.025, 10);
  });

  // Case 2 — fast-bob constants (originally the map-pickup bob profile)
  it('matches the fast-bob formula at its exact constants', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Oscillator, {
      frequency: 2.4,
      amplitude: 0.08,
      phase: 0,
      offset: 0,
    });

    runOscillator(world, anim.Oscillator, 1.0);

    const osc = world.get(entity, anim.Oscillator)!;
    expect(osc.offset).toBeCloseTo(Math.sin(1.0 * 2.4 + 0) * 0.08, 6);
  });

  // Case 3 — mirror of npcs.unit.test.ts "advances bobOffset from elapsed time"
  it('keeps |offset| within amplitude', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Oscillator, {
      frequency: 1.6,
      amplitude: 0.025,
      phase: 0.5,
      offset: 0,
    });

    runOscillator(world, anim.Oscillator, 1.0);

    const osc = world.get(entity, anim.Oscillator)!;
    expect(osc.offset).not.toBe(0);
    expect(Math.abs(osc.offset)).toBeLessThanOrEqual(0.025);
  });

  // Case 4 — guards the both-paths ticking design (play + customize)
  it('is idempotent for the same elapsed', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Oscillator, {
      frequency: 2.4,
      amplitude: 0.08,
      phase: 0.9,
      offset: 0,
    });

    runOscillator(world, anim.Oscillator, 3.7);
    const first = world.get(entity, anim.Oscillator)!.offset;
    runOscillator(world, anim.Oscillator, 3.7);
    const second = world.get(entity, anim.Oscillator)!.offset;

    expect(second).toBe(first);
  });

  // Case 5 — phase offsets keep carriers from moving in lockstep
  it('produces different offsets for different phases', () => {
    const { world, anim } = setup();
    const e1 = world.spawn();
    const e2 = world.spawn();
    world.add(e1, anim.Oscillator, { frequency: 2.4, amplitude: 0.08, phase: 0, offset: 0 });
    world.add(e2, anim.Oscillator, { frequency: 2.4, amplitude: 0.08, phase: Math.PI, offset: 0 });

    runOscillator(world, anim.Oscillator, 1.0);

    const o1 = world.get(e1, anim.Oscillator)!;
    const o2 = world.get(e2, anim.Oscillator)!;
    expect(o1.offset).not.toBeCloseTo(o2.offset, 3);
  });

  // Case 8 — one system call drives heterogeneous carriers
  it('updates slow-constant and fast-constant oscillators in one call', () => {
    const { world, anim } = setup();
    const npc = world.spawn();
    const fast = world.spawn();
    world.add(npc, anim.Oscillator, { frequency: 1.6, amplitude: 0.025, phase: 0.3, offset: 0 });
    world.add(fast, anim.Oscillator, { frequency: 2.4, amplitude: 0.08, phase: 0.7, offset: 0 });

    runOscillator(world, anim.Oscillator, 2.0);

    expect(world.get(npc, anim.Oscillator)!.offset).toBeCloseTo(
      Math.sin(2.0 * 1.6 + 0.3) * 0.025,
      10,
    );
    expect(world.get(fast, anim.Oscillator)!.offset).toBeCloseTo(
      Math.sin(2.0 * 2.4 + 0.7) * 0.08,
      10,
    );
  });
});

describe('Spin system', () => {
  it('sets angle as a pure function of elapsed at a fixed spin speed', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Spin, { speed: 2.2, angle: 0 });

    runSpin(world, anim.Spin, 0.5);
    expect(world.get(entity, anim.Spin)!.angle).toBeCloseTo(0.5 * 2.2, 6);

    runSpin(world, anim.Spin, 0.7);
    expect(world.get(entity, anim.Spin)!.angle).toBeCloseTo(0.7 * 2.2, 6);
  });

  // Idempotence is the point of #75: any path may tick spin, any number of
  // times per frame, without the angle drifting.
  it('is idempotent: repeated ticks at the same elapsed write the same angle', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Spin, { speed: 2.2, angle: 0 });

    runSpin(world, anim.Spin, 1.25);
    const first = world.get(entity, anim.Spin)!.angle;
    runSpin(world, anim.Spin, 1.25);
    runSpin(world, anim.Spin, 1.25);

    expect(world.get(entity, anim.Spin)!.angle).toBe(first);
    expect(first).toBeCloseTo(1.25 * 2.2, 6);
  });

  it('wraps the angle to [0, 2π) on long elapsed', () => {
    const { world, anim } = setup();
    const entity = world.spawn();
    world.add(entity, anim.Spin, { speed: 2.2, angle: 0 });

    runSpin(world, anim.Spin, 1000);
    const angle = world.get(entity, anim.Spin)!.angle;
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(Math.PI * 2);
    expect(angle).toBeCloseTo((1000 * 2.2) % (Math.PI * 2), 6);
  });

  it('drives multiple carriers at independent speeds', () => {
    const { world, anim } = setup();
    const slow = world.spawn();
    const fast = world.spawn();
    world.add(slow, anim.Spin, { speed: 1.0, angle: 0 });
    world.add(fast, anim.Spin, { speed: 2.2, angle: 0 });

    runSpin(world, anim.Spin, 2.0);
    expect(world.get(slow, anim.Spin)!.angle).toBeCloseTo(2.0, 6);
    expect(world.get(fast, anim.Spin)!.angle).toBeCloseTo((2.0 * 2.2) % (Math.PI * 2), 6);
  });
});
