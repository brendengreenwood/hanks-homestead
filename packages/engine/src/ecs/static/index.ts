// Static world-prop layer: plain-data components + prefab recipes + store.
export type {
  Placement,
  EntityKind,
  LayoutId,
  HouseColors,
  Tilt,
  StaticComponents,
} from './components';
export { registerStaticComponents } from './components';
export { STATIC_TYPES, type StaticType } from './STATIC_TYPES';
export { registerStaticPrefabs } from './registerStaticPrefabs';
export type { StaticPrefabParams } from './prefabs/stampCommon';
export { toEntityDef } from './toEntityDef';
export { StaticEntityStore } from './StaticEntityStore';
export { deriveWorldDefs } from './deriveWorldDefs';
