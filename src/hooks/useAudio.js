import { useCallback, useRef } from 'react';

// ============================================
// SOUND SYSTEM (Web Audio synth + looping tracks)
// ============================================

export const useSound = () => {
  const audioCtxRef = useRef(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((frequency, duration = 0.1, type = 'sine', volume = 0.15) => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  return {
    buy: () => { playTone(880, 0.08, 'sine', 0.1); setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 50); },
    buyBulk: () => { playTone(880, 0.06, 'sine', 0.1); setTimeout(() => playTone(1100, 0.06, 'sine', 0.1), 40); setTimeout(() => playTone(1320, 0.1, 'sine', 0.1), 80); },
    plant: () => { playTone(180, 0.08, 'sine', 0.15); setTimeout(() => playTone(120, 0.12, 'sine', 0.1), 30); },
    water: () => { playTone(600, 0.08, 'triangle', 0.08); setTimeout(() => playTone(500, 0.08, 'triangle', 0.06), 60); setTimeout(() => playTone(400, 0.1, 'triangle', 0.04), 120); },
    harvest: () => { playTone(523, 0.1, 'sine', 0.12); setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 80); setTimeout(() => playTone(784, 0.15, 'sine', 0.1), 160); },
    sell: () => { playTone(800, 0.05, 'square', 0.06); setTimeout(() => playTone(1000, 0.05, 'square', 0.06), 40); setTimeout(() => playTone(1200, 0.08, 'square', 0.05), 80); },
    error: () => { playTone(300, 0.1, 'sine', 0.12); setTimeout(() => playTone(200, 0.15, 'sine', 0.1), 80); },
    sleep: () => { playTone(440, 0.2, 'sine', 0.1); setTimeout(() => playTone(349, 0.2, 'sine', 0.08), 150); setTimeout(() => playTone(262, 0.4, 'sine', 0.06), 300); },
    wake: () => { playTone(262, 0.15, 'sine', 0.08); setTimeout(() => playTone(330, 0.15, 'sine', 0.1), 120); setTimeout(() => playTone(392, 0.2, 'sine', 0.12), 240); },
    click: () => { playTone(800, 0.03, 'sine', 0.05); },
    getAudioContext,
  };
};

const MUSIC_TRACKS = {
  spring: '/audio/ambient-spring.wav',
  summer: '/audio/ambient-summer.wav',
  fall: '/audio/ambient-fall.wav',
  winter: '/audio/ambient-winter.wav',
};

const NATURE_TRACKS = {
  spring: '/audio/nature-spring.wav',
  summer: '/audio/nature-summer.wav',
  fall: '/audio/nature-fall.wav',
  winter: '/audio/nature-winter.wav',
};

// Generic looping-track player keyed by season. Shared by music + ambience.
const useAudioLoop = (getAudioContext, tracks, defaultVolume) => {
  const buffersRef = useRef({});
  const currentSourceRef = useRef(null);
  const currentGainRef = useRef(null);
  const currentSeasonRef = useRef(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(defaultVolume);

  const loadTrack = useCallback(async (season) => {
    if (buffersRef.current[season]) return buffersRef.current[season];
    try {
      const ctx = getAudioContext();
      const response = await fetch(tracks[season]);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffersRef.current[season] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      return null;
    }
  }, [getAudioContext, tracks]);

  const preloadAll = useCallback(async () => {
    await Promise.all(Object.keys(tracks).map(loadTrack));
  }, [loadTrack, tracks]);

  const playTrack = useCallback((season, fadeIn = 0) => {
    const ctx = getAudioContext();
    const buffer = buffersRef.current[season];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volumeRef.current, ctx.currentTime + fadeIn);
    } else {
      gainNode.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
    }

    source.start(0);
    currentSourceRef.current = source;
    currentGainRef.current = gainNode;
    currentSeasonRef.current = season;
    isPlayingRef.current = true;
  }, [getAudioContext]);

  const stopTrack = useCallback((fadeOut = 0) => {
    if (!currentSourceRef.current || !currentGainRef.current) return;

    const ctx = getAudioContext();
    const gain = currentGainRef.current;
    const source = currentSourceRef.current;

    if (fadeOut > 0) {
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
      setTimeout(() => {
        try { source.stop(); } catch (e) {}
      }, fadeOut * 1000);
    } else {
      try { source.stop(); } catch (e) {}
    }

    currentSourceRef.current = null;
    currentGainRef.current = null;
    isPlayingRef.current = false;
  }, [getAudioContext]);

  const changeSeason = useCallback(async (newSeason, fadeOutDuration = 1.5, fadeInDuration = 0.2) => {
    if (currentSeasonRef.current === newSeason && isPlayingRef.current) return;

    await loadTrack(newSeason);

    if (isPlayingRef.current) {
      stopTrack(fadeOutDuration);
    }

    setTimeout(() => {
      playTrack(newSeason, fadeInDuration);
    }, fadeOutDuration * 600);
  }, [loadTrack, stopTrack, playTrack]);

  const setVolume = useCallback((vol) => {
    volumeRef.current = Math.max(0, Math.min(1, vol));
    if (currentGainRef.current) {
      const ctx = getAudioContext();
      currentGainRef.current.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
    }
  }, [getAudioContext]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopTrack(0.3);
    } else if (currentSeasonRef.current) {
      playTrack(currentSeasonRef.current, 0.3);
    }
  }, [stopTrack, playTrack]);

  return { preloadAll, changeSeason, setVolume, toggle, isPlaying: () => isPlayingRef.current };
};

export const useMusic = (getAudioContext) => useAudioLoop(getAudioContext, MUSIC_TRACKS, 0.3);
export const useAmbience = (getAudioContext) => useAudioLoop(getAudioContext, NATURE_TRACKS, 0.25);
