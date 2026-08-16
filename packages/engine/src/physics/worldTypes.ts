export type WorldBounds = {
  half: number;
};

export type Obstacle = {
  x: number;
  z: number;
  radius: number;
  /** If set, the obstacle only blocks while the player is below this height (e.g. stepping stones). */
  topY?: number;
  /** If set, the physics collider is this rotated box footprint instead of a cylinder (houses/huts). */
  box?: { hx: number; hz: number; height: number; rotY: number };
};
