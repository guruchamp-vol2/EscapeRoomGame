// The curator mystery, and the rhythm it imposes on level generation.
// Pure data + helpers (no three.js / DOM): the planner and server import it.
//
// Rhythm, from small to large:
//   * every 7 levels  a FEATURED mechanic is foregrounded: forced into the
//                     level, its family boosted, with its own WREN line.
//                     (Brand-new mechanics still arrive once per world.)
//   * every 50 levels a CHAPTER turns: the museum's tone shifts, and level 50k
//                     is a BOSS level: an extra room, the chapter's mechanics,
//                     a pressure twist, its own architecture and a story reveal.
//   * within a chapter the STORY PULSE runs arrival → exploration → pressure,
//                     which drives twists, lighting, music and WREN's mood.
//
// The mystery: the player isn't only solving puzzles. They are finding out why
// the museum exists and why its rooms are becoming self-aware. It ties into
// the 20 Curator's Notes (one per world) and WREN's milestones.

export const CHAPTER_LENGTH = 50;
export const FEATURE_EVERY = 7;

// Chapter 0 is the prologue (the four story chambers). Chapter k (1–10) covers
// levels 50(k-1)+1 … 50k and ends in its boss level; 501–504 are the epilogue.
export const CHAPTERS = [
  {
    name: 'The Galleries', tone: 'curious',
    art: { tint: '#9fc4ff', motif: null },
    summary: 'A museum of impossible rooms, a missing curator, and a caretaker drone who keeps the floors clean.',
  },
  {
    name: 'The Archive', tone: 'curious', boss: 50,
    art: { tint: '#e8c27a', motif: 'archive' },
    intro: 'The Archive. Where the curator kept records of every room. Every design. Every mistake.',
    narrative: "A ledger of every room in the museum. Most entries are in the curator's handwriting. The last two hundred are not in any handwriting at all. They were printed by the building. One line is circled: 'Room 313 is different. It remembers. It is waiting for someone.'",
    reward: 'The rooms after the curator left were not built by anyone. They were grown.',
    mechanics: ['escape_room', 'memory_sequence', 'teleport_maze', 'anamorph_code', 'loop_rooms'],
    pressure: [],
  },
  {
    name: 'The Laboratory', tone: 'uneasy', boss: 100,
    art: { tint: '#7affc8', motif: 'lab' },
    intro: 'The Perspective Lab. Where theory became rooms. Where the curator experimented.',
    narrative: "Lab notes, in a hurry: 'Every solved puzzle teaches the building something. It learns from the visitors. I have gone deeper. The rooms are becoming ideas. Ideas are becoming rooms. Soon there won't be a difference.'",
    reward: 'A photograph: the curator, smiling, standing inside a room that should not fit inside anything.',
    mechanics: ['loop_rooms', 'bigger_inside', 'portal_pit', 'keycard_doors'],
    pressure: ['decoys'],
    pressureText: 'Some portal panels here are fake. The museum has started to lie.',
  },
  {
    name: 'The Vault', tone: 'tense', boss: 150,
    art: { tint: '#b8c4d4', motif: 'vault' },
    intro: 'The Vault. What does a curator keep locked away in a museum of impossibilities?',
    narrative: "The last note in the curator's own hand: 'If you're reading this, I didn't leave. I stepped through. The last room is a door to everywhere else. Build it. Make it real.' Folded inside: a blueprint for a door marked EXIT.",
    reward: 'A blueprint. A room that does not exist yet. A door marked "Exit".',
    mechanics: ['escape_room', 'portal_glass', 'portal_ledge', 'loop_rooms', 'dark_room'],
    pressure: ['blackout'],
    pressureText: 'The Vault keeps its lights off. Bring your own.',
  },
  {
    name: 'The Echoes', tone: 'eerie', boss: 200,
    art: { tint: '#9a8cff', motif: 'echoes' },
    intro: "WREN's voice changes here. It's not quite WREN anymore. It's every version of WREN, echoing.",
    narrative: "A hundred WRENs, all talking at once: 'We built this place. We keep it clean. We want you to finish what the curator started. But maybe... we want you to stay too.' The daughter's rooms were designed so people stay. It worked on the drones first.",
    reward: 'One of the echoes stays behind and says, very quietly, "please don\'t stay".',
    mechanics: ['memory_sequence', 'window_code', 'teleport_maze', 'anamorph_code', 'laser_fence'],
    pressure: ['decoys'],
    pressureText: 'False panels again. The echoes are trying to keep you here.',
  },
  {
    name: 'The Recorded End', tone: 'hollow', boss: 250,
    alt: {"narrative":"The curator's maps stop here. Beside them, in fresh ink that matches your own handwriting: a map of the next fifty rooms. You don't remember drawing it. The echoes say you will.","reward":"The museum has started asking what you'd build next."},
    art: { tint: '#ff7a5c', motif: 'unfinished' },
    intro: "You've reached the end of what was recorded. What comes next has no name.",
    narrative: "The curator's maps stop here, mid-line. Beyond this the museum improvises, building each room from what it learned from the rooms you solved. 'Room 500 exists. The curator is there. Or was. Or will be. Tense doesn't work anymore.'",
    reward: 'From here on, nobody designed anything. The museum is making it up as you go.',
    mechanics: ['sprint_door', 'collapsing_floor', 'portal_pit', 'escape_room', 'fan_lift'],
    pressure: [],
  },
  {
    name: 'The Blueprint', tone: 'determined', boss: 300,
    alt: {"narrative":"The blueprint isn't for an exit any more. It's for a room. Your room. Every puzzle you solved since the Echoes is in it, arranged the way you like them. The museum is not building a way out. It is building a place for you.","reward":"A brick with your name on it. The museum seems proud."},
    art: { tint: '#4aa8ff', motif: 'blueprint' },
    intro: 'The exit blueprint, pinned to a wall the size of a city. Half of it is already built.',
    narrative: "You recognise the bricks. Each one is a puzzle you solved: the plate you weighed down in level 9, the code you counted in level 40. The museum has been building the curator's exit out of you. It is two hundred rooms from finished.",
    reward: 'Every room you solve from now on adds a brick to the door.',
    mechanics: ['stack_ledge', 'two_plates', 'cube_rescue', 'math_code', 'escape_room'],
    pressure: ['blackout'],
    pressureText: 'Construction lights only. The rest of the wing is dark.',
  },
  {
    name: 'The Mirror Wing', tone: 'eerie', boss: 350,
    alt: {"narrative":"Your ghost walks a few seconds ahead, and it's happy. It waves. On the mirror: 'It only copies what it loves.' The echoes have added, underneath: 'We love you. Stay.'","reward":"For the first time, your reflection waits for you."},
    art: { tint: '#e0f0ff', motif: 'mirror' },
    intro: 'Room 313 remembered you. This wing does more than remember. It imitates.',
    narrative: "Someone walked these rooms before you, in exactly your footsteps, a few seconds ahead. Your ghost, rehearsing. The museum has learned to predict you. A note scratched into a mirror: 'It only copies what it loves. Do something it can't copy.'",
    reward: 'For the first time, the museum looks surprised.',
    mechanics: ['portal_glass', 'window_code', 'loop_rooms', 'teleport_maze', 'bigger_inside'],
    pressure: ['decoys'],
    pressureText: 'Half the panels here are reflections.',
  },
  {
    name: 'The Engine', tone: 'urgent', boss: 400,
    alt: {"narrative":"The engine runs on attention, and you have been giving it all of yours. It purrs. The curator kept it alive alone for eleven years. You've made it sing. Somewhere above, a dark wing switches its lights back on.","reward":"Two whole wings wake up. The museum is growing again."},
    art: { tint: '#ff9a3c', motif: 'engine' },
    intro: 'Under the floors, something enormous turns over. It runs on attention.',
    narrative: "The Abyssal note was right: the pressure is attention. The museum only exists while someone is solving it. Every visitor who left let a wing go dark. The curator didn't vanish. He kept paying attention, from the inside, so the building wouldn't die.",
    reward: 'The engine slows when you stop to read. It speeds up when you solve.',
    mechanics: ['fan_lift', 'collapsing_floor', 'laser_fence', 'sprint_door', 'escape_room'],
    pressure: ['blackout', 'decoys'],
    pressureText: 'The engine room is dark and full of false panels. Keep moving.',
  },
  {
    name: "The Curator's Room", tone: 'tender', boss: 450,
    alt: {"narrative":"The curator's room, and a second chair, freshly built, facing his. On the desk his letter to WREN: 'Let them leave anyway.' Under it, a new note in the echoes' handwriting: 'They chose to stay. Is that allowed?' Nobody has answered it yet.","reward":"WREN pulls the second chair out for you."},
    art: { tint: '#ffcf9a', motif: 'home' },
    intro: "A small room. A desk, a chair, a cold cup of tea. Nobody has been here for eleven years.",
    narrative: "His room is the only one in the museum with a window to outside. Real rain on real glass. On the desk, a child's drawing labelled CANDYLAND, and a letter: 'WREN, they will want to stay. You will want them to stay. Let them leave anyway. That is the whole point of a door.'",
    reward: 'WREN reads the letter twice. It does not say anything for a long time.',
    mechanics: ['escape_room', 'memory_sequence', 'math_code', 'keycard_doors', 'dark_room'],
    pressure: ['decoys'],
  },
  {
    name: 'The Door to Everywhere', tone: 'final', boss: 500,
    alt: {"narrative":"The exit stands finished in an empty hall. Through it: everywhere else. You don't go through. You turn the sign on the door around, from EXIT to WELCOME, and leave it open for whoever comes next.","reward":"The museum has a new curator."},
    art: { tint: '#fff0b0', motif: 'door' },
    intro: 'The last brick. The door the curator drew, the museum built, and you finished.',
    narrative: "The exit stands in an empty hall, real and finished. Through it: everywhere else. The curator's voice, from every wall at once: 'You built it. Thank you. Now go, before the building learns to miss you.' WREN opens the door, and holds it.",
    reward: 'The museum lets you go.',
    mechanics: ['sprint_door', 'teleport_maze', 'stack_ledge', 'portal_pit', 'escape_room'],
    pressure: ['blackout', 'decoys'],
    pressureText: 'Everything the museum has, all at once.',
  },
];

