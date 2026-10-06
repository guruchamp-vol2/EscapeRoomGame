// Player preferences, persisted in localStorage when available.
const KEY = 'perspective-lab:settings';

export const DEFAULTS = {
  sensitivity: 1,
  fov: 75,
  volume: 0.7,
  invertY: false,
  showTimer: true,
  headBob: true,
  highQuality: true, // bloom, vignette and shadows
  raceGhost: true,
  wren: true, // the caretaker drone's commentary
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
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
