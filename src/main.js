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
import { Music, moodFor } from './music.js';
import { GamepadInput, PAD, ACTIONS, RESERVED, actionFor, canonFor, keyLabel, defaultBindings } from './controls.js';
import { a11y } from './a11y.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { bossStory, CHOICE, ENDINGS, CHAPTERS } from './levels/gen/storyline.js';
import { Cutscene } from './story/cutscene.js';
import { sceneForLevel, SCENES } from './story/script.js';

// ---------- engine ----------
const settings = loadSettings();
// First run on a phone: lighter graphics, bigger interface.
try {
  if (isTouchDevice() && !localStorage.getItem('perspective-lab:settings')) Object.assign(settings, { highQuality: false, uiScale: 0.9, fov: 80 });
} catch { /* storage blocked */ }
const params = new URLSearchParams(location.search);
// ?debug lets automated tests drive the game without pointer lock.
const DEBUG = params.has('debug');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice() ? 1.5 : 2));
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
const music = new Music(sfx);
const cutscene = new Cutscene({ sfx, envMap });
music.setVolume(settings.musicVolume);
const gamepad = new GamepadInput();
// Phones and tablets get on-screen controls (see touch.js).
const touch = new TouchControls({
  onLook: (dx, dy) => {
    if (!locked) return;
    lastActive = performance.now();
    const k = settings.sensitivity * 1.7;
    if (photo) photoLook(dx, dy, k);
    else player.look(dx, dy, k, settings.invertY);
  },
  onAction: (id) => {
    if (!locked) return;
    lastActive = performance.now();
    if (photo) {
      if (id === 'photo' || id === 'pause') exitPhoto();
      else if (id === 'interact' || id === 'blue') photo.snap = true;
      return;
    }
    switch (id) {
      case 'jump': player.queueJump(); break;
      case 'interact': interact(); break;
      case 'blue': fire(game.blue); break;
      case 'orange': fire(game.orange); break;
      case 'hint': hint(); break;
      case 'recall': recallCubes(); break;
      case 'flashlight': toggleFlashlight(); break;
      case 'photo': enterPhoto(); break;
      case 'pause': onLockChange(false); break;
    }
  },
  onDigit: (d) => {
    if (locked && aim?.kind === 'keypad') keypadInput(aim.obj.userData.keypad, d);
  },
});
a11y.colorblind = settings.colorblind;

// Interface size and crosshair size are CSS variables.
function applyDisplay() {
  const root = document.documentElement.style;
  root.setProperty('--ui-scale', settings.uiScale);
  root.setProperty('--ch-scale', settings.crosshairSize);
}
applyDisplay();

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
  onChamber: (id) => playStory(id),
  onReplayScene: (index) => showScene(SCENES[index], () => ui.show('journal')),
  onAuth: (u, p, mode, email) => account.login(u, p, mode === 'register', email),
  onForgot: (login) => account.forgotPassword(login),
  onReset: (password) => account.resetPassword(resetToken, password),
  onEmail: (email) => account.setEmail(email),
  onBoard: loadBoard,
  onBind: (action, code) => {
    const b = { ...settings.bindings };
    if (!action) {
      Object.assign(b, defaultBindings());
    } else if (RESERVED.has(code)) {
      ui.toast(`${keyLabel(code)} is reserved (pause and keypad digits).`, { type: 'warn', ms: 2500 });
    } else {
      // A key already in use swaps places with the one being rebound.
      const clash = ACTIONS.find((a) => a.id !== action && b[a.id] === code);
      if (clash) b[clash.id] = b[action];
      b[action] = code;
    }
    settings.bindings = b;
    saveSettings(settings);
    ui.renderBinds(b);
  },
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
ui.renderBinds(settings.bindings);

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
  } else if (name === 'musicVolume') {
    music.setVolume(value);
  } else if (name === 'uiScale' || name === 'crosshairSize') {
    applyDisplay();
  } else if (name === 'colorblind') {
    a11y.colorblind = value;
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
  music.muffle(!!game?.started && !game.escaped);
  sfx.play('ui');
  switch (action) {
    case 'continue': playStory(continueId(progress)); break;
    case 'daily': play(DAILY_ID, true); break;
    case 'resume': requestLock(); break;
    case 'restart':
    case 'replay': play(game.id, game.daily); break;
    case 'next': {
      const i = LEVELS.findIndex((l) => l.id === game.id) + 1;
      if (levelUnlocked(progress, i)) playStory(LEVELS[i].id);
      break;
    }
    case 'quit':
      wren.say('menu', { cooldown: 30 });
    case 'home': ui.show('main'); break;
    case 'leaderboard':
      if (ui.returnTo === 'win' && game) ui.openBoard(game.id, game.daily ? 'daily' : 'all');
      loadBoard(ui.boardLevel, ui.boardKind);
      break;
    case 'profile': ui.renderProfile(account, progress); break;
    case 'controls': ui.setPadStatus(gamepad.pad?.id); break;
    case 'share': shareResult(); break;
    case 'workshop': ui.renderWorkshop(progress); break;
    case 'journal': ui.renderJournal(progress); break;
    case 'auth': ui.setAuthMode('login'); break;
    case 'logout': account.logout(); break;
  }
}

