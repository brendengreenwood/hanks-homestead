import type { EntityDef } from '../../entityDef';
import type { EntityId } from '../../types';
import type { World } from '../../World';
import type { StaticComponents } from '../components';

/** Per-spawn input shared by every static prefab: the content def to stamp. */
export interface StaticPrefabParams {
  def: EntityDef;
}

/**
 * Guard for the registry's erased-params path: a static prefab spawned
 * without its def is a programming error, surfaced with the prefab name.
 */
export function requireDef(
  prefabName: string,
  params?: StaticPrefabParams,
): EntityDef {
  if (params === undefined || params.def === undefined) {
    throw new Error(`static prefab "${prefabName}" requires { def }`);
  }
  return params.def;
}

/**
 * Spawn an entity and stamp the component set every static prop shares:
 * `Placement` (transform defaults resolved: y/rot* → 0, scale → 1),
 * `EntityKind`, and `LayoutId`. Type-specific extras (`HouseColors`, `Tilt`)
 * are stamped by the individual prefab files; layout-id naming and the
 * duplicate-id guard live in `StaticEntityStore.load` (the batch entry point
 * — a per-entity recipe cannot see duplicates).
 *
 * Scope: static props only. Consumed-type extras (`pose` on NPCs) are not
 * modeled and are dropped — callers must pre-filter defs to static types
 * before spawning (Segment 3's derive path does exactly that).
 */
export function stampCommon(
  world: World,
  components: StaticComponents,
  def: EntityDef,
): EntityId {
  const entity = world.spawn();
  world.add(entity, components.Placement, {
    x: def.x,
    y: def.y ?? 0,
    z: def.z,
    rotX: def.rotX ?? 0,
    rotY: def.rotY ?? 0,
    rotZ: def.rotZ ?? 0,
    scale: def.scale ?? 1,
  });
  world.add(entity, components.EntityKind, { type: def.type });
  world.add(entity, components.LayoutId, { id: def.id });
  return entity;
}
