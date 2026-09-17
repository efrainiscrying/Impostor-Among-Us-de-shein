import { customAlphabet } from "nanoid";
import { startGame, onMove, onTaskComplete, onKill, onReportBody, onCallMeeting, onVote, onChat, handleDisconnectDuringGame } from "./game.js";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const DEFAULT_SETTINGS = {
  mode: "classic", // "classic" | "hideseek"
  numImpostors: 1,
  playerSpeed: 1.0, // multiplier
  killCooldown: 25, // seconds
  discussionTime: 20,
  votingTime: 60,
  visionRadius: 1.0, // multiplier
  impostorVisionRadius: 1.5,
  taskBarUpdates: "always", // "always" | "meetings" | "never"
  emergencyMeetings: 1,
  // hide & seek specific
  seekerCount: 1,
  roundTime: 120,
  hideTime: 10,
};

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 15;

/** @type {Map<string, Lobby>} */
const lobbies = new Map();

function publicState(lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    settings: lobby.settings,
    phase: lobby.phase,
    players: [...lobby.players.values()].map((p) => ({
      userId: p.userId,
      username: p.username,
      color: p.color,
      ready: p.ready,
      connected: p.connected,
    })),
  };
}

function maxImpostorsFor(playerCount) {
  return Math.max(1, Math.min(3, Math.floor(playerCount / 2) - 1 || 1));
}

export function attachLobby(io) {
  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("lobby:create", (cb) => {
      const code = makeCode();
      const lobby = {
        code,
        hostId: user.id,
        settings: { ...DEFAULT_SETTINGS },
        phase: "lobby",
        players: new Map(),
      };
      lobby.players.set(user.id, {
        userId: user.id,
        username: user.username,
        color: user.color,
        ready: false,
        connected: true,
        socketId: socket.id,
      });
      lobbies.set(code, lobby);
      socket.join(code);
      socket.data.lobbyCode = code;
      cb?.({ ok: true, state: publicState(lobby) });
    });

    socket.on("lobby:join", ({ code } = {}, cb) => {
      const lobby = lobbies.get((code || "").toUpperCase());
      if (!lobby) return cb?.({ ok: false, error: "Esa sala no existe." });
      if (lobby.phase !== "lobby") return cb?.({ ok: false, error: "Esa partida ya empezó." });
      if (lobby.players.size >= MAX_PLAYERS) return cb?.({ ok: false, error: "La sala está llena." });

      lobby.players.set(user.id, {
        userId: user.id,
        username: user.username,
        color: user.color,
        ready: false,
        connected: true,
        socketId: socket.id,
      });
      socket.join(lobby.code);
      socket.data.lobbyCode = lobby.code;
      cb?.({ ok: true, state: publicState(lobby) });
      io.to(lobby.code).emit("lobby:state", publicState(lobby));
    });

    function currentLobby() {
      const code = socket.data.lobbyCode;
      return code ? lobbies.get(code) : null;
    }

    socket.on("lobby:leave", () => {
      leaveLobby(io, socket);
    });

    socket.on("lobby:toggleReady", () => {
      const lobby = currentLobby();
      if (!lobby) return;
      const p = lobby.players.get(user.id);
      if (!p) return;
      p.ready = !p.ready;
      io.to(lobby.code).emit("lobby:state", publicState(lobby));
    });

    socket.on("lobby:setColor", (color) => {
      const lobby = currentLobby();
      if (!lobby) return;
      const p = lobby.players.get(user.id);
      if (!p || typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
      p.color = color;
      io.to(lobby.code).emit("lobby:state", publicState(lobby));
    });

    socket.on("lobby:updateSettings", (settings) => {
      const lobby = currentLobby();
      if (!lobby || lobby.hostId !== user.id) return;
      const merged = { ...lobby.settings, ...sanitizeSettings(settings, lobby.players.size) };
      lobby.settings = merged;
      io.to(lobby.code).emit("lobby:state", publicState(lobby));
    });

    socket.on("lobby:start", (cb) => {
      const lobby = currentLobby();
      if (!lobby) return cb?.({ ok: false, error: "No estás en una sala." });
      if (lobby.hostId !== user.id) return cb?.({ ok: false, error: "Solo el host puede iniciar." });
      if (lobby.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: `Se necesitan al menos ${MIN_PLAYERS} jugadores.` });

      const maxImp = maxImpostorsFor(lobby.players.size);
      if (lobby.settings.numImpostors > maxImp) lobby.settings.numImpostors = maxImp;

      io.to(lobby.code).emit("lobby:state", publicState(lobby));
      cb?.({ ok: true });
      startGame(io, lobby);
    });

    socket.on("game:move", (pos) => {
      const lobby = currentLobby();
      if (lobby && pos) onMove(io, socket, lobby, user, pos);
    });

    socket.on("game:taskComplete", (taskId) => {
      const lobby = currentLobby();
      if (lobby) onTaskComplete(io, lobby, user, taskId);
    });

    socket.on("game:kill", (targetUserId) => {
      const lobby = currentLobby();
      if (lobby) onKill(io, lobby, user, targetUserId);
    });

    socket.on("game:reportBody", (bodyId) => {
      const lobby = currentLobby();
      if (lobby) onReportBody(io, lobby, user, bodyId);
    });

    socket.on("game:callMeeting", () => {
      const lobby = currentLobby();
      if (lobby) onCallMeeting(io, lobby, user);
    });

    socket.on("game:vote", (targetUserId) => {
      const lobby = currentLobby();
      if (lobby) onVote(io, lobby, user, targetUserId);
    });

    socket.on("game:chat", (text) => {
      const lobby = currentLobby();
      if (lobby) onChat(io, lobby, user, text);
    });

    socket.on("disconnect", () => {
      leaveLobby(io, socket, { keepIfEmpty: false });
    });
  });
}

