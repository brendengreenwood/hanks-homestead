/**
 * The entity types the static ECS layer owns: every renderable world prop from
 * `RENDERERS` (src/game/renderers.ts) minus the game-consumed types
 * (`npc` — characters, handled by Game, not World).
 *
 * This is the ECS's own list — production code here never imports the
 * renderer registry. The completeness test in
 * `prefabs/staticPrefabs.unit.test.ts` locks the two lists together in both
 * directions, so adding a new prop type means three edits or a red test:
 * a renderer entry, a prefab file (registered in `registerStaticPrefabs`),
 * and an entry in this list.
 */
export const STATIC_TYPES = [
  'tree',
  'rock',
  'lamp',
  'house',
  'well',
  'crate',
  'hut',
  'firepit',
  'log',
  'monolith',
  'stump',
  'bookStack',
  'lantern',
] as const;

export type StaticType = (typeof STATIC_TYPES)[number];
