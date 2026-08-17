import { World } from './World';
import type { EntityId, ComponentType } from './types';
import { PrefabRegistry } from './prefab/PrefabRegistry';
import { registerCoreComponents, type CoreComponents, type Transform } from './prefab/components';
import { runPhysicsSync } from './bridge/systems/PhysicsSyncSystem';
import { runNetInterp } from './bridge/systems/NetInterpSystem';
import type { PhysicsBody, MoverLike } from './bridge/components/PhysicsBody';
import type { NetInterp, NetSnapshot } from './bridge/components/NetInterp';
import { RENDER_DELAY_MS, SNAPSHOT_MAX } from './bridge/netConstants';
import { createPlayerPrefab } from './prefab/prefabs/playerPrefab';
import { createRemotePlayerPrefab } from './prefab/prefabs/remotePlayerPrefab';
import type { EntityDef } from './entityDef';

/**
 * The spawn subset of an NPC content def — the only fields loadNpcs consumes.
 * The game's full NpcDef (appearance palette, dialogue graph, …) stays
 * game-side and satisfies this structurally.
 */
export interface NpcSpawnDef {
  id: string;
  name: string;
  /** Sits in place (on a log etc.): body stays put, only the head tracks the player. */
  seated: boolean;
  position: readonly [number, number];
  /** Rest facing (radians), from the layout. */
  restYaw: number;
}
import { StaticEntityStore } from './static/StaticEntityStore';
import { STATIC_TYPES } from './static/STATIC_TYPES';
import { deriveWorldDefs } from './static/deriveWorldDefs';
import {
  createEmoteSelect,
  runEmoteSelect,
  type EmoteSelect,
  type EmoteSelectCommands,
  type EmoteSelectInput,
} from './emote/EmoteSelectSystem';
import type { EmoteKind } from './emote/emoteTypes';
import {
  registerNpcComponents,
  createNpcPrefab,
  runFacing,
  type NpcComponents,
  type NpcState,
  type Facing,
} from './npcs';
import {
  registerAnimationComponents,
  runOscillator,
  runSpin,
  type AnimationComponents,
  type AnimationState,
} from './animation';

const STATIC_TYPE_SET: ReadonlySet<string> = new Set(STATIC_TYPES);

/**
 * EcsWorldSystem — the single seam through which `Game` talks to the ECS.
 *
 * It owns one `World`, registers the components the player slice needs
 * (`Transform`, `Appearance` via the core set, plus the bridge `PhysicsBody`),
 * registers and spawns the local-player prefab, and exposes `update(dt)` which
 * runs the bridge sync systems. `Game` holds exactly one field of this type and
 * calls `update` once per frame *after* the player's own `update()`/`solve()`
 * has advanced the authoritative mover — so the Transform mirrors the freshly
 * solved position.
 *
 * Remote players: each remote avatar gets an ECS entity carrying Transform +
 * NetInterp. `spawnRemote` / `despawnRemote` manage the lifecycle; `pushSnapshot`
 * feeds wire data into the interpolation buffer; `update()` runs `runNetInterp`
 * so every remote entity's Transform mirrors its interpolated wire position.
 *
 * The ECS does not swallow `Game`: game-feel, rendering, camera, and net all
 * stay where they are. This subsystem only maintains the ECS-side mirror and is
 * the anchor point future entity adoption would grow from.
 */
export class EcsWorldSystem {
  readonly world = new World();
  private readonly registry = new PrefabRegistry();
  private readonly components: CoreComponents;
  private readonly physicsBody: ComponentType<PhysicsBody>;
  private readonly emoteSelectType: ComponentType<EmoteSelect>;
  private readonly netInterp: ComponentType<NetInterp>;
  private readonly npcComponents: NpcComponents;
  private readonly animationComponents: AnimationComponents;
  private readonly _player: EntityId;
  /** Remote avatar entities keyed by their net-layer peer id. */
  private readonly remoteEntities = new Map<string, EntityId>();
  /** NPC entities keyed by their content def id. */
  private readonly npcEntities = new Map<string, EntityId>();
  /** Static world props live in their own store (standalone by design). */
  private readonly statics = new StaticEntityStore();
  /** Cached diagnostics probe (immutable after `loadStatic`). */
  private probe: { id: string; type: string; x: number; z: number } | null = null;

