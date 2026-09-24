'use strict';
// Modo developer: herramientas de prueba. Solo funcionan en salas donde el
// developer es el único humano (el resto son bots), para no afectar a nadie.
const S = require('../public/js/shared.js');

const ROLES = {
  classic: ['crew', 'impostor', 'sheriff', 'engineer'],
  hideseek: ['hider', 'seeker'],
  race: [],
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function nearestFree(map, x, y, doors) {
  if (S.canStand(map, x, y, doors)) return { x, y };
  for (let r = 20; r < 400; r += 20) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (S.canStand(map, nx, ny, doors)) return { x: nx, y: ny };
    }
  }
  return null;
}

// Aplica el rol elegido por el developer al empezar la partida
function applyStartRole(room, all, impostors, nImp) {
  const dev = all.find(p => p.devRole && room.devAllowed(p));
  if (!dev) return;
  const wantImp = dev.devRole === 'impostor' || dev.devRole === 'seeker';
  if (wantImp && !impostors.has(dev.id) && nImp > 0) {
    const other = [...impostors][0];
    impostors.delete(other);
    impostors.add(dev.id);
  } else if (!wantImp && impostors.has(dev.id)) {
    const other = shuffle(all.filter(q => q !== dev && !impostors.has(q.id)))[0];
    if (other) { impostors.delete(dev.id); impostors.add(other.id); }
  }
}

function applyStartSub(room, all) {
  const dev = all.find(p => p.devRole && room.devAllowed(p));
  if (!dev || room.settings.mode !== 'classic') return;
  const want = dev.devRole === 'sheriff' || dev.devRole === 'engineer' ? dev.devRole : null;
  if (want) {
    const had = all.find(q => q !== dev && q.sub === want);
    if (had) had.sub = null;
    dev.sub = want;
    if (want === 'sheriff') dev.killReadyAt = room.introEnd + room.settings.killCooldown * 1000;
  } else if (dev.devRole === 'crew') dev.sub = null;
}

function setRoleNow(room, p, role) {
  const now = Date.now();
  const mode = room.settings.mode;
  if (mode === 'classic') {
    const wasImp = p.role === 'impostor';
    p.role = role === 'impostor' ? 'impostor' : 'crew';
    p.sub = role === 'sheriff' || role === 'engineer' ? role : null;
    // Siempre debe quedar al menos un impostor vivo para que la partida siga
    if (wasImp && p.role !== 'impostor' && !room.active().some(q => q !== p && q.alive && q.role === 'impostor')) {
      const c = shuffle(room.active().filter(q => q.bot && q.alive && q.role === 'crew'))[0];
      if (c) { c.role = 'impostor'; c.sub = null; c.fake = true; c.killReadyAt = now + 10000; c.ai = null; }
    }
  } else if (mode === 'hideseek') {
    if (role === 'seeker' && p.role !== 'seeker') {
      const old = room.active().find(q => q.role === 'seeker');
      if (old) { old.role = 'hider'; old.fake = false; old.ai = null; }
      p.role = 'seeker';
    } else if (role === 'hider' && p.role === 'seeker') {
      const c = shuffle(room.active().filter(q => q !== p && q.bot && q.role === 'hider' && q.alive))[0];
      if (c) { c.role = 'seeker'; c.fake = true; c.killReadyAt = now + 5000; c.ai = null; }
      p.role = 'hider';
    }
  } else return;
  p.fake = p.role === 'impostor' || p.role === 'seeker';
  p.killReadyAt = now;
  p.inVent = null;
  room.sendStart(p, false);
  room.sendProgress();
}

function killPlayer(room, target) {
  if (!target || !target.alive || target.left) return;
  const now = Date.now();
  target.alive = false;
  target.inVent = null;
  target.scanning = false;
  room.bodies.push({ id: target.id, color: target.color, x: target.x, y: target.y, at: now });
  room.sendTo(target, { t: 'killed', by: { color: 'white', hat: 'halo', name: 'Developer' }, mode: room.settings.mode });
  room.broadcast({ t: 'killfx', x: target.x, y: target.y, victim: target.id });
}

function devState(room, p) {
  return {
    t: 'devState', solo: room.devAllowed(p), role: p.devRole || null,
    noclip: !!p.devNoclip, speed: p.devSpeed || 1, nocd: !!p.devNoCd, frozen: !!room.botsFrozen, impostors: room.devImpostors || null,
  };
}

