// ============================================
// AUDIO ENGINE — Web Audio graph shared by all game sound.
//
//   one-shots ──▶ [panner?] ──▶ sfx bus ──▶ highpass ──▶ master ──▶ compressor ──▶ out
//   music/ambience (disabled) ─────────────────────────▶ master ─┘
//
// The highpass on the SFX bus clears low-end mud; the compressor glues
// levels. Positioned sounds (pass a world-space {x,y,z}) get an equal-power
// panner, and the listener follows the camera (see AudioListenerSync in
// FarmScene) — cheap spatial audio that reads as "over there" in iso view.
// ============================================

export const MUSIC_ENABLED = false; // flip to bring seasonal music back

let ctx = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;

const ensure = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);

  sfxBus = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 200;
  hp.Q.value = 0.7;
  sfxBus.connect(hp);
  hp.connect(master);

  musicBus = ctx.createGain();
  musicBus.connect(master);

  // 1s of white noise, reused by every textured one-shot
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return ctx;
};

// Camera → listener sync (called from the 3D scene each few frames).
const setListener = (px, py, pz, fx, fy, fz, ux, uy, uz) => {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;
  } else {
    l.setPosition(px, py, pz);
    l.setOrientation(fx, fy, fz, ux, uy, uz);
  }
};

// Route a one-shot: through a panner when a world position is given.
// The iso camera sits ~43 units out, tiles span ±11 — so distance barely
// attenuates; the audible cue is left/right pan, which is what we want.
const route = (pos) => {
  if (!pos) return sfxBus;
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'linear';
  p.refDistance = 28;
  p.maxDistance = 90;
  p.rolloffFactor = 0.8;
  if (p.positionX) {
    p.positionX.value = pos.x; p.positionY.value = pos.y ?? 0.5; p.positionZ.value = pos.z;
  } else {
    p.setPosition(pos.x, pos.y ?? 0.5, pos.z);
  }
  p.connect(sfxBus);
  return p;
};

// Tone one-shot. `at` = seconds from now (sample-accurate, no setTimeout).
const tone = ({ f, f2, type = 'triangle', d = 0.1, v = 0.12, a = 0.004, at = 0, pos }) => {
  try {
    ensure();
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    osc.connect(g);
    g.connect(route(pos));
    osc.start(t0);
    osc.stop(t0 + d + 0.02);
  } catch (e) {}
};

// Filtered-noise one-shot (dirt scuffs, water spritz, sparkle).
const noise = ({ d = 0.08, v = 0.1, type = 'bandpass', f = 1500, q = 1, at = 0, pos }) => {
  try {
    ensure();
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    src.connect(filt);
    filt.connect(g);
    g.connect(route(pos));
    src.start(t0, Math.random() * 0.5, d + 0.02);
  } catch (e) {}
};

// ---- The sound bank. Tile-anchored sounds accept a world position. -------
export const createSounds = () => ({
  click: () => tone({ f: 1150, d: 0.035, v: 0.05 }),
  plant: (pos) => {
    noise({ f: 700, q: 0.8, d: 0.07, v: 0.16, pos }); // dirt scuff
    tone({ f: 330, f2: 240, d: 0.09, v: 0.09, at: 0.015, pos });
  },
  water: (pos) => {
    noise({ f: 2400, q: 1.2, d: 0.12, v: 0.11, pos }); // spritz
    tone({ f: 880, f2: 620, type: 'sine', d: 0.1, v: 0.06, at: 0.02, pos });
    tone({ f: 1320, f2: 990, type: 'sine', d: 0.06, v: 0.04, at: 0.1, pos });
  },
  harvest: (pos) => {
    tone({ f: 659, d: 0.09, v: 0.11, pos });
    tone({ f: 831, d: 0.09, v: 0.11, at: 0.07, pos });
    tone({ f: 988, d: 0.13, v: 0.1, at: 0.14, pos });
    noise({ type: 'highpass', f: 4000, d: 0.06, v: 0.05, at: 0.14, pos }); // sparkle
  },
  sell: () => {
    tone({ f: 1175, type: 'square', d: 0.05, v: 0.05 });
    tone({ f: 1568, type: 'square', d: 0.08, v: 0.05, at: 0.055 });
  },
  buy: () => {
    tone({ f: 990, d: 0.06, v: 0.08 });
    tone({ f: 1245, d: 0.08, v: 0.08, at: 0.045 });
  },
  buyBulk: () => {
    tone({ f: 990, d: 0.05, v: 0.08 });
    tone({ f: 1245, d: 0.05, v: 0.08, at: 0.04 });
    tone({ f: 1480, d: 0.09, v: 0.08, at: 0.08 });
  },
  error: () => {
    tone({ f: 392, type: 'square', d: 0.08, v: 0.08 });
    tone({ f: 311, type: 'square', d: 0.12, v: 0.07, at: 0.07 });
  },
  sleep: () => {
    tone({ f: 659, d: 0.18, v: 0.07 });
    tone({ f: 523, d: 0.18, v: 0.06, at: 0.14 });
    tone({ f: 392, d: 0.3, v: 0.05, at: 0.3 });
  },
  wake: () => {
    tone({ f: 392, d: 0.12, v: 0.06 });
    tone({ f: 494, d: 0.12, v: 0.08, at: 0.1 });
    tone({ f: 587, d: 0.18, v: 0.09, at: 0.2 });
  },
  getAudioContext: ensure,
});

export const engine = { ensure, setListener, get musicBus() { return musicBus; } };
