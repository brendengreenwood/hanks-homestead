// ============================================
// PROCEDURAL PROPS — barn, silo, house, chickens, farmer accessories.
// Geometry ported verbatim from legacy src/three/FarmScene.jsx (flat-shaded
// low-poly to match the Kenney Nature Kit; the kit has no farm buildings).
// ============================================
import * as THREE from 'three';

const flat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, ...extra });

function shadowed<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  return m;
}

/** A flat triangle that closes off a gable end. */
function gableEnd(width: number, rise: number, y: number, z: number, color: string): THREE.Mesh {
  const hw = width / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0, 0, hw, 0, 0, 0, rise, 0], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  const mesh = shadowed(new THREE.Mesh(g, flat(color, { side: THREE.DoubleSide })));
  mesh.position.set(0, y, z);
  return mesh;
}

function gableRoof(group: THREE.Group, W: number, D: number, Hb: number, rise: number, overhang: number, roof: string): void {
  const run = W / 2 + overhang;
  const angle = Math.atan2(rise, run);
  const slabLen = Math.hypot(run, rise);
  const left = shadowed(new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.07, D + overhang * 2), flat(roof)));
  left.position.set(-run / 2, Hb + rise / 2, 0);
  left.rotation.z = angle;
  const right = shadowed(new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.07, D + overhang * 2), flat(roof)));
  right.position.set(run / 2, Hb + rise / 2, 0);
  right.rotation.z = -angle;
  const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, D + overhang * 2), flat(roof)));
  ridge.position.set(0, Hb + rise, 0);
  group.add(left, right, ridge);
}

export function buildBarn(): THREE.Group {
  const W = 1.7, D = 1.55, Hb = 0.9, rise = 0.6, overhang = 0.12;
  const wall = '#b0402c', roof = '#6f2c20', trim = '#efe6d2';
  const g = new THREE.Group();

  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, Hb, D), flat(wall)));
  body.position.y = Hb / 2;
  body.receiveShadow = true;
  g.add(body);
  gableRoof(g, W, D, Hb, rise, overhang, roof);
  g.add(gableEnd(W, rise, Hb, D / 2 + 0.001, wall));
  g.add(gableEnd(W, rise, Hb, -D / 2 - 0.001, wall));

  // big barn door + white trim + cross planks (front, +z)
  const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, Hb * 0.72, 0.04), flat(trim)));
  door.position.set(0, Hb * 0.42, D / 2 + 0.02);
  g.add(door);
  for (const s of [0.5, -0.5]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.02), flat(wall));
    plank.position.set(0, Hb * 0.42, D / 2 + 0.045);
    plank.rotation.z = s * 0.72;
    g.add(plank);
  }
  // hayloft window in the gable
  const win = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), flat(trim)));
  win.position.set(0, Hb + rise * 0.45, D / 2 + 0.02);
  g.add(win);
  return g;
}

export function buildSilo(): THREE.Group {
  const r = 0.4, h = 1.5;
  const body = '#d7d0bf', metal = '#9aa0a8';
  const g = new THREE.Group();
  const tank = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), flat(body, { roughness: 0.95 })),
  );
  tank.position.y = h / 2;
  tank.receiveShadow = true;
  g.add(tank);
  const cap = shadowed(
    new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      flat(metal, { metalness: 0.2, roughness: 0.6 }),
    ),
  );
  cap.position.y = h;
  g.add(cap);
  for (const yy of [0.4, 0.85, 1.25]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r + 0.015, 0.018, 6, 20),
      flat(metal, { metalness: 0.2, roughness: 0.6 }),
    );
    ring.position.y = yy;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  return g;
}