function handle(room, p, msg) {
  if (!p.dev) return;
  if (msg.cmd === 'state') return room.sendTo(p, devState(room, p));
  if (!room.devAllowed(p)) {
    room.sendTo(p, { t: 'toast', text: '🛠️ Los poderes de developer solo funcionan en salas sin otros jugadores (solo bots).' });
    return room.sendTo(p, devState(room, p));
  }
  const now = Date.now();
  const inGame = room.phase !== 'lobby';
  const playing = room.phase === 'play';
  const mode = room.settings.mode;
  const toast = text => room.sendTo(p, { t: 'toast', text });

  switch (msg.cmd) {
    case 'role': {
      const role = msg.role;
      if (role === 'random') { p.devRole = null; toast('🎲 Rol aleatorio en la próxima partida'); break; }
      if (!inGame) {
        if (ROLES.classic.indexOf(role) < 0 && ROLES.hideseek.indexOf(role) < 0) return;
        p.devRole = role;
        toast('✅ Tendrás ese rol en la próxima partida');
      } else {
        if (!(ROLES[mode] || []).includes(role)) return toast('Ese rol no existe en este modo');
        p.devRole = role;
        setRoleNow(room, p, role);
      }
      break;
    }
    case 'tp': {
      if (!inGame && room.phase !== 'lobby') return;
      const map = room.map;
      let x = Math.max(20, Math.min(map.w - 20, Number(msg.x) || 0));
      let y = Math.max(20, Math.min(map.h - 20, Number(msg.y) || 0));
      if (p.alive && !p.devNoclip) {
        const f = nearestFree(map, x, y, room.closedDoors);
        if (!f) return toast('No hay suelo cerca de ese punto');
        x = f.x; y = f.y;
      }
      p.x = x; p.y = y; p.inVent = null; p.lastMoveAt = now;
      room.sendTo(p, { t: 'pos', x, y });
      break;
    }
    case 'noclip': p.devNoclip = !!msg.on; break;
    case 'speed': p.devSpeed = Math.max(1, Math.min(4, Number(msg.v) || 1)); break;
    case 'nocd':
      p.devNoCd = !!msg.on;
      if (p.devNoCd) { p.killReadyAt = 0; p.ventReadyAt = 0; room.sendTo(p, { t: 'cd', killIn: 0 }); }
      break;
    case 'freeze': room.botsFrozen = !!msg.on; break;
    case 'start':
      if (inGame) return;
      room.cancelCountdown();
      room.startGame(p);
      break;
    case 'bots': {
      // modo locura: hasta 100 bots, sin importar el máximo de la sala
      if (inGame) return;
      const MAX_BOTS = 100;
      const have = room.active().filter(q => q.bot).length;
      const n = Math.max(0, Math.min(MAX_BOTS - have, Number(msg.n) || 1));
      for (let i = 0; i < n; i++) room.addBot();
      room.broadcastRoom();
      if (n === 0) toast('🤖 Ya tienes el máximo: 100 bots');
      else if (have + n >= 50) toast(`🤪 MODO LOCURA: ${have + n} bots`);
      break;
    }
    case 'clearbots': {
      if (inGame) return;
      for (const q of [...room.players.values()]) if (q.bot) room.players.delete(q.id);
      room.broadcastRoom();
      break;
    }
    case 'impostors':
      room.devImpostors = Math.max(1, Math.min(20, Number(msg.n) || 1));
      toast(`🔪 ${room.devImpostors} impostor(es) en la próxima partida (si hay jugadores suficientes)`);
      break;
    case 'mode':
      if (inGame || !S.MODES[msg.mode]) return;
      room.handleLobby(p, { t: 'settings', settings: Object.assign({}, room.settings, { mode: msg.mode }) });
      break;
    case 'tasks': {
      if (!playing) return;
      const targets = msg.all ? room.active().filter(q => !q.fake) : [p];
      for (const q of targets) {
        for (const t of q.tasks) {
          if (t.done) continue;
          t.done = true; t.step = t.steps.length;
          if (q === p) room.sendTo(p, { t: 'taskok', id: t.id, step: t.step, done: true });
        }
      }
      room.sendProgress();
      if (mode === 'race') return room.endGame('racer', `¡${p.name} completó todas sus tareas primero!`, [p.id]);
      if (mode === 'hideseek' && msg.all) return room.endGame('hiders', 'Tareas completadas desde el modo developer');
      break;
    }
    case 'sab':
      if (!playing) return;
      if (msg.kind === 'doors') room.closeDoorsOf(msg.room);
      else { if (room.sab) room.clearSab(); room.startSab(msg.kind); }
      break;
    case 'fixsab':
      if (room.sab) room.clearSab();
      if (room.closedDoors.length) { room.closedDoors = []; room.doorTimers = {}; room.broadcast({ t: 'doors', closed: [] }); }
      break;
    case 'meeting':
      if (!playing) return;
      room.startMeeting('emergency', p, null);
      break;
    case 'endvote':
      if (room.phase === 'meeting' && room.meeting && room.meeting.stage !== 'results') room.tally();
      break;
    case 'kill':
      if (!playing) return;
      killPlayer(room, room.players.get(msg.id));
      break;
    case 'revive': {
      if (!inGame) return;
      for (const q of room.active()) { q.alive = true; q.ejected = false; }
      room.bodies = [];
      room.sendStart(p, false);
      toast('✨ Todos revividos');
      break;
    }
    case 'win': {
      if (!inGame) return;
      const reason = 'Victoria forzada desde el modo developer';
      if (mode === 'classic') room.endGame(msg.team === 'impostor' ? 'impostor' : 'crew', reason);
      else if (mode === 'hideseek') room.endGame(msg.team === 'impostor' ? 'seeker' : 'hiders', reason);
      else room.endGame('racer', reason, [p.id]);
      break;
    }
    case 'reveal': {
      const roles = {};
      for (const q of room.active()) roles[q.id] = { role: q.role, sub: q.sub || null };
      room.sendTo(p, { t: 'devRoles', roles });
      break;
    }
  }
  room.sendTo(p, devState(room, p));
}

module.exports = { handle, applyStartRole, applyStartSub };
