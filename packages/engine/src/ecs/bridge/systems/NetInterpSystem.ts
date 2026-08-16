import type { World, ComponentType } from '../../index';
import type { NetInterp, NetSnapshot } from '../components/NetInterp';
import type { Transform } from '../../prefab/components';
import { shortestAngleDiff } from '../../../utils/angles';

/**
 * NetInterpSystem — the **snapshot→Transform** direction of the seam for remote
 * avatars. For every entity with `NetInterp` + `Transform`, sample the snapshot
 * buffer at `renderTime` and write the interpolated result into the ECS
 * Transform. Remote entities never get a mover; this is the sole owner of their
 * Transform.
 *
 * The interpolation mirrors `RemoteAvatar.sample()` in
 * `src/systems/RemotePlayers.ts` (reimplemented against the ECS component, not
 * copied): find the snapshot pair bracketing `renderTime`, lerp position, and
 * take the shortest-arc lerp for yaw (delegated to `shortestAngleDiff` in
 * `src/utils/angles.ts` — a pure-math module with no dependencies, safe to use
 * from the ECS core). Past the newest snapshot it holds the
 * latest rather than extrapolating (sender idle/stalled). The caller supplies
 * `renderTime` already offset by its render delay, matching how `RemoteAvatar`
 * calls `sample(now - RENDER_DELAY_MS)`.
 *
 * Intentional narrowing vs. `sample()`: that function also derives `speed` and
 * `verticalSpeed` to drive remote animation; those are out of scope here. The
 * ECS `Transform` carries only position + yaw, so this system writes exactly
 * those four fields and nothing else.
 *
 * Entities without `NetInterp` are never visited, so physics-driven entities are
 * untouched.
 */
export function runNetInterp(
  world: World,
  netInterp: ComponentType<NetInterp>,
  transform: ComponentType<Transform>,
  renderTime: number,
): void {
  for (const entity of world.query(netInterp, transform)) {
    const interp = world.get(entity, netInterp)!;
    const snapshots = interp.snapshots;
    if (snapshots.length === 0) continue; // no data yet — leave Transform as-is

    const xf = world.get(entity, transform)!;
    writeSample(snapshots, renderTime, xf);
  }
}

/**
 * Lerp position and shortest-arc yaw between the snapshots bracketing
 * `renderTime`, writing into `xf`. Mirrors `RemoteAvatar.sample()`.
 */
function writeSample(snapshots: NetSnapshot[], renderTime: number, xf: Transform): void {
  // Default to the oldest snapshot (covers renderTime before the first).
  let older = snapshots[0];
  let newer: NetSnapshot | null = null;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].t <= renderTime) {
      older = snapshots[i];
      newer = snapshots[i + 1] ?? null;
      break;
    }
  }

  // Past the newest snapshot (or a single snapshot): hold, don't extrapolate.
  // The `newer.t <= older.t` clause also defends the divide below against a
  // zero/negative dt. With the ascending-`t` contract it is unreachable via the
  // reverse scan (which always matches the highest index with t<=renderTime, so
  // a same-`t` successor would have been matched first) — it exists only as a
  // faithful mirror of `RemoteAvatar.sample()` and a guard against malformed
  // out-of-order input. Deliberately untested: no valid input reaches it.
  if (!newer || newer.t <= older.t) {
    xf.x = older.x;
    xf.y = older.y;
    xf.z = older.z;
    xf.yaw = older.yaw;
    return;
  }

  const t = clamp01((renderTime - older.t) / (newer.t - older.t));
  const yawDiff = shortestAngleDiff(older.yaw, newer.yaw);
  xf.x = lerp(older.x, newer.x, t);
  xf.y = lerp(older.y, newer.y, t);
  xf.z = lerp(older.z, newer.z, t);
  xf.yaw = older.yaw + yawDiff * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
