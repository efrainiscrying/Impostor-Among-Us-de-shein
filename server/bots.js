'use strict';
// Inteligencia artificial de los bots
const S = require('../public/js/shared.js');

const G = S.GRID;

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// ---------------------------------------------------------------- rutas
function nearestFree(wg, i, j) {
  if (i >= 0 && j >= 0 && i < wg.cols && j < wg.rows && wg.g[j * wg.cols + i]) return [i, j];
  for (let r = 1; r < 8; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < wg.cols && b < wg.rows && wg.g[b * wg.cols + a]) return [a, b];
    }
  }
  return null;
}

function findPath(room, sx, sy, tx, ty) {
  const wg = room.wgrid;
  const s = nearestFree(wg, Math.floor(sx / G), Math.floor(sy / G));
  const t = nearestFree(wg, Math.floor(tx / G), Math.floor(ty / G));
  if (!s || !t) return null;
  const cols = wg.cols;
  const start = s[1] * cols + s[0], goal = t[1] * cols + t[0];
  const prev = new Int32Array(wg.g.length).fill(-1);
  prev[start] = start;
  const q = new Int32Array(wg.g.length);
  let qh = 0, qt = 0;
  q[qt++] = start;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (qh < qt) {
    const c = q[qh++];
    if (c === goal) break;
    const ci = c % cols, cj = (c / cols) | 0;
    for (const [di, dj] of dirs) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= wg.rows) continue;
      const n = nj * cols + ni;
      if (prev[n] !== -1 || !wg.g[n]) continue;
      if (di && dj && (!wg.g[cj * cols + ni] || !wg.g[nj * cols + ci])) continue;
      prev[n] = c;
      q[qt++] = n;
    }
  }
  if (prev[goal] === -1) return null;
  const cells = [];
  for (let c = goal; c !== start; c = prev[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map(c => ({ x: (c % cols) * G + G / 2, y: ((c / cols) | 0) * G + G / 2 }));
  pts.push({ x: tx, y: ty });
  return smooth(room, { x: sx, y: sy }, pts);
}

function clearLine(room, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 10);
  for (let k = 1; k <= n; k++) {
    const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
    if (!S.canStand(room.map, x, y)) return false;
  }
  return true;
}

function smooth(room, from, pts) {
  const out = [];
  let cur = from, i = 0;
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 12);
    while (j > i && !clearLine(room, cur, pts[j])) j--;
    out.push(pts[j]);
    cur = pts[j];
    i = j + 1;
  }
  return out;
}

function goTo(room, p, x, y) {
  const path = findPath(room, p.x, p.y, x, y);
  p.ai.path = path || [];
  p.ai.goal = { x, y };
  p.ai.stuck = 0;
  return !!path;
}

function walk(room, p, dt) {
  const ai = p.ai;
  if (!ai.path || !ai.path.length) { p.m = 0; return true; }
  let budget = room.speedOf(p) * dt;
  while (budget > 0 && ai.path.length) {
    const t = ai.path[0];
    const dx = t.x - p.x, dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) { ai.path.shift(); continue; }
    const step = Math.min(d, budget);
    const nx = p.x + dx / d * step, ny = p.y + dy / d * step;
    let np;
    if (!p.alive && room.phase !== 'lobby') np = { x: nx, y: ny };
    else np = S.moveWithCollision(room.map, p.x, p.y, nx - p.x, ny - p.y, room.closedDoors);
    const moved = Math.hypot(np.x - p.x, np.y - p.y);
    if (Math.abs(dx) > 1) p.f = dx < 0 ? 1 : 0;
    p.x = np.x; p.y = np.y;
    budget -= step;
    if (moved < step * 0.3) {
      ai.stuck += dt;
      if (ai.stuck > 1.2) { ai.path = []; ai.stuckOut = true; }
      break;
    } else ai.stuck = 0;
  }
  p.m = ai.path.length ? 1 : 0;
  return !ai.path.length;
}

