import type { World, ComponentType } from '../index';
import type { Placement } from './components/Placement';
import type { EntityKind } from './components/EntityKind';
import type { LayoutId } from './components/LayoutId';
import type { HouseColors } from './components/HouseColors';
import type { Tilt } from './components/Tilt';

export type { Placement, EntityKind, LayoutId, HouseColors, Tilt };

/**
 * The component handles a world exposes for static world props. Mirrors
 * `CoreComponents` (src/ecs/prefab/components.ts): component types are
 * per-world, so a world registers once and hands the typed handles around.
 */
export interface StaticComponents {
  Placement: ComponentType<Placement>;
  EntityKind: ComponentType<EntityKind>;
  LayoutId: ComponentType<LayoutId>;
  HouseColors: ComponentType<HouseColors>;
  Tilt: ComponentType<Tilt>;
}

/**
 * Define the static-prop components on a world and return their handles.
 * Names are distinct from the core set (`Transform`/`Appearance`), so a world
 * may carry both; `defineComponent` throws on a duplicate name, making a
 * second call on the same world a loud error.
 */
export function registerStaticComponents(world: World): StaticComponents {
  return {
    Placement: world.defineComponent<Placement>('Placement'),
    EntityKind: world.defineComponent<EntityKind>('EntityKind'),
    LayoutId: world.defineComponent<LayoutId>('LayoutId'),
    HouseColors: world.defineComponent<HouseColors>('HouseColors'),
    Tilt: world.defineComponent<Tilt>('Tilt'),
  };
}
