import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/** Spawn recipe for a `rock` def: the shared static component set, no extras. */
export function createRockPrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'rock',
    build(world: World, params?: StaticPrefabParams): EntityId {
      return stampCommon(world, components, requireDef('rock', params));
    },
  };
}
