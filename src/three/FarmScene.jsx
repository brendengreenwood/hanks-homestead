import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
// BUILDINGS
// ============================================
function BuildingPlaceholder({ data }) {
  const w = data.width;
  const d = data.height;
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[w * 0.85, 0.9, d * 0.85]} />
        <meshStandardMaterial color={data.color} roughness={0.9} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[w * 0.7, 0.5, 4]} />
        <meshStandardMaterial color="#7F1D1D" flatShading />
      </mesh>
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
        <ModelOrPlaceholder
          url={modelUrl(b.type === 'farmhouse' ? 'farmhouse' : 'silo')}
          scale={1}
          placeholder={<BuildingPlaceholder data={data} />}
        />
        <Html position={[0, 1.7, 0]} center style={{ pointerEvents: 'none' }}>
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

  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
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
// FARMER (smoothly lerps toward gs.farmerPos)
// ============================================
function Farmer({ gs }) {
  const ref = useRef();
  const bob = useRef(0);
  const movingRef = useRef(false);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const tx = gx(gs.farmerPos.x);
    const tz = gz(gs.farmerPos.y);
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, tx, 12, dt);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, tz, 12, dt);

    // face direction
    const dir = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 }[gs.farmerDir] ?? 0;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, dir, 10, dt);

    // bob while moving (procedural fallback only; the rigged model walks itself)
    const moving = gs.isMoving || Math.abs(ref.current.position.x - tx) > 0.02 || Math.abs(ref.current.position.z - tz) > 0.02;
    movingRef.current = moving;
    bob.current += dt * 12;
    ref.current.position.y = !FARMER.model && moving ? Math.abs(Math.sin(bob.current)) * 0.08 : 0;
  });

  const dressed = FARMER.model ? (
    <ModelErrorBoundary fallback={<ProceduralFarmer />}>
      <Suspense fallback={<ProceduralFarmer />}>
        <FarmerModel gs={gs} movingRef={movingRef} />
        <StrawHat pos={FARMER.hat.pos} rot={FARMER.hat.rot} />
        <Pitchfork pos={FARMER.pitchfork.pos} rot={FARMER.pitchfork.rot} />
      </Suspense>
    </ModelErrorBoundary>
  ) : (
    <ProceduralFarmer />
  );

  return (
    <group ref={ref} position={[gx(gs.farmerPos.x), 0, gz(gs.farmerPos.y)]}>
      {dressed}
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
