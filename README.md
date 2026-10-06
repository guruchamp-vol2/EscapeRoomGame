# Perspective Lab

A first-person puzzle game in the browser (Three.js + a small Node server), built
around three "impossible" mechanics:

- **Forced perspective** (Superliminal-style): a held object keeps its on-screen
  size. Look far away and it grows; look close and it shrinks.
- **Portals**: a portal device fires linked blue/orange portals onto white panels.
  You can see and walk through them seamlessly.
- **Impossible geometry**: rooms bigger on the inside, corridors that never end.

## Chambers

| # | Chamber | Teaches |
| --- | --- | --- |
| 01 | **Scale** | Grow a cube into a step to climb a ledge, then shrink it into a socket. |
| 02 | **Gateway** | Use the portal device to get past a glass wall and up to a high exit. |
| 03 | **The Loop** | An endless corridor. Each lap changes the room number; collect the code, then find room 0. |
| 04 | **Perspective Lab** | The finale: every mechanic in one room. |

Then **500 generated levels** (5–504) across **20 worlds** of 25 levels each:
Clinical, Brutalist, Neon Arcade, Desert Ruins, Arctic Station, Greenhouse, Old
Library, The Void, Candyland, Foundry, Abyssal, Art Deco, Cyber Grid, Sunset
Atrium, Moonlit Gallery, Crystal Cavern, Volcanic, Origami, Chrome Hall and
Glitch. Each world has its own textures, palette, lighting, sky or ceiling,
particles and decoration, and each level jitters them so no two look the same.

