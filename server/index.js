'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const auth = require('./auth.js');
const { Room, rooms, listPublic, send } = require('./room.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e4) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

// Limitador simple de intentos de acceso por IP
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter(t => now - t < 60000);
  a.push(now);
  attempts.set(ip, a);
  return a.length > 20;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
    const body = await readBody(req);
    if (url.pathname === '/api/register' || url.pathname === '/api/login') {
      if (limited(ip)) return json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' });
      const r = url.pathname === '/api/register' ? auth.register(body.username, body.password) : auth.login(body.username, body.password);
      return json(res, r.error ? 400 : 200, r);
    }
    if (url.pathname === '/api/me') {
      const u = auth.byToken(body.token);
      return u ? json(res, 200, { user: auth.publicUser(u) }) : json(res, 401, { error: 'Sesión expirada' });
    }
    if (url.pathname === '/api/logout') { auth.logout(body.token); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: 'No encontrado' });
  }

  if (url.pathname === '/health') return json(res, 200, { ok: true, rooms: rooms.size });

  let file = decodeURIComponent(url.pathname);
  if (file === '/' || !path.extname(file)) file = '/index.html';
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': path.extname(full) === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  let user = null;
  let room = null;
  let player = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const leave = (reason) => {
    if (room && player) room.removePlayer(player.id, reason);
    room = null; player = null;
  };

  const join = (r) => {
    const res = r.addPlayer(user, ws);
    if (res.error) return send({ ws, bot: false }, { t: 'error', text: res.error });
    if (room && room !== r) leave();
    room = r; player = res;
  };

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const reply = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };

    if (msg.t === 'auth') {
      const u = auth.byToken(msg.token);
      if (!u) return reply({ t: 'authfail' });
      user = u;
      reply({ t: 'hello', user: auth.publicUser(u) });
      // Reconexión automática a la sala donde estaba
      for (const r of rooms.values()) {
        const p = r.players.get(u.id);
        if (p && !p.left) { join(r); break; }
      }
      return;
    }
    if (!user) return;
    if (msg.t === 'ping') return reply({ t: 'pong', c: msg.c });

    switch (msg.t) {
      case 'profile':
        auth.updateProfile(user, msg);
        reply({ t: 'profile', user: auth.publicUser(user) });
        if (room && player && room.phase === 'lobby') room.handle(player, { t: 'look', color: msg.color, hat: msg.hat, pet: msg.pet });
        return;
      case 'rooms': return reply({ t: 'rooms', list: listPublic() });
      case 'create': {
        leave();
        const r = new Room({ id: user.id }, { mode: msg.mode, isPublic: msg.isPublic });
        return join(r);
      }
      case 'join': {
        const code = String(msg.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) return reply({ t: 'error', text: 'No existe una sala con ese código.' });
        if (room === r && player) return;
        return join(r);
      }
      case 'leave':
        leave();
        return reply({ t: 'left' });
      default:
        if (room && player && !room.destroyed) room.handle(player, msg);
    }
  });

  ws.on('close', () => {
    if (room && player && player.ws === ws) {
      player.connected = false;
      player.dcAt = Date.now();
      player.ws = null;
      room.broadcastRoom();
    }
  });
});

// Mantener vivas las conexiones
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* */ }
  }
}, 20000);

server.listen(PORT, () => {
  console.log(`Among Us (Temu) listo en http://localhost:${PORT}`);
});
