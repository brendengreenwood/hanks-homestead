import { describe, expect, it } from 'vitest';
import { normalizeAngle, shortestAngleDiff, yawFromDirection } from './angles';

const PI = Math.PI;

describe('normalizeAngle', () => {
  it('is the identity on already-normal angles', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(1.2)).toBeCloseTo(1.2, 12);
    expect(normalizeAngle(-1.2)).toBeCloseTo(-1.2, 12);
    expect(normalizeAngle(-PI)).toBeCloseTo(-PI, 12);
  });

  it('wraps the +π boundary to -π (range is [-π, π))', () => {
    expect(normalizeAngle(PI)).toBeCloseTo(-PI, 12);
    expect(normalizeAngle(3 * PI)).toBeCloseTo(-PI, 12);
  });

  it('unwinds arbitrarily wound angles of either sign', () => {
    expect(normalizeAngle(4 * PI)).toBeCloseTo(0, 12);
    expect(normalizeAngle(4 * PI + 0.5)).toBeCloseTo(0.5, 12);
    expect(normalizeAngle(-4 * PI - 0.5)).toBeCloseTo(-0.5, 12);
    expect(normalizeAngle(-7.5 * PI)).toBeCloseTo(0.5 * PI, 12);
  });
});

describe('shortestAngleDiff', () => {
  it('returns zero for equal angles', () => {
    expect(shortestAngleDiff(0.7, 0.7)).toBe(0);
  });

  it('returns signed quarter turns', () => {
    expect(shortestAngleDiff(0, PI / 2)).toBeCloseTo(PI / 2, 12);
    expect(shortestAngleDiff(0, -PI / 2)).toBeCloseTo(-PI / 2, 12);
  });

  it('treats the ±π boundary consistently (half turn maps to -π)', () => {
    expect(shortestAngleDiff(0, PI)).toBeCloseTo(-PI, 12);
    expect(shortestAngleDiff(PI / 2, -PI / 2)).toBeCloseTo(-PI, 12);
    // Just past the seam turns the short way.
    expect(shortestAngleDiff(PI - 0.1, -PI + 0.1)).toBeCloseTo(0.2, 12);
    expect(shortestAngleDiff(-PI + 0.1, PI - 0.1)).toBeCloseTo(-0.2, 12);
  });

  it('is correct for wound inputs where the old % formula broke', () => {
    // Old formula: ((PI/2 - 4*PI + 3*PI) % (2*PI)) - PI = -3*PI/2 — a
    // wrong-direction three-quarter turn. The true shortest arc is +PI/2.
    expect(shortestAngleDiff(4 * PI, PI / 2)).toBeCloseTo(PI / 2, 12);
    // Mirrored negative winding.
    expect(shortestAngleDiff(-4 * PI, -PI / 2)).toBeCloseTo(-PI / 2, 12);
    // The exact live repro shape: yaw wound to 3π, target -π/2 (KeyD).
    expect(shortestAngleDiff(3 * PI, -PI / 2)).toBeCloseTo(PI / 2, 12);
  });
});

describe('yawFromDirection', () => {
  // These pin the +Z front convention (atan2(dx, dz)) — the glTF / lookAt
  // standard adopted in #70. Any sign flip here is a convention regression.
  it('is zero when the direction is already the model front (+Z)', () => {
    expect(yawFromDirection(0, 1)).toBeCloseTo(0, 12);
  });

  it('returns signed quarter turns for east/west directions', () => {
    // Face +X (east): rotate +Z onto +X → yaw +π/2.
    expect(yawFromDirection(1, 0)).toBeCloseTo(PI / 2, 12);
    // Face −X (west): yaw −π/2.
    expect(yawFromDirection(-1, 0)).toBeCloseTo(-PI / 2, 12);
  });

  it('returns a half turn for −Z (behind the model front)', () => {
    expect(Math.abs(normalizeAngle(yawFromDirection(0, -1)))).toBeCloseTo(PI, 12);
  });
});
