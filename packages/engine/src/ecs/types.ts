// Shared type aliases for the ECS core. Pure data — no engine imports.

/**
 * An entity id. Opaque to callers: it encodes an index (which slot) and a
 * generation (how many times that slot has been reused), packed into one
 * number so that a stale id referring to a recycled slot is detectable.
 * Never do arithmetic on it; treat it as a token.
 */
export type EntityId = number & { readonly __brand: 'EntityId' };

/**
 * A component type handle. Identifies one kind of component (its store) within
 * a world. Created via `world.defineComponent<T>(name)`; carries the component's
 * data type `T` at compile time only (phantom), erased at runtime.
 */
export type ComponentType<T> = {
  readonly id: number;
  readonly name: string;
  /**
   * Identity token of the world that created this type. `store()` asserts the
   * token matches before indexing, so a type from world A can never silently
   * alias a same-id store in world B.
   */
  readonly world: object;
  /** phantom — carries T for type inference; never read at runtime */
  readonly __data?: T;
};
