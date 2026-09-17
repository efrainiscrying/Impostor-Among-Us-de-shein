import { TASKS, SPAWN, KILL_RANGE, TASK_RANGE, REPORT_RANGE } from "./mapData.js";

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function publicPlayer(p) {
  return { userId: p.userId, username: p.username, color: p.color, x: p.x, y: p.y, alive: p.alive };
}

function spawnPoint(index, total) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return { x: SPAWN.x + Math.cos(angle) * 80, y: SPAWN.y + Math.sin(angle) * 80 };
}

export function startGame(io, lobby) {
  const playerIds = [...lobby.players.keys()];
  const isHideSeek = lobby.settings.mode === "hideseek";
  const impostorCount = isHideSeek ? lobby.settings.seekerCount : lobby.settings.numImpostors;
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const impostors = new Set(shuffled.slice(0, Math.min(impostorCount, playerIds.length - 1)));

  const players = new Map();
  let i = 0;
  for (const p of lobby.players.values()) {
    const pos = spawnPoint(i, playerIds.length);
    players.set(p.userId, {
      userId: p.userId,
      username: p.username,
      color: p.color,
      x: pos.x,
      y: pos.y,
      alive: true,
      role: impostors.has(p.userId) ? "impostor" : "crew",
      tasksDone: new Set(),
    });
    i++;
  }

  const crewCount = [...players.values()].filter((p) => p.role === "crew").length;

  lobby.phase = "playing";
  lobby.game = {
    mode: lobby.settings.mode,
    players,
    bodies: [],
    killCooldownReadyAt: new Map(),
    emergencyMeetingsLeft: new Map(playerIds.map((id) => [id, lobby.settings.emergencyMeetings])),
    meeting: null,
    timers: {},
    tasksTotal: isHideSeek ? 0 : TASKS.length * crewCount,
    hideUntil: isHideSeek ? Date.now() + lobby.settings.hideTime * 1000 : 0,
  };

  for (const p of lobby.players.values()) {
    const me = players.get(p.userId);
    io.to(p.socketId).emit("game:start", {
      settings: lobby.settings,
      isImpostor: impostors.has(p.userId),
      selfRole: me.role,
      teammates: impostors.has(p.userId) ? [...impostors].filter((id) => id !== p.userId) : [],
      tasks: lobby.settings.mode === "classic" ? TASKS : [],
      players: [...players.values()].map(publicPlayer),
    });
  }

  if (isHideSeek) {
    lobby.game.timers.round = setTimeout(() => endHideSeekRound(io, lobby), lobby.settings.roundTime * 1000);
  }
}

function endHideSeekRound(io, lobby) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing") return;
  const aliveCrew = [...g.players.values()].filter((p) => p.role === "crew" && p.alive).length;
  finishGame(io, lobby, aliveCrew > 0 ? "crew" : "impostor",
    aliveCrew > 0 ? "¡Sobrevivieron escondidos todo el tiempo!" : "Todos fueron atrapados.");
}

export function onMove(io, socket, lobby, user, pos) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing") return;
  const pl = g.players.get(user.id);
  if (!pl || !pl.alive) return;
  if (typeof pos.x !== "number" || typeof pos.y !== "number") return;
  if (g.mode === "hideseek" && pl.role === "impostor" && Date.now() < g.hideUntil) return;
  pl.x = pos.x;
  pl.y = pos.y;
  socket.volatile.to(lobby.code).emit("game:state", {
    userId: user.id,
    x: pos.x,
    y: pos.y,
    anim: pos.anim || "idle",
  });
}

export function onTaskComplete(io, lobby, user, taskId) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing" || g.mode !== "classic") return;
  const pl = g.players.get(user.id);
  if (!pl || !pl.alive || pl.role !== "crew") return;
  const task = TASKS.find((t) => t.id === taskId);
  if (!task || pl.tasksDone.has(taskId)) return;
  if (dist(pl, task) > TASK_RANGE) return;
  pl.tasksDone.add(taskId);
  const done = [...g.players.values()].filter((p) => p.role === "crew").reduce((s, p) => s + p.tasksDone.size, 0);
  io.to(lobby.code).emit("game:taskProgress", { done, total: g.tasksTotal, userId: user.id, taskId });
  checkWin(io, lobby);
}