// ---------------------------------------------------------------- percepción
function sees(room, p, q, radius) {
  if (Math.hypot(p.x - q.x, p.y - q.y) > radius) return false;
  return S.lineOfSight(room.map, room.vgrid, p.x, p.y - 20, q.x, q.y - 20, room.closedDoors);
}

function visionOf(room, p) {
  const s = room.settings;
  const imp = p.role === 'impostor' || p.role === 'seeker';
  let r = S.BASE_VISION * (imp ? s.impVision : s.crewVision);
  if (!imp && room.sab && room.sab.kind === 'lights') r *= 0.35;
  return Math.max(150, r);
}

function roomName(room, x, y) {
  const r = S.roomAt(room.map, x, y);
  return r ? r.name : 'un pasillo';
}

function colorName(id) { const c = S.COLORS.find(c => c.id === id); return c ? c.name : id; }

function botChat(room, p, text) {
  room.broadcast({ t: 'chat', id: p.id, name: p.name, color: p.color, hat: p.hat, text, ghost: false });
}

function initAI(p) {
  p.ai = { path: [], goal: null, wait: 0, stuck: 0, suspicion: {}, think: 0, lastRoom: null, chase: null, chaseT: 0 };
}

// ---------------------------------------------------------------- tick
function tick(room, dt, now) {
  for (const p of room.players.values()) {
    if (!p.bot || p.left) continue;
    if (!p.ai) initAI(p);
    try {
      if (room.phase === 'lobby') lobbyAI(room, p, dt, now);
      else if (room.phase === 'play') playAI(room, p, dt, now);
      else if (room.phase === 'meeting') meetingAI(room, p, now);
      else p.m = 0;
    } catch (e) { console.error('bot', e); }
  }
}

function lobbyAI(room, p, dt, now) {
  const ai = p.ai;
  if (walk(room, p, dt) && now > ai.wait) {
    ai.wait = now + rnd(1500, 6000);
    const c = S.LOBBY.spawnCenter;
    goTo(room, p, c.x + rnd(-380, 380), c.y + rnd(-200, 200));
  }
}

