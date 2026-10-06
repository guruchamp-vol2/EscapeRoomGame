import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Player } from './player.js';
import { Portal, PortalSystem } from './portals.js';
import { Grabber } from './perspective.js';
import { Sfx } from './audio.js';
import { UI, formatMs } from './ui.js';
import { loadSettings, saveSettings } from './settings.js';
import { Account } from './account.js';
import { ACHIEVEMENTS } from './achievements.js';
import { LEVELS, levelMeta, buildLevel, themeFor, DAILY_ID } from './levels/index.js';
import { LevelBuilder, makePortalGun, disposeScene } from './levels/builder.js';
import { GhostRecorder, GhostPlayer } from './ghost.js';
import { createPost } from './fx.js';
import { makeRng } from './random.js';
import { Wren } from './wren/wren.js';
import { LINES } from './wren/lines.js';
import { Progress, NOTES, levelUnlocked, continueId } from './progress.js';

// ---------- engine ----------
const settings = loadSettings();
const params = new URLSearchParams(location.search);
// ?debug lets automated tests drive the game without pointer lock.
const DEBUG = params.has('debug');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = settings.highQuality;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // updated once per frame, not once per portal pass
document.body.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.03, 400);
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const post = createPost(renderer, camera);

const player = new Player(camera);
const grabber = new Grabber();
const sfx = new Sfx();
sfx.setVolume(settings.volume);

// WREN, the museum's caretaker drone.
const wren = new Wren({ sfx, enabled: settings.wren });

// Flashlight for blackout levels (toggle with F).
const flashlight = new THREE.SpotLight('#fff4dd', 0, 30, 0.5, 0.55, 1.4);
flashlight.position.set(0.2, -0.1, 0);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight, flashlight.target);

const viewmodel = makePortalGun();
viewmodel.position.set(0.3, -0.27, -0.55);
viewmodel.scale.setScalar(0.75);
viewmodel.visible = false;
camera.add(viewmodel);

// ---------- UI & account ----------
const ui = new UI({
  onAction,
  onSetting,
  onChamber: (id) => play(id),
  onAuth: (u, p, mode, email) => account.login(u, p, mode === 'register', email),
  onForgot: (login) => account.forgotPassword(login),
  onReset: (password) => account.resetPassword(resetToken, password),
  onEmail: (email) => account.setEmail(email),
  onBoard: loadBoard,
  onShop: (op, slot, id) => {
    const ok = op === 'buy' ? progress.buy(slot, id) : progress.equip(slot, id);
    if (ok) {
      sfx.play(op === 'buy' ? 'item' : 'ui');
      if (op === 'buy') wren.say('purchase', { cooldown: 20 });
      applyCosmetics();
    } else {
      sfx.play('denied');
    }
    ui.renderWorkshop(progress);
  },
});
ui.loadSettings(settings);

// Long-term progress (stars, Fragments, Workshop, quests, notes).
const progress = new Progress({ onChange: () => { renderMenu(); scheduleSync(); } });
function renderMenu() {
  ui.renderMenu(account, settings, progress);
}
let syncTimer = 0;
function scheduleSync() {
  if (!account?.user) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => account.saveProgress(progress.data), 1500);
}
// Cosmetics: WREN's hat, portal colours on the crosshair and device.
function applyCosmetics() {
  wren.setHat(progress.equipped('hat').id);
  const [a, c] = progress.equipped('portal').colors;
  document.documentElement.style.setProperty('--portal-a', a);
  document.documentElement.style.setProperty('--portal-b', c);
  viewmodel.userData.rings.blue.material.color.set(a).multiplyScalar(1.5);
  viewmodel.userData.rings.orange.material.color.set(c).multiplyScalar(1.5);
}

