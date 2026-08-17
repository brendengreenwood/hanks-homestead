import type {
  Box3DModule,
  b3BodyId,
  b3CollisionPlane,
  b3HullData,
  b3Quat,
  b3QueryFilter,
  b3ShapeId,
  b3Vec3,
  b3WorldId,
  PlaneResultBuffer,
} from 'box3d.js';
import Box3D from 'box3d.js/inline';
import type * as THREE from 'three';

const FIXED_STEP = 1 / 60;
const SUB_STEPS = 4;
/** Cap the accumulator so a long hitch doesn't cascade into a spiral of steps. */
const MAX_ACCUMULATED = FIXED_STEP * 4;

const MOVER_ITERATIONS = 5;
const MOVER_TOLERANCE = 0.01;
/**
 * Fastest a mover push may get a dynamic body moving (m/s along the contact
 * normal). Without a cap the push cancels the full relative velocity every
 * render frame, so walking into a crate flings it at player speed or faster.
 */
const MAX_PUSH_SPEED = 1.8;
/** FLT_MAX: treat collision planes as rigid (no pushing through them). */
const PUSH_LIMIT = 3.4e38;
const CYLINDER_SIDES = 12;

export type MoverDef = {
  radius: number;
  /** Capsule sphere centers along +Y, relative to the mover's feet origin. */
  bottomY: number;
  topY: number;
};

/**
 * Kinematic capsule character driven by Box3D's mover API
 * (b3World_CollideMover → b3SolvePlanes → b3World_CastMover), following
 * box3d.js's port of Box3D's CharacterMover sample.
 *
 * The caller owns game-feel: acceleration, friction, gravity and jump
 * impulses are applied to `velocity` before calling `solve`. The mover owns
 * position resolution: sliding along walls, stepping onto low ledges, and a
 * spring "pogo" ride that keeps the feet glued to the ground.
 */
export class CharacterMover {
  readonly position: b3Vec3 = { x: 0, y: 0, z: 0 };
  velocity: b3Vec3 = { x: 0, y: 0, z: 0 };
  grounded = false;

  private pogoVelocity = 0;
  private readonly capsule: { center1: b3Vec3; center2: b3Vec3; radius: number };
  private readonly pogoRest: number;

  constructor(
    private readonly b3: Box3DModule,
    private readonly world: b3WorldId,
    private readonly filter: b3QueryFilter,
    def: MoverDef,
  ) {
    this.capsule = {
      center1: { x: 0, y: def.bottomY, z: 0 },
      center2: { x: 0, y: def.topY, z: 0 },
      radius: def.radius,
    };
    // Suspension rest length: bottom sphere center sits def.bottomY above the
    // ground, which puts the feet origin exactly on the ground surface.
    this.pogoRest = def.bottomY;
  }

  teleport(x: number, y: number, z: number): void {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.pogoVelocity = 0;
    this.grounded = true;
  }