function sanitizeSettings(input, playerCount) {
  const out = {};
  const maxImp = maxImpostorsFor(playerCount);
  if (Number.isFinite(input.numImpostors)) out.numImpostors = clamp(Math.round(input.numImpostors), 1, maxImp);
  if (Number.isFinite(input.playerSpeed)) out.playerSpeed = clamp(input.playerSpeed, 0.5, 2.0);
  if (Number.isFinite(input.killCooldown)) out.killCooldown = clamp(Math.round(input.killCooldown), 10, 60);
  if (Number.isFinite(input.discussionTime)) out.discussionTime = clamp(Math.round(input.discussionTime), 0, 120);
  if (Number.isFinite(input.votingTime)) out.votingTime = clamp(Math.round(input.votingTime), 15, 300);
  if (Number.isFinite(input.visionRadius)) out.visionRadius = clamp(input.visionRadius, 0.25, 3);
  if (Number.isFinite(input.impostorVisionRadius)) out.impostorVisionRadius = clamp(input.impostorVisionRadius, 0.25, 3);
  if (["always", "meetings", "never"].includes(input.taskBarUpdates)) out.taskBarUpdates = input.taskBarUpdates;
  if (Number.isFinite(input.emergencyMeetings)) out.emergencyMeetings = clamp(Math.round(input.emergencyMeetings), 0, 9);
  if (["classic", "hideseek"].includes(input.mode)) out.mode = input.mode;
  if (Number.isFinite(input.seekerCount)) out.seekerCount = clamp(Math.round(input.seekerCount), 1, 4);
  if (Number.isFinite(input.roundTime)) out.roundTime = clamp(Math.round(input.roundTime), 30, 600);
  if (Number.isFinite(input.hideTime)) out.hideTime = clamp(Math.round(input.hideTime), 0, 60);
  return out;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function leaveLobby(io, socket, { keepIfEmpty = true } = {}) {
  const code = socket.data.lobbyCode;
  if (!code) return;
  const lobby = lobbies.get(code);
  if (!lobby) return;
  const user = socket.data.user;

  if (lobby.phase === "playing" || lobby.phase === "meeting") {
    handleDisconnectDuringGame(io, lobby, user.id);
  }
  lobby.players.delete(user.id);
  socket.leave(code);
  socket.data.lobbyCode = null;

  if (lobby.players.size === 0) {
    lobbies.delete(code);
    return;
  }
  if (lobby.hostId === user.id) {
    lobby.hostId = [...lobby.players.values()][0].userId;
  }
  io.to(code).emit("lobby:state", publicState(lobby));
}

export { lobbies, MIN_PLAYERS, MAX_PLAYERS, DEFAULT_SETTINGS };
