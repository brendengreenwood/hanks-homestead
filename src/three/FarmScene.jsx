import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, createPortal, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, useGLTF, useAnimations, Html } from '@react-three/drei';
import * as THREE from 'three';

import { CROPS, BUILDINGS, SEASONS, COLORS, WORLD_SIZE, FIELD_OFFSET, FIELD_SIZE, seasonForDay, fieldHeight } from '../game/constants.js';
import { isFarmland } from '../game/logic.js';
import { modelUrl, cropModelUrl, CROP_TRANSFORM, DECORATIONS, FARMER } from '../game/assets.js';

// Coarse pointer (phone/tablet): the HUD covers the edges, so world-anchored
// building labels are redundant and collide with the touch controls.
const IS_COARSE =
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

// ============================================
// GRID <-> WORLD COORDINATES
// Each grid cell is a 1x1 tile. We re-center the world on the origin so the
// camera frames the field nicely and OrbitControls can target [0,0,0].
// ============================================
const HALF = WORLD_SIZE / 2;
const gx = (x) => x - HALF + 0.5; // tile center X
const gz = (y) => y - HALF + 0.5; // tile center Z

// ============================================
// GLTF LOADER WITH PLACEHOLDER FALLBACK
// Renders the Kenney model when a url is provided (and assets enabled),
// otherwise the supplied placeholder geometry.
// ============================================
function GltfModel({ url, scale = 1 }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} scale={scale} />;
}

