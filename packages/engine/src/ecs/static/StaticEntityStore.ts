import type { EntityDef } from '../entityDef';
import type { EntityId } from '../types';
import { World } from '../World';
import { PrefabRegistry } from '../prefab/PrefabRegistry';
import {
  registerStaticComponents,
  type StaticComponents,
  type Placement,
} from './components';
import { registerStaticPrefabs } from './registerStaticPrefabs';
import { toEntityDef } from './toEntityDef';

/**
 * Standalone registry of static world props: owns its own ECS `World`,
 * registers the static components, and loads an `EntityDef[]` layout into
 * entities.
 *
 * Deliberately NOT part of `EcsWorldSystem`: that seam's constructor requires
 * a player mover, which conflates the ECS with the player slice. The editor
 * has no player yet still needs the static layer, so this store is
 * constructible with no arguments and carries no physics/net/game dependency.
 */
export class StaticEntityStore {
  /**
   * The backing ECS world, exposed for read-side queries (diagnostics, later
   * segments' derive path). Mutating it directly (despawn/setName) breaks the
   * store's invariants — spawn static entities only through `load`.
   */
  readonly world = new World();
  private readonly components: StaticComponents;
  private readonly registry = new PrefabRegistry();
  private entities: EntityId[] | null = null;

  constructor() {
    this.components = registerStaticComponents(this.world);
    registerStaticPrefabs(this.registry, this.components);
  }

  /**
   * Load a layout, spawning one entity per def through its type's prefab
   * (load order preserved — World's dispatch grouping depends on it). Each
   * entity is named with its layout id for O(1) `byId` lookup; a duplicate
   * `def.id` throws — a corrupted layout must surface loudly, not as a
   * silent name overwrite. A def whose type has no prefab throws too: this
   * is a store-misuse guard — callers pre-filter to `STATIC_TYPES`
   * (Segment 3's derive path does), so game content never trips it.
   *
   * Callable once — a second call throws rather than silently mixing two
   * layouts. An empty layout counts as loaded: construct the store only when
   * the content is resolved.
   */
  load(defs: readonly EntityDef[]): readonly EntityId[] {
    if (this.entities !== null) {
      throw new Error('StaticEntityStore.load may only be called once');
    }
    // Validate the whole layout before spawning anything: a throw must leave
    // the world untouched, not a half-loaded prefix behind a still-loadable
    // guard (`entities` stays null on throw, so a corrected retry is safe).
    const seen = new Set<string>();
    for (const def of defs) {
      if (seen.has(def.id)) {
        throw new Error(`duplicate layout id "${def.id}" in entity defs`);
      }
      seen.add(def.id);
      if (!this.registry.has(def.type)) {
        throw new Error(
          `no static prefab for entity type "${def.type}" (def "${def.id}") — pre-filter defs to STATIC_TYPES`,
        );
      }
    }
    this.entities = defs.map((def) => {
      const entity = this.registry.spawn(this.world, def.type, { def });
      this.world.setName(entity, def.id);
      return entity;
    });
    return this.entities;
  }

  /** Number of loaded static entities. */
  get count(): number {
    return this.entities?.length ?? 0;
  }

  /**
   * The loaded layout as canonical `EntityDef`s, in load order (the original
   * array order — World's dispatch grouping depends on it). Canonical means
   * default-valued fields are omitted; see `toEntityDef`.
   */
  defs(): EntityDef[] {
    return (this.entities ?? []).map((entity) =>
      toEntityDef(this.world, this.components, entity),
    );
  }

  /** The entity holding a layout id, or undefined if none. */
  byId(id: string): EntityId | undefined {
    return this.world.findByName(id);
  }

  /** The `Placement` of the entity holding a layout id, or undefined. */
  placement(id: string): Placement | undefined {
    const entity = this.byId(id);
    if (entity === undefined) return undefined;
    return this.world.get(entity, this.components.Placement);
  }

  /**
   * The canonical `EntityDef` of the entity holding a layout id, or undefined
   * if no entity carries that id. Canonical means default-valued fields are
   * omitted; see `toEntityDef`.
   */
  defOf(id: string): EntityDef | undefined {
    const entity = this.byId(id);
    if (entity === undefined) return undefined;
    return toEntityDef(this.world, this.components, entity);
  }
}