function playAI(room, p, dt, now) {
  const ai = p.ai;
  const s = room.settings;
  const roomNow = S.roomAt(room.map, p.x, p.y);
  if (roomNow) ai.lastRoom = roomNow.name;
  if (p.inVent) { p.m = 0; if (now > ai.ventOut) room.onVent(p, { a: 'exit' }); return; }

  // Pensamiento periódico
  if (now >= ai.think) {
    ai.think = now + 400;
    if (p.role === 'crew' && p.alive && s.mode === 'classic') {
      for (const b of room.bodies) {
        if (sees(room, p, b, visionOf(room, p))) {
          if (!ai.reportAt) ai.reportAt = now + rnd(500, 1800);
          ai.reportBody = b;
          // quién estaba cerca
          for (const q of room.active()) {
            if (q !== p && q.alive && Math.hypot(q.x - b.x, q.y - b.y) < 260) ai.suspicion[q.id] = (ai.suspicion[q.id] || 0) + 25;
          }
        }
      }
    }
    if (p.role === 'impostor' || p.role === 'seeker') thinkHunter(room, p, now);
    if (p.role === 'hider' && p.alive) thinkHider(room, p, now);
  }

  if (ai.reportAt && now >= ai.reportAt && p.alive) {
    const b = ai.reportBody;
    ai.reportAt = 0;
    if (b && room.bodies.indexOf(b) >= 0) {
      if (Math.hypot(p.x - b.x, p.y - b.y) > S.REPORT_RANGE) goTo(room, p, b.x, b.y);
      else { ai.reported = { color: b.color, room: roomName(room, b.x, b.y) }; room.onReport(p, b.id); return; }
      ai.reportAt = now + 600;
    }
  }

  // Persecución
  if (ai.chase) {
    const t = room.players.get(ai.chase);
    if (!t || !t.alive || now > ai.chaseT || (p.role === 'seeker' && now < room.seekerReleaseAt)) { ai.chase = null; ai.path = []; }
    else {
      const range = S.KILL_DISTANCES[s.killDistance];
      if (Math.hypot(p.x - t.x, p.y - t.y) < range * 0.8 && now >= p.killReadyAt) {
        room.onKill(p, t);
        ai.chase = null;
        ai.path = [];
        if (p.role === 'impostor') afterKill(room, p, now);
        return;
      }
      if (!ai.path.length || now > (ai.repath || 0)) { ai.repath = now + 500; goTo(room, p, t.x, t.y); }
      walk(room, p, dt);
      return;
    }
  }

  // Sabotajes críticos: los tripulantes van a arreglar
  if (room.sab && p.alive && (p.role === 'crew') && fixSabotage(room, p, dt, now)) return;

  if (p.role === 'seeker' && now < room.seekerReleaseAt) { p.m = 0; return; }

  // Tareas
  if (ai.doing) {
    p.m = 0;
    if (now >= ai.doing.until) {
      const t = p.tasks.find(x => x.id === ai.doing.id);
      p.scanning = false;
      if (t && !t.done && !p.fake) room.onTask(p, t.id, t.step);
      if (p.fake) ai.fakeDone = (ai.fakeDone || 0) + 1;
      ai.doing = null;
    }
    return;
  }
  const arrived = walk(room, p, dt);
  if (ai.fleeing && arrived) ai.fleeing = false;
  if (!arrived && !ai.stuckOut) return;
  ai.stuckOut = false;
  if (now < ai.wait) return;

  const next = p.fake ? null : p.tasks.find(t => !t.done);
  if (next && (p.alive || p.role === 'crew' || p.role === 'hider' || p.role === 'racer')) {
    const st = next.steps[next.step];
    if (Math.hypot(p.x - st.x, p.y - st.y) < 50) {
      const race = s.mode === 'race';
      ai.doing = { id: next.id, until: now + (race ? rnd(4500, 8000) : rnd(2500, 5500)) };
      if (st.game === 'scan' && s.visualTasks) p.scanning = true;
    } else if (!goTo(room, p, st.x, st.y)) ai.wait = now + 1000;
    return;
  }
  // Pasear (impostores fingen tareas)
  const all = Object.values(S.TASKS).reduce((a, t) => a.concat(t.steps.filter(x => !x.options)), []);
  const spot = pick(all);
  goTo(room, p, spot.x + rnd(-20, 20), spot.y + rnd(-10, 10));
  ai.wait = now + rnd(0, 1500);
  if (p.fake && Math.random() < 0.5) ai.doing = null;
}

function thinkHunter(room, p, now) {
  const ai = p.ai;
  const s = room.settings;
  if (!p.alive) return;
  if (p.role === 'seeker' && now < room.seekerReleaseAt) return;
  const vis = visionOf(room, p);
  const preys = room.active().filter(q => q.alive && !q.inVent && q !== p && q.role !== 'impostor' && q.role !== 'seeker');
  if (!ai.chase && now + 1500 >= p.killReadyAt) {
    let best = null, bd = 1e9;
    for (const q of preys) {
      if (!sees(room, p, q, vis)) continue;
      if (p.role === 'impostor') {
        const witnesses = room.active().filter(w => w.alive && w !== p && w !== q && w.role !== 'impostor' && sees(room, w, q, 520));
        if (witnesses.length) continue;
      }
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) { ai.chase = best.id; ai.chaseT = now + (p.role === 'seeker' ? 9000 : 6000); ai.doing = null; }
  }
  if (p.role === 'seeker' && !ai.chase && ai.pings && ai.pings.length && (!ai.path.length)) {
    let best = null, bd = 1e9;
    for (const pt of ai.pings) { const d = Math.hypot(pt[0] - p.x, pt[1] - p.y); if (d < bd) { bd = d; best = pt; } }
    if (best) goTo(room, p, best[0], best[1]);
  }
  // Sabotaje ocasional
  if (p.role === 'impostor' && s.mode === 'classic' && !room.sab && now >= room.sabReadyAt && Math.random() < 0.02) {
    room.onSabotage(p, { kind: pick(['lights', 'lights', 'reactor', 'o2']) });
  }
}