// If a model fails to load (missing/corrupt file), fall back to the placeholder
// instead of crashing the whole canvas.
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function ModelOrPlaceholder({ url, scale, placeholder }) {
  if (!url) return placeholder;
  return (
    <ModelErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <GltfModel url={url} scale={scale} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

// ============================================
// CROP
// ============================================
function CropPlaceholder({ cropId, progress, mature }) {
  const crop = CROPS[cropId];
  const height = THREE.MathUtils.lerp(0.18, 0.7, mature ? 1 : Math.max(0.15, progress));
  const color = mature ? crop.matureColor : crop.color;

  return (
    <group>
      {/* stem */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, height, 6]} />
        <meshStandardMaterial color={mature ? '#2D5016' : '#1E3D0F'} />
      </mesh>
      {/* foliage / fruit */}
      <mesh position={[0, height + 0.12, 0]} castShadow>
        {cropId === 'corn' || cropId === 'wheat' ? (
          <coneGeometry args={[0.16, 0.34, 7]} />
        ) : (
          <icosahedronGeometry args={[mature ? 0.2 : 0.13, 0]} />
        )}
        <meshStandardMaterial color={color} flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}

function Crop({ cell }) {
  const crop = CROPS[cell.crop];
  const mature = cell.growth >= crop.growTime;
  const progress = Math.min(cell.growth / crop.growTime, 1);
  const url = cropModelUrl(cell.crop, mature);
  const t = CROP_TRANSFORM[cell.crop] || { scale: 0.6, y: 0 };
  // sprout grows from ~45% to full size as it ripens, then swaps to the mature model
  const modelScale = (mature ? 1 : 0.45 + 0.5 * progress) * t.scale;

  return (
    <group position={[0, 0.08 + t.y, 0]}>
      <ModelOrPlaceholder
        url={url}
        scale={modelScale}
        placeholder={<CropPlaceholder cropId={cell.crop} progress={progress} mature={mature} />}
      />
      {/* ready-to-harvest beacon */}
      {mature && (
        <mesh position={[0.28, 0.95, 0.28]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={COLORS.ui.green} emissive={COLORS.ui.green} emissiveIntensity={0.6} />
        </mesh>
      )}
      {/* watered / fed status pips */}
      {!mature && cell.watered && <StatusPip color={COLORS.ui.blue} x={-0.28} />}
      {!mature && cell.fed && <StatusPip color="#A78BFA" x={0.28} />}
    </group>
  );
}

function StatusPip({ color, x }) {
  return (
    <mesh position={[x, 0.55, -0.28]}>
      <sphereGeometry args={[0.06, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
}

// ============================================
// FIELD TILE (visual only — interaction handled by FieldPlane below)
// ============================================
function Tile({ x, y, cell, hovered, selected }) {
  const baseColor = cell.watered ? COLORS.soil.wet : COLORS.soil.dry;
  const color = selected && !cell.crop ? '#3B82F6' : baseColor;

  return (
    <group position={[gx(x), 0, gz(y)]}>
      <mesh receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[0.98, 0.08, 0.98]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {hovered && (
        <lineSegments position={[0, 0.1, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1, 0.02, 1)]} />
          <lineBasicMaterial color="white" />
        </lineSegments>
      )}
      {cell.crop && <Crop cell={cell} />}
    </group>
  );
}

// One invisible plane over the whole field handles all picking. Using a single
// surface (instead of per-tile pointer handlers) makes touch drag-select work —
// touch implicitly captures the pointer to the pointerdown target, so per-tile
// onPointerOver never fires mid-drag. We raycast the plane and derive the tile
// from the hit point, which behaves identically for mouse and touch.
const clampW = (v) => Math.max(FIELD_OFFSET, Math.min(FIELD_OFFSET + FIELD_SIZE - 1, v));
const clampH = (v, fieldH) => Math.max(FIELD_OFFSET, Math.min(FIELD_OFFSET + fieldH - 1, v));
const pointToTile = (p, fieldH) => ({
  x: clampW(Math.round(p.x + HALF - 0.5)),
  y: clampH(Math.round(p.z + HALF - 0.5), fieldH),
});

function FieldPlane({ fieldH, onDown, onMove }) {
  const cx = (gx(FIELD_OFFSET) + gx(FIELD_OFFSET + FIELD_SIZE - 1)) / 2;
  const cz = (gz(FIELD_OFFSET) + gz(FIELD_OFFSET + fieldH - 1)) / 2;
  return (
    <mesh
      position={[cx, 0.16, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const t = pointToTile(e.point, fieldH);
        onDown(t.x, t.y);
      }}
      onPointerMove={(e) => {
        if (!e.point) return;
        const t = pointToTile(e.point, fieldH);
        onMove(t.x, t.y);
      }}
    >
      <planeGeometry args={[FIELD_SIZE, fieldH]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Field({ gs, onPointerDown, onPointerEnter }) {
  const tiles = [];
  const fieldH = fieldHeight(gs.upgrades);
  const sel = gs.selectionStart && gs.selectionEnd;
  const inSel = (x, y) => {
    if (!sel) return false;
    const minX = Math.min(gs.selectionStart.x, gs.selectionEnd.x);
    const maxX = Math.max(gs.selectionStart.x, gs.selectionEnd.x);
    const minY = Math.min(gs.selectionStart.y, gs.selectionEnd.y);
    const maxY = Math.max(gs.selectionStart.y, gs.selectionEnd.y);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  for (let y = FIELD_OFFSET; y < FIELD_OFFSET + fieldH; y++) {
    for (let x = FIELD_OFFSET; x < FIELD_OFFSET + FIELD_SIZE; x++) {
      const hovered = gs.hoveredTile && gs.hoveredTile.x === x && gs.hoveredTile.y === y;
      tiles.push(
        <Tile key={`${x},${y}`} x={x} y={y} cell={gs.grid[y][x]} hovered={hovered} selected={inSel(x, y)} />
      );
    }
  }
  return (
    <group>
      {tiles}
      <FieldPlane fieldH={fieldH} onDown={onPointerDown} onMove={onPointerEnter} />
    </group>
  );
}

// ============================================
// GROUND (whole-world grass slab + border)
// ============================================
function Ground({ grass }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
      <meshStandardMaterial color={grass} roughness={1} />
    </mesh>
  );
}

// ============================================
// BUILDINGS — procedural low-poly, flat-shaded to match the Nature Kit.
// The kit has no barn/silo, so we model simple stylized ones.
// ============================================

// A flat triangle, used to close off the barn's gable ends.
function GableEnd({ width, rise, y, z, color }) {
  const geo = useMemo(() => {
    const hw = width / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0, 0, hw, 0, 0, 0, rise, 0], 3));
    g.setIndex([0, 1, 2]);
    g.computeVertexNormals();
    return g;
  }, [width, rise]);
  return (
    <mesh geometry={geo} position={[0, y, z]} castShadow>
      <meshStandardMaterial color={color} flatShading roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Barn() {
  const W = 1.7; // width (x)
  const D = 1.55; // depth (z)
  const Hb = 0.9; // wall height
  const rise = 0.6; // roof rise
  const overhang = 0.12;
  const run = W / 2 + overhang;
  const angle = Math.atan2(rise, run);
  const slabLen = Math.hypot(run, rise);
  const wall = '#b0402c';
  const roof = '#6f2c20';
  const trim = '#efe6d2';

  return (
    <group>
      {/* body */}
      <mesh position={[0, Hb / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, Hb, D]} />
        <meshStandardMaterial color={wall} flatShading roughness={1} />
      </mesh>
      {/* roof slabs */}
      <mesh position={[-run / 2, Hb + rise / 2, 0]} rotation={[0, 0, angle]} castShadow>
        <boxGeometry args={[slabLen, 0.07, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      <mesh position={[run / 2, Hb + rise / 2, 0]} rotation={[0, 0, -angle]} castShadow>
        <boxGeometry args={[slabLen, 0.07, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      {/* ridge cap */}
      <mesh position={[0, Hb + rise, 0]} castShadow>
        <boxGeometry args={[0.1, 0.08, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      {/* gable end walls */}
      <GableEnd width={W} rise={rise} y={Hb} z={D / 2 + 0.001} color={wall} />
      <GableEnd width={W} rise={rise} y={Hb} z={-D / 2 - 0.001} color={wall} />
      {/* big barn door + white trim + cross planks (front, +z) */}
      <mesh position={[0, Hb * 0.42, D / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.62, Hb * 0.72, 0.04]} />
        <meshStandardMaterial color={trim} flatShading roughness={1} />
      </mesh>
      {[0.5, -0.5].map((s) => (
        <mesh key={s} position={[0, Hb * 0.42, D / 2 + 0.045]} rotation={[0, 0, s * 0.72]}>
          <boxGeometry args={[0.05, 0.78, 0.02]} />
          <meshStandardMaterial color={wall} flatShading roughness={1} />
        </mesh>
      ))}
      {/* hayloft window in the gable */}
      <mesh position={[0, Hb + rise * 0.45, D / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.04]} />
        <meshStandardMaterial color={trim} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

function Silo() {
  const r = 0.4;
  const h = 1.5;
  const body = '#d7d0bf';
  const metal = '#9aa0a8';
  return (
    <group>
      {/* tank */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 16]} />
        <meshStandardMaterial color={body} flatShading roughness={0.95} />
      </mesh>
      {/* domed cap */}
      <mesh position={[0, h, 0]} castShadow>
        <sphereGeometry args={[r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={metal} flatShading metalness={0.2} roughness={0.6} />
      </mesh>
      {/* banding rings */}
      {[0.4, 0.85, 1.25].map((yy) => (
        <mesh key={yy} position={[0, yy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.015, 0.018, 6, 20]} />
          <meshStandardMaterial color={metal} flatShading metalness={0.2} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function ChimneySmoke({ origin }) {
  const refs = useRef([]);
  const st = useRef(Array.from({ length: 3 }, (_, i) => ({ t: i / 3 })));
  useFrame((_, dt) => {
    for (let i = 0; i < st.current.length; i++) {
      const p = st.current[i];
      const m = refs.current[i];
      if (!m) continue;
      p.t += dt * 0.32;
      if (p.t > 1) p.t -= 1;
      const t = p.t;
      m.position.set(origin[0] + Math.sin(t * 6) * 0.06, origin[1] + t * 0.95, origin[2]);
      m.scale.setScalar(0.05 + t * 0.13);
      m.material.opacity = (1 - t) * 0.5;
    }
  });
  return st.current.map((_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} position={origin}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#d8d4cc" transparent opacity={0.4} depthWrite={false} flatShading />
    </mesh>
  ));
}

// Hank's cottage — cream walls, shingled gable roof, door, shuttered windows,
// and a smoking chimney. Flat-shaded to match the kit.
function House() {
  const W = 1.6;
  const D = 1.5;
  const Hb = 0.95;
  const rise = 0.55;
  const overhang = 0.12;
  const run = W / 2 + overhang;
  const angle = Math.atan2(rise, run);
  const slabLen = Math.hypot(run, rise);
  const wall = '#e8dcc0';
  const roof = '#6b4a2a';
  const trim = '#7a5230';
  const door = '#5b3a22';
  const glass = '#bcd6e8';

  return (
    <group>
      {/* body */}
      <mesh position={[0, Hb / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, Hb, D]} />
        <meshStandardMaterial color={wall} flatShading roughness={1} />
      </mesh>
      {/* roof */}
      <mesh position={[-run / 2, Hb + rise / 2, 0]} rotation={[0, 0, angle]} castShadow>
        <boxGeometry args={[slabLen, 0.07, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      <mesh position={[run / 2, Hb + rise / 2, 0]} rotation={[0, 0, -angle]} castShadow>
        <boxGeometry args={[slabLen, 0.07, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, Hb + rise, 0]} castShadow>
        <boxGeometry args={[0.1, 0.08, D + overhang * 2]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      <GableEnd width={W} rise={rise} y={Hb} z={D / 2 + 0.001} color={wall} />
      <GableEnd width={W} rise={rise} y={Hb} z={-D / 2 - 0.001} color={wall} />
      {/* door (front, +z) */}
      <mesh position={[0, 0.33, D / 2 + 0.015]}>
        <boxGeometry args={[0.42, 0.7, 0.03]} />
        <meshStandardMaterial color={trim} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.32, D / 2 + 0.03]} castShadow>
        <boxGeometry args={[0.34, 0.62, 0.05]} />
        <meshStandardMaterial color={door} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.1, 0.32, D / 2 + 0.07]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#d8b24a" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* windows flanking the door */}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0.6, D / 2 + 0.02]}>
          <mesh>
            <boxGeometry args={[0.3, 0.3, 0.04]} />
            <meshStandardMaterial color={trim} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[0.22, 0.22, 0.04]} />
            <meshStandardMaterial color={glass} flatShading roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <boxGeometry args={[0.24, 0.02, 0.02]} />
            <meshStandardMaterial color={trim} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <boxGeometry args={[0.02, 0.24, 0.02]} />
            <meshStandardMaterial color={trim} />
          </mesh>
        </group>
      ))}
      {/* chimney + smoke */}
      <mesh position={[-0.45, Hb + rise * 0.6, -0.3]} castShadow>
        <boxGeometry args={[0.18, 0.52, 0.18]} />
        <meshStandardMaterial color="#9a4a36" flatShading roughness={1} />
      </mesh>
      <ChimneySmoke origin={[-0.45, Hb + rise * 0.6 + 0.32, -0.3]} />
    </group>
  );
}

function Buildings({ buildings }) {
  return buildings.map((b, i) => {
    const data = BUILDINGS[b.type];
    // center of the building footprint
    const cx = gx(b.x) + (data.width - 1) / 2;
    const cz = gz(b.y) + (data.height - 1) / 2;
    return (
      <group key={i} position={[cx, 0, cz]}>
        {b.type === 'barn' ? <Barn /> : b.type === 'house' ? <House /> : <Silo />}
        {!IS_COARSE && (
          <Html position={[0, 1.95, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
            <div className="world-label">{data.name}</div>
          </Html>
        )}
      </group>
    );
  });
}

// ============================================
// DECORATIONS (Nature Kit scatter around the farm)
// ============================================
function Decorations({ count }) {
  const list = count ? DECORATIONS.slice(0, count) : DECORATIONS;
  return list.map((d, i) => (
    <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.r || 0, 0]}>
      <ModelOrPlaceholder url={modelUrl(d.model)} scale={d.s || 1} placeholder={null} />
    </group>
  ));
}

// ============================================
// CHICKENS — procedural flat-shaded hens that wander the barnyard and
// scatter when Hank gets close. Pure useFrame; no game state involved.
// ============================================
const CHICKEN_HOME = { x: -7.2, z: -1.0 }; // grassy patch between the barn and house
const CHICKEN_COUNT = 5;
const YARD_R = 1.9; // how far they roam from home
const FLEE_R = 2.3; // how close Hank can get before they bolt

function Chicken() {
  const white = '#f7f3ea';
  const red = '#cf3b2b';
  const beak = '#e8a13a';
  return (
    <group>
      {/* body (faces +Z) */}
      <mesh position={[0, 0.12, 0]} scale={[1, 0.9, 1.25]} castShadow>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color={white} flatShading roughness={1} />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0.19, -0.13]} rotation={[0.7, 0, 0]} castShadow>
        <coneGeometry args={[0.08, 0.13, 4]} />
        <meshStandardMaterial color="#e6ddcb" flatShading roughness={1} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.25, 0.1]} castShadow>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={white} flatShading roughness={1} />
      </mesh>
      {/* comb */}
      <mesh position={[0, 0.32, 0.1]} castShadow>
        <boxGeometry args={[0.02, 0.045, 0.07]} />
        <meshStandardMaterial color={red} flatShading roughness={1} />
      </mesh>
      {/* beak (points +Z) */}
      <mesh position={[0, 0.24, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.025, 0.06, 4]} />
        <meshStandardMaterial color={beak} flatShading roughness={1} />
      </mesh>
      {/* wattle */}
      <mesh position={[0, 0.2, 0.16]}>
        <boxGeometry args={[0.015, 0.035, 0.02]} />
        <meshStandardMaterial color={red} flatShading roughness={1} />
      </mesh>
      {/* legs */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.035, 0.02]}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 5]} />
          <meshStandardMaterial color={beak} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Chickens({ gs }) {
  const refs = useRef([]);
  const state = useRef(
    Array.from({ length: CHICKEN_COUNT }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * YARD_R * 0.8;
      const x = CHICKEN_HOME.x + Math.cos(a) * r;
      const z = CHICKEN_HOME.z + Math.sin(a) * r;
      return { x, z, tx: x, tz: z, dir: Math.random() * Math.PI * 2, wait: Math.random() * 2, phase: Math.random() * 10 };
    })
  );

  useFrame((_, dt) => {
    const fx = gx(gs.farmerPos.x);
    const fz = gz(gs.farmerPos.y);
    const step = Math.min(dt, 0.05); // guard against big tab-out jumps

    for (let i = 0; i < state.current.length; i++) {
      const c = state.current[i];
      const g = refs.current[i];
      if (!g) continue;

      const dfx = c.x - fx;
      const dfz = c.z - fz;
      const df = Math.hypot(dfx, dfz);

      let speed;
      let moving = true;
      if (df < FLEE_R) {
        // bolt directly away from Hank
        const inv = 1 / (df || 0.001);
        c.tx = c.x + dfx * inv;
        c.tz = c.z + dfz * inv;
        speed = 2.5;
        c.wait = 0.4 + Math.random() * 0.6; // stay nervous a moment after
      } else {
        c.wait -= step;
        const reached = Math.hypot(c.tx - c.x, c.tz - c.z) < 0.12;
        if (reached && c.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * YARD_R;
          c.tx = CHICKEN_HOME.x + Math.cos(a) * r;
          c.tz = CHICKEN_HOME.z + Math.sin(a) * r;
          c.wait = 0.8 + Math.random() * 2.6; // pause to peck between strolls
        }
        moving = !reached;
        speed = 0.65;
      }

      if (moving) {
        const dx = c.tx - c.x;
        const dz = c.tz - c.z;
        const d = Math.hypot(dx, dz) || 1;
        const s = Math.min(speed * step, d);
        c.x += (dx / d) * s;
        c.z += (dz / d) * s;
        c.dir = Math.atan2(dx, dz);
        c.phase += speed * step * 16;
      }

      // keep them in the yard (slightly looser when fleeing)
      const hx = c.x - CHICKEN_HOME.x;
      const hz = c.z - CHICKEN_HOME.z;
      const hd = Math.hypot(hx, hz);
      const maxR = YARD_R + 0.7;
      if (hd > maxR) {
        c.x = CHICKEN_HOME.x + (hx / hd) * maxR;
        c.z = CHICKEN_HOME.z + (hz / hd) * maxR;
      }

      g.position.x = c.x;
      g.position.z = c.z;
      g.position.y = moving ? Math.abs(Math.sin(c.phase)) * 0.05 : 0;
      let dd = c.dir - g.rotation.y;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      g.rotation.y += dd * (1 - Math.exp(-(df < FLEE_R ? 16 : 8) * step));
    }
  });

  return state.current.map((_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <Chicken />
    </group>
  ));
}

// ============================================
// FARMER ACCESSORIES (procedural — straw hat + pitchfork)
// ============================================
function StrawHat({ pos = [0, 1.02, 0], rot = [0, 0, 0] }) {
  return (
    <group position={pos} rotation={rot}>
      {/* brim */}
      <mesh castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.035, 16]} />
        <meshStandardMaterial color="#C9A24B" roughness={1} flatShading />
      </mesh>
      {/* crown */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <coneGeometry args={[0.15, 0.2, 16]} />
        <meshStandardMaterial color="#B8893B" roughness={1} flatShading />
      </mesh>
      {/* band */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.155, 0.155, 0.04, 16]} />
        <meshStandardMaterial color="#6B4423" roughness={1} />
      </mesh>
    </group>
  );
}

function Pitchfork({ pos = [0.34, 0, 0.05], rot = [0, 0, 0] }) {
  const prong = (x) => (
    <mesh key={x} position={[x, 1.16, 0]} castShadow>
      <cylinderGeometry args={[0.012, 0.006, 0.22, 6]} />
      <meshStandardMaterial color="#9CA3AF" metalness={0.6} roughness={0.4} />
    </mesh>
  );
  return (
    <group position={pos} rotation={rot}>
      {/* handle */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 1.1, 8]} />
        <meshStandardMaterial color="#9B6B3F" roughness={0.9} />
      </mesh>
      {/* head crossbar */}
      <mesh position={[0, 1.06, 0]} castShadow>
        <boxGeometry args={[0.18, 0.03, 0.03]} />
        <meshStandardMaterial color="#9CA3AF" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.07, 0, 0.07].map(prong)}
    </group>
  );
}

// ============================================
// FARMER MODEL (Kenney Mini Characters, CC0) + animation if present
// ============================================
function FarmerModel({ gs, movingRef }) {
  const { scene, animations } = useGLTF(FARMER.model);
  const ref = useRef();
  const { actions, names, mixer } = useAnimations(animations, ref);
  const currentRef = useRef(null);
  const interacting = useRef(false);
  const seenTick = useRef(gs.actionTick);

  const { headBone, handBone } = useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return {
      headBone: scene.getObjectByName(FARMER.hat.bone),
      handBone: scene.getObjectByName(FARMER.pitchfork.bone),
    };
  }, [scene]);

  useEffect(() => () => Object.values(actions || {}).forEach((a) => a?.stop()), [actions]);

  // When a one-shot interact clip finishes, drop back into locomotion.
  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e) => {
      if (e.action === actions['interact-right']) {
        interacting.current = false;
        currentRef.current = null; // force a fresh idle/walk fade-in
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, actions]);

  useFrame(() => {
    // One-shot interact gesture on each tile action.
    if (gs.actionTick !== seenTick.current) {
      seenTick.current = gs.actionTick;
      const act = actions['interact-right'];
      if (act) {
        if (currentRef.current) actions[currentRef.current]?.fadeOut(0.1);
        currentRef.current = null;
        interacting.current = true;
        act.reset();
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = false;
        act.fadeIn(0.05).play();
      }
    }
    if (interacting.current) return;

    // Crossfade idle <-> walk based on whether the farmer is moving.
    const want = movingRef?.current && actions.walk ? 'walk' : actions.idle ? 'idle' : names[0];
    if (!want || want === currentRef.current) return;
    actions[want]?.reset().fadeIn(0.2).play();
    if (currentRef.current) actions[currentRef.current]?.fadeOut(0.2);
    currentRef.current = want;
  });

  return (
    <group ref={ref} rotation={[0, FARMER.rot, 0]} position={[0, FARMER.y, 0]}>
      <primitive object={scene} scale={FARMER.scale} />
      {/* Accessories attached to skeleton bones so they track every animation. */}
      {headBone &&
        createPortal(
          <group position={FARMER.hat.pos} rotation={FARMER.hat.rot} scale={FARMER.hat.scale}>
            <StrawHat pos={[0, 0, 0]} />
          </group>,
          headBone
        )}
      {handBone &&
        createPortal(
          <group position={FARMER.pitchfork.pos} rotation={FARMER.pitchfork.rot} scale={FARMER.pitchfork.scale}>
            <Pitchfork pos={[0, 0, 0]} />
          </group>,
          handBone
        )}
    </group>
  );
}

function ProceduralFarmer() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.3, 4, 10]} />
        <meshStandardMaterial color="#1E40AF" />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#FDBF6F" />
      </mesh>
      <StrawHat pos={[0, 0.95, 0]} />
      <mesh position={[0, 0.6, 0.18]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#F4D03F" />
      </mesh>
    </group>
  );
}

