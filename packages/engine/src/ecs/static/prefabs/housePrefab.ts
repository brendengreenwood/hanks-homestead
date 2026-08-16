import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { Prefab } from '../../prefab/Prefab';
import type { StaticComponents, HouseColors } from '../components';
import { requireDef, stampCommon, type StaticPrefabParams } from './stampCommon';

/**
 * Spawn recipe for a `house` def: the shared static component set, plus
 * `HouseColors` when the def carries a color override. Only the present keys
 * are stored — no `roofColor: undefined` entries, so the canonical round-trip
 * (`toEntityDef`) emits exactly what the content carried.
 */
export function createHousePrefab(
  components: StaticComponents,
): Prefab<StaticPrefabParams> {
  return {
    name: 'house',
    build(world: World, params?: StaticPrefabParams): EntityId {
      const def = requireDef('house', params);
      const entity = stampCommon(world, components, def);
      if (def.bodyColor !== undefined || def.roofColor !== undefined) {
        const colors: HouseColors = {};
        if (def.bodyColor !== undefined) colors.bodyColor = def.bodyColor;
        if (def.roofColor !== undefined) colors.roofColor = def.roofColor;
        world.add(entity, components.HouseColors, colors);
      }
      return entity;
    },
  };
}
