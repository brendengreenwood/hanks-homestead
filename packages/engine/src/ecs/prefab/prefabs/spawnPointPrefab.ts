import type { World, EntityId } from '../../index';
import type { Prefab } from '../Prefab';
import type { CoreComponents } from '../components';

/** Per-spawn overrides for the spawn-point prefab. */
export interface SpawnPointParams {
  x?: number;
  z?: number;
  yaw?: number;
}

/**
 * An invisible spawn point: an entity with a `Transform` only, no `Appearance`.
 * Demonstrates a distinct (single-component) prefab shape from `marker`, so the
 * registry and queries are exercised over differing component sets.
 */
export function createSpawnPointPrefab(
  components: CoreComponents,
): Prefab<SpawnPointParams> {
  return {
    name: 'spawnPoint',
    build(world: World, params: SpawnPointParams = {}): EntityId {
      const entity = world.spawn();
      world.add(entity, components.Transform, {
        x: params.x ?? 0,
        y: 0,
        z: params.z ?? 0,
        yaw: params.yaw ?? 0,
      });
      return entity;
    },
  };
}
