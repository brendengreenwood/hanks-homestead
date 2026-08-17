import type { EntityId, ComponentType } from './types';

/**
 * A per-type component store: a map from entity id → component data for one
 * component type. Membership order is insertion order (Map semantics), which
 * the world relies on for deterministic query iteration.
 *
 * The store keys on the full EntityId (index + generation). Because the world
 * removes an entity's components on despawn before its slot can be recycled, a
 * recycled id (new generation) can never collide with a stale entry here.
 */
export class ComponentStore<T> {
  readonly type: ComponentType<T>;
  private readonly data = new Map<EntityId, T>();

  constructor(type: ComponentType<T>) {
    this.type = type;
  }

  /** Attach or overwrite this component's data for an entity. */
  add(entity: EntityId, value: T): void {
    this.data.set(entity, value);
  }

  /** Remove this component from an entity. No-op if absent. */
  remove(entity: EntityId): void {
    this.data.delete(entity);
  }

  /** The component data for an entity, or undefined if it has none. */
  get(entity: EntityId): T | undefined {
    return this.data.get(entity);
  }

  /** Whether an entity currently has this component. */
  has(entity: EntityId): boolean {
    return this.data.has(entity);
  }

  /** Number of entities carrying this component. */
  get size(): number {
    return this.data.size;
  }

  /** Entities carrying this component, in insertion order. */
  entities(): IterableIterator<EntityId> {
    return this.data.keys();
  }
}