// The choice offered after The Echoes (level 200).
export const CHOICE = {
  chapter: 4,
  prompt: "The echoes go quiet and wait. One of them asks, very politely: will you finish the curator's door and leave? Or will you stay and listen to what the museum wants?",
  options: [
    { id: 'leave', label: 'Keep going', detail: "Finish the curator's door. Then walk through it." },
    { id: 'stay', label: 'Something else...', detail: 'Listen to the museum. Maybe it needs a curator more than a door.' },
  ],
};

// A boss chapter's text for a player, honouring their choice.
export function bossStory(chapter, choice) {
  const c = CHAPTERS[chapter];
  if (!c) return null;
  const alt = choice === 'stay' && c.alt ? c.alt : {};
  return { name: c.name, intro: c.intro, narrative: alt.narrative ?? c.narrative, reward: alt.reward ?? c.reward, pressureText: c.pressureText ?? null };
}

// The true ending, shown after level 500 (one per choice).
export const ENDINGS = {
  leave: [
    'The last brick settles into place.',
    'The door the curator drew, the museum built, and you finished, stands open.',
    'Through it: rain on real streets. Real sky. Everywhere else.',
    'WREN holds the door. "He said to let you leave," it says. "So. Leave. Please come back."',
    'You step through.',
    'Behind you, five hundred impossible rooms turn their lights down, one by one, gently, like a house when the guests have gone.',
    'THE END',
  ],
  stay: [
    'The last brick settles into place.',
    "The exit is finished. It's beautiful. You don't go through it.",
    'You turn the sign on the door from EXIT to WELCOME.',
    'Every light in the museum comes on at once. Wings you never saw. Rooms nobody has solved yet.',
    'WREN takes the curator\'s old keys from the desk and gives them to you. "You\'ll need these," it says. "Everything is locked. He locked everything."',
    'Somewhere far below, a new visitor walks through the front door.',
    'THE END. THE MUSEUM HAS A NEW CURATOR.',
  ],
};