function requestLock() {
  if (DEBUG || gamepad.active || touch.enabled) {
    if (touch.enabled && !DEBUG && !document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    onLockChange(true);
    return;
  }
  try {
    const p = renderer.domElement.requestPointerLock();
    // Browsers refuse a re-lock for ~1s after Esc.
    if (p?.catch) p.catch(() => {
      // The browser wants a click first (e.g. after Esc): offer one.
      if (game && !game.started) {
        ui.setPauseInfo(game.def.name, 'Click Resume to start', 0);
        ui.show('pause');
      } else {
        ui.toast('Give it a second, then click again.', { type: 'warn', ms: 2000 });
      }
    });
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
  ui.setThreat(null, 0);

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
    onStory: () => progress.readChapter(def.plan?.boss?.chapter),
    storyFor: (chapter) => bossStory(chapter, progress.data.choice),
    // Telescope: aim at a point and zoom right in for a few seconds.
    zoom: (target, secs) => {
      const e = player.eye(new THREE.Vector3());
      player.yaw = Math.atan2(-(target.x - e.x), -(target.z - e.z));
      player.pitch = Math.atan2(target.y - e.y, Math.hypot(target.x - e.x, target.z - e.z));
      feel.zoomUntil = performance.now() + secs * 1000;
      ui.toast('Zoomed in. Move the mouse to look around; it zooms back out in a moment.', { type: 'info', ms: 2500 });
    },
    wrenText: (text, mood = 'thoughtful', priority = 1) => wren.sayText(text, mood, priority),
    shake: (amount) => shake(amount),
    threatHud: (remaining, urgency) => ui.setThreat(remaining, urgency),
    onThreat: (kind) => {
      if (kind === 'averted') {
        progress.data.fragments += 20;
        progress.data.earned += 20;
        progress.stat('lockdowns');
        progress.save();
        ui.toast('Lockdown averted. +20 ◆', { type: 'success', ms: 3000 });
        wren.sayText(pickLine(['Made it. The room is sulking.', 'Lockdown averted. The museum respects that.', 'In time! Barely! I was not worried!']), 'happy', 2);
      } else {
        ui.toast('Lockdown. The room goes dark. It is still solvable.', { type: 'warn', ms: 4000 });
        wren.sayText(pickLine(['The lights are going down. Keep going, I can still see you.', 'It sealed itself. It did not lock us in. Small mercies.']), 'worried', 2);
      }
    },
    read: (title, text) => ui.showDoc(title, text),
    isTouch: touch.enabled,
    torchOn: () => flashlight.intensity > 0,
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
  music.setMood(moodFor(def.world, { story: def.story, blackout: def.plan?.twists?.includes('blackout'), boss: !!def.plan?.boss }));
  if (def.plan?.boss) renderer.toneMappingExposure *= 0.9;
  music.setIntensity(0);
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
  flashlight.color.set('#fff4dd');
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

// Starting a level from the menus: every third level opens with a story
// scene the first time (Settings → Story scenes). Replays and restarts don't.
function playStory(id, daily = false) {
  const def = levelMeta(id, account.today);
  const scene = !daily && !DEBUG && settings.storyScenes && def?.number ? sceneForLevel(def.number) : null;
  if (!scene || progress.data.scenesSeen?.includes(scene.index)) return play(id, daily);
  showScene(scene, () => {
    progress.data.scenesSeen = [...new Set([...(progress.data.scenesSeen ?? []), scene.index])];
    progress.save();
    play(id, daily); // the click that ended the scene counts as the gesture for the mouse lock
  });
}

function showScene(scene, onDone) {
  const level = 5 + scene.index * 3;
  const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.ceil(level / 50))];
  wren.clear();
  ui.menu.classList.add('hidden');
  ui.hud.classList.add('hidden');
  music.muffle(false);
  music.setIntensity(0);
  cutscene.play(scene, {
    chapterName: level > 500 ? 'EPILOGUE' : chapter.name.toUpperCase(),
    chapterIndex: level > 500 ? 0 : Math.ceil(level / 50),
    choice: progress.data.choice,
    onDone,
  });
}

function play(id, daily = false) {
  if (photo) exitPhoto();
  try {
    loadLevel(id, daily);
  } catch (err) {
    console.error(`Level ${id} failed to load`, err);
    ui.toast(`That level failed to load (${err.message}). Try another one, and please report it.`, { type: 'warn', ms: 8000 });
    sfx.play('error');
    return;
  }
  ui.fadeIn();
  // Restarting mid-run keeps the lock, so no lock event will start the level.
  if (locked) {
    ui.hideMenu();
    startGame();
  } else {
    requestLock();
  }
}

const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];

