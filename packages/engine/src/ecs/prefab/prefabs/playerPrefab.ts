import type { World, EntityId, ComponentType } from '../../index';
import type { Prefab } from '../Prefab';
import type { CoreComponents } from '../components';
import type { PhysicsBody, MoverLike } from '../../bridge';

/** Per-spawn inputs for the player prefab. */
export interface PlayerParams {
  /** The authoritative Box3D mover for this player (C-heap handle). */
  mover: MoverLike;
  /** Optional starting yaw (radians); position is read from the mover on sync. */
  yaw?: number;
  /** Which visual model the render bridge should use. */
  model?: string;
  tint?: number;
}

/**
 * The local player: an ECS entity carrying a `Transform` (derived, synced from
 * the mover), a `PhysicsBody` (the authoritative Box3D mover handle), and an
 * `Appearance`. This is the marker prefab's shape generalised with the physics
 * boundary from Segment 3 — the mover stays authoritative, the Transform is a
 * mirror `PhysicsSyncSystem` keeps up to date each frame.
 *
 * A factory (not a singleton) because `build` needs this world's per-world
 * component handles. The `PhysicsBody` handle is passed in alongside the core
 * components so the player prefab is the only prefab that binds a mover.
 */
export function createPlayerPrefab(
  components: CoreComponents,
  physicsBody: ComponentType<PhysicsBody>,
): Prefab<PlayerParams> {
  return {
    name: 'player',
    build(world: World, params?: PlayerParams): EntityId {
      if (params === undefined || params.mover === undefined) {
        throw new Error('player prefab requires a mover');
      }
      const entity = world.spawn();
      world.setName(entity, 'player');
      const p = params.mover.position;
      // Seed the Transform from the mover's current position so the first frame
      // before a sync isn't at the origin; PhysicsSyncSystem keeps it current.
      world.add(entity, components.Transform, {
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: params.yaw ?? 0,
      });
      world.add(entity, physicsBody, { mover: params.mover });
      world.add(entity, components.Appearance, {
        model: params.model ?? 'player',
        tint: params.tint ?? 0xffffff,
      });
      return entity;
    },
  };
}