  /** Resolves one frame of movement; reads and rewrites position/velocity/grounded. */
  solve(dt: number): void {
    const { b3, world, filter, capsule } = this;
    const position = this.position;
    const velocity = this.velocity;

    // Pogo ray for ground stick. Only engage when settled or descending — while
    // rising from a jump we stay airborne so the spring doesn't yank us down.
    const rayLength = this.pogoRest + capsule.radius;
    const ray = b3.b3World_CastRayClosest(
      world,
      { x: position.x + capsule.center1.x, y: position.y + capsule.center1.y, z: position.z + capsule.center1.z },
      { x: 0, y: -rayLength, z: 0 },
      filter,
    );
    if (ray.hit && velocity.y <= 0.1) {
      this.grounded = true;
      const currentLength = ray.fraction * rayLength;
      const zeta = 0.7;
      const hertz = 8;
      const omega = 2 * Math.PI * hertz;
      const omegaH = omega * dt;
      this.pogoVelocity =
        (this.pogoVelocity - omega * omegaH * (currentLength - this.pogoRest)) /
        (1 + 2 * zeta * omegaH + omegaH * omegaH);
    } else {
      this.grounded = false;
      this.pogoVelocity = 0;
    }

    const target = {
      x: position.x + dt * velocity.x,
      y: position.y + dt * (velocity.y + this.pogoVelocity),
      z: position.z + dt * velocity.z,
    };

    let planes: b3CollisionPlane[] = [];
    let contacts: Array<{ shape: b3ShapeId; point: b3Vec3 }> = [];
    const planeResult = b3.createPlaneResult();
    for (let iter = 0; iter < MOVER_ITERATIONS; iter++) {
      planes = [];
      contacts = [];
      b3.b3World_CollideMover(world, position, capsule, filter, (shape: b3ShapeId, buf: PlaneResultBuffer) => {
        // Dynamic bodies are pushable, not walls: keep the mover's velocity so
        // the closing speed (and thus the push impulse) survives the contact.
        const isDynamic = b3.b3Body_GetType(b3.b3Shape_GetBody(shape)) === b3.b3BodyType.b3_dynamicBody;
        for (let i = 0, n = b3.getNumPlaneResults(buf); i < n; i++) {
          b3.getPlaneResultAt(planeResult, buf, i);
          const normal = planeResult.plane.normal;
          planes.push({
            plane: {
              normal: { x: normal.x, y: normal.y, z: normal.z },
              offset: planeResult.plane.offset,
            },
            pushLimit: PUSH_LIMIT,
            push: 0,
            clipVelocity: !isDynamic,
          });
          // Contact point comes back relative to the mover origin.
          contacts.push({
            shape,
            point: {
              x: position.x + planeResult.point.x,
              y: position.y + planeResult.point.y,
              z: position.z + planeResult.point.z,
            },
          });
        }
        return true;
      });

      const targetDelta = {
        x: target.x - position.x,
        y: target.y - position.y,
        z: target.z - position.z,
      };
      const solved = b3.b3SolvePlanes(targetDelta, planes);
      let delta = solved.delta;
      const fraction = b3.b3World_CastMover(world, position, capsule, delta, filter, () => true);
      delta = { x: delta.x * fraction, y: delta.y * fraction, z: delta.z * fraction };
      position.x += delta.x;
      position.y += delta.y;
      position.z += delta.z;
      if (delta.x * delta.x + delta.y * delta.y + delta.z * delta.z < MOVER_TOLERANCE * MOVER_TOLERANCE) break;
    }

    this.pushDynamicBodies(planes, contacts);
    this.velocity = b3.b3ClipVector(velocity, planes);
  }

  /**
   * Shove the dynamic bodies the mover is leaning on. CastMover/CollideMover are
   * purely geometric queries, so without this the mover treats crates like walls.
   *
   * Impulses are horizontal-only, applied at the center of mass (no torque),
   * and capped at MAX_PUSH_SPEED: crates slide ahead of the player at a
   * believable shove pace instead of spinning away or getting launched.
   */
  private pushDynamicBodies(
    planes: b3CollisionPlane[],
    contacts: Array<{ shape: b3ShapeId; point: b3Vec3 }>,
  ): void {
    const { b3 } = this;
    for (let i = 0; i < planes.length; i++) {
      const body = b3.b3Shape_GetBody(contacts[i].shape);
      if (b3.b3Body_GetType(body) !== b3.b3BodyType.b3_dynamicBody) continue;
      const mass = b3.b3Body_GetMass(body);
      if (mass <= 0) continue;

      // The collision plane's normal points toward the mover; push the other
      // way, flattened to the ground plane. A mostly-vertical normal means
      // we're standing on the body — don't grind it into the floor.
      const planeNormal = planes[i].plane.normal;
      let nx = -planeNormal.x;
      let nz = -planeNormal.z;
      const len = Math.hypot(nx, nz);
      if (len < 0.3) continue;
      nx /= len;
      nz /= len;

      const linear = b3.b3Body_GetLinearVelocity(body);
      const bodySpeed = linear.x * nx + linear.z * nz;
      const closing = this.velocity.x * nx + this.velocity.z * nz - bodySpeed;
      const wantedChange = Math.min(closing, MAX_PUSH_SPEED - bodySpeed);
      const impulse = mass * wantedChange;
      if (impulse > 0) {
        b3.b3Body_ApplyLinearImpulseToCenter(body, { x: nx * impulse, y: 0, z: nz * impulse }, true);
      }
    }
  }
}

