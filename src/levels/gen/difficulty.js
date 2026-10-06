// Difficulty configuration system.
// Exported at level-generation time, consumed by module implementations.

export const DIFFICULTY_PRESETS = {
  EASY: {
    modeName: 'Easy Mode',
    signpostingIntensity: 0.9,
    pathBranchCount: 0.4,
    codeLength: () => 3,
    timerDuration: () => 120,
    multiRoomDependencies: false,
    hintFrequency: 0.7,
    visibilityModifier: 1.0,
    timeDecay: false,
    motionSensitivity: 1.0,
    abstractPuzzleLogic: false,
  },

  NORMAL: {
    modeName: 'Normal Mode',
    signpostingIntensity: 0.5,
    pathBranchCount: 0.65,
    codeLength: (baseDiff) => baseDiff >= 0.5 ? 4 : 3,
    timerDuration: (baseDiff) => 60 + baseDiff * 30,
    multiRoomDependencies: true,
    hintFrequency: 0.4,
    visibilityModifier: 0.85,
    timeDecay: true,
    motionSensitivity: 1.0,
    abstractPuzzleLogic: false,
  },

  HARD: {
    modeName: 'Hard Mode',
    signpostingIntensity: 0.2,
    pathBranchCount: 1.0,
    codeLength: () => 5,
    timerDuration: (baseDiff) => 30 + baseDiff * 40,
    multiRoomDependencies: true,
    hintFrequency: 0.15,
    visibilityModifier: 0.65,
    timeDecay: true,
    motionSensitivity: 1.3,
    abstractPuzzleLogic: true,
  },
};

export function getDifficultyConfig(difficultyMode) {
  return DIFFICULTY_PRESETS[difficultyMode] || DIFFICULTY_PRESETS.NORMAL;
}

export function computeDifficultyParams(baseDiff, difficultyMode = 'NORMAL') {
  const config = getDifficultyConfig(difficultyMode);
  return {
    codeLength: config.codeLength(baseDiff),
    timerDuration: config.timerDuration(baseDiff),
    multiRoomDependencies: config.multiRoomDependencies,
    hintFrequency: config.hintFrequency,
    signpostingIntensity: config.signpostingIntensity,
    pathBranchCount: config.pathBranchCount,
    visibilityModifier: config.visibilityModifier,
    timeDecay: config.timeDecay,
    motionSensitivity: config.motionSensitivity,
    abstractPuzzleLogic: config.abstractPuzzleLogic,
  };
}
