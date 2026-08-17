import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/**
 * Spawn recipe for a `monolith` def: the shared static component set, plus
 * `Tilt` when the def carries one (the lean angle World's builder applies).
 */
export function createMonolithPrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'monolith',
    build(world: World, params?: StaticPrefabParams): EntityId {
      const def = requireDef('monolith', params);
      const entity = stampCommon(world, components, def);
      if (def.tilt !== undefined) {
        world.add(entity, components.Tilt, { tilt: def.tilt });
      }
      return entity;
    },
  };
}
