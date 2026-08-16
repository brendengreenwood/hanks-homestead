/**
 * World + camera constants ported from the legacy app.
 * Sources: src/game/constants.js (grid) and src/three/FarmScene.jsx (camera rig).
 * Values are verbatim — the grid and iso framing are part of the shipped look.
 */

/** Grid is WORLD_SIZE × WORLD_SIZE cells; each cell is a 1×1 tile in world units. */
export const WORLD_SIZE = 36;
/** The farm field is FIELD_SIZE × FIELD_SIZE at FIELD_OFFSET within the grid. */
export const FIELD_SIZE = 10;
export const FIELD_OFFSET = 13;

/** Legacy `<OrthographicCamera position={[24, 26, 24]} zoom={26} near={-50} far={200} />`. */
export const CAMERA_POSITION: readonly [number, number, number] = [24, 26, 24];
export const CAMERA_ZOOM = 26;
export const CAMERA_NEAR = -50;
export const CAMERA_FAR = 200;
/** Fixed iso elevation used by the legacy camera rig (ISO_POLAR in FarmScene.jsx). */
export const ISO_POLAR = 0.93;

/** Re-center grid coords on the origin: worldX = gridX - WORLD_SIZE/2 + 0.5. */
export function gridToWorld(gridX: number, gridY: number): [number, number] {
  return [gridX - WORLD_SIZE / 2 + 0.5, gridY - WORLD_SIZE / 2 + 0.5];
}