let progressLoadedFor = null;
const account = new Account({
  onChange: () => {
    renderMenu();
    wren.name = account.user?.username ?? 'Visitor';
    const who = account.user?.username ?? null;
    if (who && progressLoadedFor !== who) {
      progressLoadedFor = who;
      account.loadProgress().then((remote) => {
        if (remote) progress.merge(remote);
        // Levels finished before stars existed count as one star.
        for (const id of Object.keys(account.levels)) progress.data.stars[id] ||= 1;
        progress.save();
        applyCosmetics();
      });
    } else if (!who) {
      progressLoadedFor = null;
    }
  },
  onAchievement: (def) => {
    wren.say('achievement', { chance: 0.4, cooldown: 20 });
    ui.achievementPop(def);
    sfx.play('achievement');
  },
});
for (const id of Object.keys(account.levels)) progress.data.stars[id] ||= 1;
renderMenu();
applyCosmetics();
account.init();

// Password reset links look like /?reset=TOKEN.
let resetToken = params.get('reset');
if (resetToken) {
  history.replaceState(null, '', location.pathname);
  ui.show('reset');
} else if (!DEBUG) {
  ui.show('main');
}

async function loadBoard(level, kind) {
  ui.renderBoard({ loading: true });
  try {
    const result = await account.leaderboard(level, kind);
    if (ui.boardLevel === level && ui.boardKind === kind) ui.renderBoard(result, account.user?.username);
  } catch (err) {
    ui.renderBoard({ error: err.message });
  }
}

function onSetting(name, value) {
  settings[name] = value;
  saveSettings(settings);
  if (name === 'fov') {
    camera.fov = value;
    camera.updateProjectionMatrix();
  } else if (name === 'volume') {
    sfx.setVolume(value);
  } else if (name === 'wren') {
    wren.enabled = value;
    if (!value) wren.clear();
  } else if (name === 'highQuality') {
    renderer.shadowMap.enabled = value;
    game?.scene.traverse((o) => {
      if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
    });
  }
}

function onAction(action) {
  sfx.unlock();
  sfx.play('ui');
  switch (action) {
    case 'continue': play(continueId(progress)); break;
    case 'daily': play(DAILY_ID, true); break;
    case 'resume': requestLock(); break;
    case 'restart':
    case 'replay': play(game.id, game.daily); break;
    case 'next': {
      const i = LEVELS.findIndex((l) => l.id === game.id) + 1;
      if (levelUnlocked(progress, i)) play(LEVELS[i].id);
      break;
    }
    case 'quit':
      wren.say('menu', { cooldown: 30 });
    case 'home': ui.show('main'); break;
    case 'leaderboard':
      if (ui.returnTo === 'win' && game) ui.openBoard(game.id, game.daily ? 'daily' : 'all');
      loadBoard(ui.boardLevel, ui.boardKind);
      break;
    case 'profile': ui.renderProfile(account); break;
    case 'workshop': ui.renderWorkshop(progress); break;
    case 'journal': ui.renderJournal(progress); break;
    case 'auth': ui.setAuthMode('login'); break;
    case 'logout': account.logout(); break;
  }
}

function requestLock() {
  if (DEBUG) {
    onLockChange(true);
    return;
  }
  try {
    const p = renderer.domElement.requestPointerLock();
    // Browsers refuse a re-lock for ~1s after Esc.
    if (p?.catch) p.catch(() => ui.toast('Give it a second, then click again.', { type: 'warn', ms: 2000 }));
  } catch {
    // Older browsers: no promise, nothing to do.
  }
}

// ---------- levels ----------
let game = null;

