import type { World, EntityId, ComponentType } from '../index';
import type { Prefab } from '../prefab/Prefab';
import type { CoreComponents } from '../prefab/components';
import type { NpcState, Facing } from './components';
import type { Oscillator } from '../animation';

const FACE_RADIUS = 5;
const TURN_RATE = 6;

// Idle breathing bob — same constants the original Npc.update used:
// `sin(elapsed * 1.6 + phase) * 0.025`.
const BOB_FREQUENCY = 1.6;
const BOB_AMPLITUDE = 0.025;

/** Per-spawn inputs for the NPC prefab, derived from NpcDef. */
export interface NpcParams {
  defId: string;
  name: string;
  seated: boolean;
  x: number;
  z: number;
  restYaw: number;
}

/**
 * An NPC entity: Transform (authored world position), NpcState (identity/flags),
 * Facing (yaw tracking toward the player), Oscillator (breathing bob).
 */
export function createNpcPrefab(
  components: CoreComponents,
  npcState: ComponentType<NpcState>,
  facing: ComponentType<Facing>,
  oscillator: ComponentType<Oscillator>,
): Prefab<NpcParams> {
  return {
    name: 'npc',
    build(world: World, params?: NpcParams): EntityId {
      if (!params) throw new Error('NPC prefab requires params');
      const entity = world.spawn();
      world.setName(entity, `npc:${params.defId}`);
      world.add(entity, components.Transform, {
        x: params.x,
        y: 0,
        z: params.z,
        yaw: params.restYaw,
      });
      world.add(entity, npcState, {
        defId: params.defId,
        name: params.name,
        talked: false,
        seated: params.seated,
      });
      world.add(entity, facing, {
        restYaw: params.restYaw,
        currentYaw: params.restYaw,
        faceRadius: FACE_RADIUS,
        turnRate: TURN_RATE,
      });
      world.add(entity, oscillator, {
        frequency: BOB_FREQUENCY,
        amplitude: BOB_AMPLITUDE,
        phase: Math.random() * Math.PI * 2,
        offset: 0,
      });
      return entity;
    },
  };
}
