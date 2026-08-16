// Public surface of the ECS prefab layer.
export type { Prefab } from './Prefab';
export { PrefabRegistry } from './PrefabRegistry';
export type {
  Transform,
  Appearance,
  CoreComponents,
} from './components';
export { registerCoreComponents } from './components';
export type { MarkerParams } from './prefabs/markerPrefab';
export { createMarkerPrefab } from './prefabs/markerPrefab';
export type { SpawnPointParams } from './prefabs/spawnPointPrefab';
export { createSpawnPointPrefab } from './prefabs/spawnPointPrefab';
export type { PlayerParams } from './prefabs/playerPrefab';
export { createPlayerPrefab } from './prefabs/playerPrefab';
export type { RemotePlayerParams } from './prefabs/remotePlayerPrefab';
export { createRemotePlayerPrefab } from './prefabs/remotePlayerPrefab';
