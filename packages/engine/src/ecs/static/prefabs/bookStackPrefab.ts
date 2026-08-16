import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/** Spawn recipe for a `bookStack` def: the shared static component set, no extras. */
export function createBookStackPrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'bookStack',
    build(world: World, params?: StaticPrefabParams): EntityId {
      return stampCommon(world, components, requireDef('bookStack', params));
    },
  };
}