function loadLevel(id, daily = false) {
  if (grabber.held) grabber.drop();
  sfx.stopHeld();
  if (game) {
    game.ghost?.dispose();
    game.scene.remove(camera); // keep the viewmodel out of the disposal
    wren.detach();
    disposeScene(game.scene);
    game.portals.portals.forEach((p) => p.rt.dispose());
  }
  ui.clearToasts();

  const def = levelMeta(id, account.today);
  const scene = new THREE.Scene();
  scene.environment = envMap;
  scene.environmentIntensity = 0.35;
  const portals = new PortalSystem(scene);
  const flags = { hasGun: false };
  const ctx = {
    sfx,
    flags,
    rng: makeRng(null),
    toast: (msg, type = 'info') => ui.toast(msg, { type }),
    say: (event, opts) => wren.say(event, opts),
    player,
    respawn: () => respawnPlayer(),
    unlock: (key) => account.unlock(key),
    cubeSkin: progress.data.equipped.cube,
    hasNote: (w) => progress.hasNote(w),
    onNote: (w) => {
      const fresh = progress.collectNote(w);
      ui.showNote(w, NOTES[w], fresh);
      sfx.play('item');
      if (fresh) wren.say('note_found', { priority: 2, cooldown: 0 });
    },
  };
  const theme = themeFor(def);
  const b = new LevelBuilder(scene, portals, ctx, theme);
  const level = buildLevel(def, b, ctx);
  flags.hasGun = level.hasGun;
  post.setBloom(theme.bloom ?? 0.5);
  renderer.toneMappingExposure = theme.exposure ?? 1.05;

  const [colA, colB] = progress.equipped('portal').colors;
  const dim = (c) => new THREE.Color(c).multiplyScalar(0.45).getHex();
  const blue = portals.add(new Portal({ width: 1.1, height: 2.2, rimColor: new THREE.Color(colA).getHex(), flatColor: dim(colA), oval: true, name: 'blue' }));
  const orange = portals.add(new Portal({ width: 1.1, height: 2.2, rimColor: new THREE.Color(colB).getHex(), flatColor: dim(colB), oval: true, name: 'orange' }));
  PortalSystem.link(blue, orange);
  scene.add(camera);
  wren.attach(scene);

  player.spawn(level.spawn.pos, level.spawn.yaw);
  player.applyCamera();
  viewmodel.visible = flags.hasGun;
  flashlight.intensity = level.flashlight ? 60 : 0;

  game = {
    id, def, daily, scene, portals, b, level, blue, orange, flags,
    started: false,
    escaped: false,
    elapsed: 0,
    hinted: new Set(),
    splits: [],
    portalsFired: 0,
    teleports: 0,
    wrongCodes: 0,
    recorder: new GhostRecorder(),
    ghost: null,
  };
  scene.updateMatrixWorld(true); // raycasts need world matrices before the first render
  post.setScene(scene);
  resize();
  renderer.shadowMap.needsUpdate = true;
  ui.setChamberLabel(def, daily);
  ui.setGhostDelta('');
  refreshHud();

  if (settings.raceGhost && account.online) {
    const session = game;
    account.ghost(id, daily).then((g) => {
      if (!g || game !== session) return;
      session.ghost = new GhostPlayer(scene, g);
      ui.setGhostDelta(`Racing 👻 ${g.username} · ${formatMs(g.timeMs)}`);
    });
  }
}

function play(id, daily = false) {
  loadLevel(id, daily);
  requestLock();
}

function onLockChange(isLocked) {
  locked = isLocked;
  keys.clear();
  if (locked) {
    ui.hideMenu();
    if (!game.started) {
      game.started = true;
      account.startRun(game.id, game.daily);
      ui.chapter(game.def, game.daily);
      setTimeout(() => introLine(game), 1400);
    }
    return;
  }
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
  }
  if (game?.started && !game.escaped) {
    const step = game.level.steps[game.level.stage()];
    ui.setPauseInfo(game.def.name, step.label, game.elapsed);
    ui.show('pause');
  }
}

function refreshHud() {
  const { level, flags } = game;
  ui.setObjectives(level.steps, level.stage(), game.hinted.size);
  const items = flags.hasGun ? ['device'] : [];
  ui.setInventory([...items, ...(level.inventory?.() ?? [])]);
}

