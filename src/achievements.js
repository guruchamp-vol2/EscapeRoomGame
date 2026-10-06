// Achievement definitions, shared by the game client and the server (which uses
// the keys to reject unknown achievements). Must stay free of DOM/three imports.
export const ACHIEVEMENTS = [
  { key: 'first_escape', icon: '🚪', name: 'Free at Last', desc: 'Complete your first chamber.' },
  { key: 'graduate', icon: '🎓', name: 'Graduate', desc: 'Complete the four story chambers.' },
  { key: 'dedicated', icon: '🧭', name: 'Dedicated', desc: 'Complete 25 levels.' },
  { key: 'centurion', icon: '💯', name: 'Centurion', desc: 'Complete 100 levels.' },
  { key: 'world_tour', icon: '🌍', name: 'World Tour', desc: 'Complete a level in 10 different worlds.' },
  { key: 'completionist', icon: '🏆', name: 'Completionist', desc: 'Complete all 504 levels.' },
  { key: 'giant', icon: '🗿', name: 'Think Big', desc: 'Grow a cube to 4 m across.' },
  { key: 'tiny', icon: '🔬', name: 'Honey, I Shrunk the Cube', desc: 'Shrink a cube below 15 cm.' },
  { key: 'thinking', icon: '🌀', name: 'Thinking with Portals', desc: 'Walk through a portal you placed.' },
  { key: 'frequent_flyer', icon: '✈️', name: 'Frequent Flyer', desc: 'Teleport 20 times in one run.' },
  { key: 'loop_master', icon: '♾️', name: 'Going in Circles', desc: 'Go around The Loop 10 times.' },
  { key: 'explorer', icon: '📦', name: 'Bigger on the Inside', desc: 'Step into the storage closet.' },
  { key: 'brute_force', icon: '🔢', name: 'Brute Force', desc: 'Enter 5 wrong codes in one run.' },
  { key: 'no_hints', icon: '🧠', name: 'No Help Needed', desc: 'Complete a chamber without hints.' },
  { key: 'minimalist', icon: '🎯', name: 'Portal Minimalist', desc: 'Escape the Lab firing only 2 portals.' },
  { key: 'quick', icon: '⏱️', name: 'Quick Thinker', desc: 'Escape the Lab in under 3 minutes.' },
  { key: 'speedrunner', icon: '⚡', name: 'Speedrunner', desc: 'Escape the Lab in under 90 seconds.' },
  { key: 'daily', icon: '📅', name: 'Daily Escapee', desc: 'Complete a daily challenge.' },
  { key: 'ghostbuster', icon: '👻', name: 'Ghostbuster', desc: 'Beat the ghost you were racing.' },
];

export const ACHIEVEMENT_KEYS = new Set(ACHIEVEMENTS.map((a) => a.key));