// ============================================
// FARMER (smoothly lerps/turns toward gs.farmerPos + gs.farmerDir)
// ============================================
const DIR_ANGLE = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };

function Farmer({ gs }) {
  const ref = useRef();
  const movingRef = useRef(false);
  const stride = useRef(0); // hop phase, advanced by distance travelled
  const moveAmt = useRef(0); // smoothed 0..1 "is walking" factor
  const prev = useRef(null); // last rendered world pos

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;

    const tx = gx(gs.farmerPos.x);
    const tz = gz(gs.farmerPos.y);

    // First frame: snap to the starting tile (no glide in from the origin).
    if (!prev.current) {
      g.position.set(tx, 0, tz);
      prev.current = { x: tx, z: tz };
    }

    // Eased glide toward the target tile (a touch slower than before so each
    // tile-to-tile step reads as a deliberate stride).
    g.position.x = THREE.MathUtils.damp(g.position.x, tx, 9, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, tz, 9, dt);

    // Shortest-path turn: wrap the delta to [-PI, PI] so he never spins the
    // long way around (e.g. left -> up).
    const target = DIR_ANGLE[gs.farmerDir] ?? 0;
    let d = target - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * (1 - Math.exp(-11 * dt));

    // Distance covered this frame -> drives the walking hop's stride.
    const stepDist = Math.hypot(g.position.x - prev.current.x, g.position.z - prev.current.z);
    prev.current.x = g.position.x;
    prev.current.z = g.position.z;

    const remaining = Math.hypot(tx - g.position.x, tz - g.position.z);
    const moving = gs.isMoving || remaining > 0.015;
    movingRef.current = moving;

    // Smooth the walk factor so the hop fades in/out instead of snapping.
    moveAmt.current = THREE.MathUtils.damp(moveAmt.current, moving ? 1 : 0, 14, dt);
    stride.current += stepDist * 16; // hops per unit travelled
    const hopH = FARMER.model ? 0.045 : 0.08;
    g.position.y = Math.abs(Math.sin(stride.current)) * hopH * moveAmt.current;
  });

  const dressed = FARMER.model ? (
    <ModelErrorBoundary fallback={<ProceduralFarmer />}>
      <Suspense fallback={<ProceduralFarmer />}>
        <FarmerModel gs={gs} movingRef={movingRef} />
      </Suspense>
    </ModelErrorBoundary>
  ) : (
    <ProceduralFarmer />
  );

  // NB: no `position` prop here — React would re-apply it on every requestRender
  // and snap him to the target tile, defeating the useFrame glide. useFrame owns
  // the position (seeded once on its first run).
  return (
    <group ref={ref}>
      {dressed}
      {gs.speechBubble && !gs.showSellModal && (
        <Html position={[0, 1.45, 0]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <div className="hank-speech">{gs.speechBubble}</div>
        </Html>
      )}
    </group>
  );
}

