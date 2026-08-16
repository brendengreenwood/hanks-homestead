import type { World, EntityId, ComponentType } from '../../index';
import type { Prefab } from '../Prefab';
import type { CoreComponents } from '../components';
import type { NetInterp } from '../../bridge';

/** Per-spawn inputs for the remote-player prefab. */
export interface RemotePlayerParams {
  /** Starting position (from the first wire snapshot). */
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
}

/**
 * A remote player: an ECS entity carrying a `Transform` (derived, synced from
 * wire snapshots via `NetInterpSystem`) and a `NetInterp` (the snapshot
 * interpolation buffer). No `PhysicsBody` — remote avatars have no local mover;
 * their Transform is the sole product of the net-bridge interpolation.
 */
export function createRemotePlayerPrefab(
  components: CoreComponents,
  netInterp: ComponentType<NetInterp>,
): Prefab<RemotePlayerParams> {
  return {
    name: 'remotePlayer',
    build(world: World, params?: RemotePlayerParams): EntityId {
      const entity = world.spawn();
      world.add(entity, components.Transform, {
        x: params?.x ?? 0,
        y: params?.y ?? 0,
        z: params?.z ?? 0,
        yaw: params?.yaw ?? 0,
      });
      world.add(entity, netInterp, { snapshots: [] });
      return entity;
    },
  };
}
