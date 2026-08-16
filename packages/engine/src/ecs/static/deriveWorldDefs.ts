import type { EntityDef } from '../entityDef';
import { STATIC_TYPES } from './STATIC_TYPES';
import type { StaticEntityStore } from './StaticEntityStore';

const STATIC_TYPE_SET: ReadonlySet<string> = new Set(STATIC_TYPES);

/**
 * Derive the `EntityDef[]` that `World` consumes from the ECS static registry:
 * content → ECS → World. This is the single merge implementation — both `Game`
 * and the editor route through it.
 *
 * Contract:
 * - The store must already be loaded with exactly the static subset of `defs`
 *   (`defs.filter((d) => STATIC_TYPES has d.type)`) — the caller loads it first.
 * - Output preserves the original `defs` array order (World's dispatch grouping
 *   and `bookStack`'s positional read depend on it).
 * - Each static def is replaced by its ECS-derived canonical def, matched by
 *   `store.byId(def.id)` — never by index-zip.
 * - Every non-static def — consumed types (`coin`/`item`/`npc`) AND unknown
 *   types — passes through byte-identical (same object reference). Unknown
 *   types keep World's warn-and-skip behavior; they never reach the store's
 *   loud unknown-type throw.
 * - A static def missing from the store throws loudly: the caller loaded the
 *   store from a different array than it is deriving from.
 */
export function deriveWorldDefs(
  defs: readonly EntityDef[],
  store: StaticEntityStore,
): EntityDef[] {
  return defs.map((def) => {
    if (!STATIC_TYPE_SET.has(def.type)) return def;
    const derived = store.defOf(def.id);
    if (derived === undefined) {
      throw new Error(
        `deriveWorldDefs: static def "${def.id}" (type "${def.type}") is not in the store — load the store from the same defs array first`,
      );
    }
    return derived;
  });
}
