// Accessibility flags read while levels are built. Colour-blind mode tags every
// colour-coded puzzle piece with a letter (R, G, B, Y, M, C, O, W).
export const a11y = {
  colorblind: false,
  letters: {}, // hex → letter, filled by the modules that own the palettes
};

export function colorLetter(hex) {
  if (!a11y.colorblind || !hex) return null;
  return a11y.letters[String(hex).toLowerCase()] ?? null;
}