// ---------- keypads ----------
function keypadInput(kp, key) {
  if (kp.solved) return;
  if (!kp.enabled()) {
    sfx.play('denied');
    ui.toast('The keypad is dead. No signal in this room.', { type: 'warn', ms: 2000 });
    return;
  }
  if (key === 'Backspace') kp.entered = kp.entered.slice(0, -1);
  else if (/^[0-9]$/.test(key) && kp.entered.length < kp.code.length) kp.entered += key;
  else return;
  sfx.play('beep');

  if (kp.entered.length === kp.code.length) {
    if (kp.entered === kp.code) {
      kp.solved = true;
      sfx.play('unlock');
      ui.toast('Access granted.', { type: 'success' });
      kp.onSolve?.();
      kp.idle();
    } else {
      kp.draw('ERR', '#ff4b4b');
      sfx.play('error');
      kp.flash = 0.8;
      wren.say(game.wrongCodes >= 2 ? 'wrong_code_many' : 'wrong_code', { chance: 0.6, cooldown: 8 });
      kp.entered = '';
      if (++game.wrongCodes >= 5) account.unlock('brute_force');
    }
  } else {
    kp.idle();
  }
  refreshHud();
}

// ---------- aiming & interaction ----------
const raycaster = new THREE.Raycaster();
const eye = new THREE.Vector3();
const dir = new THREE.Vector3();
let aim = null;

function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function castFrom(list, far) {
  raycaster.set(eye, dir);
  raycaster.far = far;
  const held = grabber.held?.mesh;
  return raycaster.intersectObjects(list, false).find((h) => h.object !== held && isShown(h.object)) ?? null;
}

function findInteract(o) {
  for (; o; o = o.parent) if (o.userData.interact) return o;
  return null;
}

// [key, text, locked] for what the player is looking at.
function promptFor(a) {
  if (grabber.held) return ['E', 'Drop'];
  if (!a?.kind) return [null, ''];
  const near = a.distance < 3;
  switch (a.kind) {
    case 'cube': return ['E', 'Pick up'];
    case 'gun': return near ? ['E', 'Take portal device'] : [null, ''];
    case 'keypad': {
      const kp = a.obj.userData.keypad;
      if (kp.solved) return [null, ''];
      return kp.enabled() ? ['0-9', 'Type the code'] : [null, 'No signal.', true];
    }
    case 'button': return near ? ['E', a.obj.userData.label ?? 'Press'] : [null, ''];
    default: return game.level.prompt?.(a.kind, a.distance, a.obj) ?? [null, ''];
  }
}

function updateAim() {
  const hit = castFrom(game.b.solids, 3.5);
  const obj = hit && findInteract(hit.object);
  aim = hit ? { kind: obj?.userData.interact ?? null, obj, distance: hit.distance } : null;
  const [key, text, lockedPrompt] = promptFor(aim);
  ui.setPrompt(key, text, lockedPrompt);
  ui.setCrosshair({
    hasGun: game.flags.hasGun, blue: game.blue.placed, orange: game.orange.placed, usable: !!key && !lockedPrompt,
  });
}

function interact() {
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
    sfx.play('drop');
    return;
  }
  if (!aim?.kind) return;
  switch (aim.kind) {
    case 'cube':
      grabber.grab(aim.obj.userData.cube, eye);
      sfx.play('pickup');
      sfx.startHeld();
      break;
    case 'gun':
      if (aim.distance > 3) return;
      game.flags.hasGun = true;
      aim.obj.visible = false;
      viewmodel.visible = true;
      sfx.play('item');
      ui.toast('Portal device acquired. Left click: blue portal. Right click: orange portal.', { type: 'success', ms: 5000 });
      break;
    case 'keypad':
      ui.toast('Type the code with the number keys while looking at the keypad.', { type: 'info', ms: 2500 });
      break;
    case 'button':
      if (aim.distance < 3) aim.obj.userData.press();
      break;
    default:
      game.level.interact?.(aim.kind, aim.distance, aim.obj);
  }
  refreshHud();
}

