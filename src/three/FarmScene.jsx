import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, createPortal } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, useGLTF, useAnimations, Html } from '@react-three/drei';
import * as THREE from 'three';

import { CROPS, BUILDINGS, SEASONS, COLORS, WORLD_SIZE, FIELD_OFFSET, FIELD_SIZE, seasonForDay } from '../game/constants.js';
import { isFarmland } from '../game/logic.js';
import { modelUrl, cropModelUrl, CROP_TRANSFORM, DECORATIONS, FARMER } from '../game/assets.js';

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
  const modelScale = (mature ? 1 : 0.7) * t.scale;

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
// FIELD TILE (interactive soil)
// ============================================
function Tile({ x, y, cell, hovered, selected, onPointerDown, onPointerEnter }) {
  const baseColor = cell.watered ? COLORS.soil.wet : COLORS.soil.dry;
  const color = selected && !cell.crop ? '#3B82F6' : baseColor;

  return (
    <group position={[gx(x), 0, gz(y)]}>
      <mesh
        receiveShadow
        position={[0, 0.04, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(x, y);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerEnter(x, y);
        }}
      >
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

function Field({ gs, onPointerDown, onPointerEnter }) {
  const tiles = [];
  const sel = gs.selectionStart && gs.selectionEnd;
  const inSel = (x, y) => {
    if (!sel) return false;
    const minX = Math.min(gs.selectionStart.x, gs.selectionEnd.x);
    const maxX = Math.max(gs.selectionStart.x, gs.selectionEnd.x);
    const minY = Math.min(gs.selectionStart.y, gs.selectionEnd.y);
    const maxY = Math.max(gs.selectionStart.y, gs.selectionEnd.y);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  for (let y = FIELD_OFFSET; y < FIELD_OFFSET + FIELD_SIZE; y++) {
    for (let x = FIELD_OFFSET; x < FIELD_OFFSET + FIELD_SIZE; x++) {
      const hovered = gs.hoveredTile && gs.hoveredTile.x === x && gs.hoveredTile.y === y;
      tiles.push(
        <Tile
          key={`${x},${y}`}
          x={x}
          y={y}
          cell={gs.grid[y][x]}
          hovered={hovered}
          selected={inSel(x, y)}
          onPointerDown={onPointerDown}
          onPointerEnter={onPointerEnter}
        />
      );
    }
  }
  return <group>{tiles}</group>;
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

function Buildings({ buildings }) {
  return buildings.map((b, i) => {
    const data = BUILDINGS[b.type];
    // center of the building footprint
    const cx = gx(b.x) + (data.width - 1) / 2;
    const cz = gz(b.y) + (data.height - 1) / 2;
    return (
      <group key={i} position={[cx, 0, cz]}>
        {b.type === 'farmhouse' ? <Barn /> : <Silo />}
        <Html position={[0, 1.95, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="world-label">{data.name}</div>
        </Html>
      </group>
    );
  });
}

// ============================================
// DECORATIONS (Nature Kit scatter around the farm)
// ============================================
function Decorations() {
  return DECORATIONS.map((d, i) => (
    <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.r || 0, 0]}>
      <ModelOrPlaceholder url={modelUrl(d.model)} scale={d.s || 1} placeholder={null} />
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
      {gs.speechBubble && (
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
function SeasonLighting({ season }) {
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
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
// SCENE ROOT
// ============================================
export default function FarmScene({ gs, version, onTilePointerDown, onTilePointerEnter, onBackgroundMissed }) {
  const season = seasonForDay(gs.day);
  const data = SEASONS[season];

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={onBackgroundMissed}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[data.sky.bottom]} />
      <fog attach="fog" args={[data.sky.horizon, 38, 70]} />

      <OrthographicCamera makeDefault position={[24, 26, 24]} zoom={26} near={-50} far={200} />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minZoom={12}
        maxZoom={70}
        maxPolarAngle={Math.PI / 2.3}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      />

      <SeasonLighting season={season} />

      {/* version is read so the subtree re-renders when game state mutates */}
      <group userData={{ version }}>
        <Ground grass={data.grass} />
        <Decorations />
        <Field gs={gs} onPointerDown={onTilePointerDown} onPointerEnter={onTilePointerEnter} />
        <Buildings buildings={gs.buildings} />
        <Farmer gs={gs} />
      </group>
    </Canvas>
  );
}
