/**
 * The layout id from `entities.json` (`EntityDef.id`). Matches the
 * `userData.layoutId` that World stamps onto every placed scene object
 * (src/game/World.ts, applyTransform), so an ECS entity and its rendered
 * counterpart can be correlated.
 */
export interface LayoutId {
  id: string;
}
