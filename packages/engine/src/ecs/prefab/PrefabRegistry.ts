import type { World, EntityId } from '../index';
import type { Prefab } from './Prefab';

/**
 * A name → prefab registry. The ECS analogue of the content `RENDERERS` record:
 * a lookup table that turns a name into an entity recipe. Unlike `RENDERERS`
 * (a plain object literal), the registry rejects duplicate names and unknown
 * lookups so author mistakes surface loudly instead of silently no-op'ing.
 */
export class PrefabRegistry {
  // Params are erased on storage: a string-keyed registry cannot statically
  // link a name to its param type (the same tradeoff `RENDERERS` makes). The
  // per-prefab `Prefab<Params>` type still guards direct `build` calls.
  private readonly prefabs = new Map<string, Prefab<object>>();

  /** Register a prefab. Throws if its name is already registered. */
  register(prefab: Prefab<object>): void {
    if (this.prefabs.has(prefab.name)) {
      throw new Error(`prefab "${prefab.name}" is already registered`);
    }
    this.prefabs.set(prefab.name, prefab);
  }

  /** Whether a prefab with this name is registered. */
  has(name: string): boolean {
    return this.prefabs.has(name);
  }

  /**
   * Spawn an entity from a registered prefab. Throws if the name is unknown —
   * a missing prefab is a programming error, not a recoverable condition.
   * `params` is not statically checked against the named prefab (see the map
   * note above); it is forwarded as-is.
   */
  spawn(world: World, name: string, params?: object): EntityId {
    const prefab = this.prefabs.get(name);
    if (prefab === undefined) {
      throw new Error(`prefab "${name}" is not registered`);
    }
    return prefab.build(world, params);
  }
}