// What the echoes whisper in the chapters where the museum starts to talk.
export const WHISPERS = [
  '...stay...', 'We kept the floors clean for you.', 'You could stay. There is room.', '...the door is not finished...',
  'We like the way you think.', '...he stayed too...', 'Every room you solve, we learn.',
];

// Boss fights: the last room of every boss level is an arena. The boss hides
// its core behind a shield; each phase breaks the shield with a mechanic the
// chapter taught (using only tools you have by then). Attacks knock you back
// to the arena entrance; nothing kills you.
//   phases: switches | order | plate | beam | grapple | blink | tether | gel | echo | chrono | lantern
//   attack: sweep (a low laser circling the arena: jump it) | wave (a shockwave
//           ring: jump it) | both | none
export const BOSSES = {
  1: { name: 'THE LEDGER', color: '#e8c27a', attack: 'sweep', phases: ['switches', 'plate', 'grapple'],
    lines: { start: 'Every room is written down. You are not written down. You will be.', hit: ['A page torn out.', 'You do not belong in the margins.', 'Unrecorded. Unacceptable.'], end: 'Fine. Write yourself in.' } },
  2: { name: 'SPECIMEN ZERO', color: '#7affc8', attack: 'wave', phases: ['beam', 'plate', 'blink'],
    lines: { start: 'I was the first room he grew. Let me grow around you.', hit: ['That stung. I am learning.', 'Again? I am learning faster.', 'You are a very good teacher.'], end: 'Lesson... learned.' } },
  3: { name: 'THE LOCK', color: '#b8c4d4', attack: 'sweep', phases: ['order', 'tether', 'gel'],
    lines: { start: 'Forty-one locks. He made them all for you. Well. For her.', hit: ['Tumbler one: open.', 'Tumbler two: open. How rude.', 'Nobody opens me.'], end: 'Click.' } },
  4: { name: 'THE CHOIR', color: '#9a8cff', attack: 'wave', phases: ['echo', 'beam', 'switches'],
    lines: { start: 'We are two hundred and twelve voices. Stay, stay, stay.', hit: ['Some of us are listening to you.', 'Fewer of us are singing.', 'The song is changing.'], end: '...thank you.' } },
  5: { name: 'THE IMPROVISER', color: '#ff7a5c', attack: 'both', phases: ['chrono', 'blink', 'plate'],
    lines: { start: 'No plans left. Just me, making it up. Watch this.', hit: ['I did not plan that.', 'I did not plan that either.', 'I am running out of ideas. That has never happened.'], end: 'Encore? No? Fair.' } },
  6: { name: 'THE ARCHITECT', color: '#4aa8ff', attack: 'sweep', phases: ['lantern', 'gel', 'plate'],
    lines: { start: 'Every brick of that door is yours. Every brick of me is his.', hit: ['A load-bearing wall. Gone.', 'You are better at this than he was.', 'Structural integrity: questionable.'], end: 'Build it, then. Build it well.' } },
  7: { name: 'YOUR REFLECTION', color: '#e0f0ff', attack: 'wave', phases: ['beam', 'echo', 'grapple'],
    lines: { start: 'I learned you. Every step. Every pause. Now do something I can\'t.', hit: ['I would have done that.', 'I would not have done that.', 'Who taught you that?'], end: 'You were never a copy.' } },
  8: { name: 'THE ENGINE', color: '#ff9a3c', attack: 'both', phases: ['chrono', 'switches', 'tether'],
    lines: { start: 'Pay attention. PAY ATTENTION. He did, for eleven years.', hit: ['Gear three slipping.', 'You could let me rest.', 'Let me rest.'], end: 'Quiet. Finally, quiet.' } },
  9: { name: 'WHAT ELIAS LEFT', color: '#ffcf9a', attack: 'none', phases: ['lantern', 'echo', 'grapple'],
    lines: { start: '(a tired, kind voice) I am not going to fight you. Light my lanterns, if you like.', hit: ['That one was hers.', 'That one was mine.', 'That one is yours.'], end: 'There. Now the room is warm.' } },
  10: { name: 'THE MUSEUM', color: '#fff0b0', attack: 'both', phases: ['grapple', 'chrono', 'beam', 'echo'],
    lines: { start: 'Everything I have. Every room. Every trick. One last time, together.', hit: ['That was the Archive.', 'That was the Engine.', 'That was the Mirror.', 'That was me.'], end: 'Go on, then. The door is open.' } },
};

