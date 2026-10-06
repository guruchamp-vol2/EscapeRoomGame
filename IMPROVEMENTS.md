# Everything that could make Perspective Lab better

A working list. `[x]` is in the game, `[~]` is partly there, `[ ]` is not yet.
Grouped by what it improves; the most important groups come first.

## 1. Puzzles that feel like a real escape room
- [x] Search the room: drawers, cabinets, boxes and chests that open
- [x] Locked containers: find the key somewhere else in the room
- [x] Combination padlocks (3–4 digit) on chests and cabinets
- [x] Notes, letters and books to read, with clues in them
- [x] UV torch that reveals hidden writing on walls
- [x] Fuse box: find the fuse, restore power, read what the lights show
- [x] Stopped clocks whose time is part of a code
- [x] Paintings that swing open to reveal a wall safe
- [x] Bookshelf with one book that's out of place
- [x] Several clue chains that run side by side and come together in a final lock
- [x] Every room has a theme and a short story (study, lab, tomb, cabin, observatory, vault)
- [x] Rooms get deeper chains and more red herrings as levels go on
- [ ] Directional (↑↓←→) and letter locks
- [ ] Combining two items (battery + torch, two halves of a map)
- [ ] Jigsaw pieces scattered around a room
- [ ] Morse code from a blinking lamp, or a tune played on pipes
- [ ] Mirror writing, read via a mirror or a portal
- [ ] Puzzles that span several rooms (a clue in room 1 opens room 4)
- [ ] Co-op escape rooms (two players, split clues)

## 2. Difficulty and pacing
- [x] Every level measurably harder than the one before (ratings + rising `diff`; `npm run check:curve`)
- [x] Room count grows 3 → 4 → 5, plus the escape room finale
- [x] A new mechanic every world, introduced on its own first
- [x] Hints that cost stars instead of being free
- [ ] Optional "hard mode" remixes of finished levels (no hints, tighter timers)
- [ ] Per-level hint ladder (nudge → clue → answer) instead of one hint
- [ ] Play-tested par times from real players instead of estimates

## 3. Variety (no two levels alike)
- [x] 20 visual worlds, per-level palette shifts and per-room pattern changes
- [x] 5 start areas, 5 connector types, 4 exits
- [x] Lighting rigs, ceilings and floor styles per room
- [x] Distant scenery seen from bridges and overlooks
- [x] 466/500 distinct puzzle combinations; neighbouring levels share ~6% of rooms
- [ ] Rooms that aren't rectangles (L-shapes, rotundas, split levels)
- [ ] Day/night and weather in open-sky worlds
- [ ] Hand-built "showcase" levels every 25 levels
- [ ] Level editor and sharing of player-made levels

## 4. Reasons to come back
- [x] Stars, Fragments, Workshop cosmetics (portal colours, cube skins, hats for WREN)
- [x] Daily challenge (same level for everyone), daily quests, streaks
- [x] Leaderboards per level (all-time, weekly, no-hints, daily) and ghost races
- [x] The Curator's Journal: 20 hidden notes that tell a story
- [x] 23 achievements, ranks, lifetime stats
- [x] Share your result (copies a spoiler-free summary)
- [ ] Weekly event levels with their own cosmetics
- [ ] Friends list and friend leaderboards
- [ ] Season pass style progression track (free)
- [ ] Unlockable WREN voice lines and story chapters at milestones

## 5. Feel and presentation
- [x] Adaptive soundtrack that builds as you solve, per-world keys and tempos
- [x] Screen shake, FOV kicks, landing dips, edge flashes, controller rumble
- [x] Coyote time and jump buffering (platforming forgives near-misses)
- [x] Fade-in on level start, chapter cards, stingers on solves
- [x] Photo mode with free camera, zoom, tilt and grid
- [x] Credits roll
- [ ] Voice acting for WREN (text-to-speech option)
- [ ] Cutscenes between worlds
- [ ] Particle bursts when doors open and puzzles click
- [ ] Footstep sounds that change with the floor material

## 6. Controls and devices
- [x] Keyboard + mouse with full key rebinding
- [x] Gamepad (Xbox/PlayStation layout), with menu navigation
- [x] Phones and tablets: joystick, drag-to-look, on-screen buttons and number pad
- [x] Toggle sprint, separate mouse/controller sensitivity, invert Y
- [ ] Gyro aiming on phones
- [ ] Remappable controller buttons
- [ ] VR mode (WebXR)

## 7. Accessibility
- [x] Colour-blind letter tags on every colour-coded puzzle
- [x] Reduce motion, head bob toggle, interface and crosshair size
- [x] Subtitles for every WREN line; hints always available
- [ ] Screen-reader friendly menus
- [ ] High-contrast mode for puzzle pieces
- [ ] Hold-to-interact alternatives for rapid inputs (sprint doors)

## 8. Online and accounts
- [x] Accounts that survive restarts (Turso/libSQL), password reset by email
- [x] Server-timed runs (no fake times), rate limits
- [x] Progress synced between devices
- [ ] Sign in with Google/Discord
- [ ] Anti-cheat checks on ghost recordings
- [ ] Moderation tools for usernames

## 9. Technical
- [x] Every generated level proven solvable by an auto-solver
- [x] Free hosting blueprint (Render) with a persistent database
- [ ] Offline play as an installable app (PWA)
- [ ] Code splitting so the first load is smaller
- [ ] Automatic quality scaling on slow devices
- [ ] Telemetry: where players get stuck, to tune puzzles