function fire(portal) {
  if (!game.flags.hasGun || grabber.held) return;
  const isBlue = portal === game.blue;
  sfx.play(isBlue ? 'fireBlue' : 'fireOrange');
  viewmodel.userData.rings[isBlue ? 'blue' : 'orange'].scale.setScalar(1.6);
  const hit = castFrom(game.b.gunSolids, 150);
  game.lastShot = hit && { point: hit.point.toArray(), panel: !!hit.object.userData.panel, size: hit.object.geometry?.parameters };
  if (!hit) return;
  const rec = hit.object.userData.panel;
  if (!rec) {
    sfx.play('fizzle');
    if (!wren.say('fizzle', { cooldown: 25 })) ui.toast("That surface won't hold a portal. Look for white panels.", { type: 'warn', ms: 2000 });
    return;
  }
  if (portal.link.placed && portal.link.panel === rec) {
    sfx.play('fizzle');
    ui.toast('The other portal is already there.', { type: 'warn', ms: 2000 });
    return;
  }
  portal.place(rec.point, rec.rotY, [rec.wall], rec);
  game.portalsFired++;
  progress.event('portal');
  sfx.play('portalOpen');
  refreshHud();
}

function hint() {
  const step = game.level.stage();
  game.hinted.add(step);
  sfx.play('hint');
  const text = game.level.steps[step].hint;
  if (!wren.sayText(text, 'thoughtful', 3)) ui.toast(text, { type: 'hint', ms: 8000 });
  refreshHud();
}

function recallCubes() {
  if (!game.b.cubes.length) return;
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
  }
  for (const c of game.b.cubes) c.resetHome();
  sfx.play('portalOpen');
  ui.toast('Cubes returned to where they started.', { type: 'info', ms: 2000 });
}

// ---------- input ----------
const keys = new Set();
let locked = false;

document.addEventListener('pointerlockchange', () => {
  onLockChange(document.pointerLockElement === renderer.domElement);
});