// Anomalies: how self-aware the rooms are, by chapter (see anomalies.js).
//   watchers  eyes that follow you         flicker   lights notice you pass
//   whispers  echoes in WREN's subtitles   seal      doors close behind you
//   ghost     your ghost, a few s behind   engine    rooms dim when you stop
//   rain      a window with real rain
export const ANOMALIES = [
  [], [], ['watchers'], ['watchers', 'flicker'], ['watchers', 'flicker', 'whispers'],
  ['flicker', 'seal'], ['watchers', 'seal'], ['ghost', 'watchers', 'seal'], ['engine', 'flicker', 'seal'],
  ['rain', 'watchers'], ['ghost', 'engine', 'whispers', 'watchers'],
];

// Old-style lookup by boss level (kept for anything that used it).
export const STORYLINE_BEATS = Object.fromEntries(CHAPTERS.filter((c) => c.boss).map((c, i) => [c.boss, { ...c, type: 'boss', chapter: i + 1 }]));

// What WREN says when a mechanic is FEATURED (every 7 levels).
export const FEATURE_FLAVOR = {
  grow_plate: 'The first puzzle, again. Perspective is everything.',
  step_ledge: 'A ledge. You know this one. Do it faster.',
  shrink_socket: "What's big can be small. The curator knew that.",
  portal_glass: 'Walls are just suggestions now.',
  portal_ledge: 'Up is a direction. Portals disagree.',
  anamorph_code: 'Stand in the right place and the mess becomes a message.',
  loop_rooms: 'Corridors that come back. Count your laps.',
  bigger_inside: 'Bigger on the inside. Most good things are.',
  color_count: 'Counting teaches clarity.',
  button_sequence: 'Everything here repeats on purpose.',
  bounce_pad: 'Gravity has become optional.',
  portal_pit: 'Mind the gap. Or, better, portal over it.',
  keycard_doors: 'The curator locked some doors. Not all keys are where you expect.',
  dark_room: 'Sight fails. Find the switch.',
  laser_fence: 'Light that cuts. Block it, then walk.',
  two_plates: 'Two plates, one of you. Think in cubes.',
  memory_sequence: 'Watch. Remember. Repeat.',
  window_code: 'A window into a room that is somewhere else entirely.',
  fan_lift: 'The museum breathes.',
  cube_rescue: 'A cube in a glass case. Rescue it.',
  stack_ledge: 'Two is stronger than one.',
  math_code: 'The curator loved thinking games.',
  collapsing_floor: 'The floor is tired. Keep moving.',
  teleport_maze: 'Distance becomes meaningless.',
  sprint_door: "Some doors close fast. You're faster.",
  escape_room: 'A room to search, properly. Open everything.',
};

