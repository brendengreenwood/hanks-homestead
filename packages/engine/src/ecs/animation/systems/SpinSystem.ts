import type { World, ComponentType } from '../../index';
import type { Spin } from '../components';

const TWO_PI = Math.PI * 2;

/**
 * Set all spin angles: `angle = (elapsed * speed) % 2π`.
 *
 * Pure in elapsed — calling twice with the same elapsed writes the same
 * angle, so this can tick from any update path (exploring, customizing)
 * without drift. Wrapped to [0, 2π) so long sessions keep float precision.
 */
export function runSpin(
  world: World,
  spinType: ComponentType<Spin>,
  elapsed: number,
): void {
  for (const entity of world.query(spinType)) {
    const spin = world.get(entity, spinType)!;
    spin.angle = (elapsed * spin.speed) % TWO_PI;
  }
}