// ============================================
// LIGHTING (tinted per season)
// ============================================
function SeasonLighting({ season, shadowMap = 2048 }) {
  const data = SEASONS[season];
  const dirRef = useRef();
  return (
    <>
      <hemisphereLight args={[data.sky.top, data.grass, 0.7]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        ref={dirRef}
        color={data.light}
        intensity={1.15}
        position={[12, 20, 8]}
        castShadow
        shadow-mapSize-width={shadowMap}
        shadow-mapSize-height={shadowMap}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </>
  );
}

// ============================================
// CAMERA RIG — on touch, hold a fixed isometric angle and ease toward the
// discrete azimuth (gs.camAz) / top-down (gs.camTop) the UI buttons request.
// ============================================
const ISO_POLAR = 0.93; // ~iso elevation
const TOP_POLAR = 0.16; // near top-down
function CameraRig({ gs }) {
  const controls = useThree((s) => s.controls);
  useFrame((_, dt) => {
    if (!controls) return;
    const targetAz = gs.camAz ?? Math.PI / 4;
    const targetPol = gs.camTop ? TOP_POLAR : ISO_POLAR;
    const k = 1 - Math.exp(-7 * dt);
    const az = controls.getAzimuthalAngle();
    let d = targetAz - az;
    d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest path
    controls.setAzimuthalAngle(az + d * k);
    const pol = controls.getPolarAngle();
    controls.setPolarAngle(pol + (targetPol - pol) * k);
    controls.update();
  });
  return null;
}

// ============================================
// SCENE ROOT
// ============================================
export default function FarmScene({ gs, version, onTilePointerDown, onTilePointerEnter, onBackgroundMissed }) {
  const season = seasonForDay(gs.day);
  const data = SEASONS[season];
  // Lighter render budget on touch / low-power devices.
  const lowSpec =
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  return (
    <Canvas
      shadows
      dpr={[1, lowSpec ? 1.5 : 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={onBackgroundMissed}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={[data.sky.bottom]} />
      <fog attach="fog" args={[data.sky.horizon, 38, 70]} />

      <OrthographicCamera makeDefault position={[24, 26, 24]} zoom={26} near={-50} far={200} />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableRotate={!lowSpec}
        minZoom={12}
        maxZoom={70}
        maxPolarAngle={Math.PI / 2.3}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: undefined, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      {lowSpec && <CameraRig gs={gs} />}

      <SeasonLighting season={season} shadowMap={lowSpec ? 1024 : 2048} />

      {/* version is read so the subtree re-renders when game state mutates */}
      <group userData={{ version }}>
        <Ground grass={data.grass} />
        <Decorations count={lowSpec ? 12 : undefined} />
        <Field gs={gs} onPointerDown={onTilePointerDown} onPointerEnter={onTilePointerEnter} />
        <Buildings buildings={gs.buildings} />
        <Chickens gs={gs} />
        <Farmer gs={gs} />
      </group>
    </Canvas>
  );
}