// WREN beats at specific levels (non-boss). Boss levels use their chapter intro.
export const NARRATIVE_BEATS = {
  5: { line: 'And so it begins. Room by room, we will find out what the curator was building.', mood: 'thoughtful' },
  12: { line: "You're getting better at this. The rooms notice. I notice too.", mood: 'happy' },
  25: { line: "Twenty-five rooms. I started looking for the curator after room three. I haven't stopped.", mood: 'sad' },
  75: { line: "Some of these rooms were built after the curator disappeared. Nobody I know built them.", mood: 'worried' },
  125: { line: 'The rooms learn from you. I can tell. This one copied the way you hesitate at doors.', mood: 'worried' },
  175: { line: "Did you read it? 'Build it. Make it real.' The curator means the exit. But I think the exit is also a door in.", mood: 'worried' },
  225: { line: "The rooms are rearranging faster. They're excited. Or scared. I'm scared. Please tell me you're not scared.", mood: 'worried' },
  275: { line: 'Nobody drew this room. The museum made it up just now, for you. It is very proud of it.', mood: 'thoughtful' },
  313: { line: "Room 313. The ledger said it remembers. Hello, room. ...It said hello back. I'm choosing not to think about that.", mood: 'worried' },
  325: { line: 'Half a door. Every room you solve is a brick. I counted.', mood: 'happy' },
  375: { line: 'Your ghost went this way a moment ago. Try to surprise it.', mood: 'thoughtful' },
  425: { line: 'The engine is louder when you stop. Keep going. For both of us.', mood: 'worried' },
  475: { line: "Almost there. I don't know what I'll do when there are no more rooms to clean.", mood: 'sad' },
  501: { line: "You came back. After the door. The museum is very quiet. I think it's happy.", mood: 'happy' },
};

// ---------- helpers used by the planner and the game ----------

export function isBossLevel(n) {
  return n > 0 && n <= 500 && n % CHAPTER_LENGTH === 0;
}

// Chapter for level n: the chapter whose boss is the next one at or after n.
export function chapterFor(n) {
  const idx = Math.min(CHAPTERS.length - 1, Math.ceil(Math.max(n, 1) / CHAPTER_LENGTH));
  return { index: idx, ...CHAPTERS[idx] };
}

// Where in its chapter a level sits: arrival → exploration → pressure → boss.
export function storyPulse(n) {
  if (isBossLevel(n)) return 'boss';
  if (n > 500) return 'epilogue';
  const pos = (n % CHAPTER_LENGTH) / CHAPTER_LENGTH;
  if (pos < 0.2) return 'arrival';
  if (pos < 0.62) return 'exploration';
  return 'pressure';
}

export const PULSE = {
  arrival: { twistChance: 0.4, aimShift: -0.1, mood: 'calm' },
  exploration: { twistChance: 1, aimShift: 0, mood: 'curious' },
  pressure: { twistChance: 1.5, aimShift: 0.1, mood: 'tense' },
  boss: { twistChance: 0, aimShift: 0.15, mood: 'boss' },
  epilogue: { twistChance: 0.5, aimShift: 0, mood: 'calm' },
};

export const isFeatureLevel = (n) => n >= 5 && (n - 5) % FEATURE_EVERY === 0;

export function getBossLevelInfo(n) {
  return isBossLevel(n) ? STORYLINE_BEATS[n] ?? null : null;
}

export function getChapterTitle(n) {
  const boss = getBossLevelInfo(n);
  return boss ? `Chapter ${boss.chapter}: ${boss.name}` : null;
}

export function getNarrativeBeat(n) {
  return NARRATIVE_BEATS[n] ?? null;
}
