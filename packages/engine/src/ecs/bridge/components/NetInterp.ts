/**
 * NetInterp — the boundary between an ECS entity and the net layer's snapshot
 * stream for a *remote* avatar. Remote avatars have no mover and no physics
 * (see `RemoteAvatar` in `src/systems/RemotePlayers.ts`); their Transform is
 * derived by interpolating buffered wire snapshots. This component holds that
 * interpolation state; `NetInterpSystem` reads it and writes the entity's
 * Transform.
 *
 * The bridge *consumes* the wire shape, it does not define the protocol. The
 * fields mirror the on-wire `MovePayload {x,y,z,yaw,speed}` plus a receive
 * timestamp `t` — the exact `Snapshot` shape `RemoteAvatar` buffers. This file
 * declares that shape locally (as read-only data) rather than importing the net
 * layer, keeping the bridge free of any net-client dependency and unit-testable.
 */

/**
 * One buffered wire keyframe: the `MovePayload` fields plus the receive time
 * `t` (ms, same clock the render time is measured against). Read-only — the
 * bridge never mutates snapshots it was handed.
 */
export interface NetSnapshot {
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly speed: number;
}

/**
 * The component: the snapshot buffer for a remote entity, ordered oldest→newest
 * by strictly ascending `t`. `NetInterpSystem` samples this at `renderTime` to
 * produce the derived Transform. The buffer is owned by whoever ingests the net
 * stream; the bridge only reads it.
 *
 * Ordering contract: `NetInterpSystem` relies on `t` being non-descending (the
 * `RemoteAvatar.buffer()` precedent only ever `push`es monotonically increasing
 * receive times). Out-of-order insertion would make the bracket search pick a
 * wrong pair — ingesters must preserve ascending `t`.
 */
export interface NetInterp {
  readonly snapshots: NetSnapshot[];
}
