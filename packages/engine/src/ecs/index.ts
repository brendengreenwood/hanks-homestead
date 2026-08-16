// Public surface of the ECS core.
export type { EntityId, ComponentType } from './types';
export { World } from './World';
export { ComponentStore } from './Component';
export {
  makeEntityId,
  entityIndex,
  entityGeneration,
  GENERATION_STRIDE,
} from './Entity';

// Prefab layer.
export * from './prefab';

// Physics & net bridge (seam to Box3D mover + net snapshots).
export * from './bridge';

// Static world-prop layer (EntityDef-backed components, loader, store).
export * from './static';

// The subsystem seam Game uses to talk to the ECS.
export { EcsWorldSystem } from './EcsWorldSystem';