function afterKill(room, p, now) {
  // huir por una ventila cercana a veces
  const v = S.SHIP.vents.find(v => Math.hypot(v.x - p.x, v.y - p.y) < S.VENT_RANGE + 30);
  if (v && Math.random() < 0.7) {
    room.onVent(p, { a: 'enter' });
    const to = pick(v.links);
    setTimeout(() => { if (p.inVent) room.onVent(p, { a: 'move', to }); }, 900);
    p.ai.ventOut = now + 2500;
  }
}

function thinkHider(room, p, now) {
  const ai = p.ai;
  const seeker = room.active().find(q => q.role === 'seeker' && q.alive);
  if (!seeker || now < room.seekerReleaseAt) return;
  if (sees(room, p, seeker, 480) && !ai.fleeing) {
    const spots = S.SHIP.rooms.map(r => ({ x: r.r.x + r.r.w / 2, y: r.r.y + r.r.h - 60 }));
    spots.sort((a, b) => Math.hypot(b.x - seeker.x, b.y - seeker.y) - Math.hypot(a.x - seeker.x, a.y - seeker.y));
    const target = pick(spots.slice(0, 4));
    ai.doing = null;
    p.scanning = false;
    ai.fleeing = true;
    goTo(room, p, target.x, target.y);
  }
}

function fixSabotage(room, p, dt, now) {
  const sab = room.sab;
  const ai = p.ai;
  const stations = S.SABOTAGE_STATIONS[sab.kind];
  if (!stations) return false;
  let idx = 0;
  if (sab.kind === 'reactor') idx = sab.holds[0] && sab.holds[0] !== p.id ? 1 : (sab.holds[1] && sab.holds[1] !== p.id ? 0 : (ai.sabIdx === undefined ? (ai.sabIdx = Math.random() < 0.5 ? 0 : 1) : ai.sabIdx));
  if (sab.kind === 'o2') { idx = sab.done[0] ? 1 : sab.done[1] ? 0 : (ai.sabIdx === undefined ? (ai.sabIdx = Math.random() < 0.5 ? 0 : 1) : ai.sabIdx); }
  const st = stations[idx];
  // Solo algunos bots van (para no quedarse todos), salvo reactor/o2
  if (sab.kind === 'lights' && ai.lightsSkip === undefined) ai.lightsSkip = Math.random() < 0.4;
  if (sab.kind === 'lights' && ai.lightsSkip) return false;
  if (Math.hypot(p.x - st.x, p.y - st.y) > 60) {
    if (!ai.path.length || !ai.sabGoal || ai.sabGoal !== st) { ai.sabGoal = st; ai.doing = null; p.scanning = false; goTo(room, p, st.x, st.y); }
    walk(room, p, dt);
    return true;
  }
  p.m = 0;
  if (now < (ai.fixAt || 0)) return true;
  ai.fixAt = now + rnd(700, 1400);
  if (sab.kind === 'lights') {
    const i = sab.switches.findIndex(x => !x);
    if (i >= 0) room.onFix(p, { kind: 'lights', idx: i });
  } else if (sab.kind === 'reactor') {
    if (sab.holds[idx] !== p.id) room.onFix(p, { kind: 'reactor', idx, val: true });
  } else if (sab.kind === 'o2') {
    room.onFix(p, { kind: 'o2', idx, val: sab.code });
  }
  if (!room.sab) { ai.sabIdx = undefined; ai.lightsSkip = undefined; ai.sabGoal = null; }
  return true;
}

