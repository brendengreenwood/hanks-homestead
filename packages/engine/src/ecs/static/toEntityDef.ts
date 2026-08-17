import type { EntityDef } from '../entityDef';
import type { EntityId } from '../types';
import type { World } from '../World';
import type { StaticComponents } from './components';

/**
 * Inverse of the static prefab stamping for one entity, emitting the **canonical**
 * def: fields equal to their defaults (`y === 0`, `rot* === 0`, `scale === 1`,
 * absent extras) are omitted. Canonical defs are consumer-equivalent to
 * explicit-default ones — every consumer reads these fields with `??` defaults
 * (`World.applyTransform` and the builders) — but not byte-equal to a source
 * def that spelled a default out (e.g. `y: 0`).
 *
 * Throws if the entity was not loaded as a static entity (missing the static
 * component set) — a misuse guard, not a content-error path.
 */
export function toEntityDef(
  world: World,
  components: StaticComponents,
  entity: EntityId,
): EntityDef {
  const placement = world.get(entity, components.Placement);
  const kind = world.get(entity, components.EntityKind);
  const layout = world.get(entity, components.LayoutId);
  if (placement === undefined || kind === undefined || layout === undefined) {
    throw new Error('toEntityDef: entity is not a loaded static entity');
  }

  const def: EntityDef = {
    id: layout.id,
    type: kind.type,
    x: placement.x,
    z: placement.z,
  };
  if (placement.y !== 0) def.y = placement.y;
  if (placement.rotX !== 0) def.rotX = placement.rotX;
  if (placement.rotY !== 0) def.rotY = placement.rotY;
  if (placement.rotZ !== 0) def.rotZ = placement.rotZ;
  if (placement.scale !== 1) def.scale = placement.scale;

  const colors = world.get(entity, components.HouseColors);
  if (colors?.bodyColor !== undefined) def.bodyColor = colors.bodyColor;
  if (colors?.roofColor !== undefined) def.roofColor = colors.roofColor;

  const tilt = world.get(entity, components.Tilt);
  if (tilt !== undefined) def.tilt = tilt.tilt;

  return def;
}