export function buildHouse(): THREE.Group {
  const W = 1.6, D = 1.5, Hb = 0.95, rise = 0.55, overhang = 0.12;
  const wall = '#e8dcc0', roof = '#6b4a2a', trim = '#7a5230', door = '#5b3a22', glass = '#bcd6e8';
  const g = new THREE.Group();

  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, Hb, D), flat(wall)));
  body.position.y = Hb / 2;
  body.receiveShadow = true;
  g.add(body);
  gableRoof(g, W, D, Hb, rise, overhang, roof);
  g.add(gableEnd(W, rise, Hb, D / 2 + 0.001, wall));
  g.add(gableEnd(W, rise, Hb, -D / 2 - 0.001, wall));

  // door + frame + knob (front, +z)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.03), flat(trim));
  frame.position.set(0, 0.33, D / 2 + 0.015);
  g.add(frame);
  const doorMesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.05), flat(door)));
  doorMesh.position.set(0, 0.32, D / 2 + 0.03);
  g.add(doorMesh);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#d8b24a', metalness: 0.4, roughness: 0.5 }),
  );
  knob.position.set(0.1, 0.32, D / 2 + 0.07);
  g.add(knob);

  // windows flanking the door
  for (const x of [-0.5, 0.5]) {
    const w = new THREE.Group();
    w.position.set(x, 0.6, D / 2 + 0.02);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.04), flat(trim));
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.04),
      flat(glass, { roughness: 0.4, metalness: 0.1 }),
    );
    pane.position.z = 0.012;
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: trim }));
    barH.position.z = 0.035;
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.02), new THREE.MeshStandardMaterial({ color: trim }));
    barV.position.z = 0.035;
    w.add(outer, pane, barH, barV);
    g.add(w);
  }

  // chimney (smoke is animated by the scene)
  const chimney = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.18), flat('#9a4a36')));
  chimney.position.set(-0.45, Hb + rise * 0.6, -0.3);
  g.add(chimney);
  return g;
}

/** Chimney-top position in house-local space, for the smoke emitter. */
export const HOUSE_CHIMNEY_TOP: [number, number, number] = [-0.45, 0.95 + 0.55 * 0.6 + 0.26, -0.3];

export function buildChicken(): THREE.Group {
  const white = '#f7f3ea', red = '#cf3b2b', beak = '#e8a13a';
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), flat(white)));
  body.position.y = 0.12;
  body.scale.set(1, 0.9, 1.25);
  const tail = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.13, 4), flat('#e6ddcb')));
  tail.position.set(0, 0.19, -0.13);
  tail.rotation.x = 0.7;
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flat(white)));
  head.position.set(0, 0.25, 0.1);
  const comb = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.07), flat(red)));
  comb.position.set(0, 0.32, 0.1);
  const beakMesh = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 4), flat(beak)));
  beakMesh.position.set(0, 0.24, 0.18);
  beakMesh.rotation.x = Math.PI / 2;
  const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.02), flat(red));
  wattle.position.set(0, 0.2, 0.16);
  g.add(body, tail, head, comb, beakMesh, wattle);
  for (const x of [-0.045, 0.045]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), flat(beak));
    leg.position.set(x, 0.035, 0.02);
    g.add(leg);
  }
  return g;
}

export function buildStrawHat(): THREE.Group {
  const g = new THREE.Group();
  const brim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 16), flat('#C9A24B')));
  const crown = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 16), flat('#B8893B')));
  crown.position.y = 0.1;
  const band = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#6B4423', roughness: 1 })),
  );
  band.position.y = 0.03;
  g.add(brim, crown, band);
  return g;
}

export function buildPitchfork(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#9B6B3F', roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: '#9CA3AF', metalness: 0.6, roughness: 0.4 });
  const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8), wood));
  handle.position.y = 0.55;
  const crossbar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), steel));
  crossbar.position.y = 1.06;
  g.add(handle, crossbar);
  for (const x of [-0.07, 0, 0.07]) {
    const prong = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.22, 6), steel));
    prong.position.set(x, 1.16, 0);
    g.add(prong);
  }
  return g;
}

/** Procedural farmer fallback if the character GLB is missing. */
export function buildProceduralFarmer(): THREE.Group {
  const g = new THREE.Group();
  const legs = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), new THREE.MeshStandardMaterial({ color: '#1E40AF' })));
  legs.position.y = 0.3;
  const torso = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshStandardMaterial({ color: '#DC2626' })));
  torso.position.y = 0.6;
  const headM = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: '#FDBF6F' })));
  headM.position.y = 0.82;
  const hat = buildStrawHat();
  hat.position.y = 0.95;
  g.add(legs, torso, headM, hat);
  return g;
}