function startGame() {
  if (game.started) return;
  game.started = true;
  music.setIntensity(game.def.plan?.boss || game.def.plan?.pulse === 'pressure' ? 2 : 1);
  account.startRun(game.id, game.daily);
  ui.chapter(game.def, game.daily);
  const g = game;
  setTimeout(() => introLine(g), 1400);
}

function onLockChange(isLocked) {
  locked = isLocked;
  keys.clear();
  holdRestart = -1;
  ui.holdRing(0);
  sprintToggled = false;
  touch.setActive(locked);
  if (locked) {
    ui.hideMenu();
    music.muffle(false);
    startGame();
    return;
  }
  if (photo) exitPhoto();
  player.moveInput = null;
  if (game?.started) progress.save();
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
  }
  if (game?.started && !game.escaped) {
    music.muffle(true);
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
    progress.stat('codes');
    if (kp.entered === kp.code) {
      kp.solved = true;
      sfx.play('unlock');
      ui.toast('Access granted.', { type: 'success' });
      kp.onSolve?.();
      kp.idle();
    } else {
      kp.draw('ERR', '#ff4b4b');
      sfx.play('error');
      shake(0.15);
      gamepad.rumble(0.4, 0.2, 150);
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
// Key label for an action: the controller button when one is in use.
const PAD_LABELS = { interact: 'X', hint: 'Y', recall: 'B', flashlight: 'RB', photo: 'View' };
const TOUCH_LABELS = { interact: 'Use', hint: '?', recall: '⟲', flashlight: '🔦', photo: '📷' };
const K = (action) => (gamepad.active ? PAD_LABELS[action] : touch.enabled ? TOUCH_LABELS[action] : keyLabel(settings.bindings[action]));

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
      if (!kp.enabled()) return [null, 'No signal.', true];
      if (touch.enabled && !gamepad.active) return [null, 'Tap the code on the keypad'];
      return gamepad.active ? ['X', `Enter <b>${padDigit}</b> · D-pad ↑↓ changes it · B deletes`] : ['0-9', 'Type the code'];
    }
    case 'button': return near ? ['E', a.obj.userData.label ?? 'Press'] : [null, ''];
    default: return game.level.prompt?.(a.kind, a.distance, a.obj) ?? [null, ''];
  }
}

function updateAim() {
  const hit = castFrom(game.b.solids, 3.5);
  const obj = hit && findInteract(hit.object);
  aim = hit ? { kind: obj?.userData.interact ?? null, obj, distance: hit.distance } : null;
  let [key, text, lockedPrompt] = promptFor(aim);
  if (key === 'E') key = K('interact');
  ui.setPrompt(key, text, lockedPrompt);
  touch.setState({ gun: game.flags.hasGun, flashlight: game.level.flashlight || game.flags.uv, keypad: aim?.kind === 'keypad' && !aim.obj.userData.keypad.solved });
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
      progress.stat('cubes');
      gamepad.rumble(0.1, 0.3, 60);
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
  progress.stat('portals');
  ui.crosshairPulse();
  gamepad.rumble(0.2, 0.5, 90);
  progress.event('portal');
  sfx.play('portalOpen');
  refreshHud();
}

