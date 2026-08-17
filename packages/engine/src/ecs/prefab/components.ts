import type { World, ComponentType } from '../index';

/**
 * Plain-data transform: local-space position + facing yaw (radians). This is
 * the ECS-internal transform, distinct from the wire `MovePayload` and from the
 * Box3D mover — Segment 3 adds the systems that sync it from those owners. For
 * now it is pure data the seed prefabs attach.
 */
export interface Transform {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/**
 * Appearance handle: which visual/model a spawned entity should use, plus a
 * tint. Kept as a plain data descriptor — resolving it to a THREE object is the
 * job of a later rendering bridge, never of the ECS core.
 */
export interface Appearance {
  model: string;
  tint: number;
}

/**
 * The component handles a world exposes for prefab use. Because component types
 * are per-world (each carries its creating world's identity token), a world must
 * register its components once and hand the typed handles to prefabs.
 */
export interface CoreComponents {
  Transform: ComponentType<Transform>;
  Appearance: ComponentType<Appearance>;
}

/**
 * Define the core plain-data components on a world and return their handles.
 * Call once per world; `defineComponent` throws on a duplicate name, so a second
 * call on the same world is a loud error rather than a silent re-register.
 */
export function registerCoreComponents(world: World): CoreComponents {
  return {
    Transform: world.defineComponent<Transform>('Transform'),
    Appearance: world.defineComponent<Appearance>('Appearance'),
  };
}