document.addEventListener('keydown', (e) => {
  if (!locked) return;
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyE') interact();
  else if (e.code === 'KeyH') hint();
  else if (e.code === 'KeyR') recallCubes();
  else if (e.code === 'KeyF' && game.level.flashlight) flashlight.intensity = flashlight.intensity > 0 ? 0 : 60;
  else if (aim?.kind === 'keypad' && (e.key === 'Backspace' || /^[0-9]$/.test(e.key))) {
    keypadInput(aim.obj.userData.keypad, e.key);
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('keydown', () => (lastActive = performance.now()));
document.addEventListener('mousemove', (e) => {
  if (locked) {
    player.look(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
    lastActive = performance.now();
  }
});
document.addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) fire(game.blue);
  else if (e.button === 2) fire(game.orange);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  post.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  game?.portals.resize(size.x, size.y);
}
window.addEventListener('resize', resize);

// ---------- simulation ----------
const tmp = new THREE.Vector3();
const prevEye = new THREE.Vector3();
let stepDistance = 0;

function playerFeedback(dt) {
  if (player.jumped) sfx.play('jump');
  if (player.landImpact > 5) sfx.play('land');
  const speed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && speed > 0.8) {
    stepDistance += speed * dt;
    if (stepDistance > 2.0) {
      stepDistance = 0;
      sfx.play('step');
    }
  }
  // Sprint widens the view a little.
  const sprinting = speed > 5 && player.onGround;
  const targetFov = settings.fov + (sprinting ? 6 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
  }
}

function update(dt) {
  game.portals.animate(dt);
  game.b.update(dt);
  for (const ring of Object.values(viewmodel.userData.rings)) {
    ring.scale.setScalar(1 + (ring.scale.x - 1) * Math.exp(-10 * dt));
  }

  // Menu background: slowly look around the chamber.
  if (!locked && !game.started) {
    player.yaw += dt * 0.08;
    player.applyCamera(dt, 0);
    return;
  }
  if (!locked || game.escaped) return;
  game.elapsed += dt;

  player.eye(prevEye);
  const ignore = game.portals.ignoreSet(player.center(tmp));
  player.update(dt, keys, game.b.colliders, ignore);
  const through = game.portals.checkTeleport(player, prevEye, player.eye(tmp));
  if (through) {
    game.teleports++;
    progress.event('teleport');
    sfx.play('teleport');
    if (through === game.blue || through === game.orange) {
      account.unlock('thinking');
      if (!seenPortal) {
        seenPortal = true;
        wren.say('first_portal');
      }
    }
    if (game.teleports === 12) wren.say('loop_laps', { cooldown: 60 });
    if (game.teleports >= 20) account.unlock('frequent_flyer');
    game.level.onTeleport?.(through);
  }
  player.applyCamera(dt, settings.headBob ? 1 : 0);
  playerFeedback(dt);

  if (player.pos.y < -20 || game.level.fellOut?.(player)) {
    respawnPlayer();
    if (!wren.say('fell', { priority: 2, cooldown: 4 })) ui.toast('Whoops. Back to the start.', { type: 'warn' });
  }

  player.eye(eye);
  camera.getWorldDirection(dir);
  grabber.update(eye, dir, game.b.colliders);
  if (grabber.held) {
    const size = grabber.held.size;
    sfx.updateHeld(size);
    if (size >= 4) {
      account.unlock('giant');
      if (!game.madeGiant) {
        game.madeGiant = true;
        progress.event('giant');
      }
      wren.say('cube_giant', { cooldown: 90 });
    }
    if (size < 0.15) {
      account.unlock('tiny');
      wren.say('cube_tiny', { cooldown: 90 });
    }
  }
  for (const c of game.b.cubes) {
    if (c.held) continue;
    const vy = c.vy;
    Grabber.simulate(c, dt, game.b.colliders);
    if (vy < -3 && c.vy === 0) sfx.play('thud');
    if (c.mesh.position.y < -20) c.resetHome();
  }

  game.level.update?.(dt, player);
  const stage = game.level.stage();
  while (game.splits.length < stage) recordSplit(game.splits.length);
  if (stage !== game.lastStage) {
    if (game.lastStage !== undefined && stage > game.lastStage && stage < game.level.steps.length - 1) wren.say('solved', { chance: 0.45, cooldown: 10 });
    game.lastStage = stage;
    refreshHud();
  }

  if (renderOff) game.scene.updateMatrixWorld(); // normally done by the renderer
  if (performance.now() - lastActive > 45_000) {
    lastActive = performance.now();
    wren.say('idle', { cooldown: 90 });
  }
  game.recorder.sample(game.elapsed, player);
  game.ghost?.update(game.elapsed, camera.position);
  updateAim();
  ui.setTimer(game.elapsed, settings.showTimer);

  const { min, max } = game.level.exit;
  const c = player.center(tmp);
  if (c.x > min.x && c.x < max.x && c.y > min.y && c.y < max.y && c.z > min.z && c.z < max.z) complete();
}

// Speedrun split for objective `i`, compared against the best run's split.
function recordSplit(i) {
  game.splits.push(game.elapsed);
  const best = game.daily ? null : account.levels[game.id]?.splits?.[i];
  const ms = Math.round(game.elapsed * 1000);
  let delta = '';
  if (best != null) {
    const d = ms - best;
    delta = ` (${d <= 0 ? '−' : '+'}${formatMs(Math.abs(d))})`;
  }
  ui.toast(`✓ ${game.level.steps[i].label}  ${formatMs(ms)}${delta}`, { type: 'success', ms: 3000 });
}

// Back to the last checkpoint (falls, laser fences).
function respawnPlayer() {
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
  }
  const sp = game.level.respawn?.() ?? game.level.spawn;
  player.spawn(sp.pos, sp.yaw);
  player.applyCamera();
  ui.fade(() => {});
}

// ---------- WREN's lines at the start and end of a level ----------
let seenPortal = false;
let lastActive = performance.now();