  constructor(playerMover: MoverLike) {
    this.components = registerCoreComponents(this.world);
    this.physicsBody = this.world.defineComponent<PhysicsBody>('PhysicsBody');
    this.netInterp = this.world.defineComponent<NetInterp>('NetInterp');
    this.npcComponents = registerNpcComponents(this.world);
    this.animationComponents = registerAnimationComponents(this.world);
    this.registry.register(createPlayerPrefab(this.components, this.physicsBody));
    this.registry.register(createRemotePlayerPrefab(this.components, this.netInterp));
    this.registry.register(createNpcPrefab(
      this.components,
      this.npcComponents.NpcState,
      this.npcComponents.Facing,
      this.animationComponents.Oscillator,
    ));
    this._player = this.registry.spawn(this.world, 'player', { mover: playerMover });
    // Emote select is a local-player orchestration concern layered on after
    // spawn — not part of the shared player prefab recipe.
    this.emoteSelectType = this.world.defineComponent<EmoteSelect>('EmoteSelect');
    this.world.add(this._player, this.emoteSelectType, createEmoteSelect());
  }

  /** The local-player entity id (spawned from the player prefab at construction). */
  get player(): EntityId {
    return this._player;
  }

  /**
   * Adopt a renderer-owned AnimationState onto an entity (post-spawn, like
   * EmoteSelect — not part of the prefab recipe). The renderer keeps stepping
   * the same object reference; the world gains it as a queryable component.
   */
  attachAnimationState(entity: EntityId, state: AnimationState): void {
    this.world.add(entity, this.animationComponents.AnimationState, state);
  }

  /** The Transform component handle, for callers that read the player's mirror. */
  get transform(): ComponentType<Transform> {
    return this.components.Transform;
  }

  // ---- remote player lifecycle ---------------------------------------------

  /**
   * Spawn an ECS entity for a remote avatar. Returns the entity id. Throws if
   * the peer id already has a live entity (double-spawn is an integration bug).
   */
  spawnRemote(peerId: string, x = 0, y = 0, z = 0, yaw = 0): EntityId {
    if (this.remoteEntities.has(peerId)) {
      throw new Error(`remote entity for peer "${peerId}" already exists`);
    }
    const entity = this.registry.spawn(this.world, 'remotePlayer', { x, y, z, yaw });
    this.world.setName(entity, `remote:${peerId}`);
    this.remoteEntities.set(peerId, entity);
    return entity;
  }

  /**
   * Despawn a remote avatar's ECS entity. No-op if no entity exists for the
   * given peer (the net layer may fire remove before the ECS saw an add).
   */
  despawnRemote(peerId: string): void {
    const entity = this.remoteEntities.get(peerId);
    if (entity === undefined) return;
    this.world.despawn(entity);
    this.remoteEntities.delete(peerId);
  }

  /**
   * Push a wire snapshot into a remote avatar's interpolation buffer. Maintains
   * the ascending-t contract and caps the buffer at `SNAPSHOT_MAX`.
   */
  pushSnapshot(peerId: string, snap: NetSnapshot): void {
    const entity = this.remoteEntities.get(peerId);
    if (entity === undefined) return; // silently ignore if entity not yet spawned
    const interp = this.world.get(entity, this.netInterp);
    if (!interp) return;
    const buf = interp.snapshots;
    buf.push(snap);
    if (buf.length > SNAPSHOT_MAX) buf.shift();
  }

  /** Whether a remote entity exists for this peer. */
  hasRemote(peerId: string): boolean {
    return this.remoteEntities.has(peerId);
  }

  /** The remote entity id for a peer, or undefined. */
  remoteEntity(peerId: string): EntityId | undefined {
    return this.remoteEntities.get(peerId);
  }

  /** Number of live remote entities. */
  get remoteCount(): number {
    return this.remoteEntities.size;
  }

  /** Read the ECS Transform for a remote peer (for render / diagnostics). */
  remoteTransform(peerId: string): Transform | null {
    const entity = this.remoteEntities.get(peerId);
    if (entity === undefined) return null;
    return this.world.get(entity, this.components.Transform) ?? null;
  }

  /** Snapshot of all remote Transforms for diagnostics. */
  remoteTransforms(): Array<{ id: string; x: number; y: number; z: number; yaw: number }> {
    const result: Array<{ id: string; x: number; y: number; z: number; yaw: number }> = [];
    for (const [peerId, entity] of this.remoteEntities) {
      const xf = this.world.get(entity, this.components.Transform);
      if (xf) result.push({ id: peerId, x: xf.x, y: xf.y, z: xf.z, yaw: xf.yaw });
    }
    return result;
  }

  // ---- NPC lifecycle -------------------------------------------------------

