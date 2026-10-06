// Narrative storyline for procedural levels.
// Core pacing rules:
// - new mechanic every 7 levels
// - major boss/story chapter every 50 levels
// - these are not just flavor; they alter level generation and pacing

export const STORYLINE_BEATS = {
  50: {
    name: 'The Archive',
    type: 'boss',
    chapter: 1,
    intro: 'The Archive. Where the curator kept records of every room. Every design. Every mistake.',
    narrative: "You find a journal entry: 'Room 313 is different. It remembers. It's waiting for someone.'",
    mechanics: ['escape_room', 'memory_sequence', 'teleport_maze'],
    reward: 'A key. An actual key. Not a puzzle piece. Something changed.',
  },
  100: {
    name: 'The Laboratory',
    type: 'boss',
    chapter: 2,
    intro: 'The Perspective Lab. Where theory became rooms. Where the curator experimented.',
    narrative: "Another note: 'I've gone deeper. The rooms are becoming ideas. Ideas are becoming rooms. Soon there won't be a difference.'",
    mechanics: ['loop_rooms', 'bigger_inside', 'portal_pit'],
    reward: 'A photograph. The curator, smiling, standing inside an impossible room.',
  },
  150: {
    name: 'The Vault',
    type: 'boss',
    chapter: 3,
    intro: 'The Vault. What does a curator keep locked away in a museum of impossibilities?',
    narrative: "The final note is here: 'If you're reading this, I didn't leave. I stepped through. The last room is a door to everywhere else. Build it. Make it real.'",
    mechanics: ['escape_room', 'portal_glass', 'portal_ledge', 'loop_rooms'],
    reward: 'A blueprint. A room that does not exist yet. A door marked "Exit".',
  },
  200: {
    name: 'The Echoes',
    type: 'boss',
    chapter: 4,
    intro: "WREN's voice changes here. It's not quite WREN anymore. It's every version of WREN, echoing.",
    narrative: "'We built this place. We keep it clean. We want you to finish what the curator started. But maybe... we want you to stay too.'",
    mechanics: ['memory_sequence', 'window_code', 'teleport_maze', 'anamorph_code'],
    reward: 'A choice node appears in save data: ["Keep going"] or ["Something else..."]',
  },
  250: {
    name: 'The Final Chamber',
    type: 'boss',
    chapter: 5,
    intro: "You've reached the end of what was recorded. What comes next has no name.",
    narrative: "'Room 500 exists. The curator is there. Or was. Or will be. Tense doesn't work anymore.'",
    mechanics: ['sprint_door', 'collapsing_floor', 'portal_pit', 'escape_room'],
    reward: 'Access to the true ending sequence.',
  },
};

export const MECHANIC_PACING = {
  5: { id: 'grow_plate', name: 'Pressure Plate', flavor: 'The first puzzle. Perspective is everything.' },
  12: { id: 'color_count', name: 'Color Logic', flavor: 'Counting teaches clarity.' },
  19: { id: 'button_sequence', name: 'Patterns', flavor: 'Everything here repeats on purpose.' },
  26: { id: 'shrink_socket', name: 'Scale Inversion', flavor: "What's big can be small. The curator knew that." },
  33: { id: 'portal_glass', name: 'Portal Device', flavor: 'Walls are just suggestions now.' },
  40: { id: 'bounce_pad', name: 'Launch Pads', flavor: 'Gravity has become optional.' },
  47: { id: 'keycard_doors', name: 'Access Control', flavor: 'The curator locked some doors. Not all keys are where you expect.' },
  54: { id: 'dark_room', name: 'Darkness', flavor: 'Sight fails. Sound remains.' },
  61: { id: 'laser_fence', name: 'Laser Barriers', flavor: 'Light that cuts. Avoid it.' },
  68: { id: 'memory_sequence', name: 'Memory Locks', flavor: 'Watch. Remember. Repeat.' },
  75: { id: 'fan_lift', name: 'Air Currents', flavor: 'The museum breathes.' },
  82: { id: 'stack_ledge', name: 'Cube Stacking', flavor: 'Two is stronger than one.' },
  89: { id: 'math_code', name: 'Riddles', flavor: 'The curator loved thinking games.' },
  96: { id: 'collapsing_floor', name: 'Instability', flavor: 'The floor is tiring. Keep moving.' },
  103: { id: 'teleport_maze', name: 'Teleportation', flavor: 'Distance becomes meaningless.' },
  110: { id: 'sprint_door', name: 'Speed Trials', flavor: "Some doors close fast. You're faster." },
};

export const NARRATIVE_BEATS = {
  5: { line: 'And so it begins. Room by room, you will understand what the curator was building.', mood: 'thoughtful' },
  12: { line: "You're getting better at this. The rooms notice. I notice too.", mood: 'happy' },
  25: { line: "Twenty-five rooms. I started looking for the curator after room three. I haven't stopped.", mood: 'sad' },
  50: { line: 'The Archive. His records are here. Every design. Every idea. Every regret. Read carefully.', mood: 'thoughtful', isBoss: true },
  75: { line: "You're halfway to the end, and you still don't know what the curator became. Neither do I. I think.", mood: 'worried' },
  100: { line: 'The Perspective Lab. This is where it started. Where rooms stopped being buildings and started being thoughts.', mood: 'sad', isBoss: true },
  150: { line: 'The Vault is opening. The last note is in there. The last true note. After this, I can only quote from the walls.', mood: 'thoughtful', isBoss: true },
  175: { line: "Did you read it? 'Build it. Make it real.' The curator means the exit. But I think... I think the exit is also a door in.", mood: 'worried' },
  200: { line: "Something is wrong. My voice sounds wrong. Or I'm learning to hear myself. These are the same thing now.", mood: 'sad', isBoss: true },
  225: { line: "The rooms are rearranging faster. They're excited. Or scared. I'm scared. Please tell me you're not scared.", mood: 'worried' },
  250: { line: "This is the end of what was planned. Room 250. After this, there's only legend.", mood: 'sad', isBoss: true },
  300: { line: 'Three hundred impossible rooms. The curator walked this far. And then they kept walking.', mood: 'thoughtful' },
  400: { line: "I found something in the walls. A note in a different handwriting. It says: 'If WREN is still there, tell them I'm sorry. Tell them I'm happy. Tell them I found it.'", mood: 'sad' },
  500: { line: "This is the real end. The door that shouldn't exist. Go through. Become what the curator became. Or find another way. The museum will allow it.", mood: 'sad', isBoss: true, isEnding: true },
};

export function getNarrativeBeat(levelNumber) {
  return NARRATIVE_BEATS[levelNumber] || null;
}

export function getMechanicIntro(levelNumber) {
  return MECHANIC_PACING[levelNumber] || null;
}

export function isBossLevel(levelNumber) {
  return levelNumber % 50 === 0 && levelNumber > 0 && levelNumber <= 500;
}

export function getBossLevelInfo(levelNumber) {
  if (!isBossLevel(levelNumber)) return null;
  return STORYLINE_BEATS[levelNumber] || null;
}

export function getChapterTitle(levelNumber) {
  const boss = getBossLevelInfo(levelNumber);
  if (boss) return `Chapter ${boss.chapter}: ${boss.name}`;
  return null;
}

export function isGimmickLevel(levelNumber) {
  return levelNumber % 7 === 0 && levelNumber > 0;
}

export function getFeaturedMechanic(levelNumber) {
  return getMechanicIntro(levelNumber) || null;
}