function introLine(g) {
  if (g !== game || g.escaped) return;
  const def = g.def;
  if (g.daily) return wren.say('daily', { priority: 2 });
  if (def.story) return wren.say(`story_${def.id}`, { priority: 2 });
  // A new world gets its welcome, then the mechanic it introduces.
  if ((def.number - 5) % 25 === 0) wren.say('world', { index: def.world, priority: 2, cooldown: 0 });
  if (def.plan.introduces) return wren.say('module_intro', { key: def.plan.introduces, priority: 1, cooldown: 0 });
  if ((def.number - 5) % 25 === 0) return;
  wren.say('level_start', { vars: { level: def.number }, chance: 0.35, cooldown: 30 });
}

function outroLine(g, { levels, hints, timeMs }) {
  if (!g.daily) {
    const first = !levels[g.id];
    const count = LEVELS.filter((l) => levels[l.id]).length + (first ? 1 : 0);
    if (g.id === LEVELS[LEVELS.length - 1].id) return wren.say('final', { priority: 3, cooldown: 0 });
    if (first && LINES.milestone[count]) return wren.say('milestone', { key: count, priority: 3, cooldown: 0 });
  }
  if (g.ghost) {
    const won = timeMs < g.ghost.timeMs;
    return wren.say(won ? 'ghost_beaten' : 'ghost_lost', { vars: { ghost: g.ghost.username }, priority: 2 });
  }
  if (hints === 0 && Math.random() < 0.3) return wren.say('complete_nohints', { cooldown: 120 });
  if (timeMs < (g.def.minMs ?? 10_000) * 4) return wren.say('complete_fast', { vars: { time: formatMs(timeMs) }, cooldown: 60 });
  if (timeMs > 300_000) return wren.say('complete_slow');
  wren.say('complete', { chance: 0.7 });
}

function complete() {
  const g = game;
  g.escaped = true;
  g.splits.push(g.elapsed);
  const timeMs = Math.round(g.elapsed * 1000);
  const hints = g.hinted.size;
  const levels = account.levels;
  const prevBest = g.daily ? account.dailyBestMs : levels[g.id]?.bestMs;
  const record = prevBest == null || timeMs < prevBest;
  const bestSplits = g.daily ? null : levels[g.id]?.splits;

  // Achievements earned by finishing.
  const before = new Set(account.achievements);
  account.unlock('first_escape');
  if (hints === 0) account.unlock('no_hints');
  if (g.id === 'lab') {
    if (g.portalsFired <= 2) account.unlock('minimalist');
    if (g.elapsed < 180) account.unlock('quick');
    if (g.elapsed < 90) account.unlock('speedrunner');
  }
  if (g.daily) account.unlock('daily');
  if (!g.daily) {
    const cleared = LEVELS.filter((l) => l.id === g.id || levels[l.id]);
    if (LEVELS.filter((l) => l.story).every((l) => cleared.includes(l))) account.unlock('graduate');
    if (cleared.length >= 25) account.unlock('dedicated');
    if (cleared.length >= 100) account.unlock('centurion');
    if (cleared.length === LEVELS.length) account.unlock('completionist');
    if (new Set(cleared.map((l) => l.world).filter((w) => w >= 0)).size >= 10) account.unlock('world_tour');
  }
  let ghostText = null;
  if (g.ghost) {
    const d = timeMs - g.ghost.timeMs;
    if (d < 0) {
      account.unlock('ghostbuster');
      ghostText = `You beat ${g.ghost.username}'s ghost by ${formatMs(-d)}!`;
    } else {
      ghostText = `${g.ghost.username}'s ghost was ${formatMs(d)} faster.`;
    }
  }
  const newAchievements = ACHIEVEMENTS.filter((a) => account.achievements.has(a.key) && !before.has(a.key));
  outroLine(g, { levels, hints, timeMs });
  const reward = progress.complete(g.def, { timeMs, hints, daily: g.daily });
  for (const q of reward.quests) ui.toast(`Quest complete: ${q.text} (+${q.reward} ◆)`, { type: 'success', ms: 5000 });
  if (reward.stars === 3 && reward.gained) wren.say('stars_three', { chance: 0.5, cooldown: 30 });

  const index = LEVELS.findIndex((l) => l.id === g.id);
  const splitsMs = g.splits.map((s) => Math.round(s * 1000));
  sfx.play('win');
  ui.showWin({
    level: g.def,
    final: g.def.story ? index === 3 : index === LEVELS.length - 1,
    daily: g.daily,
    time: g.elapsed,
    best: record ? timeMs : prevBest,
    record,
    hints,
    portals: g.portalsFired,
    teleports: g.teleports,
    newAchievements,
    hasNext: !g.daily && index < LEVELS.length - 1,
    ghostText,
    reward,
    nextLocked: index < LEVELS.length - 1 && !g.daily && !levelUnlocked(progress, index + 1),
    nextGate: LEVELS[index + 1] && !LEVELS[index + 1].story ? progress.worldGate(LEVELS[index + 1].world) : 0,
    par: Progress.parFor(g.def),
    splits: splitsMs.map((ms, i) => ({
      label: g.level.steps[i]?.label ?? 'Exit', ms, bestMs: bestSplits?.[i] ?? null,
    })),
  });
  if (!DEBUG) document.exitPointerLock();
  locked = false;

  const guest = !account.user;
  ui.setWinRank(guest
    ? (account.online ? 'Log in before your next run to post your time to the leaderboard.' : '')
    : 'Submitting your time…');
  account.finishRun({
    level: g.id, daily: g.daily, timeMs, hints, portals: g.portalsFired, teleports: g.teleports,
    splits: splitsMs, ghost: g.recorder.frames,
  }).then((res) => {
    if (guest) return;
    if (!res) ui.setWinRank('This run started before you logged in, so it was not timed.');
    else if (res.error) ui.setWinRank(`Couldn't submit: ${res.error}`);
    else {
      const name = g.def.name.replace(/^The /, '');
      const where = res.board === 'daily' ? "today's daily board" : `the ${name} leaderboard`;
      ui.setWinRank(`You're <b>#${res.rank}</b> of ${res.total} on ${where}.`);
    }
  });
}

