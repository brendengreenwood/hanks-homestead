/**
 * PhysicsBody — the boundary between an ECS entity and its authoritative Box3D
 * `CharacterMover`. The mover lives in C-heap (WASM) and owns the local player's
 * resolved position; the ECS never reaches into Box3D internals, it only holds a
 * *handle* and reads what the mover already solved.
 *
 * `MoverLike` is the minimal surface `PhysicsSyncSystem` touches — the read side
 * of `Player.update()` (`this.mover.position`). Typing against this interface
 * (rather than importing the real Box3D module) is what keeps the bridge unit-
 * testable with a plain-object fake; the real mover is only exercised in the
 * Segment 4 browser proof.
 *
 * Ownership invariant: an entity carries EITHER a `PhysicsBody` (physics-driven
 * Transform) OR a `NetInterp` (snapshot-driven Transform), never both. See
 * `../ownership` and the ownership unit test.
 */

/** A read-only view of a solved 3D position. */
export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The slice of the Box3D `CharacterMover` the bridge depends on. The caller
 * (as `Player.update()` does today) writes game-feel into `velocity` and drives
 * `solve()`; the bridge only reads `position` afterwards. Kept intentionally
 * narrow so a fake mover in tests is trivially faithful.
 */
export interface MoverLike {
  readonly position: Vec3Like;
  readonly velocity: { x: number; y: number; z: number };
  solve(delta: number): void;
}

/** The component: an opaque handle to the entity's mover. */
export interface PhysicsBody {
  readonly mover: MoverLike;
}
