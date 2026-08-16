import type { Obstacle, WorldBounds } from './worldTypes';
import type { Physics } from './Physics';

/** Tall enough that no jump clears a full-height obstacle (matches the old "blocks at any height"). */
const BLOCKER_HEIGHT = 4;
const WALL_HEIGHT = 3;
const WALL_HALF_THICKNESS = 0.5;

/**
 * Builds the static physics world: a ground slab, four boundary walls whose
 * inner faces sit exactly on the play-area edge, and one collider per gameplay
 * obstacle. Obstacles with a `box` footprint become rotated boxes (houses,
 * huts); obstacles with a `topY` become standable pillars of that height
 * (rocks, stepping stones, stumps); the rest become full-height cylinder
 * blockers, mirroring the old circle-collision behavior.
 */
export function buildStaticColliders(
  physics: Physics,
  obstacles: readonly Obstacle[],
  bounds: WorldBounds,
): void {
  const half = bounds.half;
  const extent = half + WALL_HALF_THICKNESS * 2;

  // Ground slab with its top surface at y = 0.
  physics.addStaticBox(0, -0.5, 0, extent, 0.5, extent);

  // Boundary walls just outside ±half on each axis.
  const center = half + WALL_HALF_THICKNESS;
  const halfHeight = WALL_HEIGHT / 2;
  physics.addStaticBox(0, halfHeight, -center, extent, halfHeight, WALL_HALF_THICKNESS);
  physics.addStaticBox(0, halfHeight, center, extent, halfHeight, WALL_HALF_THICKNESS);
  physics.addStaticBox(-center, halfHeight, 0, WALL_HALF_THICKNESS, halfHeight, extent);
  physics.addStaticBox(center, halfHeight, 0, WALL_HALF_THICKNESS, halfHeight, extent);

  for (const obstacle of obstacles) {
    if (obstacle.box) {
      const { hx, hz, height, rotY } = obstacle.box;
      const rotation = physics.b3.b3MakeQuatFromAxisAngle({ x: 0, y: 1, z: 0 }, rotY);
      physics.addStaticBox(obstacle.x, height / 2, obstacle.z, hx, height / 2, hz, rotation);
    } else {
      const height = obstacle.topY ?? BLOCKER_HEIGHT;
      physics.addStaticCylinder(obstacle.x, obstacle.z, obstacle.radius, height);
    }
  }
}
