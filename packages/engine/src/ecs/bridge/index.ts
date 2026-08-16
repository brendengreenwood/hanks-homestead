// Physics & net bridge: boundary components + sync systems that connect the ECS
// to the Box3D mover (local player) and net snapshots (remote avatars) WITHOUT
// making the ECS authoritative for either.
export type { PhysicsBody, MoverLike, Vec3Like } from './components/PhysicsBody';
export type { NetInterp, NetSnapshot } from './components/NetInterp';
export { runPhysicsSync } from './systems/PhysicsSyncSystem';
export { runNetInterp } from './systems/NetInterpSystem';
export { assertSingleTransformOwner } from './ownership';
export { RENDER_DELAY_MS, SNAPSHOT_MAX } from './netConstants';
