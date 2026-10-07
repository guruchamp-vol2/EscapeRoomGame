// Dev tool: plays generated levels through the real game code to prove they're
// solvable. Loaded only with ?debug. It takes shortcuts a player can't (placing
// itself in a spot, reading the code from memory) but every mechanic is done
// for real: cubes are grabbed and resized by forced perspective, portals are
// fired and walked through, doors must open, plates must register.
//
//   await __solve('p137')          → { ok, reason, ... }
//   await __solveAll(['p5', ...])  → summary
const G = () => window.__game;
const FRAME = 1 / 60;

function step(sec) {
  const n = Math.max(1, Math.round(sec / FRAME));
  for (let i = 0; i < n; i++) G().update(FRAME);
}

function place(x, y, z, yaw = 0, pitch = 0) {
  const p = G().player;
  p.pos.set(x, y, z);
  p.vel.set(0, 0, 0);
  p.yaw = yaw;
  p.pitch = pitch;
  step(FRAME * 2);
}

function aimFrom(eye, target) {
  const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

// Stand at (x, y, z) and look at `target`.
function standLook(x, y, z, target) {
  const a = aimFrom([x, y + 1.6, z], target);
  place(x, y, z, a.yaw, a.pitch);
}

function hold(codes, sec) {
  codes.forEach((k) => G().keys.add(k));
  step(sec);
  codes.forEach((k) => G().keys.delete(k));
  step(0.1);
}

const held = () => G().grabber.held;
const level = () => G().game.level;
const fail = (reason) => { throw new Error(reason); };

function pickUp(cube, y0, dist = 1.4) {
  const p = cube.mesh.position;
  for (const [dx, dz] of [[0, dist], [0, -dist], [dist, 0], [-dist, 0], [0, dist + 0.8]]) {
    standLook(p.x + dx, y0, p.z + dz, [p.x, p.y, p.z]);
    G().interact();
    if (held() === cube) return;
    if (held()) G().interact(); // grabbed something else; drop it
  }
  fail('could not pick up cube');
}

function drop() {
  if (held()) G().interact();
  step(1.5);
}

// Grow (or shrink) the held cube onto a spot by searching for a view angle
// where forced perspective lands it there at an acceptable size.
function placeHeldAt(target, accept, stands) {
  for (const s of stands) {
    const yawTo = Math.atan2(-(target.x - s.x), -(target.z - s.z));
    for (let pitch = 0.25; pitch > -1.0; pitch -= 0.01) {
      place(s.x, s.y, s.z, yawTo, pitch);
      const c = held();
      if (!c) fail('cube was dropped while aiming');
      if (accept(c)) {
        drop();
        return c;
      }
    }
  }
  fail('no view angle placed the cube correctly');
}

function growOntoPlate(cube, plate, cell) {
  if (held() !== cube) pickUp(cube, cell.y0);
  const onPlate = (c) => {
    const p = c.mesh.position;
    return Math.abs(p.x - plate.x) < plate.half - 0.15 && Math.abs(p.z - plate.z) < plate.half - 0.15 &&
      c.size >= plate.min + 0.08 && p.y - c.size / 2 < plate.y + 0.6;
  };
  const stands = [];
  for (const back of [9, 7, 11, 5.5, 13]) {
    const z = Math.min(cell.zS - 0.8, plate.z + back);
    stands.push({ x: plate.x, y: cell.y0, z });
  }
  placeHeldAt(plate, onPlate, stands);
  step(0.5);
}

function walkThroughPortal(panel, floorY) {
  const nx = Math.sin(panel.rotY), nz = Math.cos(panel.rotY);
  const p = panel.point;
  place(p.x + nx * 1.6, floorY, p.z + nz * 1.6, Math.atan2(nx, nz), 0);
  const before = G().game.teleports;
  hold(['KeyW'], 1.2);
  if (G().game.teleports === before) fail('walked into a portal but did not teleport');
}

function fireAt(color, panel, stands) {
  const target = [panel.point.x, panel.point.y + 0.6, panel.point.z];
  for (const s of stands) {
    standLook(s.x, s.y, s.z, target);
    G().fire(color);
    if (G().game[color].panel === panel) return;
  }
  fail(`could not hit a panel with the ${color} portal`);
}

// Candidate places to stand in a cell, nearest the south end first.
function standsIn(cell, zMin, zMax, y = cell.y0) {
  const out = [];
  for (let z = zMax; z >= zMin; z -= 1.5) for (const x of [0, -2, 2, -4, 4]) {
    if (x > cell.x0 + 0.8 && x < cell.x1 - 0.8) out.push({ x, y, z });
  }
  return out;
}

// Portal from panel A (reachable) to panel B, and walk through.
function portalHop(cell, from, to, standZ = [cell.zS - 1, cell.zS - 1], floorY = cell.y0, exclude = () => false) {
  const nearStands = standsIn(cell, standZ[0], standZ[1], floorY).filter((s) => !exclude(s));
  fireAt('blue', from, [...nearStands, ...standsIn(cell, from.point.z - 3, from.point.z + 3, floorY).filter((s) => !exclude(s))]);
  fireAt('orange', to, nearStands);
  walkThroughPortal(from, floorY);
}

function typeCode(pos, code, y0) {
  standLook(pos.x, y0, pos.z + 1.0, [pos.x, pos.y + 0.19, pos.z]);
  if (G().aim?.kind !== 'keypad') fail('could not aim at the keypad');
  G().typeCode(code);
}

function pressButton(btn, y0) {
  for (const [dx, dz] of [[0, 1.2], [0, -1.2], [1.2, 0], [-1.2, 0]]) {
    standLook(btn.x + dx, y0, btn.z + dz, [btn.x, btn.y + 0.02, btn.z]);
    if (G().aim?.kind === 'button') {
      G().interact();
      step(0.1);
      return;
    }
  }
  fail('could not aim at a button');
}

// Escape rooms: replay the solving order the generator recorded.
function escapeAction(a, y0) {
  const at = [a.at.x, a.at.y, a.at.z];
  if (a.t === 'exit') return typeCode(a.at, a.code, y0);
  standLook(a.stand.x, y0, a.stand.z, at);
  const aim = G().aim;
  if (a.t === 'press') {
    if (aim?.kind !== 'button') fail(`could not aim at: ${a.why} (aim: ${aim?.kind ?? 'nothing'} at ${aim?.distance?.toFixed(2)}) hits: ${JSON.stringify(G().rayHits())}`);
    G().interact();
    step(0.6);
  } else if (a.t === 'code') {
    if (aim?.kind !== 'keypad') fail(`could not aim at a padlock (aim: ${aim?.kind ?? 'nothing'} "${aim?.obj?.userData?.label ?? ''}") hits: ${JSON.stringify(G().rayHits())}`);
    G().typeCode(a.code);
    if (!aim.obj.userData.keypad.solved) fail('padlock rejected the code');
    step(0.9);
  } else if (a.t === 'look') {
    step(0.2);
  } else if (a.t === 'uv') {
    if (G().flashlight.intensity === 0) G().toggleFlashlight();
    step(0.6);
    G().toggleFlashlight();
  }
}

const SOLVERS = {
  escape_room(c) {
    for (const a of c.actions) escapeAction(a, c.y0);
  },
  grow_plate(c) {
    growOntoPlate(c.cube, c.plates[0], c);
  },
  two_plates(c) {
    growOntoPlate(c.cubes[0], c.plates[0], c);
    growOntoPlate(c.cubes[1], c.plates[1], c);
  },
  step_ledge(c) {
    const { front, top } = c.ledge;
    pickUp(c.cube, c.y0);
    const ok = (cube) => {
      const p = cube.mesh.position;
      return cube.size > 0.8 && cube.size < 1.45 && p.z - cube.size / 2 < front + 0.6 && p.y - cube.size / 2 < c.y0 + 0.5;
    };
    const stands = [9, 7, 5, 11].map((back) => ({ x: 0, y: c.y0, z: Math.min(c.zS - 0.8, front + back) }));
    const cube = placeHeldAt({ x: 0, z: front }, ok, stands);
    const p = cube.mesh.position;
    place(p.x, c.y0, p.z + cube.size / 2 + 2.2, 0, 0);
    hold(['KeyW', 'Space'], 2.5);
    if (G().player.pos.y < top - 0.2) fail('could not climb onto the ledge');
  },
  shrink_socket(c) {
    const s = c.socket;
    const p = c.cube.mesh.position;
    // Grab the big cube from a few metres away so it shrinks a lot.
    standLook(p.x, c.y0, p.z + c.cube.size / 2 + 3.1, [p.x, p.y, p.z]);
    G().interact();
    if (held() !== c.cube) fail('could not pick up the big cube');
    const sgn = s.side === 'e' ? 1 : -1;
    const inSocket = (cube) => {
      const q = cube.mesh.position;
      return cube.size <= s.maxSize - 0.02 && Math.abs(q.z - s.z) < 0.5 - cube.size / 2 + 0.02 && Math.abs(q.y - s.y) < 0.45 &&
        (sgn > 0 ? q.x > s.mouthX + cube.size / 2 - 0.05 : q.x < s.mouthX - cube.size / 2 + 0.05);
    };
    for (const back of [1.0, 0.8, 1.2, 0.6, 1.5]) {
      const sx = s.mouthX - sgn * back;
      for (let dy = -0.3; dy <= 0.3; dy += 0.05) {
        standLook(sx, c.y0, s.z, [s.x, s.y + dy, s.z]);
        if (inSocket(held())) {
          drop();
          return;
        }
      }
    }
    fail('could not fit the cube into the socket');
  },
  portal_glass(c) {
    portalHop(c, c.near[0], c.far[0], [c.glassZ + 1.5, c.zS - 1]);
  },
  portal_pit(c) {
    portalHop(c, c.near[0], c.far[0], [c.pitS + 0.8, c.zS - 1]);
  },
  portal_ledge(c) {
    const from = c.floorPanels[0], to = c.ledgePanel;
    fireAt('blue', from, standsIn(c, c.ledge.front + 1.5, c.zS - 1));
    fireAt('orange', to, standsIn(c, c.ledge.front + 3, c.zS - 0.8).reverse());
    walkThroughPortal(from, c.y0);
  },
  anamorph_code(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  window_code(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  color_count(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  dark_room(c) {
    pressButton(c.button, c.y0);
    step(1);
    typeCode(c.keypad, c.code, c.y0 + c.exitY);
  },
  button_sequence(c) {
    for (const btn of c.buttons) pressButton(btn, c.y0);
  },
  loop_rooms(c) {
    const forward = c.target > c.room;
    place(forward ? c.x0 + 2 : c.x1 - 2, c.y0, c.zc, forward ? -Math.PI / 2 : Math.PI / 2, 0);
    G().keys.add('KeyW');
    for (let t = 0; t < 90 && c.room !== c.target; t += 0.25) step(0.25);
    G().keys.delete('KeyW');
    step(0.1);
    if (c.room !== c.target) fail(`loop stuck in room ${c.room}, wanted ${c.target}`);
  },
  bigger_inside(c) {
    place(c.closet.x, c.y0, c.closet.front + 1.6, 0, 0);
    hold(['KeyW'], 1.2);
    if (G().player.pos.x < 1000) fail('did not enter the closet');
    pressButton(c.button, 0);
    place(c.remoteX, 0, c.remotePortalZ - 1.6, Math.PI, 0);
    hold(['KeyW'], 1.2);
    if (G().player.pos.x > 1000) fail('did not come back out of the closet');
  },
  cube_rescue(c) {
    const { encl } = c;
    const sgn = encl.side === 'e' ? 1 : -1;
    const lo = Math.min(encl.inner, encl.wallX) - 0.6, hi = Math.max(encl.inner, encl.wallX) + 0.6;
    const inCase = (s) => s.x > lo && s.x < hi && Math.abs(s.z - encl.zc) < 2.5;
    portalHop(c, c.outside[0], c.inside, [c.zN + 7, c.zS - 1], c.y0, inCase);
    pickUp(c.cube, c.y0, 1.1);
    // Walk back out through the inside portal, holding the cube.
    const p = c.inside.point;
    place(p.x - sgn * 1.4, c.y0, p.z, sgn > 0 ? -Math.PI / 2 : Math.PI / 2, -0.35);
    hold(['KeyW'], 1.2);
    if (held() !== c.cube) fail('lost the cube going through the portal');
    if (Math.abs(G().player.pos.x - encl.wallX) < 3.4 && Math.abs(G().player.pos.z - encl.zc) < 1.8) fail('still inside the glass case');
    growOntoPlate(c.cube, c.plates[0], c);
  },
};

// Wall switches face along rotY; stand in front of them.
function pressSwitch(sw, y0) {
  const nx = Math.sin(sw.rotY), nz = Math.cos(sw.rotY);
  standLook(sw.x + nx * 1.1, y0, sw.z + nz * 1.1, [sw.x, sw.y + 0.1, sw.z]);
  if (G().aim?.kind !== 'button') fail('could not aim at a wall switch');
  G().interact();
  step(0.1);
}

function climbFromSouth(c, x, z, sec = 3) {
  place(x, c.y0, z, 0, 0);
  hold(['KeyW', 'Space'], sec);
  if (G().player.pos.y < c.ledge.top - 0.2) fail('could not climb onto the ledge');
}

function growStep(c, cube, minSize, maxSize) {
  const { front } = c.ledge;
  const ok = (k) => {
    const p = k.mesh.position;
    return k.size > minSize && k.size < maxSize && p.z - k.size / 2 < front + 0.6 && p.y - k.size / 2 < c.y0 + 0.5 && Math.abs(p.x) < c.x1 - 1;
  };
  const stands = [9, 7, 5, 11, 13, 4, 15].map((back) => ({ x: 0, y: c.y0, z: Math.min(c.zS - 0.8, front + back) }));
  // Like a player re-grabbing: try a few grab distances (closer = bigger cube).
  let last = null;
  for (const dist of [1.4, 1.1, 0.9, 1.8]) {
    try {
      pickUp(cube, c.y0, dist);
      return placeHeldAt({ x: 0, z: front }, ok, stands);
    } catch (err) {
      last = err;
      drop();
      cube.resetHome(); // like pressing R before trying again
      step(0.5);
    }
  }
  throw last;
}

// Stand in front of a wall-mounted thing and press it (n times).
function pressAt(p, stand, n = 1) {
  standLook(stand.x, stand.y, stand.z, [p.x, p.y, p.z]);
  for (let i = 0; i < n; i++) {
    if (G().aim?.kind !== 'button') fail(`could not aim at ${JSON.stringify(p)} (aim: ${G().aim?.kind ?? 'nothing'})`);
    G().interact();
    step(0.08);
  }
}

// Grow a cube onto a spot with a size window (tries a few grab distances).
function growInto(c, cube, target, accept) {
  const stands = [5, 7, 9, 11, 4, 13].map((back) => ({ x: target.x, y: c.y0, z: Math.min(c.zS - 0.8, target.z + back) }));
  let last = null;
  for (const dist of [1.4, 1.1, 1.8, 0.9]) {
    try {
      pickUp(cube, c.y0, dist);
      return placeHeldAt(target, accept, stands);
    } catch (err) {
      last = err;
      drop();
      cube.resetHome();
      step(0.5);
    }
  }
  throw last;
}

// ---- tools (modules5.js): aim from where we are, then use the tool.
const tools = () => G().tools;
function aimAt(target) {
  const p = G().player;
  const e = [p.pos.x, p.pos.y + 1.6, p.pos.z];
  const a = aimFrom(e, [target.x, target.y, target.z]);
  p.yaw = a.yaw;
  p.pitch = a.pitch;
  step(FRAME * 2);
}
function useTool(id, which = 0) {
  tools().select(id);
  if (tools().current !== id) fail(`tool ${id} not available`);
  if (which) tools().secondary(); else tools().primary();
}
function grappleTo(ring) {
  aimAt(ring);
  useTool('grapple');
  for (let t = 0; t < 3.5 && tools().tools.grapple.mode !== 'hang'; t += FRAME) step(FRAME);
  if (tools().tools.grapple.mode !== 'hang') fail('grapple did not reach the ring');
}
function blinkTo(target, from) {
  if (from) place(from.x, from.y, from.z, 0, 0);
  aimAt({ x: target.x, y: target.y, z: target.z });
  useTool('blink', 0);
  step(0.5);
  if (!tools().tools.blink.placed) fail('beacon did not land');
  useTool('blink', 1);
  step(0.3);
}

const TOOL_SOLVERS = {
  grapple_gap(c) {
    place(0, c.y0, c.zS - 2, 0, 0);
    for (const r of c.rings) grappleTo(r);
    useTool('grapple', 1);
    step(1.5);
  },
  grapple_climb(c) {
    place(0, c.y0, c.front + 5, 0, 0);
    for (const r of c.rings) grappleTo(r);
    useTool('grapple', 1);
    step(1.5);
  },
  blink_cage(c) {
    place(0, c.y0, c.targets[0].z + 4, 0, 0);
    for (const t of c.targets) blinkTo(t);
    step(0.3);
  },
  blink_islands(c) {
    place(c.targets[0].x * 0.3, c.y0, c.zS - 1.5, 0, 0);
    for (const t of c.targets) blinkTo(t);
    step(0.5);
  },
  gel_bounce(c) {
    place(0, c.y0, c.spot.z + 4, 0, 0);
    aimAt(c.spot);
    useTool('gel', 0);
    step(0.2);
    place(0, c.y0, c.spot.z + 3, 0, 0);
    hold(['KeyW'], 2.2);
  },
  gel_speed(c) {
    const spot = { x: 0, y: c.y0, z: c.pitS + 1.2 };
    place(0, c.y0, c.pitS + 4.5, 0, 0);
    aimAt(spot);
    useTool('gel', 1);
    step(0.2);
    place(0, c.y0, c.pitS + 7.4, 0, 0);
    const k = G().keys;
    k.add('KeyW'); k.add('ShiftLeft');
    let jumped = false;
    for (let t = 0; t < 4 && !c.done; t += FRAME) {
      if (!jumped && G().player.pos.z < c.pitS + 0.35) { jumped = true; G().player.queueJump(); }
      step(FRAME);
    }
    k.delete('KeyW'); k.delete('ShiftLeft');
    step(0.3);
  },
  chrono_blades(c) {
    place(1.6, c.y0, c.zS - 1.2, 0, 0);
    useTool('chrono');
    const k = G().keys;
    k.add('KeyW'); k.add('ShiftLeft');
    for (let t = 0; t < 4 && !c.done; t += FRAME) step(FRAME);
    k.delete('KeyW'); k.delete('ShiftLeft');
    step(0.3);
  },
  chrono_crusher(c) {
    place(0, c.y0, c.zS - 1.2, 0, 0);
    // Wait until every piston is up, then freeze and walk under.
    for (let t = 0; t < 8 && !c.heights.every((h) => h > c.minY + 2.0); t += FRAME) step(FRAME);
    useTool('chrono');
    const k = G().keys;
    k.add('KeyW'); k.add('ShiftLeft');
    for (let t = 0; t < 4 && !c.done; t += FRAME) step(FRAME);
    k.delete('KeyW'); k.delete('ShiftLeft');
    step(0.3);
  },
  echo_plates(c) {
    const [a, b] = c.pads;
    place(a.x, a.y, a.z, 0, 0);
    useTool('echo');
    step(0.5);
    useTool('echo');
    place(b.x, b.y, b.z, 0, 0);
    step(0.4);
  },
  echo_door(c) {
    place(c.pad.x, c.pad.y, c.pad.z, 0, 0);
    useTool('echo');
    step(0.5);
    useTool('echo');
    place(0, c.y0, c.gateZ + 2, 0, 0);
    step(1.2); // the gate rises while the hologram holds the pad
    hold(['KeyW'], 1.2);
  },
  hidden_bridge(c) {
    tools().select('lantern');
    if (!tools().tools.lantern.on) useTool('lantern');
    place(0, c.y0, c.pitS + 1, 0, 0);
    step(0.6);
    for (const pt of c.bridge) walkTo(pt.x, pt.z, 4);
    step(0.3);
  },
  hidden_stairs(c) {
    tools().select('lantern');
    if (!tools().tools.lantern.on) useTool('lantern');
    step(0.6);
    for (const blk of c.blocks) {
      place(blk.x, blk.y + 0.02, blk.z, 0, 0);
      step(0.15);
      if (G().player.pos.y < blk.y - 0.2) fail('fell through a hidden step');
    }
    const last = c.blocks[c.blocks.length - 1];
    place(last.x, last.y + 0.02, last.z, 0, 0);
    hold(['KeyW', 'Space'], 1.2);
  },
  throw_target(c) {
    const cube = c.cube;
    const grab = () => {
      const p = cube.mesh.position;
      place(p.x, c.y0, p.z + 2.2, 0, 0);
      aimAt({ x: p.x, y: p.y, z: p.z });
      useTool('tether', 0);
      step(0.6);
      if (!tools().tools.tether.cube) fail('tether could not grab the cube');
    };
    const t = c.target;
    for (let back = 5; back <= 9 && !c.done; back += 2) {
      for (let lift = 0.1; lift < 1.6 && !c.done; lift += 0.15) {
        grab();
        place(t.x, c.y0, t.z + back, 0, 0);
        aimAt({ x: t.x, y: t.y + lift, z: t.z });
        step(0.3);
        useTool('tether', 0); // throw
        step(1.5);
        if (!c.done) { cube.resetHome(); step(0.3); }
      }
    }
  },
  tether_fetch(c) {
    const p = c.cube.mesh.position;
    place(p.x, c.y0, c.zS - 1.5, 0, 0);
    aimAt({ x: p.x, y: p.y, z: p.z });
    useTool('tether', 0);
    step(1.2);
    if (!tools().tools.tether.cube) fail('tether could not grab the cube');
    // Stand by the plate and let go above it.
    place(c.plate.x, c.y0, c.plate.z + 2.0, 0, 0);
    aimAt({ x: c.plate.x, y: c.y0 + 0.4, z: c.plate.z });
    step(0.8);
    useTool('tether', 1);
    step(1.2);
  },
};

// The rooms introduced on the 7-level schedule (modules4.js).
Object.assign(SOLVERS, TOOL_SOLVERS);

Object.assign(SOLVERS, {
  lever_pattern(c) {
    for (const l of c.levers.filter((x) => x.need)) pressAt(l, { x: l.x + (l.west ? 1.2 : -1.2), y: c.y0, z: l.z });
    step(0.3);
  },
  color_mix(c) {
    for (const btn of c.buttons.filter((x) => x.need)) pressButton(btn, c.y0);
    step(0.3);
  },
  lights_out(c) {
    for (const p of c.presses) pressAt(p, { x: p.x + 1.5, y: c.y0, z: p.z });
    step(0.3);
  },
  balance_scale(c) {
    const { pan } = c;
    growInto(c, c.cube, pan, (k) => {
      const p = k.mesh.position;
      return k.size > c.min && k.size < c.max && Math.abs(p.x - pan.x) < pan.half - 0.15 && Math.abs(p.z - pan.z) < pan.half - 0.15 && p.y - k.size / 2 < pan.y + 0.6;
    });
    step(1);
  },
  moving_platform(c) {
    // Wait for it on our side, ride it over, step off.
    place(0, c.y0, c.pitS + 1.0, 0, 0);
    for (let t = 0; t < 40 && !c.atNear; t += FRAME) step(FRAME);
    if (!c.atNear) fail('platform never came');
    place(0, c.y0 + 0.02, c.z, 0, 0);
    for (let t = 0; t < 30 && Math.abs(c.z - c.far) > 0.02; t += FRAME) step(FRAME);
    hold(['KeyW'], 1.2);
    if (!c.done) step(0.3);
  },
  telescope(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  mirror_beam(c) {
    for (const m of c.mirrors.filter((x) => x.need)) pressButton(m, c.y0);
    step(0.3);
  },
  symbol_hunt(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  conveyor(c) {
    place(0, c.y0, c.start, 0, 0);
    G().keys.add('KeyW');
    G().keys.add('ShiftLeft');
    for (let t = 0; t < 15 && !c.done; t += FRAME) step(FRAME);
    G().keys.delete('KeyW');
    G().keys.delete('ShiftLeft');
    step(0.2);
  },
  pipe_flow(c) {
    for (const p of c.presses) if (p.n) pressAt(p, { x: p.x, y: c.y0, z: p.z + 1.5 }, p.n);
    step(0.3);
  },
  sweeper(c) {
    const active = (i) => ((c.t + c.phase[i]) % c.period) < c.on;
    c.gates.forEach((g, i) => {
      place(0, c.y0, g.z + 0.9, 0, 0);
      // Wait for the gate to switch off, then sprint through.
      for (let t = 0; t < 10 && !(active(i) === false && ((c.t + c.phase[i]) % c.period) < c.on + 0.12); t += FRAME) step(FRAME);
      G().keys.add('KeyW');
      G().keys.add('ShiftLeft');
      for (let t = 0; t < 1 && G().player.pos.z > g.z - 0.7; t += FRAME) step(FRAME);
      G().keys.delete('KeyW');
      G().keys.delete('ShiftLeft');
      step(FRAME * 2);
    });
    place(0, c.y0, c.gates[c.gates.length - 1].z - 1.5, 0, 0);
    step(0.2);
  },
  dual_switch(c) {
    const [w, e] = c.switches;
    pressAt(w, { x: w.x + 1.2, y: c.y0, z: w.z });
    pressAt(e, { x: e.x - 1.2, y: c.y0, z: e.z });
    step(0.3);
  },
});

Object.assign(SOLVERS, {
  bounce_pad(c) {
    if (c.plates.length) growOntoPlate(c.cube, c.plates[0], c);
    place(c.pad.x, c.y0, c.pad.z + 2.2, 0, 0);
    hold(['KeyW'], 2.5);
    if (G().player.pos.y < c.ledge.top - 0.2) fail('launch pad did not get us onto the ledge');
  },
  fan_lift(c) {
    if (c.plates.length) growOntoPlate(c.cube, c.plates[0], c);
    place(c.fan.x, c.y0, c.fan.z, 0, 0);
    step(3);
    hold(['KeyW'], 2);
    if (G().player.pos.y < c.ledge.top - 0.2) fail('updraft did not get us onto the ledge');
  },
  keycard_doors(c) {
    for (const s of c.steps) {
      if (s.type === 'take') pressButton(s, c.y0);
      else pressSwitch(s, c.y0);
      step(1.4); // let booth doors finish opening
    }
  },
  laser_fence(c) {
    const { beam } = c;
    pickUp(c.cube, c.y0, 0.9); // grab close: the cube must grow a lot
    const ok = (k) => {
      const p = k.mesh.position;
      return k.size >= c.need && Math.abs(p.x - beam.x) < k.size / 2 - 0.1 &&
        p.z < beam.z0 - k.size / 2 - 0.05 && p.z > beam.z1 + k.size / 2 + 0.05 && p.y - k.size / 2 < c.y0 + 0.5;
    };
    const stands = [];
    for (const dz of [0.8, 1.6, 2.4, 3.4, 4.6]) for (const dx of [0, 1, -1, 2, -2]) stands.push({ x: beam.x + dx, y: c.y0, z: c.zS - dz });
    placeHeldAt({ x: beam.x, z: (beam.z0 + beam.z1) / 2 }, ok, stands);
    step(0.5);
    place(-beam.x * 0.3, c.y0, c.fenceZ + 2, 0, 0);
    hold(['KeyW'], 1.5);
  },
  memory_sequence(c) {
    pressButton(c.start, c.y0);
    step(c.playTime + 0.5);
    for (const btn of c.buttons) pressButton(btn, c.y0);
  },
  stack_ledge(c) {
    // A staircase: a tall cube against the ledge, a short one in front of it.
    const [a, bCube] = c.cubes;
    const rise = c.ledge.top - c.y0;
    const tallMin = Math.max(1.6, rise - 1.4), tallMax = Math.min(2.8, tallMin + 0.9);
    const tall = growStep(c, a, tallMin, tallMax);
    step(0.5);
    const p1 = tall.mesh.position;
    const south = p1.z + tall.size / 2;
    pickUp(bCube, c.y0);
    const inFront = (k) => {
      const p = k.mesh.position;
      return k.size > Math.max(0.8, tall.size - 1.45) && k.size < 1.45 && Math.abs(p.x - p1.x) < tall.size / 2 - 0.3 &&
        p.z - k.size / 2 > south - 0.05 && p.z - k.size / 2 < south + 0.5 && p.y - k.size / 2 < c.y0 + 0.4;
    };
    const stands = [6, 8, 5, 10, 12].map((back) => ({ x: p1.x, y: c.y0, z: Math.min(c.zS - 0.8, south + back) }));
    const short = placeHeldAt({ x: p1.x, z: south + 0.7 }, inFront, stands);
    step(1);
    climbFromSouth(c, p1.x, short.mesh.position.z + short.size / 2 + 2.2, 5);
  },
  math_code(c) { typeCode(c.keypad, c.code, c.y0 + c.exitY); },
  collapsing_floor(c) {
    // Sprint across; jump just before each missing tile (gaps lists their south edges).
    place(0, c.y0, c.pitS + 1.2, 0, 0);
    const k = G().keys;
    k.add('KeyW');
    k.add('ShiftLeft');
    const jumped = new Set();
    for (let t = 0; t < (c.pitS - c.pitN) / 5 + 3 && !c.done; t += FRAME) {
      const z = G().player.pos.z;
      for (const g of c.gaps) {
        if (!jumped.has(g) && z < g + 0.9 && z > g) {
          jumped.add(g);
          k.add('Space');
        }
      }
      step(FRAME);
      k.delete('Space');
    }
    k.delete('KeyW');
    k.delete('ShiftLeft');
    step(0.2);
  },
  teleport_maze(c) {
    for (const hop of c.route) {
      const yaw = Math.atan2(-(hop.x - hop.from.x), -(hop.z - hop.from.z));
      place(hop.from.x, c.y0, hop.from.z, yaw, 0);
      G().keys.add('KeyW');
      let arrived = false;
      for (let t = 0; t < 3 && !arrived; t += 0.05) {
        step(0.05);
        const p = G().player.pos;
        arrived = Math.hypot(p.x - hop.to.x, p.z - hop.to.z) < 0.6;
      }
      G().keys.delete('KeyW');
      step(0.1);
      if (!arrived) fail('teleporter did not take us where expected');
    }
  },
  sprint_door(c) {
    pressButton(c.button, c.y0);
    place(0, c.y0, c.button.z - 0.8, 0, 0); // down the middle, lined up with the door
    hold(['KeyW', 'ShiftLeft'], c.window + 1);
  },
});

// Walk towards (x, z), steering every frame.
function walkTo(x, z, maxSec = 8) {
  const g = G(), p = g.player;
  g.keys.add('KeyW');
  for (let t = 0; t < maxSec; t += FRAME) {
    const dx = x - p.pos.x, dz = z - p.pos.z;
    if (Math.hypot(dx, dz) < 0.3) break;
    p.yaw = Math.atan2(-dx, -dz);
    g.update(FRAME);
  }
  g.keys.delete('KeyW');
  step(0.05);
}

// From just inside the exit door, through the connector (stairs, chicanes…).
function walkToNext(c) {
  const y = c.y0 + c.exitY;
  // Already through (e.g. sprinted on): carry on from here. Doors may have
  // sealed behind us, so never step back.
  if (G().player.pos.z < c.zN - 0.5) {
    for (const [x, z] of c.path ?? []) if (G().player.pos.z > z) walkTo(x, z);
    return;
  }
  place(0, y, c.zN + 1.2, 0, 0);
  walkTo(0, c.zN - 0.6);
  for (const [x, z] of c.path ?? [[0, c.zN - 4]]) walkTo(x, z);
}

export async function solve(id, { daily = false } = {}) {
  const g = G();
  g.manual = true;
  g.render = false;
  g.play(id, daily);
  step(0.2);
  const cells = level().debug?.cells;
  if (!cells) return { id, ok: false, reason: 'not a generated level' };
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    try {
      if (c.toolPickup) pressButton(c.toolPickup, c.y0);
      SOLVERS[c.id](c);
      step(0.3);
      if (!c.done) fail('puzzle did not register as solved');
      walkToNext(c);
      if (i < cells.length - 1 && G().player.pos.z > cells[i + 1].zS) fail('could not walk through the exit door');
    } catch (err) {
      return { id, ok: false, module: c.id, cell: i, reason: err.message, modules: cells.map((x) => x.id) };
    }
  }
  walkTo(0, level().debug.exitZ, 6);
  const ok = G().game.escaped;
  return { id, ok, reason: ok ? null : 'did not reach the exit', modules: cells.map((x) => x.id) };
}

export async function solveAll(ids, onProgress) {
  const results = [];
  for (const id of ids) {
    let r;
    try {
      r = await solve(id);
    } catch (err) {
      r = { id, ok: false, reason: `crash: ${err.message}` };
    }
    results.push(r);
    onProgress?.(r);
    await new Promise((res) => setTimeout(res, 0));
  }
  return results;
}