// ---------------------------------------------------------------- reuniones
function onMeeting(room) {
  const now = Date.now();
  const m = room.meeting;
  for (const p of room.players.values()) {
    if (!p.bot || p.left) continue;
    if (!p.ai) initAI(p);
    p.ai.path = []; p.ai.doing = null; p.ai.chase = null; p.ai.reportAt = 0;
    p.ai.chatAt = p.alive ? now + rnd(3800, 9000) : 0;
    p.ai.voteAt = m.discussEnd + rnd(1500, Math.min(12000, Math.max(2000, m.voteEnd - m.discussEnd - 3000)));
    p.ai.saidMore = false;
  }
}

function suspectOf(room, p) {
  let best = null, bs = 0;
  for (const id in p.ai.suspicion) {
    const q = room.players.get(id);
    if (!q || !q.alive || q === p || q.left) continue;
    if (p.role === 'impostor' && q.role === 'impostor') continue;
    if (p.ai.suspicion[id] > bs) { bs = p.ai.suspicion[id]; best = q; }
  }
  return bs >= 30 ? best : null;
}

function meetingAI(room, p, now) {
  const ai = p.ai;
  const m = room.meeting;
  if (!m || !p.alive) return;
  p.m = 0;
  if (ai.chatAt && now >= ai.chatAt) {
    ai.chatAt = 0;
    const sus = suspectOf(room, p);
    let line;
    if (m.caller === p.id && ai.reported) line = `Encontré el cuerpo de ${colorName(ai.reported.color)} en ${ai.reported.room}.`;
    else if (m.caller === p.id && m.kind === 'emergency') line = sus ? `Convoqué la reunión: ${sus.name} es muy sospechoso.` : 'Convoqué la reunión, algo raro está pasando.';
    else if (sus && Math.random() < 0.85) line = pick([`Fue ${sus.name}, lo vi.`, `${sus.name} estaba muy cerca, sospechoso.`, `Voto por ${sus.name}.`]);
    else line = pick([`Yo estaba en ${ai.lastRoom || 'la cafetería'} haciendo tareas.`, '¿Dónde?', 'No vi nada :(', `Estaba en ${ai.lastRoom || 'un pasillo'}.`, '¿Quién fue?', 'Yo soy inocente.', 'Skip por ahora.']);
    ai.reported = null;
    botChat(room, p, line);
  }
  if (now >= ai.voteAt && m.votes[p.id] === undefined && m.stage === 'vote') {
    let target = 'skip';
    const sus = suspectOf(room, p);
    const alive = room.active().filter(q => q.alive && q !== p);
    if (sus) target = sus.id;
    else if (p.role === 'impostor') {
      const crew = alive.filter(q => q.role !== 'impostor');
      if (Math.random() < 0.35 && crew.length) target = pick(crew).id;
    } else if (Math.random() < 0.2 && alive.length) target = pick(alive).id;
    room.onVote(p, target);
  }
}

function onChat(room, from, text) {
  const low = text.toLowerCase();
  for (const q of room.active()) {
    if (q === from || !q.alive) continue;
    const cn = colorName(q.color).toLowerCase();
    if (low.indexOf(q.name.toLowerCase()) >= 0 || low.indexOf(cn) >= 0) {
      for (const b of room.players.values()) {
        if (!b.bot || !b.ai || b === q) continue;
        b.ai.suspicion[q.id] = (b.ai.suspicion[q.id] || 0) + 18;
      }
    }
  }
}

function onKill(room, killer, victim) {
  for (const b of room.players.values()) {
    if (!b.bot || !b.alive || b === killer || b === victim || b.left) continue;
    if (!b.ai) initAI(b);
    if (sees(room, b, victim, visionOf(room, b)) && sees(room, b, killer, visionOf(room, b))) {
      b.ai.suspicion[killer.id] = (b.ai.suspicion[killer.id] || 0) + 120;
    }
  }
}

function afterMeeting(room) {
  for (const p of room.players.values()) {
    if (!p.bot || !p.ai) continue;
    p.ai.path = []; p.ai.doing = null; p.ai.wait = 0; p.ai.chase = null; p.ai.pings = null;
  }
}

module.exports = { tick, onMeeting, onChat, onKill, afterMeeting, findPath };
