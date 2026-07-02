import { useMemo, useRef, useCallback } from 'react';
import { createSounds, engine, MUSIC_ENABLED } from '../game/audio.js';

// ============================================
// SOUND HOOKS — thin React layer over the audio engine (src/game/audio.js).
// SFX are synthesized through the mixer graph (highpass + compressor) and
// support world-space positions for spatial panning.
// ============================================

export const useSound = () => useMemo(() => createSounds(), []);

const MUSIC_TRACKS = {
  spring: '/audio/ambient-spring.wav',
  summer: '/audio/ambient-summer.wav',
  fall: '/audio/ambient-fall.wav',
  winter: '/audio/ambient-winter.wav',
};

// Disabled loops resolve to this: same API, zero fetches, zero playback.
const SILENT = {
  preloadAll: async () => {},
  changeSeason: () => {},
  setVolume: () => {},
  toggle: () => {},
  isPlaying: () => false,
};

// Generic looping-track player keyed by season (kept for when music returns).
const useAudioLoop = (tracks, defaultVolume, enabled) => {
  const buffersRef = useRef({});
  const currentSourceRef = useRef(null);
  const currentGainRef = useRef(null);
  const currentSeasonRef = useRef(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(defaultVolume);

  const loadTrack = useCallback(async (season) => {
    if (buffersRef.current[season]) return buffersRef.current[season];
    try {
      const ctx = engine.ensure();
      const response = await fetch(tracks[season]);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffersRef.current[season] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      return null;
    }
  }, [tracks]);

  const preloadAll = useCallback(async () => {
    await Promise.all(Object.keys(tracks).map(loadTrack));
  }, [loadTrack, tracks]);

  const playTrack = useCallback((season, fadeIn = 0) => {
    const ctx = engine.ensure();
    const buffer = buffersRef.current[season];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    gainNode.connect(engine.musicBus || ctx.destination);

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
  }, []);

  const stopTrack = useCallback((fadeOut = 0) => {
    if (!currentSourceRef.current || !currentGainRef.current) return;

    const ctx = engine.ensure();
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
  }, []);

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
      const ctx = engine.ensure();
      currentGainRef.current.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopTrack(0.3);
    } else if (currentSeasonRef.current) {
      playTrack(currentSeasonRef.current, 0.3);
    }
  }, [stopTrack, playTrack]);

  const api = { preloadAll, changeSeason, setVolume, toggle, isPlaying: () => isPlayingRef.current };
  return enabled ? api : SILENT;
};

export const useMusic = () => useAudioLoop(MUSIC_TRACKS, 0.3, MUSIC_ENABLED);
// The nature-ambience layer never shipped real files; keep it silent.
export const useAmbience = () => SILENT;