  /**
   * Spawn NPC entities from content defs. Each NPC gets an ECS entity with
   * Transform, NpcState, Facing, and Oscillator components. Call once on scene load.
   *
   * Typed against the structural spawn subset (NpcSpawnDef) rather than the
   * game's full NpcDef — the full def carries game-side appearance/dialogue
   * types the engine must not import; any NpcDef satisfies this subset.
   */
  loadNpcs(defs: readonly NpcSpawnDef[]): void {
    for (const def of defs) {
      const entity = this.registry.spawn(this.world, 'npc', {
        defId: def.id,
        name: def.name,
        seated: def.seated,
        x: def.position[0],
        z: def.position[1],
        restYaw: def.restYaw,
      });
      this.npcEntities.set(def.id, entity);
    }
  }

  /**
   * Read NPC state by content def id — for interaction, dialogue, diagnostics.
   * Returns Transform + NpcState or null if the NPC doesn't exist.
   */
  npcByDefId(defId: string): { transform: Transform; state: NpcState; facing: Facing; bobOffset: number } | null {
    const entity = this.npcEntities.get(defId);
    if (entity === undefined) return null;
    const transform = this.world.get(entity, this.components.Transform);
    const state = this.world.get(entity, this.npcComponents.NpcState);
    const facing = this.world.get(entity, this.npcComponents.Facing);
    const osc = this.world.get(entity, this.animationComponents.Oscillator);
    if (!transform || !state || !facing || !osc) return null;
    return { transform, state, facing, bobOffset: osc.offset };
  }

  /**
   * Write the talked mirror flag on an NPC. Called only by Game.syncQuestProgress.
   * The source of truth is `flags.has('talked:<id>')` — this is a one-way mirror.
   */
  setNpcTalked(defId: string, talked: boolean): void {
    const entity = this.npcEntities.get(defId);
    if (entity === undefined) return;
    const state = this.world.get(entity, this.npcComponents.NpcState);
    if (state) state.talked = talked;
  }

  /** Number of loaded NPC entities. */
  npcCount(): number {
    return this.npcEntities.size;
  }

  /**
   * Per-NPC yaw snapshot for diagnostics/tests: def id, ECS transform position,
   * current body yaw, and whether the NPC is seated (seated bodies never turn).
   * Read-only and serializable — no gameplay dependency.
   */
  npcYaws(): Array<{ defId: string; x: number; z: number; yaw: number; seated: boolean }> {
    const out: Array<{ defId: string; x: number; z: number; yaw: number; seated: boolean }> = [];
    for (const [defId, entity] of this.npcEntities) {
      const t = this.world.get(entity, this.components.Transform);
      const state = this.world.get(entity, this.npcComponents.NpcState);
      if (!t || !state) continue;
      out.push({ defId, x: t.x, z: t.z, yaw: t.yaw, seated: state.seated });
    }
    return out;
  }

  /** Count of NPCs whose talked mirror flag is true. */
  talkedCount(): number {
    let count = 0;
    for (const entity of this.npcEntities.values()) {
      const state = this.world.get(entity, this.npcComponents.NpcState);
      if (state?.talked) count += 1;
    }
    return count;
  }

