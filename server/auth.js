'use strict';
// Cuentas de usuario: usuario + contraseña (hash scrypt), guardadas en data/users.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Shared = require('../public/js/shared.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'users.json');

let db = { users: {} };
let saveTimer = null;

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!db.users) db.users = {};
  } catch (e) {
    console.error('No se pudo leer la base de usuarios:', e.message);
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, FILE);
    } catch (e) {
      console.error('No se pudo guardar la base de usuarios:', e.message);
    }
  }, 300);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function publicUser(u) {
  return {
    id: u.id, username: u.username, color: u.color, hat: u.hat, pet: u.pet || 'none',
    stats: u.stats,
  };
}

function key(username) { return String(username).trim().toLowerCase(); }

function register(username, password) {
  username = String(username || '').trim();
  if (!/^[A-Za-z0-9_áéíóúñÁÉÍÓÚÑ]{3,14}$/.test(username)) {
    return { error: 'El usuario debe tener 3-14 letras, números o _.' };
  }
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) {
    return { error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  const k = key(username);
  if (db.users[k]) return { error: 'Ese usuario ya existe. Prueba otro nombre.' };
  const salt = crypto.randomBytes(16).toString('hex');
  const color = Shared.COLORS[Math.floor(Math.random() * Shared.COLORS.length)].id;
  const u = {
    id: 'u_' + crypto.randomBytes(8).toString('hex'),
    username, salt, hash: hashPassword(password, salt),
    color, hat: 'none', tokens: [], created: Date.now(),
    stats: { games: 0, wins: 0, impostor: 0, kills: 0, tasks: 0 },
  };
  db.users[k] = u;
  return issueToken(u);
}

function login(username, password) {
  const u = db.users[key(username || '')];
  if (!u || typeof password !== 'string') return { error: 'Usuario o contraseña incorrectos.' };
  const h = hashPassword(password, u.salt);
  if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'))) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }
  return issueToken(u);
}

function issueToken(u) {
  const token = crypto.randomBytes(24).toString('hex');
  u.tokens = (u.tokens || []).slice(-9);
  u.tokens.push(token);
  save();
  return { token, user: publicUser(u) };
}

function byToken(token) {
  if (!token || typeof token !== 'string') return null;
  for (const k in db.users) {
    const u = db.users[k];
    if (u.tokens && u.tokens.indexOf(token) >= 0) return u;
  }
  return null;
}

function logout(token) {
  const u = byToken(token);
  if (u) { u.tokens = u.tokens.filter(t => t !== token); save(); }
}

function updateProfile(u, data) {
  if (data.color && Shared.COLORS.some(c => c.id === data.color)) u.color = data.color;
  if (data.hat && Shared.HATS.some(h => h.id === data.hat)) u.hat = data.hat;
  if (data.pet && Shared.PETS.some(h => h.id === data.pet)) u.pet = data.pet;
  save();
}

function addStats(userId, delta) {
  for (const k in db.users) {
    const u = db.users[k];
    if (u.id !== userId) continue;
    u.stats = u.stats || { games: 0, wins: 0, impostor: 0, kills: 0, tasks: 0 };
    for (const s in delta) u.stats[s] = (u.stats[s] || 0) + delta[s];
    save();
    return;
  }
}

load();

module.exports = { register, login, byToken, logout, updateProfile, publicUser, addStats };