// ---------- loop ----------
loadLevel(DEBUG ? (params.get('level') ?? 'scale') : account.nextLevel);
if (DEBUG) {
  ui.hideMenu();
  onLockChange(true);
}

// Scripted tests step the simulation themselves (window.__game.update).
let manualStep = false;
let renderOff = false; // the auto-solver skips drawing for speed
if (!DEBUG && !resetToken) {
  setTimeout(() => {
    let met = false;
    try { met = !!localStorage.getItem('perspective-lab:met-wren'); localStorage.setItem('perspective-lab:met-wren', '1'); } catch { /* fine */ }
    wren.say(met ? 'menu' : 'hello', { priority: 2 });
  }, 1500);
}

const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  // The first delta can be negative (rAF timestamps vs. performance.now), and a
  // negative step runs physics backwards — clamp it.
  const dt = Math.min(Math.max(timer.getDelta(), 0), 1 / 30);
  if (!manualStep) update(dt);
  if (renderOff) return;
  wren.update(dt, camera);
  if (settings.highQuality) renderer.shadowMap.needsUpdate = true;
  game.portals.render(renderer, game.scene, camera, [viewmodel]);
  if (settings.highQuality) post.render();
  else renderer.render(game.scene, camera);
});

// Handy for debugging and scripted tests.
window.__game = {
  get game() { return game; },
  player, keys, grabber, ui, account, settings,
  interact, fire: (color) => fire(game[color]), update, play, loadLevel,
  typeCode: (code) => { for (const d of code) if (aim?.kind === 'keypad') keypadInput(aim.obj.userData.keypad, d); },
  get aim() { return aim; },
  wren,
  set manual(v) { manualStep = DEBUG && v; },
  set render(v) { renderOff = DEBUG && !v; },
};

// Dev tool: window.__solve(levelId) plays a level with the auto-solver.
if (DEBUG) import('./dev/autosolve.js').then((m) => { window.__solve = m.solve; window.__solveAll = m.solveAll; });
