import type { EntityId, ComponentType } from './types';
import { makeEntityId, entityIndex, entityGeneration } from './Entity';
import { ComponentStore } from './Component';

/**
 * The ECS world: owns entities and component stores.
 *
 * Entities are slot-based. `spawn()` allocates a slot — reusing a freed slot
 * when one is available (bumping its generation) or growing the slot array
 * otherwise — and returns a packed EntityId. `despawn()` removes the entity's
 * components, invalidates its id (by bumping the slot's generation), and
 * returns the slot to the free list for reuse.
 *
 * Queries iterate in deterministic order: the driving component store is the
 * smallest of the requested stores, walked in its insertion order.
 *
 * Purity: this module and everything it imports touch no rendering, physics,
 * or net code — only plain data.
 */
export class World {
  // Per-slot generation. slotGeneration[index] is the generation of the id
  // currently (or last) occupying that slot. Bumped on despawn.
  private readonly slotGeneration: number[] = [];
  // Whether the slot at each index currently holds a live entity.
  private readonly slotAlive: boolean[] = [];
  // Freed slot indices available for reuse (LIFO).
  private readonly freeSlots: number[] = [];
  private aliveCount = 0;

  // Component stores, indexed by ComponentType.id.
  private readonly stores: ComponentStore<unknown>[] = [];
  private nextComponentId = 0;
  // Component names already defined on this world (author-mistake guard).
  private readonly componentNames = new Set<string>();
  // Identity token stamped onto every ComponentType this world creates, so a
  // foreign type is rejected rather than silently aliasing a same-id store.
  private readonly token: object = {};

  // Name index: name → entity, and entity → name (for cleanup on despawn).
  private readonly nameToEntity = new Map<string, EntityId>();
  private readonly entityToName = new Map<EntityId, string>();

  // ---- entities -----------------------------------------------------------

  /** Allocate a new entity and return its id. Reuses a freed slot if any. */
  spawn(): EntityId {
    // Choose the slot and pack the id BEFORE mutating any state: makeEntityId
    // throws on generation wrap, and a throw after marking the slot alive
    // would leave aliveCount off by one and make entities() throw forever.
    const recycled = this.freeSlots.length > 0;
    const index = recycled
      ? this.freeSlots[this.freeSlots.length - 1]
      : this.slotGeneration.length;
    const id = makeEntityId(index, recycled ? this.slotGeneration[index] : 0);

    if (recycled) {
      this.freeSlots.pop();
    } else {
      this.slotGeneration.push(0);
      this.slotAlive.push(false);
    }
    this.slotAlive[index] = true;
    this.aliveCount++;
    return id;
  }

  /**
   * Whether an id refers to a currently-live entity. False for a stale id
   * whose slot has since been recycled (generation mismatch) or freed.
   */
  isAlive(entity: EntityId): boolean {
    const index = entityIndex(entity);
    return (
      index < this.slotAlive.length &&
      this.slotAlive[index] &&
      this.slotGeneration[index] === entityGeneration(entity)
    );
  }

  /**
   * Destroy an entity: remove all its components, clear its name, invalidate
   * its id, and free its slot. No-op (returns false) for an already-dead or
   * stale id, so double-despawn is safe.
   */
  despawn(entity: EntityId): boolean {
    if (!this.isAlive(entity)) return false;
    const index = entityIndex(entity);

    for (const store of this.stores) {
      store.remove(entity);
    }
    const name = this.entityToName.get(entity);
    if (name !== undefined) {
      this.entityToName.delete(entity);
      this.nameToEntity.delete(name);
    }

    this.slotAlive[index] = false;
    // Bump generation so the freed id no longer matches the slot.
    this.slotGeneration[index]++;
    this.freeSlots.push(index);
    this.aliveCount--;
    return true;
  }

  /** Number of currently-live entities. */
  get entityCount(): number {
    return this.aliveCount;
  }

  /** Live entities, in ascending slot order (deterministic). */
  *entities(): IterableIterator<EntityId> {
    for (let index = 0; index < this.slotAlive.length; index++) {
      if (this.slotAlive[index]) {
        yield makeEntityId(index, this.slotGeneration[index]);
      }
    }
  }

  // ---- components ---------------------------------------------------------

  /** Register a new component type and its backing store. */
  defineComponent<T>(name: string): ComponentType<T> {
    if (this.componentNames.has(name)) {
      throw new Error(`component type "${name}" is already defined on this world`);
    }
    const type: ComponentType<T> = {
      id: this.nextComponentId++,
      name,
      world: this.token,
    };
    this.componentNames.add(name);
    this.stores[type.id] = new ComponentStore<unknown>(
      type as ComponentType<unknown>,
    ) as ComponentStore<unknown>;
    return type;
  }

  private store<T>(type: ComponentType<T>): ComponentStore<T> {
    if (type.world !== this.token) {
      throw new Error(
        `component type "${type.name}" belongs to a different world`,
      );
    }
    const store = this.stores[type.id];
    if (store === undefined) {
      throw new Error(`component type "${type.name}" is not defined on this world`);
    }
    return store as ComponentStore<T>;
  }

  /** Attach component data to a live entity. Throws for a dead/stale entity. */
  add<T>(entity: EntityId, type: ComponentType<T>, value: T): void {
    if (!this.isAlive(entity)) {
      throw new Error(`cannot add "${type.name}" to a dead entity`);
    }
    this.store(type).add(entity, value);
  }

  /** Remove a component from an entity. No-op if the entity lacks it. */
  remove<T>(entity: EntityId, type: ComponentType<T>): void {
    this.store(type).remove(entity);
  }

  /** This entity's data for a component, or undefined if it has none. */
  get<T>(entity: EntityId, type: ComponentType<T>): T | undefined {
    return this.store(type).get(entity);
  }

  /** Whether an entity currently has a component. */
  has<T>(entity: EntityId, type: ComponentType<T>): boolean {
    return this.store(type).has(entity);
  }

  // ---- names --------------------------------------------------------------

  /** Give an entity a unique name (replacing any prior holder's claim). */
  setName(entity: EntityId, name: string): void {
    if (!this.isAlive(entity)) {
      throw new Error(`cannot name a dead entity`);
    }
    // Clear any previous name this entity held.
    const prevName = this.entityToName.get(entity);
    if (prevName !== undefined) this.nameToEntity.delete(prevName);
    // Clear any previous holder of this name.
    const prevHolder = this.nameToEntity.get(name);
    if (prevHolder !== undefined) this.entityToName.delete(prevHolder);
    this.nameToEntity.set(name, entity);
    this.entityToName.set(entity, name);
  }

  /** The entity with this name, or undefined if none. */
  findByName(name: string): EntityId | undefined {
    return this.nameToEntity.get(name);
  }

  // ---- queries ------------------------------------------------------------

  /**
   * Iterate live entities that have *all* of the given component types.
   * Iteration is driven by whichever requested store is smallest, walked in
   * that store's insertion order — deterministic for a given mutation history.
   */
  *query(...types: ComponentType<unknown>[]): IterableIterator<EntityId> {
    if (types.length === 0) {
      yield* this.entities();
      return;
    }
    const stores = types.map((t) => this.store(t));
    // Drive from the smallest store to minimise the number of membership tests.
    let smallest = stores[0];
    for (const s of stores) {
      if (s.size < smallest.size) smallest = s;
    }
    const others = stores.filter((s) => s !== smallest);
    outer: for (const entity of smallest.entities()) {
      for (const other of others) {
        if (!other.has(entity)) continue outer;
      }
      yield entity;
    }
  }
}
