import type { World, EntityId } from '../index';

/**
 * A prefab is a named recipe: given a world (and optional params), it spawns
 * one entity, attaches its declared component set, and returns the entity id.
 *
 * This is the ECS-native evolution of the content renderer registry
 * (`RENDERERS` in `src/game/renderers.ts`): there a `type` string selects a
 * builder; here a prefab `name` selects a `build` recipe. The recipe owns the
 * `spawn` + `add` calls so callers never hand-assemble component sets.
 *
 * `Params` is an object of per-spawn inputs (e.g. a spawn position). The
 * signature keeps `params` optional so param-less prefabs need no argument;
 * prefabs with required inputs (the player's mover, a static prop's def)
 * guard at runtime and throw when the input is missing — the registry's
 * string-keyed path erases param types, so the check cannot be static.
 *
 * Prefabs stay pure plain-data: they attach only ECS components, never touch
 * three/box3d/net/physics. The physics/net-bound components arrive in Segment 3.
 */
export interface Prefab<Params extends object = Record<string, never>> {
  readonly name: string;
  build(world: World, params?: Params): EntityId;
}
