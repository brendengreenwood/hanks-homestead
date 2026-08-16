import type { World, ComponentType } from '../../index';
import type { Oscillator } from '../components';

/**
 * Advance all oscillators: `offset = sin(elapsed * frequency + phase) * amplitude`.
 *
 * `offset` is a pure function of `elapsed` — no state accumulates between
 * calls, so the system is idempotent within a frame and safe to call from
 * any update path (play and customize) any number of times.
 */
export function runOscillator(
  world: World,
  oscillatorType: ComponentType<Oscillator>,
  elapsed: number,
): void {
  for (const entity of world.query(oscillatorType)) {
    const osc = world.get(entity, oscillatorType)!;
    osc.offset = Math.sin(elapsed * osc.frequency + osc.phase) * osc.amplitude;
  }
}