  /**
   * Find the nearest NPC within `maxDistance` of the given position.
   * Returns the def id and distance, or null if none in range.
   */
  findNearestNpc(px: number, pz: number, maxDistance: number): { defId: string; distance: number } | null {
    let best: { defId: string; distance: number } | null = null;
    for (const [defId, entity] of this.npcEntities) {
      const t = this.world.get(entity, this.components.Transform);
      if (!t) continue;
      const dx = px - t.x;
      const dz = pz - t.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < maxDistance && (!best || dist < best.distance)) {
        best = { defId, distance: dist };
      }
    }
    return best;
  }

  /** Iterator over all NPC def ids + their ECS state, for the render loop. */
  *npcEntries(): IterableIterator<{ defId: string; transform: Transform; state: NpcState; bobOffset: number }> {
    for (const [defId, entity] of this.npcEntities) {
      const transform = this.world.get(entity, this.components.Transform);
      const state = this.world.get(entity, this.npcComponents.NpcState);
      const osc = this.world.get(entity, this.animationComponents.Oscillator);
      if (transform && state && osc) yield { defId, transform, state, bobOffset: osc.offset };
    }
  }

  /**
   * Tick behavior animations: NPC facing plus ALL oscillators and spins (NPC
   * breathing bob — one call each drives every
   * carrier). Oscillator and Spin are both pure functions of elapsed, so this
   * is idempotent and safe to run from ANY update path (exploring, talking,
   * customizing) — animations never pause; modes gate input, not visuals (#75).
   */
  tickBehaviorAnimations(delta: number, elapsed: number, playerX: number, playerZ: number): void {
    runFacing(
      this.world,
      this.components.Transform,
      this.npcComponents.NpcState,
      this.npcComponents.Facing,
      playerX,
      playerZ,
      delta,
    );
    runOscillator(this.world, this.animationComponents.Oscillator, elapsed);
    runSpin(this.world, this.animationComponents.Spin, elapsed);
  }

  // ---- per-frame update ---------------------------------------------------

  /**
   * Advance the ECS one frame. Runs:
   * 1. physics→Transform sync (local player mover → Transform mirror)
   * 2. net-interp→Transform sync (remote snapshot buffer → Transform mirror)
   *
   * `now` is the current performance.now() timestamp in ms — used by
   * `runNetInterp` to compute `renderTime = now - RENDER_DELAY_MS`.
   * Call this after the player's `update()` so the mirror reflects the
   * current frame.
   */
  update(_dt: number, now?: number): void {
    runPhysicsSync(this.world, this.physicsBody, this.components.Transform);
    if (now !== undefined) {
      const renderTime = now - RENDER_DELAY_MS;
      runNetInterp(this.world, this.netInterp, this.components.Transform, renderTime);
    }
  }

  /**
   * Step the emote-select arbitration with this frame's input snapshot and
   * return the effect commands for the caller to apply. When the commands say
   * `opened`, the caller must apply the open effects (open the DOM wheel,
   * re-snap the input origin) and call this again in the same frame with fresh
   * inputs — that second step arbitrates (see EmoteSelectCommands.opened).
   */
  updateEmoteSelect(input: EmoteSelectInput): EmoteSelectCommands {
    return runEmoteSelect(this.world, this.emoteSelectType, input);
  }

  /** The currently-highlighted emote wedge, from the player's component. */
  emoteHighlight(): EmoteKind | null {
    return this.world.get(this._player, this.emoteSelectType)!.highlighted;
  }

  /**
   * Force-close the emote-select state without picking (the pause path).
   * Keeps the component in lockstep when the caller closes the DOM wheel
   * out-of-band.
   */
  cancelEmoteSelect(): void {
    const state = this.world.get(this._player, this.emoteSelectType)!;
    state.wheelOpen = false;
    state.highlighted = null;
  }

  /** Read the local player's current mirrored Transform (derived, not authoritative). */
  playerTransform(): Transform {
    // The player entity always carries a Transform (attached at spawn), so this
    // is non-null by construction.
    return this.world.get(this._player, this.components.Transform)!;
  }

  /** Whether the player entity carries a PhysicsBody (the mover handle). */
  playerHasPhysicsBody(): boolean {
    return this.world.has(this._player, this.physicsBody);
  }

  /** Whether the player entity carries a Transform (the derived mirror). */
  playerHasTransform(): boolean {
    return this.world.has(this._player, this.components.Transform);
  }

  /**
   * Load the static world props from a content layout. Filters to
   * `STATIC_TYPES` — consumed types (coin/item/npc) and unknown types are the
   * caller's concern and pass through `worldDefs` untouched. Call once, before
   * `worldDefs`.
   */
  loadStatic(defs: readonly EntityDef[]): void {
    const staticDefs = defs.filter((def) => STATIC_TYPE_SET.has(def.type));
    this.statics.load(staticDefs);
    // Cache the diagnostics probe now — the store is immutable after load, and
    // staticProbe() is read every few frames (canonicalizing per read is waste).
    const first = staticDefs.length > 0 ? this.statics.defOf(staticDefs[0].id) : undefined;
    this.probe =
      first === undefined
        ? null
        : { id: first.id, type: first.type, x: first.x, z: first.z };
  }

  /**
   * The `EntityDef[]` World should consume: static defs replaced by their
   * ECS-derived canonical form (matched by id, original order preserved),
   * everything else passed through byte-identical.
   */
  worldDefs(defs: readonly EntityDef[]): EntityDef[] {
    return deriveWorldDefs(defs, this.statics);
  }

  /** Number of loaded static entities (0 before `loadStatic`). */
  staticCount(): number {
    return this.statics.count;
  }

  /** The first loaded static entity's identity + position, for diagnostics. */
  staticProbe(): { id: string; type: string; x: number; z: number } | null {
    return this.probe;
  }
}
