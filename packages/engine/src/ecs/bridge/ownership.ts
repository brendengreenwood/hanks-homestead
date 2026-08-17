import type { World, ComponentType, EntityId } from '../index';
import type { PhysicsBody } from './components/PhysicsBody';
import type { NetInterp } from './components/NetInterp';

/**
 * Transform-ownership invariant for the seam: an entity's Transform is driven by
 * exactly one owner. A **local** entity is physics-driven (`PhysicsBody`, synced
 * from the Box3D mover); a **remote** entity is net-driven (`NetInterp`, sampled
 * from snapshots). The two modes never coexist on one entity — a remote avatar
 * must never get a mover, and a physics-driven player must never be interpolated.
 *
 * `PhysicsSyncSystem` and `NetInterpSystem` enforce this by construction: each
 * only visits its own component's store, so neither can touch an entity that
 * lacks its component. This helper is a defensive assertion available to any
 * code that attaches transform-owning components, to fail loudly if it ever
 * attaches both by mistake. The player slice does not need it — its prefab only
 * attaches `PhysicsBody` — but future net-adopting code can call it at spawn.
 */
export function assertSingleTransformOwner(
  world: World,
  entity: EntityId,
  physicsBody: ComponentType<PhysicsBody>,
  netInterp: ComponentType<NetInterp>,
): void {
  if (world.has(entity, physicsBody) && world.has(entity, netInterp)) {
    throw new Error(
      `entity ${entity} has both PhysicsBody and NetInterp; Transform ownership must be exactly one of physics-driven or net-driven`,
    );
  }
}
