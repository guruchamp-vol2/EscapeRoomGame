// The 20 visual worlds generated levels are grouped into (25 levels each).
// Pure data — shared by the client and the server, so no three.js/DOM imports.
//
// wall/floor: texture pattern + colours. light: lighting mood. sky: open roof
// with a gradient sky instead of a ceiling. particles/decor: atmosphere.
export const WORLDS = [
  {
    name: 'Clinical', tagline: 'Spotless, bright and watching.',
    wall: { style: 'tile', base: '#d9dde2', line: '#b9c0c7' }, floor: { style: 'tile', base: '#9aa3ad', line: '#7d868f' },
    ceiling: '#c9ced4', accent: '#3aa0ff', light: { key: '#ffffff', lamp: '#f2f6ff', hemi: 0.8, exposure: 1.0, fog: null },
    particles: 'dust', decor: ['pillars', 'screens'], bloom: 0.35,
  },
  {
    name: 'Brutalist', tagline: 'Raw concrete, heavy silence.',
    wall: { style: 'concrete', base: '#77767a', line: '#5f5e62' }, floor: { style: 'concrete', base: '#55565a', line: '#3e3f42' },
    ceiling: '#3a3a3d', accent: '#ffb347', light: { key: '#ffe9cf', lamp: '#ffd9a8', hemi: 0.45, exposure: 1.0, fog: '#1a1a1c' },
    particles: 'dust', decor: ['beams', 'pillars'], bloom: 0.4,
  },
  {
    name: 'Neon Arcade', tagline: 'Insert coin. Mind the glow.',
    wall: { style: 'grid', base: '#1b1030', line: '#ff3df2' }, floor: { style: 'checker', base: '#140b24', line: '#2a1748' },
    ceiling: '#0d0718', accent: '#00f0ff', light: { key: '#b48cff', lamp: '#ff4fd8', hemi: 0.25, exposure: 1.1, fog: '#0b0614' },
    particles: 'fireflies', decor: ['screens', 'floating'], bloom: 0.9,
  },
  {
    name: 'Desert Ruins', tagline: 'Sandstone remembers every footstep.',
    wall: { style: 'brick', base: '#c99a62', line: '#9b7144' }, floor: { style: 'planks', base: '#b98a55', line: '#8e6539' },
    ceiling: null, accent: '#ffcf6b', light: { key: '#fff0d0', lamp: '#ffd18a', hemi: 0.9, exposure: 1.05, fog: null },
    sky: { top: '#3d7fd6', horizon: '#f6c98a', stars: false }, particles: 'sand', decor: ['arches', 'pillars'], bloom: 0.3,
  },
  {
    name: 'Arctic Station', tagline: 'Cold metal, colder logic.',
    wall: { style: 'plates', base: '#c8dceb', line: '#8fb0c8' }, floor: { style: 'plates', base: '#9eb6c8', line: '#6f8ba0' },
    ceiling: '#7f98ab', accent: '#7fe7ff', light: { key: '#e6f6ff', lamp: '#cfefff', hemi: 0.7, exposure: 1.0, fog: '#a9c3d6' },
    particles: 'snow', decor: ['crystals', 'pipes'], bloom: 0.45,
  },
  {
    name: 'Greenhouse', tagline: 'Everything here is growing. Even the puzzles.',
    wall: { style: 'stripes', base: '#a9c7a0', line: '#8db085' }, floor: { style: 'planks', base: '#7a5a3c', line: '#5c4129' },
    ceiling: null, accent: '#9dff6b', light: { key: '#fffbe6', lamp: '#eaffd0', hemi: 0.9, exposure: 1.0, fog: null },
    sky: { top: '#6fb7ff', horizon: '#e6f7ff', stars: false }, particles: 'fireflies', decor: ['plants', 'plants'], bloom: 0.35,
  },
  {
    name: 'Old Library', tagline: 'Quiet, please. Thinking in progress.',
    wall: { style: 'planks', base: '#5a3424', line: '#3f2218' }, floor: { style: 'herringbone', base: '#6e4630', line: '#4d2f1f' },
    ceiling: '#2b1a12', accent: '#ffc56b', light: { key: '#ffdcae', lamp: '#ffc98a', hemi: 0.35, exposure: 1.05, fog: '#140c08' },
    particles: 'dust', decor: ['shelves', 'shelves'], bloom: 0.5,
  },
  {
    name: 'The Void', tagline: 'There was a room here. Probably.',
    wall: { style: 'grid', base: '#08080c', line: '#272738' }, floor: { style: 'grid', base: '#060609', line: '#1d1d2c' },
    ceiling: null, accent: '#b8b8ff', light: { key: '#c9c9ff', lamp: '#9a9aff', hemi: 0.2, exposure: 1.1, fog: null },
    sky: { top: '#000003', horizon: '#0b0b1c', stars: true }, particles: 'dust', decor: ['floating', 'floating'], bloom: 0.8,
  },
  {
    name: 'Candyland', tagline: 'Sweet puzzles. Sticky solutions.',
    wall: { style: 'dots', base: '#ffc6e2', line: '#ff8fc4' }, floor: { style: 'checker', base: '#bff5e3', line: '#8fe3c6' },
    ceiling: '#ffe0f0', accent: '#ff5fa8', light: { key: '#fff4fb', lamp: '#ffe2f2', hemi: 0.9, exposure: 1.0, fog: null },
    particles: 'fireflies', decor: ['floating', 'pillars'], bloom: 0.35,
  },
  {
    name: 'Foundry', tagline: 'Hot steel and hotter heads.',
    wall: { style: 'plates', base: '#6b4532', line: '#3d2419' }, floor: { style: 'plates', base: '#3b2c25', line: '#20160f' },
    ceiling: '#1e1410', accent: '#ff7b2e', light: { key: '#ffb37a', lamp: '#ff8a3d', hemi: 0.3, exposure: 1.1, fog: '#1a0d07' },
    particles: 'embers', decor: ['pipes', 'beams'], bloom: 0.75,
  },
  {
    name: 'Abyssal', tagline: 'Pressure builds the deeper you go.',
    wall: { style: 'waves', base: '#0f3d4f', line: '#1d6b80' }, floor: { style: 'waves', base: '#0b2c39', line: '#14495a' },
    ceiling: '#06202b', accent: '#3dffe0', light: { key: '#7ff0ff', lamp: '#4fd8ff', hemi: 0.3, exposure: 1.1, fog: '#04232e' },
    particles: 'bubbles', decor: ['crystals', 'floating'], bloom: 0.7,
  },
  {
    name: 'Art Deco', tagline: 'Gold leaf and geometry.',
    wall: { style: 'herringbone', base: '#1c1c1f', line: '#b8913a' }, floor: { style: 'marble', base: '#232326', line: '#cfa64a' },
    ceiling: '#141416', accent: '#ffcc55', light: { key: '#fff1d6', lamp: '#ffd98a', hemi: 0.35, exposure: 1.05, fog: '#0c0c0d' },
    particles: 'dust', decor: ['arches', 'pillars'], bloom: 0.6,
  },
  {
    name: 'Cyber Grid', tagline: 'Compiled, optimized, still confusing.',
    wall: { style: 'circuit', base: '#06140c', line: '#1fd36b' }, floor: { style: 'grid', base: '#030b06', line: '#0f5b2f' },
    ceiling: '#020804', accent: '#39ff88', light: { key: '#9dffc7', lamp: '#39ff88', hemi: 0.2, exposure: 1.1, fog: '#020a05' },
    particles: 'fireflies', decor: ['screens', 'cables'], bloom: 0.85,
  },
  {
    name: 'Sunset Atrium', tagline: 'Golden hour, every hour.',
    wall: { style: 'marble', base: '#f2d9c4', line: '#d9a98a' }, floor: { style: 'tile', base: '#e8c1a0', line: '#c99877' },
    ceiling: null, accent: '#ff8a5c', light: { key: '#ffc9a0', lamp: '#ffb98a', hemi: 0.85, exposure: 1.05, fog: null },
    sky: { top: '#5b4bb0', horizon: '#ff9a6b', stars: false }, particles: 'dust', decor: ['pillars', 'plants'], bloom: 0.45,
  },
  {
    name: 'Moonlit Gallery', tagline: 'The statues are only pretending.',
    wall: { style: 'marble', base: '#2b3550', line: '#53618a' }, floor: { style: 'tile', base: '#1e2538', line: '#2f3a57' },
    ceiling: null, accent: '#cfe0ff', light: { key: '#bcd0ff', lamp: '#9fb8ff', hemi: 0.35, exposure: 1.1, fog: null },
    sky: { top: '#02040e', horizon: '#1b2648', stars: true }, particles: 'fireflies', decor: ['statues', 'arches'], bloom: 0.6,
  },
  {
    name: 'Crystal Cavern', tagline: 'Every surface hums a different note.',
    wall: { style: 'hex', base: '#2a1640', line: '#a46bff' }, floor: { style: 'hex', base: '#1d0f2e', line: '#6a3fb0' },
    ceiling: '#130a20', accent: '#d08bff', light: { key: '#e0c4ff', lamp: '#b77bff', hemi: 0.3, exposure: 1.1, fog: '#100820' },
    particles: 'fireflies', decor: ['crystals', 'crystals'], bloom: 0.9,
  },
  {
    name: 'Volcanic', tagline: 'The floor is not lava. Yet.',
    wall: { style: 'hex', base: '#1e1a19', line: '#4a2a1a' }, floor: { style: 'concrete', base: '#262120', line: '#140f0e' },
    ceiling: '#120d0c', accent: '#ff4d1a', light: { key: '#ff9a6b', lamp: '#ff5a2a', hemi: 0.25, exposure: 1.1, fog: '#1c0a05' },
    particles: 'embers', decor: ['crystals', 'pillars'], bloom: 0.85,
  },
  {
    name: 'Origami', tagline: 'Fold here. Then think again.',
    wall: { style: 'stripes', base: '#f4efe6', line: '#e2d8c6' }, floor: { style: 'tile', base: '#e9e1d2', line: '#d3c7b1' },
    ceiling: '#f6f1e8', accent: '#ff6b6b', light: { key: '#fffaf0', lamp: '#fff4e0', hemi: 0.95, exposure: 0.95, fog: null },
    particles: 'none', decor: ['floating', 'statues'], bloom: 0.25,
  },
  {
    name: 'Chrome Hall', tagline: 'Polished until it reflects your mistakes.',
    wall: { style: 'plates', base: '#9ea6b0', line: '#6c7480', metal: 0.85 }, floor: { style: 'plates', base: '#5f6670', line: '#3c424a', metal: 0.8 },
    ceiling: '#2a2e34', accent: '#9fd8ff', light: { key: '#eaf4ff', lamp: '#d6ecff', hemi: 0.5, exposure: 1.0, fog: null },
    particles: 'dust', decor: ['pillars', 'floating'], bloom: 0.5,
  },
  {
    name: 'Glitch', tagline: 'Th3 r00m 1s l00k1ng b4ck.',
    wall: { style: 'checker', base: '#1a0f1f', line: '#36163f' }, floor: { style: 'circuit', base: '#0d0610', line: '#ff2bd6' },
    ceiling: '#07030a', accent: '#00ff9c', light: { key: '#ff7ae6', lamp: '#00ffb0', hemi: 0.25, exposure: 1.1, fog: '#08030a' },
    particles: 'fireflies', decor: ['screens', 'floating'], bloom: 0.9,
  },
];