export function onKill(io, lobby, user, targetUserId) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing") return;
  const killer = g.players.get(user.id);
  if (!killer || !killer.alive || killer.role !== "impostor") return;
  if (g.mode === "hideseek" && Date.now() < g.hideUntil) return;
  const readyAt = g.killCooldownReadyAt.get(user.id) || 0;
  if (Date.now() < readyAt) return;
  const target = g.players.get(targetUserId);
  if (!target || !target.alive || target.role === "impostor") return;
  if (dist(killer, target) > KILL_RANGE) return;

  target.alive = false;
  const bodyId = `${targetUserId}-${Date.now()}`;
  if (g.mode === "classic") {
    g.bodies.push({ id: bodyId, userId: targetUserId, x: target.x, y: target.y });
  }
  g.killCooldownReadyAt.set(user.id, Date.now() + lobby.settings.killCooldown * 1000);
  io.to(lobby.code).emit("game:killed", { targetUserId, bodyId, x: target.x, y: target.y, killedBy: user.id });
  checkWin(io, lobby);
}

export function onReportBody(io, lobby, user, bodyId) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing" || g.mode !== "classic") return;
  const reporter = g.players.get(user.id);
  if (!reporter || !reporter.alive) return;
  const idx = g.bodies.findIndex((b) => b.id === bodyId);
  if (idx === -1) return;
  const body = g.bodies[idx];
  if (dist(reporter, body) > REPORT_RANGE) return;
  g.bodies.splice(idx, 1);
  startMeeting(io, lobby, user.id, "report", body.userId);
}

export function onCallMeeting(io, lobby, user) {
  const g = lobby.game;
  if (!g || lobby.phase !== "playing" || g.mode !== "classic") return;
  const caller = g.players.get(user.id);
  if (!caller || !caller.alive) return;
  const left = g.emergencyMeetingsLeft.get(user.id) || 0;
  if (left <= 0) return;
  g.emergencyMeetingsLeft.set(user.id, left - 1);
  startMeeting(io, lobby, user.id, "emergency", null);
}

function startMeeting(io, lobby, calledBy, reason, victimUserId) {
  const g = lobby.game;
  lobby.phase = "meeting";
  const endsAt = Date.now() + Math.max(lobby.settings.discussionTime, 3) * 1000;
  g.meeting = { phase: "discussion", calledBy, reason, victimUserId, endsAt, votes: new Map() };
  io.to(lobby.code).emit("game:meetingStart", { calledBy, reason, victimUserId, endsAt });
  clearTimeout(g.timers.meeting);
  g.timers.meeting = setTimeout(() => beginVoting(io, lobby), Math.max(endsAt - Date.now(), 0));
}

function beginVoting(io, lobby) {
  const g = lobby.game;
  if (!g?.meeting) return;
  const endsAt = Date.now() + Math.max(lobby.settings.votingTime, 10) * 1000;
  g.meeting.phase = "voting";
  g.meeting.endsAt = endsAt;
  g.meeting.votes = new Map();
  io.to(lobby.code).emit("game:votingStart", { endsAt });
  clearTimeout(g.timers.meeting);
  g.timers.meeting = setTimeout(() => resolveVoting(io, lobby), Math.max(endsAt - Date.now(), 0));
}

