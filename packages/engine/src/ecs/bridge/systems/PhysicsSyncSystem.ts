import type { World, ComponentType } from '../../index';
import type { PhysicsBody } from '../components/PhysicsBody';
import type { Transform } from '../../prefab/components';

/**
 * PhysicsSyncSystem — the **read-from-Box3D** direction of the seam.
 *
 * For every entity that has both `PhysicsBody` and `Transform`, copy the mover's
 * already-solved `position` into the ECS `Transform`. This mirrors the read-back
 * in `Player.update()` (`this.group.position.set(this.mover.position.x, ...)`):
 * the mover stays authoritative for position, the ECS Transform is a *derived*
 * mirror of it.
 *
 * Direction invariant (enforced by construction): this system NEVER writes the
 * ECS Transform back into the mover as authoritative position. The caller still
 * owns game-feel — writing velocity and driving `mover.solve()` — exactly as
 * today; this system only observes the result. It does not call `solve()`.
 *
 * Entities without a `PhysicsBody` are never visited (they are not in the
 * `PhysicsBody` store), so net-driven avatars are untouched.
 */
export function runPhysicsSync(
  world: World,
  physicsBody: ComponentType<PhysicsBody>,
  transform: ComponentType<Transform>,
): void {
  for (const entity of world.query(physicsBody, transform)) {
    const body = world.get(entity, physicsBody)!;
    const xf = world.get(entity, transform)!;
    const p = body.mover.position;
    // Read-only: copy solved mover position into the derived Transform.
    xf.x = p.x;
    xf.y = p.y;
    xf.z = p.z;
  }
}