// Section identity: how each world *plays* and is *built*, not just its colours.
//   families    puzzle families it favours (see FAMILY in plan.js)
//   connectors  the passages between rooms it prefers
//   starts      arrival areas it prefers
//   rigs        room lighting it prefers
//   mood        one line on the architecture's intent
const RHYTHM = [
  { families: ['scale', 'cipher'], connectors: ['hall', 'gallery'], starts: ['corridor', 'airlock'], rigs: ['panels', 'skylight'], mood: 'Orderly. One idea per room.' },
  { families: ['scale', 'hazard'], connectors: ['stairs', 'chicane'], starts: ['airlock', 'corridor'], rigs: ['spots', 'panels'], mood: 'Heavy and vertical. Everything is a climb.' },
  { families: ['pattern', 'motion'], connectors: ['chicane', 'bridge'], starts: ['lobby', 'elevator'], rigs: ['neon'], mood: 'Fast and flashy. Rooms want to be played.' },
  { families: ['space', 'cipher'], connectors: ['stairs', 'bridge'], starts: ['overlook'], rigs: ['lanterns', 'spots'], mood: 'Ruins that fold back on themselves.' },
  { families: ['portal', 'search'], connectors: ['hall', 'chicane'], starts: ['airlock', 'elevator'], rigs: ['panels', 'spots'], mood: 'Sealed modules and locked lockers.' },
  { families: ['scale', 'motion'], connectors: ['gallery', 'bridge'], starts: ['lobby', 'overlook'], rigs: ['skylight', 'lanterns'], mood: 'Growing things, open air.' },
  { families: ['cipher', 'hazard'], connectors: ['gallery', 'stairs'], starts: ['lobby'], rigs: ['sconces', 'lanterns'], mood: 'Quiet rooms full of things to read.' },
  { families: ['space', 'portal'], connectors: ['bridge'], starts: ['overlook'], rigs: ['spots', 'neon'], mood: 'Islands of floor in nothing at all.' },
  { families: ['motion', 'pattern'], connectors: ['chicane', 'gallery'], starts: ['lobby'], rigs: ['lanterns', 'neon'], mood: 'Bouncy, sticky, built so you stay.' },
  { families: ['scale', 'hazard'], connectors: ['stairs', 'bridge'], starts: ['elevator', 'airlock'], rigs: ['spots'], mood: 'Catwalks over furnaces.' },
  { families: ['pattern', 'search'], connectors: ['hall', 'stairs'], starts: ['airlock'], rigs: ['spots', 'neon'], mood: 'Deep, pressurised, watching.' },
  { families: ['cipher', 'scale'], connectors: ['gallery'], starts: ['lobby', 'elevator'], rigs: ['sconces', 'lanterns'], mood: 'Grand halls and gilded riddles.' },
  { families: ['cipher', 'space'], connectors: ['chicane', 'hall'], starts: ['elevator'], rigs: ['neon'], mood: 'Compiled corridors, logic gates.' },
  { families: ['motion', 'portal'], connectors: ['bridge', 'gallery'], starts: ['overlook'], rigs: ['lanterns'], mood: 'Wide, warm and airborne.' },
  { families: ['pattern', 'hazard'], connectors: ['gallery'], starts: ['lobby'], rigs: ['sconces', 'spots'], mood: 'A gallery at night. Something moves.' },
  { families: ['space', 'motion'], connectors: ['stairs', 'chicane'], starts: ['overlook'], rigs: ['neon', 'lanterns'], mood: 'Caverns that ring when you move.' },
  { families: ['motion', 'hazard'], connectors: ['bridge', 'stairs'], starts: ['overlook', 'airlock'], rigs: ['spots'], mood: 'Bridges over heat. Do not linger.' },
  { families: ['scale', 'space'], connectors: ['chicane', 'gallery'], starts: ['corridor', 'lobby'], rigs: ['skylight', 'panels'], mood: 'Paper walls that fold into new rooms.' },
  { families: ['portal', 'cipher'], connectors: ['hall', 'gallery'], starts: ['elevator'], rigs: ['panels', 'neon'], mood: 'Reflections that answer back.' },
  { families: ['space', 'pattern'], connectors: ['chicane', 'bridge', 'stairs'], starts: ['corridor', 'airlock'], rigs: ['neon'], mood: 'Rules that change when you look away.' },
];
WORLDS.forEach((w, i) => { w.rhythm = RHYTHM[i]; });

export const LEVELS_PER_WORLD = 25;
