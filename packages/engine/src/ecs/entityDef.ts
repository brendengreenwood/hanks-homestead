/** Poses an NPC can rest in. */
export type NpcPose = 'stand' | 'sit';

/**
 * One placeable world entity — the flat schema stored in public/content/entities.json.
 * Every entry is anchored at its ground point (y up); type-specific extras are optional.
 */
export interface EntityDef {
  id: string;
  type: string;
  x: number;
  z: number;
  /** Height offset from the ground (default 0). */
  y?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  /** Houses only. */
  bodyColor?: string;
  roofColor?: string;
  /** Monoliths only: lean angle in radians. */
  tilt?: number;
  /** Creatures only: key into the game's bestiary. */
  creature?: string;
  /** NPCs only: rest pose (default "stand"). */
  pose?: NpcPose;
}
