/**
 * Static-prop transform: the full placement a world prop needs — position,
 * per-axis rotation, and uniform scale. Mirrors `EntityDef`'s transform fields
 * (src/content/entities.ts) with defaults resolved: `y`/`rot*` default to 0,
 * `scale` to 1.
 *
 * This is deliberately distinct from the player-slice `Transform{x,y,z,yaw}`
 * (src/ecs/prefab/components.ts) — that component is owned by the physics/net
 * sync systems and carries only a facing yaw. Do not merge the two: they have
 * different shapes and different ownership models.
 */
export interface Placement {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}