From level 10, every level ends in an **escape room**: a snug, furnished,
themed room (study, lab, captain's cabin, vault, observatory, tomb) that you
search like a real one. Drawers, cabinets, chests and wall safes open; some
need a key found elsewhere, some a combination padlock whose code is on a
note or counted from the books on a shelf. Clues are on notes, in UV ink that
only shows under the UV torch, on a panel that lights up once you find the
fuse, or in the time on a stopped clock. Each clue is one digit of the door
code, and the chains get deeper (and the red herrings more numerous) as you go.

Before that, a generated level chains 3–5 rooms, each holding one of **25 puzzle gimmicks**
with randomized layouts: grow a cube onto a plate, climb a ledge, shrink a cube
into a socket, portal past glass / up a ledge / over a chasm, rescue a cube from
a glass case, hold two plates at once, read an anamorphic code, count coloured
lights, press a button sequence, find the light switch in a blackout room, walk
an endless loop to the right room, explore a closet that's bigger inside, and
read a code through a window into a room somewhere else. Difficulty ramps from
one gimmick to four; each gimmick is introduced in its own level first.

Levels unlock in order. Generation is deterministic (seeded per level), so
everyone gets the same level 137, and per-level leaderboards are fair.

## WREN

The museum's caretaker: a small floating drone with one big eye that follows
you, reacts to what you do (falls, wrong codes, giant cubes, idling, fast or slow
finishes, ghosts), delivers hints, and tells a story across the worlds and
milestones. Its eye changes with its mood and it "talks" in a synthesized babble.
Its lines live in `src/wren/lines.js`; it can be turned off in Settings.

## Features

- **Accounts**: sign up or log in from the main menu, or play as a guest. Guest
  progress (unlocks, achievements, best times) carries over when you sign up.
- **Password reset**: add an email at sign-up or later from your profile, then use
  "Forgot your password?" (see [Email](#email) below).
- **Leaderboards per chamber**: All time, This week and No hints, plus a Daily board.
- **Daily challenge**: a brand-new generated level each day (UTC), the same for
  everyone. Daily runs have their own board and
  don't count on the regular ones.
- **Ghost replays**: every submitted run records your path. Tick "Race the fastest
  ghost" on the chamber screen to race a translucent replay of the top run.
- **Achievements**: 23, shown in your profile, plus lifetime stats (time played,
  distance walked, jumps, portals, photos…).
- **Plays anywhere**: keyboard + mouse (every key rebindable), any standard
  gamepad (with menu navigation and rumble), and phones/tablets (floating
  joystick, drag to look, on-screen buttons and a number pad for keypads).
- **Adaptive soundtrack**, generated live: each world has its own key, scale and
  tempo, and bass, arpeggios and drums join as you get closer to the exit.
- **Photo mode** (P): freeze the action, fly the camera a few metres, zoom,
  tilt, grid overlay, save a PNG.
- **Accessibility**: colour-blind letter tags on colour puzzles, reduce motion,
  interface and crosshair size, toggle sprint, subtitles for every line.
- **Share** a result (copies a spoiler-free summary), credits roll, pause-menu tips.
- **Speedrun splits** for each objective, compared against your best run.
- **Polish**: bloom, vignette, real-time shadows, glowing trim, dust, per-chamber
  colour themes, head bob, sprint FOV kick, chamber title cards, synthesized
  sound effects, and a pause menu with settings (sensitivity, FOV, volume, graphics
  quality, head bob, invert Y, timer).

Requires **Node 20+**.

## Progression

- **Every level is harder than the one before, measurably.** Each puzzle type
  has a difficulty rating; a level's load (the sum of its rooms) never drops,
  and `diff`, which every puzzle reads to tighten its numbers (heavier plates,
  taller ledges, smaller sockets, wider chasms, longer sequences, deeper
  escape-room chains…), rises every single level. `npm run check:curve`
  verifies all 500 levels.
- **No two levels alike**: 5 kinds of start area, 5 kinds of passage between
  rooms (stairs, open-air bridges, chicanes, galleries, halls), 4 exits,
  per-room lighting rigs, ceilings and floors, and huge distant shapes seen
  from bridges. Neighbouring levels share few puzzle types.
- **Every world introduces something new**, all the way through: colour counts,
  sequences, launch pads, chasms, keycard doors, blackout rooms, laser fences,
  twin plates, memory sequences, observation windows, wind lifts, cube rescues,
  cube staircases, riddles, crumbling floors, teleporter mazes, fake portal
  panels, sprint doors and full blackouts with a flashlight (F).
- **Stars** (1–3 per level, from time and hints). Each new world needs stars to
  open (45 per world), so earlier levels are worth replaying.
- **Fragments ◆** for clears, new stars, daily quests, streaks and notes; spend
  them in the **Workshop** on portal colours, cube skins and hats for WREN.
- **Daily quests** (3 a day) and a **daily streak** bonus.
- **The Curator's Journal**: 20 hidden notes (level 13 of each world) tell the
  story of what happened to the curator.
- **Rank titles** from Visitor to Legend as your star total grows.

See [IMPROVEMENTS.md](IMPROVEMENTS.md) for the full list of what's done and
what could come next.

## Put it online (free)

The game is a single Node web service. Accounts need a database that survives
restarts, and free hosts wipe their disk, so it uses a free hosted libSQL
database from [Turso](https://turso.tech).

1. **Database (Turso, free):** sign up, create a database, then copy its URL
   (`libsql://…turso.io`) and create an auth token. In the Turso dashboard
   both are on the database page, or with their CLI:
   `turso db show <name> --url` and `turso db tokens create <name>`.
2. **Web service (Render, free):** push this repo to GitHub, then in Render
   choose **New → Blueprint** and pick the repo. It reads `render.yaml` and asks
   for:
   - `DATABASE_URL` – the `libsql://…` URL
   - `DATABASE_AUTH_TOKEN` – the token
3. Deploy. The log line should say `storage: hosted libSQL`.

The tables are created automatically on first start. Render's free tier
sleeps after 15 minutes idle, so the first visit after a while takes ~30 s.
For real password-reset emails, also set the `SMTP_*` variables (see below).

## Run

```sh
npm install
npm run dev        # game + API with hot reload on http://localhost:5173
```

For production:

```sh
npm run build
npm start          # serves dist/ and the API
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5173` | Port to listen on |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | unset | Hosted libSQL/Turso database (use this in production) |
| `DB_FILE` | `data/game.db` | Local database file when `DATABASE_URL` is unset |
| `TRUST_PROXY` | unset | Set to `1` behind a host's proxy (Render) so rate limits use the real client IP |
| `PUBLIC_URL` | Render’s `RENDER_EXTERNAL_URL`, else `http://localhost:PORT` | Base URL used in password-reset links (set automatically on Render) |
| `SECURE_COOKIES` | unset | Set to `1` when serving over HTTPS |
| `AUTH_LIMIT_PER_MIN` | `10` | Login/sign-up attempts per IP per minute |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` | unset | Email delivery |

If the front end is hosted without the server (e.g. a static host), the game
still works, and online features show as offline.

### Email

Password-reset emails need an SMTP provider (e.g. your email host, SendGrid,
Mailgun, Amazon SES). Set `SMTP_HOST` and friends and the server sends real
email via nodemailer. **Without SMTP configured, the server prints each reset
email, including the link, to its console**, which is enough for local use.

| Key | Action |
| --- | --- |
| WASD / Mouse / Space | Move / look / jump |
| Shift | Sprint |
| E | Pick up, drop, use |
| Left / Right click | Blue / orange portal |
| 0–9, Backspace | Type on a keypad you're looking at |
| R | Recall cubes to where they started |
| H | Hint |
| Esc | Pause menu |

## Code map

| File | What it does |
| --- | --- |
| `src/main.js` | Game loop, level loading, input, interactions, run submission |
| `src/levels/meta.js` | Chamber list (shared with the server) |
| `src/levels/builder.js` | Level building blocks: rooms, lights, panels, cubes, plates, sockets, doors, keypads |
| `src/levels/scale.js` … `lab.js` | One file per chamber: geometry, objectives, hints, puzzle logic |
| `src/portals.js` | Portal rendering (render targets + oblique clipping) and teleporting |
| `src/perspective.js` | Forced-perspective grabbing and cube falling |
| `src/player.js` | First-person controller with AABB collision and camera feel |
| `src/ghost.js` | Ghost recording and playback |
| `src/fx.js` | Post-processing (bloom, vignette) |
| `src/random.js` | Seeded randomness for the daily challenge |
| `src/ui.js` | HUD and all menu screens |
| `src/account.js`, `src/api.js` | Logged-in/guest progress and the server API client |
| `src/audio.js` | Sound effects synthesized with the Web Audio API |
| `src/achievements.js` | Achievement list (shared with the server) |
| `server/index.js` | HTTP server: API plus Vite (dev) or `dist/` (prod) |
| `server/api.js` | Accounts, password reset, runs, leaderboards, ghosts |
| `server/auth.js`, `server/mailer.js`, `server/db.js` | Hashing/sessions, email, SQLite schema and migrations |

Generated levels live in `src/levels/gen/`: `worlds.js` (the 20 looks),
`plan.js` (which gimmicks each level gets; shared with the server),
`theme.js`, `cell.js` (one room per gimmick), `modules.js` (the 15 gimmicks),
`decor.js` and `generate.js`. To add a gimmick, add it to `MODULES` in
`plan.js` and `MODULE_IMPL` in `modules.js`, plus a solver in
`src/dev/autosolve.js`.

### Proving every level is solvable

`src/dev/autosolve.js` plays generated levels through the real game code:
cubes are grabbed and resized by forced perspective, portals fired and walked
through, doors must open. With `?debug` in the URL, run in the console:

```js
await __solve('p137')                       // one level
await __solveAll(['p5', 'p6', /* ... */])   // many
```

All 500 generated levels pass.

Open `http://localhost:5173/?debug&level=<id>` to run without pointer lock.
`window.__game` exposes state and actions for scripted testing.

## How the server protects the leaderboard

- Passwords are hashed with scrypt. Sessions are random tokens in an HttpOnly,
  SameSite=Lax cookie, and only a SHA-256 hash of each token is stored. Reset
  tokens are hashed too, expire after an hour, work once, and log out every
  other session when used. "Forgot password" answers identically whether or not
  the account exists.
- A run gets a server-side start time when play begins. A submitted time is
  rejected if it's longer than the real time the server measured (pauses are
  excluded on the client, so the client time can only be shorter), faster than
  the chamber's minimum plausible time, or submitted twice.
- Logins, sign-ups and resets are rate-limited per IP, POSTs must be JSON (a basic
  CSRF guard), and request bodies are size-limited.

This stops casual cheating, not a determined one: the game runs in the browser,
so a modified client could still submit a fake but plausible time (or ghost).
Achievements are trusted from the client.

## Solutions (spoilers)

<details><summary>01 Scale</summary>
Pick up the cube, stand back and look at the bottom of the ledge, and drop it
there (aim for roughly a 1 m cube). Jump onto it, then the ledge. From the edge,
pick the cube up again and look into the socket up close so it shrinks to fit.
</details>

<details><summary>02 Gateway</summary>
Take the device. Shoot a portal on a panel on your side and one on a panel behind
the glass (shots pass through glass). For the ledge, shoot the panel up there.
</details>

<details><summary>03 The Loop</summary>
Walk forward: rooms 2, 3 and 4 each show one digit. Then turn around and walk back
past the start to room 0, where the keypad works. Enter the digits in order.
</details>

<details><summary>04 Perspective Lab</summary>
Make the cube big on the pressure plate, take the portal device, portal into the
glass vault for the keycard, open the storage closet, stand on the eye marker in
the gallery and look east for the code, then type it at the exit.
</details>