/**
 * Owns the Box3D world: fixed-timestep stepping, static collider creation, and
 * dynamic bodies synced to their Three.js meshes. Rendering stays in Three.js —
 * physics is authoritative only for the character mover and dynamic props.
 */
export class Physics {
  private accumulator = 0;
  private readonly hulls: b3HullData[] = [];
  private readonly dynamicBodies: Array<{ bodyId: b3BodyId; object: THREE.Object3D; hull?: b3HullData }> = [];
  private readonly filter: b3QueryFilter;

  private constructor(
    readonly b3: Box3DModule,
    readonly world: b3WorldId,
  ) {
    this.filter = b3.b3DefaultQueryFilter();
  }

  static async create(): Promise<Physics> {
    const b3 = await Box3D();
    const worldDef = b3.b3DefaultWorldDef();
    worldDef.gravity = { x: 0, y: -25, z: 0 };
    const world = b3.b3CreateWorld(worldDef);
    return new Physics(b3, world);
  }

  createMover(def: MoverDef): CharacterMover {
    return new CharacterMover(this.b3, this.world, this.filter, def);
  }

  /** Fixed-timestep stepping (60 Hz, 4 substeps), then dynamic mesh sync. */
  step(delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, MAX_ACCUMULATED);
    while (this.accumulator >= FIXED_STEP) {
      this.b3.b3World_Step(this.world, FIXED_STEP, SUB_STEPS);
      this.accumulator -= FIXED_STEP;
    }
    this.syncDynamicBodies();
  }

  addStaticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, rotation?: b3Quat): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.position = { x, y, z };
    if (rotation) def.rotation = rotation;
    const body = this.b3.b3CreateBody(this.world, def);
    this.b3.b3CreateBoxShape(body, this.b3.b3DefaultShapeDef(), hx, hy, hz);
    return body;
  }

  addStaticSphere(x: number, y: number, z: number, radius: number): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.position = { x, y, z };
    const body = this.b3.b3CreateBody(this.world, def);
    this.b3.b3CreateSphereShape(body, this.b3.b3DefaultShapeDef(), {
      center: { x: 0, y: 0, z: 0 },
      radius,
    });
    return body;
  }

  /** Flat-topped cylinder pillar with its base on the ground plane (y = baseY). */
  addStaticCylinder(x: number, z: number, radius: number, height: number, baseY = 0): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.position = { x, y: baseY, z };
    const body = this.b3.b3CreateBody(this.world, def);
    // b3CreateCylinder extrudes the full height upward from yOffset.
    const hull = this.b3.b3CreateCylinder(height, radius, 0, CYLINDER_SIDES);
    if (hull) this.hulls.push(hull);
    this.b3.b3CreateHullShape(body, this.b3.b3DefaultShapeDef(), hull);
    return body;
  }

  /** Vertical capsule obstacle standing on the ground (for trees, posts, NPCs). */
  addStaticCapsule(x: number, z: number, radius: number, height: number): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.position = { x, y: 0, z };
    const body = this.b3.b3CreateBody(this.world, def);
    this.b3.b3CreateCapsuleShape(body, this.b3.b3DefaultShapeDef(), {
      center1: { x: 0, y: radius, z: 0 },
      center2: { x: 0, y: Math.max(radius, height - radius), z: 0 },
      radius,
    });
    return body;
  }

  /** Dynamic box synced to `object` (both centered on the body origin) after each step. */
  addDynamicBox(
    object: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    options: { density?: number; rotationY?: number } = {},
  ): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.type = this.b3.b3BodyType.b3_dynamicBody;
    def.position = { x, y, z };
    // Settle quickly after a shove instead of gliding across the meadow.
    def.linearDamping = 0.8;
    def.angularDamping = 2;
    if (options.rotationY) {
      def.rotation = this.b3.b3MakeQuatFromAxisAngle({ x: 0, y: 1, z: 0 }, options.rotationY);
    }
    const body = this.b3.b3CreateBody(this.world, def);
    const shapeDef = this.b3.b3DefaultShapeDef();
    shapeDef.density = options.density ?? 40;
    this.b3.b3CreateBoxShape(body, shapeDef, hx, hy, hz);
    this.dynamicBodies.push({ bodyId: body, object });
    return body;
  }

  /**
   * Dynamic convex-hull body synced to `object` after each step. `points` is a
   * flat [x, y, z, x, y, z, ...] array of vertices in body-local space; Box3D
   * computes the convex hull internally. Used by the dice roller for a tumbling
   * d20. Damping defaults match `addDynamicBox` but are tunable via `options`:
   * a die wants less damping than a crate so it keeps spinning long enough to
   * look like a real roll.
   */
  addDynamicHull(
    object: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    points: number[],
    options: { density?: number; linearDamping?: number; angularDamping?: number } = {},
  ): b3BodyId {
    const def = this.b3.b3DefaultBodyDef();
    def.type = this.b3.b3BodyType.b3_dynamicBody;
    def.position = { x, y, z };
    def.linearDamping = options.linearDamping ?? 0.8;
    def.angularDamping = options.angularDamping ?? 2;
    const body = this.b3.b3CreateBody(this.world, def);
    // Hull data is copied into the world on shape creation, but the existing
    // cylinder path keeps its hull in this.hulls and destroys it in dispose():
    // follow that lifetime pattern for consistency.
    const hull = this.b3.b3CreateHull(points);
    if (hull) this.hulls.push(hull);
    const shapeDef = this.b3.b3DefaultShapeDef();
    shapeDef.density = options.density ?? 40;
    this.b3.b3CreateHullShape(body, shapeDef, hull);
    // Track the hull on the body entry: unlike static cylinder hulls (which live
    // for the whole world), a dynamic die is removed per roll, so its hull must
    // be destroyed in removeDynamicBody or this.hulls would grow one per roll.
    this.dynamicBodies.push({ bodyId: body, object, hull: hull ?? undefined });
    return body;
  }

  /** Set a body's linear + angular velocity. The dice roller uses this for the toss. */
  setBodyVelocity(bodyId: b3BodyId, linear: b3Vec3, angular: b3Vec3): void {
    this.b3.b3Body_SetLinearVelocity(bodyId, linear);
    this.b3.b3Body_SetAngularVelocity(bodyId, angular);
  }

  /** Linear + angular speeds (magnitudes) of a body, used for settle-detection. */
  getBodyVelocity(bodyId: b3BodyId): { linear: number; angular: number } {
    const lin = this.b3.b3Body_GetLinearVelocity(bodyId);
    const ang = this.b3.b3Body_GetAngularVelocity(bodyId);
    return {
      linear: Math.hypot(lin.x, lin.y, lin.z),
      angular: Math.hypot(ang.x, ang.y, ang.z),
    };
  }

  /** Stop syncing a dynamic body and destroy it. No-op if the id isn't tracked. */
  removeDynamicBody(bodyId: b3BodyId): void {
    const index = this.dynamicBodies.findIndex((entry) => entry.bodyId === bodyId);
    if (index === -1) return;
    const { hull } = this.dynamicBodies[index];
    this.dynamicBodies.splice(index, 1);
    this.b3.b3DestroyBody(bodyId);
    if (hull) {
      const hullIndex = this.hulls.indexOf(hull);
      if (hullIndex !== -1) this.hulls.splice(hullIndex, 1);
      this.b3.b3DestroyHull(hull);
    }
  }

  private syncDynamicBodies(): void {
    for (const { bodyId, object } of this.dynamicBodies) {
      const transform = this.b3.b3Body_GetTransform(bodyId);
      object.position.set(transform.p.x, transform.p.y, transform.p.z);
      object.quaternion.set(transform.q.v.x, transform.q.v.y, transform.q.v.z, transform.q.s);
    }
  }

  dispose(): void {
    this.b3.b3DestroyWorld(this.world);
    for (const hull of this.hulls) this.b3.b3DestroyHull(hull);
    this.hulls.length = 0;
    this.dynamicBodies.length = 0;
  }
}
