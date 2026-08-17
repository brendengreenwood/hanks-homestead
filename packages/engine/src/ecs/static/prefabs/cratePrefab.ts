import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/** Spawn recipe for a `crate` def: the shared static component set, no extras. */
export function createCratePrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'crate',
    build(world: World, params?: StaticPrefabParams): EntityId {
      return stampCommon(world, components, requireDef('crate', params));
    },
  };
}
