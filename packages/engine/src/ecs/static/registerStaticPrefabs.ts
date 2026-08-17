import type { PrefabRegistry } from '../prefab/PrefabRegistry';
import type { StaticComponents } from './components';
import { createTreePrefab } from './prefabs/treePrefab';
import { createRockPrefab } from './prefabs/rockPrefab';
import { createLampPrefab } from './prefabs/lampPrefab';
import { createHousePrefab } from './prefabs/housePrefab';
import { createWellPrefab } from './prefabs/wellPrefab';
import { createCratePrefab } from './prefabs/cratePrefab';
import { createHutPrefab } from './prefabs/hutPrefab';
import { createFirepitPrefab } from './prefabs/firepitPrefab';
import { createLogPrefab } from './prefabs/logPrefab';
import { createMonolithPrefab } from './prefabs/monolithPrefab';
import { createStumpPrefab } from './prefabs/stumpPrefab';
import { createBookStackPrefab } from './prefabs/bookStackPrefab';
import { createLanternPrefab } from './prefabs/lanternPrefab';

/**
 * Register every static-prop prefab (one per entry in `STATIC_TYPES`) on a
 * registry. The static analogue of the content `RENDERERS` map: prefab names
 * are the `EntityDef.type` strings, so `registry.spawn(world, def.type, ...)`
 * routes a def to its recipe. The completeness test locks this set to
 * `RENDERERS`' non-consumed keys in both directions.
 */
export function registerStaticPrefabs(
  registry: PrefabRegistry,
  components: StaticComponents,
): void {
  registry.register(createTreePrefab(components));
  registry.register(createRockPrefab(components));
  registry.register(createLampPrefab(components));
  registry.register(createHousePrefab(components));
  registry.register(createWellPrefab(components));
  registry.register(createCratePrefab(components));
  registry.register(createHutPrefab(components));
  registry.register(createFirepitPrefab(components));
  registry.register(createLogPrefab(components));
  registry.register(createMonolithPrefab(components));
  registry.register(createStumpPrefab(components));
  registry.register(createBookStackPrefab(components));
  registry.register(createLanternPrefab(components));
}
