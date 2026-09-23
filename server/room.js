'use strict';
// Lógica autoritativa de salas y partidas
const S = require('../public/js/shared.js');
const auth = require('./auth.js');
const bots = require('./bots.js');

const VGRID = { ship: S.buildVisionGrid(S.SHIP), lobby: S.buildVisionGrid(S.LOBBY) };
const WGRID = { ship: S.buildWalkGrid(S.SHIP), lobby: S.buildWalkGrid(S.LOBBY) };

const BOT_NAMES = ['Pepe', 'Lupita', 'Chucho', 'Bea', 'Toño', 'Maru', 'Kike', 'Sofi', 'Nacho', 'Rafa', 'Luz', 'Memo', 'Paco', 'Nena'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const rooms = new Map();

function makeCode() {
  let c;
  do {
    c = '';
    for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (rooms.has(c));
  return c;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function send(p, msg) {
  if (!p || p.bot || !p.ws || p.ws.readyState !== 1) return;
  try { p.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) { /* ignorar */ }
}

class Room {
  constructor(host, opts) {
    this.code = makeCode();
    this.players = new Map();
    this.hostId = host.id;
    this.isPublic = !!(opts && opts.isPublic);
    this.settings = S.sanitizeSettings({ mode: (opts && opts.mode) || 'classic' }, S.defaultSettings());
    if (this.settings.mode === 'hideseek') { this.settings.crewVision = 0.75; this.settings.impVision = 1.25; this.settings.shortTasks = 3; }
    this.phase = 'lobby';
    this.mapId = 'lobby';
    this.bodies = [];
    this.meeting = null;
    this.sab = null;
    this.closedDoors = [];
    this.doorTimers = {};
    this.doorReady = {};
    this.lastBroadcast = 0;
    this.botCounter = 0;
    this.created = Date.now();
    rooms.set(this.code, this);
  }

  get map() { return S.MAPS[this.mapId]; }
  get vgrid() { return VGRID[this.mapId]; }
  get wgrid() { return WGRID[this.mapId]; }

  humans() { return [...this.players.values()].filter(p => !p.bot && !p.left); }
  active() { return [...this.players.values()].filter(p => !p.left); }

  // ---------------------------------------------------------------- miembros
  addPlayer(user, ws) {
    const existing = this.players.get(user.id);
    if (existing) {
      if (existing.ws && existing.ws !== ws) {
        send(existing, { t: 'kicked', reason: 'Has abierto el juego en otra pestaña.' });
        try { existing.ws.close(); } catch (e) { /* */ }
      }
      existing.ws = ws;
      existing.connected = true;
      existing.left = false;
      this.sendJoined(existing);
      if (this.phase !== 'lobby') this.sendStart(existing, false);
      this.broadcastRoom();
      return existing;
    }
    if (this.phase !== 'lobby') return { error: 'La partida ya empezó. Espera a que termine.' };
    if (this.active().length >= this.settings.maxPlayers) return { error: 'La sala está llena.' };
    const p = this.newMember({
      id: user.id, userId: user.id, name: user.username, bot: false,
      color: this.freeColor(user.color), hat: user.hat || 'none', ws,
    });
    this.sendJoined(p);
    this.broadcastRoom();
    this.systemChat(`${p.name} se unió a la sala.`);
    return p;
  }

  newMember(o) {
    const sp = S.spawnPoints(S.LOBBY, 12)[this.players.size % 12];
    const p = Object.assign({
      connected: true, left: false, x: sp.x, y: sp.y, f: 0, m: 0, lastMoveAt: Date.now(),
      alive: true, role: null, tasks: [], inVent: null, killReadyAt: 0, emergencies: 0,
      voted: null, scanning: false, lastChat: 0, finishedAt: 0, ai: null,
    }, o);
    this.players.set(p.id, p);
    return p;
  }

  freeColor(pref) {
    const used = new Set(this.active().map(p => p.color));
    if (pref && !used.has(pref)) return pref;
    const free = S.COLORS.filter(c => !used.has(c.id));
    return (free.length ? free[Math.floor(Math.random() * free.length)] : S.COLORS[0]).id;
  }

  removePlayer(id, reason) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'lobby') {
      this.players.delete(id);
      if (!p.bot) this.systemChat(`${p.name} salió de la sala.`);
    } else {
      p.left = true;
      p.connected = false;
      if (p.alive) {
        p.alive = false;
        p.inVent = null;
        for (const t of p.tasks) { t.done = true; t.step = t.steps.length; }
        this.systemChat(`${p.name} se desconectó.`);
        this.sendProgress();
      }
      if (this.meeting) this.maybeEndVoting();
      this.checkWin();
    }
    if (p.ws && reason) send(p, { t: 'kicked', reason });
    p.ws = null;
    if (this.hostId === id) {
      const next = this.humans().find(h => h.connected);
      if (next) { this.hostId = next.id; this.systemChat(`${next.name} ahora es el anfitrión.`); }
    }
    if (!this.humans().length) this.destroy();
    else this.broadcastRoom();
  }

  destroy() {
    rooms.delete(this.code);
    this.destroyed = true;
  }

  // ---------------------------------------------------------------- envíos
  publicPlayers() {
    return this.active().map(p => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, bot: p.bot, host: p.id === this.hostId, connected: p.connected }));
  }

  roomInfo() {
    return { code: this.code, hostId: this.hostId, settings: this.settings, players: this.publicPlayers(), phase: this.phase, isPublic: this.isPublic };
  }

  sendJoined(p) { send(p, Object.assign({ t: 'joined', you: p.id }, this.roomInfo())); }

  broadcast(msg, filter) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (!p.bot && !p.left && (!filter || filter(p))) send(p, s);
  }

  broadcastRoom() { this.broadcast(Object.assign({ t: 'room' }, this.roomInfo())); }

  systemChat(text) { this.broadcast({ t: 'chat', sys: true, text }); }

  // ---------------------------------------------------------------- lobby
  handleLobby(p, msg) {
    const isHost = p.id === this.hostId;
    switch (msg.t) {
      case 'settings':
        if (!isHost || this.phase !== 'lobby') return;
        this.settings = S.sanitizeSettings(msg.settings, this.settings);
        if (typeof msg.isPublic === 'boolean') this.isPublic = msg.isPublic;
        this.broadcastRoom();
        return;
      case 'addBot': {
        if (!isHost || this.phase !== 'lobby') return;
        if (this.active().length >= this.settings.maxPlayers) return send(p, { t: 'toast', text: 'La sala está llena.' });
        const used = new Set(this.active().map(q => q.name));
        const name = BOT_NAMES.find(n => !used.has(n)) || ('Bot' + (++this.botCounter));
        const hats = S.HATS.map(h => h.id);
        this.newMember({ id: 'bot_' + Date.now().toString(36) + (++this.botCounter), name, bot: true, color: this.freeColor(), hat: hats[Math.floor(Math.random() * hats.length)] });
        this.broadcastRoom();
        return;
      }
      case 'removeBot': {
        if (!isHost || this.phase !== 'lobby') return;
        const b = [...this.players.values()].reverse().find(q => q.bot);
        if (b) { this.players.delete(b.id); this.broadcastRoom(); }
        return;
      }
      case 'kick': {
        if (!isHost || msg.id === p.id) return;
        const target = this.players.get(msg.id);
        if (!target) return;
        if (target.bot) { if (this.phase === 'lobby') this.players.delete(target.id); this.broadcastRoom(); return; }
        this.removePlayer(target.id, 'El anfitrión te expulsó de la sala.');
        return;
      }
      case 'look': {
        if (this.phase !== 'lobby') return;
        const used = new Set(this.active().filter(q => q !== p).map(q => q.color));
        if (msg.color && S.COLORS.some(c => c.id === msg.color)) {
          if (used.has(msg.color)) send(p, { t: 'toast', text: 'Ese color ya lo tiene otro jugador.' });
          else p.color = msg.color;
        }
        if (msg.hat && S.HATS.some(h => h.id === msg.hat)) p.hat = msg.hat;
        this.broadcastRoom();
        return;
      }
      case 'start':
        if (!isHost || this.phase !== 'lobby') return;
        this.startGame(p);
    }
  }

  // ---------------------------------------------------------------- inicio
  startGame(host) {
    const s = this.settings;
    const all = this.active();
    const mode = S.MODES[s.mode];
    if (all.length < mode.min) {
      return send(host, { t: 'toast', text: `El modo ${mode.name} necesita al menos ${mode.min} jugadores. ¡Agrega bots!` });
    }
    let nImp = 0;
    if (s.mode === 'classic') {
      nImp = Math.min(s.impostors, Math.max(1, Math.floor((all.length - 1) / 2)));
    } else if (s.mode === 'hideseek') nImp = 1;

    const now = Date.now();
    this.phase = 'intro';
    this.mapId = 'ship';
    this.bodies = [];
    this.meeting = null;
    this.sab = null;
    this.closedDoors = [];
    this.doorTimers = {};
    this.doorReady = {};
    this.sabReadyAt = now + 15000;
    this.introEnd = now + 6000;
    this.winner = null;
    this.startedAt = now;
    this.lastProgressSent = null;

    const order = shuffle(all.slice());
    const impostors = new Set(order.slice(0, nImp).map(p => p.id));
    const spawns = S.spawnPoints(S.SHIP, all.length);
    const common = shuffle(Object.keys(S.TASKS).filter(k => S.TASKS[k].kind === 'common')).slice(0, s.commonTasks);
    const raceTasks = s.mode === 'race' ? this.pickTasks(common) : null;

    all.forEach((p, i) => {
      p.x = spawns[i].x; p.y = spawns[i].y; p.f = 0; p.m = 0; p.lastMoveAt = now;
      p.alive = true; p.inVent = null; p.voted = null; p.scanning = false; p.finishedAt = 0;
      p.emergencies = s.emergencyMeetings;
      p.ai = null;
      if (s.mode === 'classic') p.role = impostors.has(p.id) ? 'impostor' : 'crew';
      else if (s.mode === 'hideseek') p.role = impostors.has(p.id) ? 'seeker' : 'hider';
      else p.role = 'racer';
      if (s.mode === 'race') p.tasks = raceTasks.map(t => this.instTask(t));
      else p.tasks = this.pickTasks(common).map(t => this.instTask(t));
      p.fake = p.role === 'impostor' || p.role === 'seeker';
      p.killReadyAt = this.introEnd + (s.mode === 'hideseek' ? 10000 : 10000);
    });
    this.emergencyReadyAt = this.introEnd + s.emergencyCooldown * 1000;
    if (s.mode === 'hideseek') {
      this.seekerReleaseAt = this.introEnd + 10000;
      this.hsEndAt = this.introEnd + s.hideTime * 1000;
      this.finalHide = false;
      this.nextPing = 0;
    }
    for (const p of all) this.sendStart(p, true);
    this.sendProgress(true);
  }

  pickTasks(common) {
    const s = this.settings;
    const byKind = k => shuffle(Object.keys(S.TASKS).filter(x => S.TASKS[x].kind === k));
    let list = common.slice();
    list = list.concat(byKind('long').slice(0, s.longTasks));
    list = list.concat(byKind('short').filter(k => s.visualTasks || !S.TASKS[k].visual).slice(0, s.shortTasks));
    if (!list.length) list = byKind('short').slice(0, 1);
    return list;
  }

  instTask(key) {
    const def = S.TASKS[key];
    return {
      id: key, name: def.name, kind: def.kind, step: 0, done: false,
      steps: def.steps.map(st => {
        const o = st.options ? st.options[Math.floor(Math.random() * st.options.length)] : st;
        return { room: o.room, x: o.x, y: o.y, game: o.game, fill: !!o.fill };
      }),
    };
  }

  sendStart(p, intro) {
    const now = Date.now();
    const s = this.settings;
    let mates = [];
    if (p.role === 'impostor') mates = this.active().filter(q => q.role === 'impostor').map(q => q.id);
    const seeker = s.mode === 'hideseek' ? (this.active().find(q => q.role === 'seeker') || {}).id : null;
    send(p, {
      t: 'start', intro, mode: s.mode, settings: s, you: p.id, role: p.role, mates, seeker,
      alive: p.alive, tasks: p.tasks, fake: !!p.fake,
      players: this.publicPlayers().map(q => Object.assign(q, { alive: this.players.get(q.id).alive })),
      phase: this.phase,
      introIn: Math.max(0, this.introEnd - now),
      killIn: Math.max(0, p.killReadyAt - now),
      emergencies: p.emergencies,
      hsEndIn: this.hsEndAt ? this.hsEndAt - now : 0,
      seekerIn: this.seekerReleaseAt ? Math.max(0, this.seekerReleaseAt - now) : 0,
      finalHide: !!this.finalHide,
      x: p.x, y: p.y,
    });
    if (!intro) {
      this.sendSab(p);
      send(p, { t: 'doors', closed: this.closedDoors });
      if (this.meeting) send(p, this.meetingMsg());
      this.sendProgress(false, p);
    }
  }

  // ---------------------------------------------------------------- mensajes de juego
  handle(p, msg) {
    if (!p || p.left) return;
    if (msg.t === 'chat') return this.onChat(p, msg);
    if (msg.t === 'move') return this.onMove(p, msg);
    if (this.phase === 'lobby') return this.handleLobby(p, msg);
    switch (msg.t) {
      case 'kill': return this.onKill(p, this.players.get(msg.id));
      case 'report': return this.onReport(p, msg.id);
      case 'emergency': return this.onEmergency(p);
      case 'task': return this.onTask(p, msg.id, msg.step);
      case 'scan': p.scanning = !!msg.on && p.alive; return;
      case 'vent': return this.onVent(p, msg);
      case 'sabotage': return this.onSabotage(p, msg);
      case 'fix': return this.onFix(p, msg);
      case 'vote': return this.onVote(p, msg.id);
    }
  }

  speedOf(p) {
    const s = this.settings;
    let v = S.BASE_SPEED * s.playerSpeed;
    if (p.role === 'seeker') v *= s.seekerSpeed * (this.finalHide ? 1.1 : 1);
    if (!p.alive && this.phase !== 'lobby') v *= 1.25;
    return v;
  }

  onMove(p, msg) {
    const now = Date.now();
    const x = Number(msg.x), y = Number(msg.y);
    if (!isFinite(x) || !isFinite(y)) return;
    p.f = msg.f ? 1 : 0;
    p.m = msg.m ? 1 : 0;
    const frozen = this.phase === 'intro' || this.phase === 'meeting' || this.phase === 'eject' || p.inVent ||
      (p.role === 'seeker' && now < this.seekerReleaseAt && this.phase === 'play');
    if (frozen) { p.m = 0; if (Math.hypot(x - p.x, y - p.y) > 2) send(p, { t: 'pos', x: p.x, y: p.y }); return; }
    const dt = Math.min(1, (now - p.lastMoveAt) / 1000);
    const maxD = this.speedOf(p) * dt * 1.6 + 40;
    const d = Math.hypot(x - p.x, y - p.y);
    const ghost = !p.alive && this.phase !== 'lobby';
    let ok = d <= maxD;
    if (ok && !ghost && !S.canStand(this.map, x, y, this.closedDoors)) ok = false;
    if (ghost && (x < 0 || y < 0 || x > this.map.w || y > this.map.h)) ok = false;
    p.lastMoveAt = now;
    if (ok) { p.x = x; p.y = y; }
    else send(p, { t: 'pos', x: p.x, y: p.y });
  }

  onChat(p, msg) {
    const now = Date.now();
    if (now - p.lastChat < 600) return;
    let text = String(msg.text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!text) return;
    p.lastChat = now;
    const inGame = this.phase !== 'lobby';
    if (inGame && this.phase !== 'meeting' && p.alive) return; // los vivos solo hablan en reuniones
    const ghost = inGame && !p.alive;
    const m = { t: 'chat', id: p.id, name: p.name, color: p.color, hat: p.hat, text, ghost };
    this.broadcast(m, q => !ghost || !q.alive);
    if (!ghost && this.phase === 'meeting') bots.onChat(this, p, text);
  }

  onKill(p, target) {
    const s = this.settings;
    const now = Date.now();
    if (this.phase !== 'play' || !p.alive || p.inVent || !target || !target.alive || target.left) return;
    if (p.role === 'impostor') { if (target.role === 'impostor') return; }
    else if (p.role === 'seeker') { if (now < this.seekerReleaseAt) return; }
    else return;
    if (now < p.killReadyAt - 300) return;
    const range = S.KILL_DISTANCES[s.killDistance] + 40;
    if (Math.hypot(p.x - target.x, p.y - target.y) > range) return;

    target.alive = false;
    target.scanning = false;
    target.inVent = null;
    this.bodies.push({ id: target.id, color: target.color, x: target.x, y: target.y, at: now });
    p.x = target.x; p.y = target.y;
    const cd = (s.mode === 'hideseek' ? s.seekerCooldown : s.killCooldown) * 1000;
    p.killReadyAt = now + cd;
    send(p, { t: 'pos', x: p.x, y: p.y });
    send(p, { t: 'cd', killIn: cd });
    send(target, { t: 'killed', by: { color: p.color, hat: p.hat, name: p.name }, mode: s.mode });
    this.broadcast({ t: 'killfx', x: target.x, y: target.y, victim: target.id });
    if (!p.bot) auth.addStats(p.userId, { kills: 1 });
    bots.onKill(this, p, target);
    this.checkWin();
  }

  onReport(p, bodyId) {
    if (this.phase !== 'play' || !p.alive || this.settings.mode !== 'classic' || p.inVent) return;
    const b = this.bodies.find(x => x.id === bodyId);
    if (!b || Math.hypot(p.x - b.x, p.y - b.y) > S.REPORT_RANGE + 40) return;
    this.startMeeting('report', p, b);
  }

  onEmergency(p) {
    const now = Date.now();
    if (this.phase !== 'play' || !p.alive || this.settings.mode !== 'classic' || p.inVent) return;
    if (p.emergencies <= 0) return send(p, { t: 'toast', text: 'Ya no te quedan reuniones de emergencia.' });
    if (now < this.emergencyReadyAt) return send(p, { t: 'toast', text: `Espera ${Math.ceil((this.emergencyReadyAt - now) / 1000)} s para usar el botón.` });
    if (this.sab && (this.sab.kind === 'reactor' || this.sab.kind === 'o2')) return send(p, { t: 'toast', text: '¡No puedes convocar una reunión durante una emergencia crítica!' });
    const btn = S.SHIP.button;
    if (Math.hypot(p.x - btn.x, p.y - btn.y) > S.BUTTON_RANGE + 50) return;
    p.emergencies--;
    this.startMeeting('emergency', p, null);
  }

  onTask(p, id, step) {
    if (this.phase !== 'play' || p.fake) return;
    const t = p.tasks.find(x => x.id === id);
    if (!t || t.done || t.step !== step) return;
    const st = t.steps[t.step];
    if (Math.hypot(p.x - st.x, p.y - st.y) > S.INTERACT_RANGE + 60) return;
    t.step++;
    if (t.step >= t.steps.length) {
      t.done = true;
      if (!p.bot) auth.addStats(p.userId, { tasks: 1 });
      if (this.settings.mode === 'hideseek') {
        this.hsEndAt = Math.max(Date.now() + 1000, this.hsEndAt - this.settings.taskTimeBonus * 1000);
        this.broadcast({ t: 'hstime', endIn: this.hsEndAt - Date.now() });
      }
      if (this.settings.mode === 'race' && p.tasks.every(x => x.done)) {
        p.finishedAt = Date.now();
        return this.endGame('racer', `¡${p.name} completó todas sus tareas primero!`, [p.id]);
      }
    }
    send(p, { t: 'taskok', id, step: t.step, done: t.done });
    this.sendProgress();
    this.checkWin();
  }

  onVent(p, msg) {
    if (this.phase !== 'play' || !p.alive || p.role !== 'impostor') return;
    const vents = S.SHIP.vents;
    if (msg.a === 'enter' && !p.inVent) {
      const v = vents.find(v => Math.hypot(p.x - v.x, p.y - v.y) <= S.VENT_RANGE + 40);
      if (!v) return;
      p.inVent = v.id; p.x = v.x; p.y = v.y; p.scanning = false;
      send(p, { t: 'vent', id: v.id });
      this.broadcast({ t: 'ventfx', id: v.id }, q => q !== p);
    } else if (msg.a === 'move' && p.inVent) {
      const cur = vents.find(v => v.id === p.inVent);
      if (!cur || cur.links.indexOf(msg.to) < 0) return;
      const v = vents.find(v => v.id === msg.to);
      p.inVent = v.id; p.x = v.x; p.y = v.y;
      send(p, { t: 'vent', id: v.id });
    } else if (msg.a === 'exit' && p.inVent) {
      const v = vents.find(v => v.id === p.inVent);
      p.inVent = null;
      send(p, { t: 'vent', id: null });
      this.broadcast({ t: 'ventfx', id: v.id }, q => q !== p);
    }
  }

  // ---------------------------------------------------------------- sabotajes
  onSabotage(p, msg) {
    const now = Date.now();
    if (this.phase !== 'play' || p.role !== 'impostor' || this.settings.mode !== 'classic') return;
    if (msg.kind === 'doors') {
      const room = msg.room;
      const doors = S.SHIP.doors.filter(d => d.room === room);
      if (!doors.length || (this.doorReady[room] || 0) > now) return;
      if (this.sab && this.sab.kind !== 'lights') return;
      this.doorReady[room] = now + S.DOOR_COOLDOWN * 1000;
      for (const d of doors) if (this.closedDoors.indexOf(d.id) < 0) this.closedDoors.push(d.id);
      this.pushOutOfDoors(doors);
      this.doorTimers[room] = now + S.DOOR_TIME * 1000;
      this.broadcast({ t: 'doors', closed: this.closedDoors, slam: room });
      send(p, { t: 'doorcd', room, in: S.DOOR_COOLDOWN * 1000 });
      return;
    }
    if (this.sab || now < this.sabReadyAt) return;
    if (msg.kind === 'lights') {
      const sw = [true, true, true, true, true];
      const off = shuffle([0, 1, 2, 3, 4]).slice(0, 2 + Math.floor(Math.random() * 3));
      for (const i of off) sw[i] = false;
      this.sab = { kind: 'lights', switches: sw };
    } else if (msg.kind === 'reactor') {
      this.sab = { kind: 'reactor', endsAt: now + S.SABOTAGE_TIMES.reactor * 1000, holds: [null, null] };
    } else if (msg.kind === 'o2') {
      let code = '';
      for (let i = 0; i < 5; i++) code += Math.floor(Math.random() * 10);
      this.sab = { kind: 'o2', endsAt: now + S.SABOTAGE_TIMES.o2 * 1000, done: [false, false], code };
    } else return;
    this.sendSab();
  }

  pushOutOfDoors(doors) {
    for (const p of this.players.values()) {
      if (!p.alive || p.left) continue;
      for (const d of doors) {
        if (!S.inRect({ x: d.r.x - 20, y: d.r.y - 12, w: d.r.w + 40, h: d.r.h + 24 }, p.x, p.y)) continue;
        const cands = d.dir === 'v'
          ? [[d.r.x - 30, p.y], [d.r.x + d.r.w + 30, p.y]]
          : [[p.x, d.r.y - 24], [p.x, d.r.y + d.r.h + 24]];
        const ok = cands.find(c => S.canStand(S.SHIP, c[0], c[1], this.closedDoors));
        if (ok) { p.x = ok[0]; p.y = ok[1]; send(p, { t: 'pos', x: p.x, y: p.y }); }
      }
    }
  }

  sabMsg() {
    const s = this.sab;
    const now = Date.now();
    if (!s) return { t: 'sab', kind: null };
    return {
      t: 'sab', kind: s.kind, endsIn: s.endsAt ? s.endsAt - now : 0,
      switches: s.switches, holds: s.holds ? s.holds.map(h => !!h) : null, done: s.done, code: s.code,
    };
  }

  sendSab(p) { if (p) send(p, this.sabMsg()); else this.broadcast(this.sabMsg()); }

  onFix(p, msg) {
    const s = this.sab;
    if (!s || this.phase !== 'play' || s.kind !== msg.kind) return;
    if (!p.alive) return;
    const stations = S.SABOTAGE_STATIONS[s.kind];
    const idx = Number(msg.idx) | 0;
    const st = s.kind === 'lights' ? stations[0] : stations[idx];
    if (!st || Math.hypot(p.x - st.x, p.y - st.y) > S.INTERACT_RANGE + 60) return;
    if (s.kind === 'lights') {
      if (idx < 0 || idx > 4) return;
      s.switches[idx] = !s.switches[idx];
      if (s.switches.every(Boolean)) return this.clearSab();
    } else if (s.kind === 'reactor') {
      s.holds[idx] = msg.val ? p.id : null;
      if (s.holds[0] && s.holds[1]) return this.clearSab();
    } else if (s.kind === 'o2') {
      if (String(msg.val) === s.code) s.done[idx] = true;
      if (s.done.every(Boolean)) return this.clearSab();
    }
    this.sendSab();
  }

  clearSab() {
    const was = this.sab && this.sab.kind;
    this.sab = null;
    this.sabReadyAt = Date.now() + S.SABOTAGE_COOLDOWN * 1000;
    this.broadcast({ t: 'sab', kind: null, fixed: was });
  }

  // ---------------------------------------------------------------- reuniones
  startMeeting(kind, caller, body) {
    const s = this.settings;
    const now = Date.now();
    this.phase = 'meeting';
    this.sab = null;
    this.closedDoors = [];
    this.doorTimers = {};
    this.broadcast({ t: 'sab', kind: null });
    this.broadcast({ t: 'doors', closed: [] });
    for (const p of this.players.values()) { p.inVent = null; p.scanning = false; p.voted = null; p.m = 0; }
    const introMs = 3200;
    this.meeting = {
      kind, caller: caller.id, body: body ? body.id : null, bodyColor: body ? body.color : null,
      stage: 'intro', started: now,
      discussEnd: now + introMs + s.discussionTime * 1000,
      voteEnd: now + introMs + (s.discussionTime + s.votingTime) * 1000,
      votes: {},
    };
    this.bodies = [];
    this.broadcast(this.meetingMsg());
    if (s.taskBar === 1) this.sendProgress(true);
    bots.onMeeting(this);
  }

  meetingMsg() {
    const m = this.meeting;
    const now = Date.now();
    return {
      t: 'meeting', kind: m.kind, caller: m.caller, body: m.body, bodyColor: m.bodyColor,
      discussIn: Math.max(0, m.discussEnd - now), voteIn: Math.max(0, m.voteEnd - now),
      voted: Object.keys(m.votes), stage: m.stage,
      alive: this.active().filter(p => p.alive).map(p => p.id),
      players: this.publicPlayers(),
    };
  }

  onVote(p, target) {
    const m = this.meeting;
    const now = Date.now();
    if (this.phase !== 'meeting' || !m || m.stage === 'results' || !p.alive) return;
    if (now < m.discussEnd) return;
    if (m.votes[p.id] !== undefined) return;
    if (target !== 'skip') {
      const t = this.players.get(target);
      if (!t || !t.alive || t.left) return;
    }
    m.votes[p.id] = target;
    this.broadcast({ t: 'voted', id: p.id });
    this.maybeEndVoting();
  }

  maybeEndVoting() {
    const m = this.meeting;
    if (!m || m.stage === 'results') return;
    const alive = this.active().filter(p => p.alive);
    if (alive.every(p => m.votes[p.id] !== undefined)) this.tally();
  }

  tally() {
    const m = this.meeting;
    const s = this.settings;
    m.stage = 'results';
    const counts = {};
    const voters = {};
    for (const p of this.active().filter(q => q.alive)) {
      const v = m.votes[p.id] === undefined ? 'none' : m.votes[p.id];
      if (v === 'none') continue;
      counts[v] = (counts[v] || 0) + 1;
      (voters[v] = voters[v] || []).push(s.anonymousVotes ? 'anon' : p.color);
    }
    let best = null, bestN = 0, tie = false;
    for (const k in counts) {
      if (counts[k] > bestN) { best = k; bestN = counts[k]; tie = false; }
      else if (counts[k] === bestN) tie = true;
    }
    let ejected = null;
    if (best && best !== 'skip' && !tie) ejected = this.players.get(best);
    this.ejectInfo = this.buildEject(ejected, tie, best === 'skip' || !best);
    m.resultsEnd = Date.now() + 5000;
    this.broadcast({ t: 'results', voters, ejected: ejected ? ejected.id : null });
  }

  buildEject(p, tie, skipped) {
    const s = this.settings;
    const impLeft = () => this.active().filter(q => q.alive && q.role === 'impostor' && q !== p).length;
    let line1, line2 = '';
    if (!p) {
      line1 = tie ? 'Nadie fue expulsado. (Empate)' : 'Nadie fue expulsado. (Omitido)';
    } else if (s.confirmEjects) {
      const nImp = this.active().filter(q => q.role === 'impostor').length;
      if (p.role === 'impostor') line1 = nImp > 1 ? `${p.name} era un impostor.` : `${p.name} era el impostor.`;
      else line1 = nImp > 1 ? `${p.name} no era un impostor.` : `${p.name} no era el impostor.`;
    } else line1 = `${p.name} fue expulsado.`;
    if (s.confirmEjects) {
      const n = impLeft();
      line2 = n === 1 ? 'Queda 1 impostor.' : `Quedan ${n} impostores.`;
    }
    return { id: p ? p.id : null, color: p ? p.color : null, hat: p ? p.hat : null, line1, line2 };
  }

  // ---------------------------------------------------------------- bucle
  tick(dt) {
    const now = Date.now();
    // limpiar desconectados
    for (const p of [...this.players.values()]) {
      if (!p.bot && !p.connected && !p.left && now - p.dcAt > (this.phase === 'lobby' ? 20000 : 60000)) this.removePlayer(p.id);
    }
    if (this.destroyed) return;

    if (this.phase === 'intro' && now >= this.introEnd) {
      this.phase = 'play';
      this.broadcast({ t: 'phase', phase: 'play' });
    }
    if (this.phase === 'play') this.tickPlay(now);
    if (this.phase === 'meeting') this.tickMeeting(now);
    if (this.phase === 'eject' && now >= this.ejectEnd) this.afterEject();

    bots.tick(this, dt, now);

    if (now - this.lastBroadcast >= 66) {
      this.lastBroadcast = now;
      this.broadcastState();
    }
  }

  tickPlay(now) {
    const s = this.settings;
    // puertas
    for (const room in this.doorTimers) {
      if (now >= this.doorTimers[room]) {
        delete this.doorTimers[room];
        const ids = S.SHIP.doors.filter(d => d.room === room).map(d => d.id);
        this.closedDoors = this.closedDoors.filter(id => ids.indexOf(id) < 0);
        this.broadcast({ t: 'doors', closed: this.closedDoors, open: room });
      }
    }
    // sabotaje crítico
    if (this.sab && this.sab.endsAt && now >= this.sab.endsAt) {
      const k = this.sab.kind;
      this.sab = null;
      return this.endGame('impostor', k === 'reactor' ? '¡El reactor se fundió! La nave explotó.' : '¡Se acabó el oxígeno! La tripulación se asfixió.');
    }
    if (s.mode === 'hideseek') {
      const left = this.hsEndAt - now;
      if (!this.finalHide && left <= s.finalHideTime * 1000) {
        this.finalHide = true;
        this.broadcast({ t: 'final', endIn: left });
      }
      if (this.finalHide && now >= this.nextPing) {
        this.nextPing = now + 5000;
        const pts = this.active().filter(p => p.alive && p.role === 'hider').map(p => [Math.round(p.x), Math.round(p.y)]);
        this.broadcast({ t: 'ping', pts }, q => q.role === 'seeker');
        for (const b of this.players.values()) if (b.bot && b.role === 'seeker' && b.ai) b.ai.pings = pts;
      }
      if (left <= 0) return this.endGame('hiders', '¡Los escondidos sobrevivieron hasta el final!');
    }
    this.checkWin();
  }

  tickMeeting(now) {
    const m = this.meeting;
    if (m.stage === 'intro' && now >= m.started + 3200) m.stage = 'discuss';
    if (m.stage === 'discuss' && now >= m.discussEnd) m.stage = 'vote';
    if (m.stage === 'vote' && now >= m.voteEnd) this.tally();
    if (m.stage === 'results' && now >= m.resultsEnd) {
      this.phase = 'eject';
      this.ejectEnd = now + 7500;
      const e = this.ejectInfo;
      if (e.id) {
        const p = this.players.get(e.id);
        if (p) { p.alive = false; p.ejected = true; }
      }
      this.meeting = null;
      this.broadcast(Object.assign({ t: 'eject' }, e));
    }
  }

  afterEject() {
    const s = this.settings;
    const now = Date.now();
    if (this.checkWin()) return;
    this.phase = 'play';
    const living = this.active();
    const sp = S.spawnPoints(S.SHIP, living.length);
    living.forEach((p, i) => {
      p.x = sp[i].x; p.y = sp[i].y; p.m = 0;
      if (p.role === 'impostor') p.killReadyAt = now + s.killCooldown * 1000;
      send(p, { t: 'pos', x: p.x, y: p.y });
      send(p, { t: 'cd', killIn: Math.max(0, p.killReadyAt - now) });
    });
    this.emergencyReadyAt = now + s.emergencyCooldown * 1000;
    this.sabReadyAt = now + 10000;
    this.broadcast({ t: 'phase', phase: 'play' });
    bots.afterMeeting(this);
  }

  // ---------------------------------------------------------------- progreso / victoria
  progress() {
    let done = 0, total = 0;
    for (const p of this.active().concat([...this.players.values()].filter(q => q.left))) {
      if (p.fake || !p.role || (p.role !== 'crew' && p.role !== 'hider')) continue;
      for (const t of p.tasks) { total++; if (t.done) done++; }
    }
    return { done, total };
  }

  sendProgress(force, only) {
    const s = this.settings;
    if (s.mode === 'race') {
      const board = this.active().map(p => ({ id: p.id, done: p.tasks.filter(t => t.done).length, total: p.tasks.length }));
      const m = { t: 'progress', race: board };
      return only ? send(only, m) : this.broadcast(m);
    }
    if (s.mode === 'classic' && s.taskBar === 2) return;
    if (s.mode === 'classic' && s.taskBar === 1 && !force && this.phase !== 'meeting') return;
    const pr = this.progress();
    const m = { t: 'progress', done: pr.done, total: pr.total };
    return only ? send(only, m) : this.broadcast(m);
  }

  checkWin() {
    if (this.phase === 'lobby' || this.phase === 'intro' || this.winner) return false;
    const s = this.settings;
    const act = this.active();
    if (s.mode === 'classic') {
      if (this.phase === 'meeting' || (this.phase === 'eject' && Date.now() < this.ejectEnd)) return false;
      const imp = act.filter(p => p.alive && p.role === 'impostor').length;
      const crew = act.filter(p => p.alive && p.role === 'crew').length;
      const pr = this.progress();
      if (imp === 0) return this.endGame('crew', '¡Todos los impostores fueron eliminados!');
      if (pr.total > 0 && pr.done >= pr.total) return this.endGame('crew', '¡La tripulación completó todas las tareas!');
      if (imp >= crew) return this.endGame('impostor', 'Los impostores superan en número a la tripulación.');
    } else if (s.mode === 'hideseek') {
      const hiders = act.filter(p => p.alive && p.role === 'hider').length;
      const seekers = act.filter(p => p.role === 'seeker').length;
      if (hiders === 0) return this.endGame('seeker', '¡El buscador atrapó a todos!');
      if (seekers === 0) return this.endGame('hiders', 'El buscador abandonó la partida.');
    } else if (s.mode === 'race') {
      if (!act.length) return false;
    }
    return false;
  }

  endGame(winner, reason, raceWinners) {
    if (this.winner) return true;
    this.winner = winner;
    const all = [...this.players.values()];
    const roles = {};
    for (const p of all) roles[p.id] = p.role;
    let winners;
    if (winner === 'crew') winners = all.filter(p => p.role === 'crew');
    else if (winner === 'impostor') winners = all.filter(p => p.role === 'impostor');
    else if (winner === 'hiders') winners = all.filter(p => p.role === 'hider');
    else if (winner === 'seeker') winners = all.filter(p => p.role === 'seeker');
    else winners = all.filter(p => raceWinners.indexOf(p.id) >= 0);
    const ranking = this.settings.mode === 'race'
      ? all.filter(p => !p.left).map(p => ({ id: p.id, done: p.tasks.filter(t => t.done).length, total: p.tasks.length }))
        .sort((a, b) => b.done - a.done)
      : null;
    const winIds = winners.map(p => p.id);
    const info = all.map(p => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, role: p.role, alive: p.alive }));
    this.broadcast({ t: 'gameover', winner, reason, winners: winIds, players: info, ranking, mode: this.settings.mode });
    for (const p of all) {
      if (p.bot || p.left) continue;
      auth.addStats(p.userId, {
        games: 1, wins: winIds.indexOf(p.id) >= 0 ? 1 : 0,
        impostor: p.role === 'impostor' || p.role === 'seeker' ? 1 : 0,
      });
    }
    // volver a la sala
    for (const p of all) if (p.left) this.players.delete(p.id);
    this.phase = 'lobby';
    this.mapId = 'lobby';
    this.bodies = [];
    this.meeting = null;
    this.sab = null;
    this.closedDoors = [];
    const sp = S.spawnPoints(S.LOBBY, this.players.size);
    [...this.players.values()].forEach((p, i) => {
      p.alive = true; p.role = null; p.tasks = []; p.inVent = null; p.ejected = false; p.ai = null;
      p.x = sp[i].x; p.y = sp[i].y; p.m = 0; p.scanning = false;
    });
    setTimeout(() => { this.winner = null; }, 0);
    this.broadcastRoom();
    return true;
  }

  // ---------------------------------------------------------------- estado
  broadcastState() {
    const list = [...this.players.values()].filter(p => !p.left);
    const bodies = this.bodies.map(b => [b.id, Math.round(b.x), Math.round(b.y)]);
    for (const me of list) {
      if (me.bot || !me.connected) continue;
      const seeGhosts = this.phase === 'lobby' || !me.alive;
      const ps = [];
      for (const q of list) {
        if (q.inVent && q !== me) continue;
        if (!q.alive && !seeGhosts && this.phase !== 'lobby') continue;
        ps.push([q.id, Math.round(q.x), Math.round(q.y), q.f, q.m, q.alive ? 1 : 0, q.scanning ? 1 : 0]);
      }
      send(me, { t: 's', p: ps, b: bodies });
    }
  }
}

function listPublic() {
  const out = [];
  for (const r of rooms.values()) {
    if (!r.isPublic || r.phase !== 'lobby') continue;
    const host = r.players.get(r.hostId);
    out.push({ code: r.code, host: host ? host.name : '?', mode: r.settings.mode, count: r.active().length, max: r.settings.maxPlayers });
  }
  return out.slice(0, 30);
}

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const r of rooms.values()) {
    try { r.tick(dt); } catch (e) { console.error('Error en sala', r.code, e); }
  }
}, 33);

module.exports = { Room, rooms, listPublic, send, VGRID, WGRID };
