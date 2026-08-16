import type { World } from '../World';
import type { ComponentType } from '../types';

/* ------------------------------------------------------------------ */
/*  NPC components — pure data, no THREE dependency.                  */
/* ------------------------------------------------------------------ */

/**
 * NPC identity and visual-flag state.
 *
 * `talked` is a MIRRORED visual flag — the source of truth lives in
 * `flags.has('talked:<id>')` inside Game.syncQuestProgress. Nothing in the ECS
 * reads `talked` back into quest logic; it is write-only from Game's perspective.
 */
export type NpcState = {
  defId: string;
  name: string;
  talked: boolean;
  /** Does this NPC sit in place (body frozen, only head tracks the player)? */
  seated: boolean;
};

/**
 * Facing system state: eases the NPC's body yaw toward the player when within
 * `faceRadius`. Seated NPCs never write body yaw — FacingSystem skips them.
 */
export type Facing = {
  /** The NPC's rest yaw (radians) when no player is near. */
  restYaw: number;
  /** Current body yaw (radians). Written by FacingSystem. */
  currentYaw: number;
  /** Radius within which the NPC turns toward the player. */
  faceRadius: number;
  /** Exponential ease rate (units/s). */
  turnRate: number;
};

export interface NpcComponents {
  NpcState: ComponentType<NpcState>;
  Facing: ComponentType<Facing>;
}

/** Register NPC components on a World instance. Call once per world. */
export function registerNpcComponents(world: World): NpcComponents {
  return {
    NpcState: world.defineComponent<NpcState>('NpcState'),
    Facing: world.defineComponent<Facing>('Facing'),
  };
}
