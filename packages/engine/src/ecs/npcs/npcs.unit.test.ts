import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { registerCoreComponents } from '../prefab/components';
import { registerNpcComponents } from './components';
import { createNpcPrefab, type NpcParams } from './npcPrefab';
import { runFacing } from './systems/FacingSystem';
import { normalizeAngle, yawFromDirection } from '../../utils/angles';
import { registerAnimationComponents } from '../animation';

function setup() {
  const world = new World();
  const core = registerCoreComponents(world);
  const npc = registerNpcComponents(world);
  const anim = registerAnimationComponents(world);
  const prefab = createNpcPrefab(core, npc.NpcState, npc.Facing, anim.Oscillator);
  return { world, core, npc, anim, prefab };
}

const DEF: NpcParams = {
  defId: 'mayor',
  name: 'Mayor Oak',
  seated: false,
  x: 10,
  z: 20,
  restYaw: 0,
};

describe('NPC prefab', () => {
  it('spawns an entity with Transform, NpcState, Facing, Oscillator', () => {
    const { world, core, npc, anim, prefab } = setup();
    const entity = prefab.build(world, DEF);
    expect(world.has(entity, core.Transform)).toBe(true);
    expect(world.has(entity, npc.NpcState)).toBe(true);
    expect(world.has(entity, npc.Facing)).toBe(true);
    expect(world.has(entity, anim.Oscillator)).toBe(true);
  });

  it('seeds the breathing oscillator with the idle-bob constants', () => {
    const { world, anim, prefab } = setup();
    const entity = prefab.build(world, DEF);
    const osc = world.get(entity, anim.Oscillator)!;
    expect(osc.frequency).toBe(1.6);
    expect(osc.amplitude).toBe(0.025);
    expect(osc.phase).toBeGreaterThanOrEqual(0);
    expect(osc.phase).toBeLessThan(Math.PI * 2);
    expect(osc.offset).toBe(0);
  });

  it('seeds Transform from def position', () => {
    const { world, core, prefab } = setup();
    const entity = prefab.build(world, DEF);
    const t = world.get(entity, core.Transform)!;
    expect(t.x).toBe(10);
    expect(t.z).toBe(20);
    expect(t.y).toBe(0);
    expect(t.yaw).toBe(0);
  });

  it('names the entity npc:<defId>', () => {
    const { world, prefab } = setup();
    const entity = prefab.build(world, DEF);
    expect(world.findByName(`npc:${DEF.defId}`)).toBe(entity);
  });

  it('stores seated flag on NpcState', () => {
    const { world, npc, prefab } = setup();
    const entity = prefab.build(world, { ...DEF, seated: true });
    expect(world.get(entity, npc.NpcState)!.seated).toBe(true);
  });

  it('throws without params', () => {
    const { world, prefab } = setup();
    expect(() => prefab.build(world)).toThrow('NPC prefab requires params');
  });
});

describe('FacingSystem', () => {
  it('turns the model FRONT (+Z) toward a player east of the NPC — signed', () => {
    const { world, core, npc, prefab } = setup();
    const entity = prefab.build(world, { ...DEF, restYaw: 0 });
    const t = world.get(entity, core.Transform)!;

    // Player east of NPC: NPC (10, 20), player (12, 20) → (dx, dz) = (2, 0).
    // Front convention (front = +Z): target = yawFromDirection(2, 0) = +π/2.
    // A flipped convention converges to −π/2 — the NPC's back.
    expect(yawFromDirection(2, 0)).toBeCloseTo(Math.PI / 2, 12);
    for (let i = 0; i < 100; i++) {
      runFacing(world, core.Transform, npc.NpcState, npc.Facing, 12, 20, 0.016);
    }
    expect(t.yaw).toBeGreaterThan(0); // signed: −π/2 (a flipped sign) fails here
    expect(t.yaw).toBeCloseTo(Math.PI / 2, 1);
  });

  it('turns a half revolution for a player at −Z (behind the model front)', () => {
    const { world, core, npc, prefab } = setup();
    const entity = prefab.build(world, { ...DEF, restYaw: 0 });
    const t = world.get(entity, core.Transform)!;

    // Player at (10, 18): (dx, dz) = (0, −2) → target yawFromDirection(0, −2) = ±π.
    // On a flipped convention the target is 0 (no turn at all).
    for (let i = 0; i < 200; i++) {
      runFacing(world, core.Transform, npc.NpcState, npc.Facing, 10, 18, 0.016);
    }
    expect(Math.abs(normalizeAngle(t.yaw))).toBeCloseTo(Math.PI, 1);
  });

  it('returns to rest yaw when player is outside faceRadius', () => {
    const { world, core, npc, prefab } = setup();
    prefab.build(world, { ...DEF, restYaw: Math.PI / 4 });

    // Player far away at (100, 100)
    for (let i = 0; i < 100; i++) {
      runFacing(world, core.Transform, npc.NpcState, npc.Facing, 100, 100, 0.016);
    }
    const t = [...world.query(core.Transform)].map(e => world.get(e, core.Transform)!)[0];
    expect(t.yaw).toBeCloseTo(Math.PI / 4, 1);
  });

  it('skips seated NPCs — body stays at rest yaw', () => {
    const { world, core, npc, prefab } = setup();
    const entity = prefab.build(world, { ...DEF, seated: true, restYaw: 1.0 });
    const t = world.get(entity, core.Transform)!;

    // Player very close
    runFacing(world, core.Transform, npc.NpcState, npc.Facing, 10.5, 20, 0.1);
    // Body yaw should NOT change for seated NPC
    expect(t.yaw).toBe(1.0);
  });
});
