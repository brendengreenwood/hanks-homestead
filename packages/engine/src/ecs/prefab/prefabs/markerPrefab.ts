import type { World, EntityId } from '../../index';
import type { Prefab } from '../Prefab';
import type { CoreComponents } from '../components';

/** Per-spawn overrides for the marker prefab. All optional. */
export interface MarkerParams {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  model?: string;
  tint?: number;
}

/**
 * A visible world marker: an entity with a `Transform` and an `Appearance`.
 * The canonical two-component seed prefab — the shape the player slice
 * (Segment 4) generalises from.
 *
 * A factory, not a singleton, because a prefab's `build` needs this world's
 * component handles (component types are per-world).
 */
export function createMarkerPrefab(
  components: CoreComponents,
): Prefab<MarkerParams> {
  return {
    name: 'marker',
    build(world: World, params: MarkerParams = {}): EntityId {
      // params defaults to {} so a param-less spawn attaches all defaults.
      const entity = world.spawn();
      world.add(entity, components.Transform, {
        x: params.x ?? 0,
        y: params.y ?? 0,
        z: params.z ?? 0,
        yaw: params.yaw ?? 0,
      });
      world.add(entity, components.Appearance, {
        model: params.model ?? 'marker',
        tint: params.tint ?? 0xffffff,
      });
      return entity;
    },
  };
}