function hint() {
  const step = game.level.stage();
  if (!game.hinted.has(step)) progress.stat('hints');
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

let sprintToggled = false;
let holdRestart = -1; // seconds the restart key has been held; -1 = not held
const HOLD_RESTART = 0.7;

document.addEventListener('keydown', (e) => {
  if (!locked) return;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  // Controller players have no pointer lock, so Esc pauses by hand.
  if (e.code === 'Escape' && !document.pointerLockElement && !DEBUG) {
    onLockChange(false);
    return;
  }
  const action = actionFor(e.code, settings.bindings);
  const canon = canonFor(action);
  if (canon) {
    if (action === 'sprint' && settings.toggleSprint && !photo) {
      if (!e.repeat) sprintToggled = !sprintToggled;
    } else {
      keys.add(canon);
    }
    if (action === 'jump' && !e.repeat && !photo) player.queueJump();
  }
  if (e.repeat) return;
  if (photo) {
    if (action === 'photo') exitPhoto();
    else if (e.code === 'KeyG') { photo.grid = !photo.grid; ui.photoMode(true, photo.grid); }
    else if (e.code === 'BracketLeft') photo.roll += 0.05;
    else if (e.code === 'BracketRight') photo.roll -= 0.05;
    return;
  }
  if (aim?.kind === 'keypad' && (e.key === 'Backspace' || /^[0-9]$/.test(e.key))) {
    keypadInput(aim.obj.userData.keypad, e.key);
    return;
  }
  switch (action) {
    case 'interact': interact(); break;
    case 'hint': hint(); break;
    case 'recall': recallCubes(); break;
    case 'flashlight': toggleFlashlight(); break;
    case 'photo': enterPhoto(); break;
    case 'restart': holdRestart = 0; break;
  }
});
document.addEventListener('keyup', (e) => {
  const action = actionFor(e.code, settings.bindings);
  const canon = canonFor(action);
  if (canon) keys.delete(canon);
  keys.delete(e.code);
  if (action === 'restart') {
    holdRestart = -1;
    ui.holdRing(0);
  }
});
window.addEventListener('blur', () => {
  if (locked && !document.pointerLockElement && !DEBUG) onLockChange(false);
});

function toggleFlashlight() {
  if (!game.level.flashlight && !game.flags.uv) return;
  // The escape rooms' UV torch is purple; blackout levels get a white torch.
  flashlight.color.set(game.level.flashlight ? '#fff4dd' : '#b26bff');
  flashlight.intensity = flashlight.intensity > 0 ? 0 : game.level.flashlight ? 60 : 40;
  sfx.play('ui');
}

// Keys the simulation sees this frame: keyboard + controller + toggled sprint.
const padKeys = new Set();
function frameKeys() {
  if (!padKeys.size && !sprintToggled && !touch.keys.size) return keys;
  const all = new Set(keys);
  for (const k of padKeys) all.add(k);
  for (const k of touch.keys) all.add(k);
  if (sprintToggled) all.add('ShiftLeft');
  return all;
}
document.addEventListener('keydown', () => (lastActive = performance.now()));
const mouseLive = () => locked && (DEBUG || !!document.pointerLockElement);
document.addEventListener('mousemove', (e) => {
  if (!mouseLive()) return;
  lastActive = performance.now();
  if (photo) photoLook(e.movementX, e.movementY, settings.sensitivity);
  else player.look(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
});
document.addEventListener('mousedown', (e) => {
  if (!mouseLive()) return;
  if (photo) {
    if (e.button === 0) photo.snap = true;
    return;
  }
  if (e.button === 0) fire(game.blue);
  else if (e.button === 2) fire(game.orange);
});
document.addEventListener('wheel', (e) => {
  if (photo) photo.fov = Math.min(110, Math.max(15, photo.fov + Math.sign(e.deltaY) * 3));
}, { passive: true });
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
window.addEventListener('resize', () => { resize(); cutscene.resize(); });

// ---------- simulation ----------
const tmp = new THREE.Vector3();
const prevEye = new THREE.Vector3();
let stepDistance = 0;

// Screen shake ("trauma", squared so small knocks stay subtle) and FOV kicks.
const feel = { trauma: 0, fovKick: 0, t: 0 };
function shake(amount) {
  if (!settings.reduceMotion) feel.trauma = Math.min(1, feel.trauma + amount);
}
function applyFeel(dt) {
  feel.t += dt;
  feel.fovKick *= Math.exp(-dt * 5);
  if (feel.trauma <= 0) return;
  const k = feel.trauma * feel.trauma, t = feel.t * 30;
  camera.rotation.x += Math.sin(t * 1.3) * 0.035 * k;
  camera.rotation.y += Math.sin(t * 1.7 + 2) * 0.035 * k;
  camera.rotation.z += Math.sin(t * 2.1 + 4) * 0.05 * k;
  camera.updateMatrixWorld();
  feel.trauma = Math.max(0, feel.trauma - dt * 1.8);
}
sfx.onPlay = (name) => {
  if (name === 'door') { shake(0.18); gamepad.rumble(0.3, 0.1, 400); }
};

function playerFeedback(dt) {
  if (player.jumped) {
    sfx.play('jump');
    progress.stat('jumps');
  }
  if (player.landImpact > 5) sfx.play('land');
  if (player.landImpact > 10) {
    shake(Math.min(0.45, (player.landImpact - 10) * 0.04 + 0.15));
    gamepad.rumble(0.5, 0.3, 120);
  }
  const speed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && speed > 0.8) progress.stat('distance', speed * dt);
  if (player.onGround && speed > 0.8) {
    stepDistance += speed * dt;
    if (stepDistance > 2.0) {
      stepDistance = 0;
      sfx.play('step');
    }
  }
  // Sprint widens the view a little.
  const sprinting = speed > 5 && player.onGround;
  const zoomed = feel.zoomUntil && performance.now() < feel.zoomUntil;
  const targetFov = zoomed ? 7 : settings.fov + (sprinting && !settings.reduceMotion ? 6 : 0) + feel.fovKick;
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
  progress.stat('playMs', dt * 1000);
  if (photo) {
    updatePhoto(dt);
    return;
  }
  if (holdRestart >= 0) {
    holdRestart += dt;
    ui.holdRing(Math.min(1, holdRestart / HOLD_RESTART));
    if (holdRestart >= HOLD_RESTART) {
      holdRestart = -1;
      ui.holdRing(0);
      play(game.id, game.daily);
      return;
    }
  }

  player.eye(prevEye);
  const ignore = game.portals.ignoreSet(player.center(tmp));
  const input = frameKeys();
  if (sprintToggled && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => input.has(k)) && !player.moveInput) sprintToggled = false;
  player.update(dt, input, game.b.colliders, ignore);
  const through = game.portals.checkTeleport(player, prevEye, player.eye(tmp));
  if (through) {
    game.teleports++;
    progress.event('teleport');
    progress.stat('teleports');
    sfx.play('teleport');
    if (!settings.reduceMotion) feel.fovKick = 9;
    gamepad.rumble(0.15, 0.4, 100);
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
  player.applyCamera(dt, settings.headBob && !settings.reduceMotion ? 1 : 0);
  applyFeel(dt);
  playerFeedback(dt);

  if (player.pos.y < -20 || game.level.fellOut?.(player)) {
    respawnPlayer();
    progress.stat('falls');
    gamepad.rumble(0.6, 0.6, 200);
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
    if (vy < -3 && c.vy === 0) {
      sfx.play('thud');
      const near = c.mesh.position.distanceTo(player.pos);
      if (near < 8) shake(Math.min(0.3, c.size * 0.05) * (1 - near / 8));
    }
    if (c.mesh.position.y < -20) c.resetHome();
  }

  game.level.update?.(dt, player);
  const stage = game.level.stage();
  while (game.splits.length < stage) recordSplit(game.splits.length);
  if (stage !== game.lastStage) {
    if (game.lastStage !== undefined && stage > game.lastStage) {
      ui.flash('good');
      music.stinger();
      gamepad.rumble(0.2, 0.2, 80);
    }
    music.setIntensity(stage / Math.max(1, game.level.steps.length - 1) >= 0.6 ? 2 : 1);
    if (game.lastStage !== undefined && stage > game.lastStage && stage < game.level.steps.length - 1) wren.say('solved', { chance: 0.45, cooldown: 10 });
    game.lastStage = stage;
    refreshHud();
  }

  if (renderOff) game.scene.updateMatrixWorld(); // normally done by the renderer
  if (performance.now() - lastActive > 45_000) {
    lastActive = performance.now();
    wren.say('idle', { cooldown: 90 });
  }
  checkLifetime();
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
  ui.flash('warn');
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
  const plan = def.plan;
  // Chapter bosses: the chapter's introduction, then what's different here.
  if (plan.boss) {
    const story = bossStory(plan.boss.chapter, progress.data.choice);
    wren.sayText(story.intro, 'thoughtful', 3);
    if (story.pressureText) wren.sayText(story.pressureText, 'worried', 2);
    return;
  }
  if (plan.beat) wren.sayText(plan.beat.line, plan.beat.mood ?? 'thoughtful', 2);
  // A new world gets its welcome, then the mechanic it introduces.
  if ((def.number - 5) % 25 === 0) wren.say('world', { index: def.world, priority: 2, cooldown: 0 });
  if (def.plan.introLine) return wren.sayText(def.plan.introLine, 'excited', 2);
  if (def.plan.introduces) return wren.say('module_intro', { key: def.plan.introduces, priority: 1, cooldown: 0 });
  if ((def.number - 5) % 25 === 0) return;
  // Every 7 levels a mechanic takes the spotlight.
  if (plan.featuredFlavor) return wren.sayText(plan.featuredFlavor, 'happy', 1);
  if (plan.beat) return;
  wren.say('level_start', { vars: { level: def.number }, chance: 0.35, cooldown: 30 });
}

function outroLine(g, { levels, hints, timeMs }) {
  const boss = g.def.plan?.boss;
  if (boss && !g.daily) {
    progress.reachChapter(boss.chapter);
    account.unlock(boss.chapter === 10 ? 'the_door' : boss.chapter === 1 ? 'archivist' : 'chapter_turned');
    return wren.sayText(bossStory(boss.chapter, progress.data.choice).reward, 'thoughtful', 3);
  }
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
  g.result = { timeMs, hints, stars: reward.stars };
  music.stinger(true);
  music.setIntensity(0);
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
  ui.setThreat(null, 0);
  const bossChapter = !g.daily ? g.def.plan?.boss?.chapter : null;
  if (bossChapter === CHOICE.chapter && !progress.data.choice && !DEBUG) {
    ui.showChoice(CHOICE, (id) => {
      progress.data.choice = id;
      progress.save();
      sfx.play('achievement');
      wren.sayText(id === 'stay' ? 'Oh. Oh! The echoes are... they are very happy. I am... I don\'t know what I am.' : 'The door, then. Okay. I\'ll help you build it. Even if it means you go.', 'thoughtful', 3);
      ui.show('win');
    });
  } else if (bossChapter === 10 && !DEBUG) {
    ui.playEnding(ENDINGS[progress.data.choice === 'stay' ? 'stay' : 'leave'], () => {
      account.unlock('the_door');
      ui.returnTo = 'win';
      ui.show('credits');
    });
    music.stinger(true);
  }

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

// ---------- photo mode ----------
let photo = null;
const PHOTO_RANGE = 7; // metres the camera may drift from the player: no scouting

function enterPhoto() {
  if (!game?.started || game.escaped || photo) return;
  if (grabber.held) {
    grabber.drop();
    sfx.stopHeld();
  }
  photo = {
    pos: camera.position.clone(), origin: camera.position.clone(),
    yaw: player.yaw, pitch: player.pitch, roll: 0, fov: camera.fov, grid: false, snap: false,
  };
  keys.clear();
  viewmodel.visible = false;
  wren.clear();
  ui.photoMode(true);
  sfx.play('ui');
}

function exitPhoto() {
  if (!photo) return;
  photo = null;
  keys.clear();
  viewmodel.visible = game.flags.hasGun;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  player.applyCamera();
  ui.photoMode(false);
}

function photoLook(dx, dy, sens) {
  photo.yaw -= dx * 0.0022 * sens;
  photo.pitch = Math.max(-1.55, Math.min(1.55, photo.pitch - (settings.invertY ? -dy : dy) * 0.0022 * sens));
}

const photoDir = new THREE.Vector3();
function updatePhoto(dt) {
  const input = frameKeys();
  const f = new THREE.Vector3(-Math.sin(photo.yaw) * Math.cos(photo.pitch), Math.sin(photo.pitch), -Math.cos(photo.yaw) * Math.cos(photo.pitch));
  const r = new THREE.Vector3(Math.cos(photo.yaw), 0, -Math.sin(photo.yaw));
  photoDir.set(0, 0, 0);
  if (input.has('KeyW')) photoDir.add(f);
  if (input.has('KeyS')) photoDir.sub(f);
  if (input.has('KeyD')) photoDir.add(r);
  if (input.has('KeyA')) photoDir.sub(r);
  if (input.has('Space')) photoDir.y += 1;
  if (input.has('ShiftLeft')) photoDir.y -= 1;
  if (player.moveInput) photoDir.addScaledVector(f, -player.moveInput.y).addScaledVector(r, player.moveInput.x);
  if (photoDir.lengthSq() > 0) photo.pos.addScaledVector(photoDir.normalize(), dt * 3);
  const off = photo.pos.clone().sub(photo.origin);
  if (off.length() > PHOTO_RANGE) photo.pos.copy(photo.origin).addScaledVector(off.normalize(), PHOTO_RANGE);
  camera.position.copy(photo.pos);
  camera.rotation.set(photo.pitch, photo.yaw, photo.roll, 'YXZ');
  if (Math.abs(camera.fov - photo.fov) > 0.01) {
    camera.fov += (photo.fov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

// Called right after a frame is drawn, while the canvas still holds it.
function savePhoto() {
  photo.snap = false;
  const name = `perspective-lab-${game.def.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.png`;
  renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
  ui.flash('snap');
  sfx.play('pickup');
  progress.stat('photos');
  account.unlock('shutterbug');
}

// ---------- controller ----------
let padDigit = 0;
let padSeen = null;
let padNav = { dir: 0, t: 0 };
let padSprint = false;

function handlePad(dt) {
  const p = gamepad.poll();
  if (!p || !gamepad.active) {
    player.moveInput = touch.move;
    padKeys.clear();
    if (!p) return;
  }
  if (padSeen !== gamepad.pad.id) {
    padSeen = gamepad.pad.id;
    ui.setPadStatus(padSeen);
  }
  if (gamepad.active) lastActive = performance.now();

  if (!locked) {
    player.moveInput = null;
    padKeys.clear();
    if (!ui.menuOpen) return;
    // Menu navigation with key-repeat on the D-pad / stick.
    const dir = p.held(PAD.UP) || p.move.y < -0.6 ? -1 : p.held(PAD.DOWN) || p.move.y > 0.6 ? 1 : 0;
    const side = p.held(PAD.LEFT) || p.move.x < -0.6 ? -1 : p.held(PAD.RIGHT) || p.move.x > 0.6 ? 1 : 0;
    if (dir || side) {
      padNav.t -= dt;
      if (padNav.dir !== dir + side * 3 || padNav.t <= 0) {
        if (side && ui.padAdjust(side)) { /* slider moved */ } else if (dir || side) ui.padNavigate(dir || side);
        padNav.t = padNav.dir === dir + side * 3 ? 0.12 : 0.4;
        padNav.dir = dir + side * 3;
      }
    } else {
      padNav = { dir: 0, t: 0 };
    }
    if (p.pressed(PAD.A)) { sfx.unlock(); ui.padActivate(); }
    if (p.pressed(PAD.B)) {
      if (ui.screen === 'pause') onAction('resume');
      else ui.padBack();
    }
    if (p.pressed(PAD.START)) {
      sfx.unlock();
      if (ui.screen === 'pause') onAction('resume');
      else if (ui.screen === 'main') document.querySelector('#continue-btn').click();
    }
    return;
  }

  if (p.pressed(PAD.START)) {
    if (document.pointerLockElement) document.exitPointerLock();
    else onLockChange(false);
    return;
  }
  const sens = 1500 * dt * settings.padSensitivity;
  const curve = (v) => Math.sign(v) * Math.abs(v) ** 1.7;
  if (photo) {
    photoLook(curve(p.look.x) * sens, curve(p.look.y) * sens, 1);
    player.moveInput = p.move.m ? { x: p.move.x, y: p.move.y } : null;
    padKeys.clear();
    if (p.held(PAD.A)) padKeys.add('Space');
    if (p.held(PAD.B)) padKeys.add('ShiftLeft');
    if (p.pressed(PAD.X)) photo.snap = true;
    if (p.pressed(PAD.BACK)) exitPhoto();
    if (p.held(PAD.RT)) photo.fov = Math.max(15, photo.fov - dt * 30);
    if (p.held(PAD.LT)) photo.fov = Math.min(110, photo.fov + dt * 30);
    return;
  }
  if (p.look.m) player.look(curve(p.look.x) * sens, curve(p.look.y) * sens, 1, settings.invertY);
  player.moveInput = p.move.m ? { x: p.move.x, y: p.move.y } : touch.move;
  if (p.pressed(PAD.L3)) padSprint = !padSprint;
  if (!p.move.m) padSprint = false;
  padKeys.clear();
  if (p.held(PAD.A)) padKeys.add('Space');
  if (p.held(PAD.LB) || padSprint) padKeys.add('ShiftLeft');
  if (p.pressed(PAD.A)) player.queueJump();

  const kp = aim?.kind === 'keypad' ? aim.obj.userData.keypad : null;
  if (kp && p.pressed(PAD.UP)) padDigit = (padDigit + 1) % 10;
  if (kp && p.pressed(PAD.DOWN)) padDigit = (padDigit + 9) % 10;
  if (p.pressed(PAD.X)) {
    if (kp) keypadInput(kp, String(padDigit));
    else interact();
  }
  if (p.pressed(PAD.B)) {
    if (kp) keypadInput(kp, 'Backspace');
    else recallCubes();
  }
  if (p.pressed(PAD.RT)) fire(game.blue);
  if (p.pressed(PAD.LT)) fire(game.orange);
  if (p.pressed(PAD.Y)) hint();
  if (p.pressed(PAD.RB)) toggleFlashlight();
  if (p.pressed(PAD.BACK)) enterPhoto();
}

// ---------- sharing & lifetime milestones ----------
async function shareResult() {
  const g = game;
  if (!g?.result) return;
  const { timeMs, hints, stars } = g.result;
  const title = g.daily ? `Daily challenge ${account.today}` : `${g.def.story ? 'Chamber' : 'Level'} ${g.def.number} · ${g.def.name}`;
  const text = `Perspective Lab · ${title}\n${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${formatMs(timeMs)}  ${hints ? `${hints} hint${hints > 1 ? 's' : ''}` : 'no hints'}\nCan you beat it? ${location.origin}`;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      ui.toast('Result copied. Paste it anywhere.', { type: 'success', ms: 2500 });
    }
  } catch {
    ui.toast(text, { type: 'info', ms: 8000 });
  }
}

let lifetimeCheck = 0;
function checkLifetime() {
  if ((lifetimeCheck += 1) % 120) return; // every ~2 s of play
  const st = progress.data.stats;
  if ((st.jumps ?? 0) >= 1000) account.unlock('bunny_hop');
  if ((st.playMs ?? 0) >= 3 * 3600_000) account.unlock('marathon');
  if ((st.distance ?? 0) >= 10_000) account.unlock('globetrotter');
  if (lifetimeCheck % 3600 === 0) progress.save(); // ~once a minute
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
  if (cutscene.active) {
    const p = gamepad.poll();
    if (p?.pressed(PAD.A) || p?.pressed(PAD.X)) cutscene.advance();
    if (p?.pressed(PAD.B) || p?.pressed(PAD.START)) cutscene.finish();
    cutscene.update(dt);
    if (cutscene.active) {
      renderer.render(cutscene.scene, cutscene.camera);
      return;
    }
  }
  handlePad(dt);
  if (!manualStep) update(dt);
  if (renderOff) return;
  wren.update(dt, camera);
  if (settings.highQuality) renderer.shadowMap.needsUpdate = true;
  game.portals.render(renderer, game.scene, camera, [viewmodel]);
  if (settings.highQuality) post.render();
  else renderer.render(game.scene, camera);
  if (photo?.snap) savePhoto();
});

// Handy for debugging and scripted tests.
window.__game = {
  get game() { return game; },
  player, keys, grabber, ui, account, settings,
  interact, fire: (color) => fire(game[color]), update, play, loadLevel, music, progress,
  enterPhoto, exitPhoto, get photo() { return photo; }, toggleFlashlight, flashlight, cutscene, showScene, playStory,
  rayHits: () => { raycaster.set(eye, dir); raycaster.far = 4; return raycaster.intersectObjects(game.b.solids, false).slice(0, 4).map((h) => ({ d: +h.distance.toFixed(2), geo: h.object.geometry?.type, params: h.object.geometry?.parameters, shown: isShown(h.object), interact: h.object.userData.interact ?? null, label: h.object.userData.label ?? h.object.parent?.userData?.label ?? null, pos: h.object.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) })); },
  typeCode: (code) => { for (const d of code) if (aim?.kind === 'keypad') keypadInput(aim.obj.userData.keypad, d); },
  get aim() { return aim; },
  wren,
  set manual(v) { manualStep = DEBUG && v; },
  set render(v) { renderOff = DEBUG && !v; },
};

// Dev tool: window.__solve(levelId) plays a level with the auto-solver.
if (DEBUG) import('./dev/autosolve.js').then((m) => { window.__solve = m.solve; window.__solveAll = m.solveAll; });
