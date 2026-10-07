// Player preferences, persisted in localStorage when available.
import { defaultBindings } from './controls.js';
const KEY = 'perspective-lab:settings';

export const DEFAULTS = {
  sensitivity: 1,
  fov: 75,
  volume: 0.7, // sound effects
  musicVolume: 0.45,
  invertY: false,
  showTimer: true,
  headBob: true,
  highQuality: true, // bloom, vignette and shadows
  raceGhost: true,
  wren: true, // the caretaker drone's commentary
  storyScenes: true, // a story scene before every third level (first time only)
  // Accessibility & comfort
  reduceMotion: false, // no screen shake, FOV kicks or head bob
  colorblind: false, // letter tags on colour-coded puzzles
  uiScale: 1,
  crosshairSize: 1,
  toggleSprint: false,
  padSensitivity: 1,
  bindings: defaultBindings(),
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...saved, bindings: { ...DEFAULTS.bindings, ...saved.bindings } };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode etc.) — settings just won't persist.
  }
}
