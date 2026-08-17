/**
 * Pure angle math shared by everything that eases a yaw toward a target.
 *
 * History: seven call sites used to compute the shortest-arc yaw step as
 *   ((target - current + 3π) % 2π) - π
 * That one-liner is broken: JavaScript's `%` is a sign-preserving remainder,
 * not a true modulo. The stored yaw winds unboundedly under repeated
 * same-direction turns, and once it exceeds `target + 3π` the operand goes
 * negative and the "wrapped" diff lands in (-3π, -π] — the character turns
 * up to 1.5 revolutions the wrong way. Never reintroduce a `%`-based wrap
 * here; `normalizeAngle` uses a floor-based true modulo instead.
 *
 * This module must stay dependency-free (no `three` import): it is consumed
 * from the pure ECS core (src/ecs), which is kept free of Three.js/DOM/game
 * dependencies.
 */

/**
 * Wraps an angle to [-π, π) using a true (floor-based) modulo, correct for
 * arbitrarily wound inputs of either sign.
 */
export function normalizeAngle(angle: number): number {
  return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

/**
 * Signed shortest-arc difference to turn `from` onto `to`, in [-π, π).
 * Correct even when either angle has wound far outside [-π, π).
 */
export function shortestAngleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Yaw (rotation.y) so the character front points along direction (dx, dz).
 * Character models are built front = +Z (CharacterModel.buildCharacter) — the
 * glTF / Object3D.lookAt standard — so this is atan2(dx, dz): the yaw that
 * rotates +Z onto (dx, dz), exactly what `lookAt` computes for a +Z-front rig.
 * THE front-convention lives here — never re-derive this atan2 at a call site.
 */
export function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}
