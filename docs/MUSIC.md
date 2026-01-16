# Music System

## Overview
Ambient looping audio tied to game state - primarily seasons, potentially expandable to emotional states, events, or time of day.

## Source Files
Located in `/music/` - WAV files from Splice (AM OPII Guitar Session pack).

## Season Mapping (Proposed)

| Season | File | Key | BPM | Rationale |
|--------|------|-----|-----|-----------|
| Spring | `AM_OPII_Guitar_Session_02_SWELL_05_145bpm_Gmaj.wav` | G major | 145 | Bright, pastoral, energetic - new growth |
| Summer | `AM_OPII_Guitar_Session_03_SWELL_06_100bpm_Dmaj.wav` | D major | 100 | Sunny, warm - peak season energy |
| Fall | `AM_OPII_Guitar_Session_06_SWELL_03_92bpm_Bmaj.wav` | B major | 92 | Mellower tempo, transitional feel |
| Winter | `AM_OPII_Guitar_Session_01_SWELL_04_77bpm_TAIL.wav` | Unknown | 77 | Slowest, atmospheric - sparse, reflective |

### Spare Track
- `AM_OPII_Guitar_Session_14_SEQ_11_78bpm_Dmaj_TAIL.wav` - Could use for transitions or swap with winter

## Music Theory Notes
- **Major keys**: Generally brighter, happier feel
- **Key brightness** (circle of fifths): G/D major are "warm bright", B major has slight edge
- **Tempo**: Higher BPM = more energy, lower = contemplative
- **TAIL variants**: Atmospheric fade-outs, good for sparse/quiet moments

## Implementation Ideas

### Phase 1: Season Loops
- Load appropriate track on season change
- Crossfade between seasons (1-2 sec fade)
- Loop seamlessly

### Phase 2: Dynamic Layers (Future)
- Base ambient layer (current)
- Activity layer (planting sounds, harvesting)
- Weather layer (rain, wind)
- Time of day variations

### Phase 3: Emotional States (Future)
- Low gold = more tense undertone
- Successful harvest = brief major swell
- Failed crop = minor sting

## Technical Notes
- Files should move to `public/audio/` for production
- Consider converting to MP3/OGG for smaller file size
- Web Audio API for precise loop control and crossfades
- Respect user's existing sound system in `useSound()` hook

## File Naming Convention (Proposed)
When moving to public:
```
public/audio/
  ambient-spring.wav (or .mp3)
  ambient-summer.wav
  ambient-fall.wav
  ambient-winter.wav
```
