/**
 * Shared constants for the net-interpolation bridge. Single source of truth —
 * `RemotePlayers.ts` and `EcsWorldSystem` both import from here instead of
 * defining their own copies.
 */

/**
 * Remote avatars render this far in the past (ms), interpolating between the
 * two buffered snapshots that bracket the render time. Slightly more than one
 * server patch interval (100 ms) so there is almost always a bracket pair.
 */
export const RENDER_DELAY_MS = 120;

/**
 * Maximum snapshot buffer length. ~3 s of history at the 10 Hz send rate —
 * plenty for the 120 ms render delay.
 */
export const SNAPSHOT_MAX = 32;
