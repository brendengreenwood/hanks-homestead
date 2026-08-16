export type { Oscillator, Spin, AnimationComponents } from './components';
export { registerAnimationComponents } from './components';
export { runOscillator } from './systems/OscillatorSystem';
export { runSpin } from './systems/SpinSystem';
export type { AnimationState, CharacterAnimInput, CharacterPose } from './characterAnim';
export {
  EMOTE_DURATION,
  createAnimationState,
  createCharacterPose,
  startEmote,
  cancelEmote,
  stepAnimationState,
  evaluateCharacterPose,
} from './characterAnim';
