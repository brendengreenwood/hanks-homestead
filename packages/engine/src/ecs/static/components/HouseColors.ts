/**
 * House-only palette extras from `EntityDef` (`bodyColor`/`roofColor`).
 * Attached only when the source def carries at least one of the fields; each
 * key is present only when the def had it, so canonical round-trips stay exact.
 */
export interface HouseColors {
  bodyColor?: string;
  roofColor?: string;
}
