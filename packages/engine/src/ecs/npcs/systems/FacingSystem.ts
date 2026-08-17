import type { World, ComponentType } from '../../index';
import type { Transform } from '../../prefab/components';
import type { NpcState, Facing } from '../components';
import { shortestAngleDiff, yawFromDirection } from '../../../utils/angles';

/**
 * Facing system: eases NPC body yaw toward the player when within faceRadius.
 *
 * Character models are built front = +Z (glTF / lookAt standard), and the
 * target yaw must come from `yawFromDirection` (utils/angles) — it owns the
 * front convention. Never re-derive the atan2 here: a hand-rolled sign flip
 * is exactly how NPCs shipped facing away from the player (#68).
 *
 * Seated NPCs are SKIPPED — their body stays fixed at restYaw. The Npc renderer
 * handles seated head-look independently (clamped to ±1.1 rad ≈ 63° per Npc.ts:101).
 */
export function runFacing(
  world: World,
  transform: ComponentType<Transform>,
  npcState: ComponentType<NpcState>,
  facing: ComponentType<Facing>,
  playerX: number,
  playerZ: number,
  delta: number,
): void {
  for (const entity of world.query(transform, npcState, facing)) {
    const st = world.get(entity, npcState)!;
    const f = world.get(entity, facing)!;
    const t = world.get(entity, transform)!;

    // Seated NPCs: body stays still; only head tracks (renderer's job).
    if (st.seated) continue;

    const dx = playerX - t.x;
    const dz = playerZ - t.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let targetYaw = f.restYaw;
    if (dist < f.faceRadius) {
      targetYaw = yawFromDirection(dx, dz);
    }

    const diff = shortestAngleDiff(f.currentYaw, targetYaw);
    f.currentYaw += diff * (1 - Math.exp(-f.turnRate * delta));
    t.yaw = f.currentYaw;
  }
}
