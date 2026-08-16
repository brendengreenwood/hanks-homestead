import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/** Spawn recipe for a `hut` def: the shared static component set, no extras. */
export function createHutPrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'hut',
    build(world: World, params?: StaticPrefabParams): EntityId {
      return stampCommon(world, components, requireDef('hut', params));
    },
  };
}