export function onVote(io, lobby, user, targetUserId) {
  const g = lobby.game;
  if (!g?.meeting || g.meeting.phase !== "voting") return;
  const voter = g.players.get(user.id);
  if (!voter || !voter.alive) return;
  if (g.meeting.votes.has(user.id)) return;
  g.meeting.votes.set(user.id, targetUserId || "skip");
  io.to(lobby.code).emit("game:voteUpdate", { voterId: user.id });
  const aliveCount = [...g.players.values()].filter((p) => p.alive).length;
  if (g.meeting.votes.size >= aliveCount) {
    clearTimeout(g.timers.meeting);
    resolveVoting(io, lobby);
  }
}

function resolveVoting(io, lobby) {
  const g = lobby.game;
  if (!g?.meeting) return;
  const tally = new Map();
  for (const v of g.meeting.votes.values()) tally.set(v, (tally.get(v) || 0) + 1);

  let ejected = null;
  let top = 0;
  let tie = false;
  for (const [target, count] of tally) {
    if (target === "skip") continue;
    if (count > top) {
      top = count;
      ejected = target;
      tie = false;
    } else if (count === top) {
      tie = true;
    }
  }
  if (tie || top === 0) ejected = null;

  let wasImpostor = null;
  if (ejected) {
    const p = g.players.get(ejected);
    if (p) {
      p.alive = false;
      wasImpostor = p.role === "impostor";
    }
  }

  io.to(lobby.code).emit("game:meetingResult", {
    ejectedUserId: ejected,
    wasImpostor,
    voteCounts: Object.fromEntries(tally),
  });

  g.meeting = null;
  lobby.phase = "playing";

  const alivePlayers = [...g.players.values()].filter((p) => p.alive);
  alivePlayers.forEach((p, idx) => {
    const pos = spawnPoint(idx, alivePlayers.length);
    p.x = pos.x;
    p.y = pos.y;
  });
  io.to(lobby.code).emit("game:resetPositions", {
    players: alivePlayers.map((p) => ({ userId: p.userId, x: p.x, y: p.y })),
  });

  checkWin(io, lobby);
}

export function onChat(io, lobby, user, text) {
  const g = lobby.game;
  if (!g?.meeting) return;
  if (typeof text !== "string" || !text.trim()) return;
  io.to(lobby.code).emit("game:chatMessage", {
    userId: user.id,
    username: user.username,
    text: text.slice(0, 200),
    ts: Date.now(),
  });
}

function checkWin(io, lobby) {
  const g = lobby.game;
  if (!g || lobby.phase === "ended") return;
  const alive = [...g.players.values()].filter((p) => p.alive);
  const aliveCrew = alive.filter((p) => p.role === "crew").length;
  const aliveImpostors = alive.filter((p) => p.role === "impostor").length;

  if (g.mode === "hideseek") {
    if (aliveCrew === 0) finishGame(io, lobby, "impostor", "¡Todos los escondidos fueron atrapados!");
    return;
  }

  const tasksDone = [...g.players.values()].filter((p) => p.role === "crew").reduce((s, p) => s + p.tasksDone.size, 0);
  if (aliveImpostors === 0) {
    finishGame(io, lobby, "crew", "Expulsaron a todos los impostores.");
  } else if (aliveImpostors >= aliveCrew) {
    finishGame(io, lobby, "impostor", "Los impostores igualaron a la tripulación.");
  } else if (g.tasksTotal > 0 && tasksDone >= g.tasksTotal) {
    finishGame(io, lobby, "crew", "¡La tripulación completó todas las tareas!");
  }
}

function finishGame(io, lobby, winner, reason) {
  const g = lobby.game;
  lobby.phase = "ended";
  clearTimeout(g.timers.meeting);
  clearTimeout(g.timers.round);
  io.to(lobby.code).emit("game:over", {
    winner,
    reason,
    players: [...g.players.values()].map((p) => ({ userId: p.userId, username: p.username, role: p.role, alive: p.alive })),
  });
}

export function handleDisconnectDuringGame(io, lobby, userId) {
  const g = lobby.game;
  if (!g) return;
  const p = g.players.get(userId);
  if (p && p.alive) {
    p.alive = false;
    checkWin(io, lobby);
  }
}
