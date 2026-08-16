/**
 * The `EntityDef.type` discriminant for a static prop (e.g. 'tree', 'rock',
 * 'house'). Which builder renders a kind stays the game layer's business
 * (src/game/renderers.ts); the ECS only carries the tag.
 */
export interface EntityKind {
  type: string;
}
