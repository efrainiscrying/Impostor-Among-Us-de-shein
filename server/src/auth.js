import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "30d";

export const router = Router();

const PALETTE = [
  "#c51111", "#132ed1", "#117f2d", "#ed54ba", "#ef7d0d", "#f5f557",
  "#3f474e", "#d6e0f0", "#6b2fbb", "#71491e", "#38fedc", "#50ef39",
];

function usernameValid(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_]{3,16}$/.test(u);
}

router.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!usernameValid(username)) {
    return res.status(400).json({ error: "El usuario debe tener 3-16 caracteres (letras, números, _)." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "Ese usuario ya existe." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const info = db
    .prepare("INSERT INTO users (username, password_hash, color) VALUES (?, ?, ?)")
    .run(username, hash, color);

  const user = { id: info.lastInsertRowid, username, color };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, user });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!row || !bcrypt.compareSync(password || "", row.password_hash)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  const user = { id: row.id, username: row.username, color: row.color };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, user });
});

router.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ user: { id: user.id, username: user.username, color: user.color } });
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export { PALETTE };
