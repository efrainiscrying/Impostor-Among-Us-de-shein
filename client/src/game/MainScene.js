import Phaser from "phaser";
import { WORLD_W, WORLD_H, TASKS, KILL_RANGE, TASK_RANGE, REPORT_RANGE, TASK_HOLD_MS } from "./mapData.js";

const SEND_HZ = 20;

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  init(data) {
    this.socket = data.socket;
    this.selfId = data.selfId;
    this.playersMeta = data.players; // [{userId, username, color}]
    this.settings = data.settings;
    this.isImpostor = data.isImpostor;
    this.taskList = data.tasks || [];
    this.uiState = {
      alive: true,
      role: data.isImpostor ? "impostor" : "crew",
      nearTaskId: null,
      nearTaskName: null,
      taskHoldProgress: 0,
      nearBodyId: null,
      killTargetId: null,
      killTargetName: null,
      killReadyInMs: 0,
      emergencyLeft: data.settings.emergencyMeetings,
      taskDone: 0,
      taskTotal: 0,
      frozen: false,
      mode: data.settings.mode,
      hideCountdown: data.settings.mode === "hideseek" ? data.settings.hideTime * 1000 : 0,
      hideUntil: data.settings.mode === "hideseek" ? Date.now() + data.settings.hideTime * 1000 : 0,
    };
  }

  makeBeanTexture(key, color) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(32, 58, 26, 10);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    g.fillEllipse(32, 34, 34, 40);
    g.fillEllipse(38, 22, 20, 14);
    g.fillStyle(0xbfe6ff, 1);
    g.fillEllipse(40, 26, 20, 13);
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeEllipse(32, 34, 34, 40);
    g.generateTexture(key, 64, 64);
    g.destroy();
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    const bg = this.add.graphics();
    bg.fillStyle(0x0b0e17, 1);
    bg.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let i = 0; i < 400; i++) {
      const x = Phaser.Math.Between(0, WORLD_W);
      const y = Phaser.Math.Between(0, WORLD_H);
      bg.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
      bg.fillCircle(x, y, Phaser.Math.FloatBetween(0.5, 1.8));
    }
    bg.fillStyle(0x22283a, 1);
    bg.fillRoundedRect(200, 200, WORLD_W - 400, WORLD_H - 400, 40);
    bg.lineStyle(6, 0x40485f, 1);
    bg.strokeRoundedRect(200, 200, WORLD_W - 400, WORLD_H - 400, 40);

    this.walls = this.physics.add.staticGroup();
    const wallRects = [
      [700, 500, 300, 40],
      [1200, 700, 40, 300],
      [900, 950, 400, 40],
      [1600, 400, 40, 260],
    ];
    for (const [x, y, w, h] of wallRects) {
      const r = this.add.rectangle(x, y, w, h, 0x565f7a, 1).setStrokeStyle(3, 0x2b3145);
      this.physics.add.existing(r, true);
      this.walls.add(r);
    }

    // task markers
    this.taskDoneIds = new Set();
    this.taskSprites = new Map();
    for (const t of this.taskList) {
      const icon = this.add.rectangle(t.x, t.y, 22, 22, 0xffd166, 1).setStrokeStyle(2, 0x00000066).setAngle(45);
      this.taskSprites.set(t.id, icon);
    }
    this.uiState.taskTotal = this.taskList.length * this.playersMeta.length; // rough client display, server sends real total on progress

    this.bodySprites = new Map();

    this.otherSprites = new Map();
    this.otherTargets = new Map();
    this.deadSelf = false;

    for (const p of this.playersMeta) {
      const key = `bean-${p.userId}`;
      this.makeBeanTexture(key, p.color);
      if (p.userId === this.selfId) {
        this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, key);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(28, 30).setOffset(18, 24);
        this.physics.add.collider(this.player, this.walls);
        this.nameLabel = this.add.text(this.player.x, this.player.y - 40, p.username, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }).setOrigin(0.5);
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      } else {
        const spr = this.add.sprite(WORLD_W / 2, WORLD_H / 2, key);
        const label = this.add.text(spr.x, spr.y - 40, p.username, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }).setOrigin(0.5);
        this.otherSprites.set(p.userId, { spr, label, meta: p, alive: true });
        this.otherTargets.set(p.userId, { x: spr.x, y: spr.y });
      }
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,F,R");
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.input.keyboard.addCapture("TAB");

    this.roleText = this.add.text(16, 16, this.isImpostor ? "SOS IMPOSTOR" : "SOS TRIPULANTE", {
      fontSize: "20px",
      color: this.isImpostor ? "#ff5555" : "#8fd6ff",
      fontFamily: "sans-serif",
      fontStyle: "bold",
    }).setScrollFactor(0);

    this.hudText = this.add.text(16, 44, "", {
      fontSize: "14px",
      color: "#d3d8ea",
      fontFamily: "sans-serif",
    }).setScrollFactor(0);

    this.promptText = this.add.text(0, 0, "", {
      fontSize: "13px",
      color: "#ffe066",
      fontFamily: "sans-serif",
      backgroundColor: "#00000088",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setVisible(false);

    this._sendTimer = 0;
    this._taskHoldMs = 0;
    this._activeTaskId = null;

    this._torndown = false;
    this.socket.on("game:state", this.onRemoteState, this);
    this.socket.on("game:killed", this.onKilled, this);
    this.socket.on("game:taskProgress", this.onTaskProgress, this);
    this.socket.on("game:resetPositions", this.onResetPositions, this);
    this.socket.on("game:meetingStart", this.onFreeze, this);
    this.socket.on("game:over", this.onFreeze, this);
  }

  // Called explicitly by GameScreen's React cleanup (not Phaser's own
  // scene lifecycle, which is unreliable to hook into from outside).
  teardown() {
    if (this._torndown) return;
    this._torndown = true;
    this.socket.off("game:state", this.onRemoteState, this);
    this.socket.off("game:killed", this.onKilled, this);
    this.socket.off("game:taskProgress", this.onTaskProgress, this);
    this.socket.off("game:resetPositions", this.onResetPositions, this);
    this.socket.off("game:meetingStart", this.onFreeze, this);
    this.socket.off("game:over", this.onFreeze, this);
  }

  onFreeze = () => {
    if (this._torndown) return;
    this.uiState.frozen = true;
    if (this.player?.body) this.player.setVelocity(0, 0);
  };

  onResetPositions = ({ players }) => {
    if (this._torndown) return;
    this.uiState.frozen = false;
    for (const p of players) {
      if (p.userId === this.selfId && this.player) {
        this.player.setPosition(p.x, p.y);
      } else {
        const t = this.otherTargets.get(p.userId);
        const o = this.otherSprites.get(p.userId);
        if (t) { t.x = p.x; t.y = p.y; }
        if (o) { o.spr.setPosition(p.x, p.y); }
      }
    }
  };

  onTaskProgress = ({ done, total }) => {
    if (this._torndown) return;
    this.uiState.taskDone = done;
    this.uiState.taskTotal = total;
  };

  onKilled = ({ targetUserId, x, y, bodyId, killedBy }) => {
    if (this._torndown) return;
    if (killedBy === this.selfId) {
      this.uiState.killReadyInMs = this.settings.killCooldown * 1000;
    }
    if (targetUserId === this.selfId) {
      this.deadSelf = true;
      this.uiState.alive = false;
      if (this.player) this.player.setAlpha(0.25);
    } else {
      const o = this.otherSprites.get(targetUserId);
      if (o) {
        o.alive = false;
        o.spr.setAlpha(0.25);
        o.label.setAlpha(0.4);
      }
    }
    if (this.settings.mode === "classic" && bodyId) {
      const body = this.add.ellipse(x, y, 30, 16, 0x8a1414, 1).setStrokeStyle(2, 0x000000);
      this.bodySprites.set(bodyId, { x, y, gfx: body });
    }
  };

  onRemoteState = (msg) => {
    if (msg.userId === this.selfId) return;
    const t = this.otherTargets.get(msg.userId);
    if (t) { t.x = msg.x; t.y = msg.y; }
  };

  nearestAliveTarget() {
    if (!this.player) return null;
    let best = null;
    let bestD = Infinity;
    for (const [userId, o] of this.otherSprites) {
      if (!o.alive) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, o.spr.x, o.spr.y);
      if (d < bestD) { bestD = d; best = { userId, name: o.meta.username, d }; }
    }
    return best;
  }

  nearestBody() {
    if (!this.player) return null;
    let best = null;
    let bestD = Infinity;
    for (const [id, b] of this.bodySprites) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = { id, d }; }
    }
    return best;
  }

  startTaskHold(taskId) {
    if (this.uiState.frozen || !this.uiState.alive || this.uiState.role !== "crew") return;
    this._activeTaskId = taskId;
  }

  attemptKill() {
    if (this.uiState.frozen || !this.uiState.alive || this.uiState.role !== "impostor") return;
    if (this.uiState.killReadyInMs > 0) return;
    const t = this.nearestAliveTarget();
    if (!t || t.d > KILL_RANGE) return;
    this.socket.emit("game:kill", t.userId);
  }

  reportNearestBody() {
    if (this.uiState.frozen || !this.uiState.alive) return;
    const b = this.nearestBody();
    if (!b || b.d > REPORT_RANGE) return;
    this.socket.emit("game:reportBody", b.id);
  }

  callEmergencyMeeting() {
    if (this.uiState.frozen || !this.uiState.alive || this.uiState.emergencyLeft <= 0) return;
    this.socket.emit("game:callMeeting");
    this.uiState.emergencyLeft -= 1;
  }

  update(_time, delta) {
    if (this.uiState.mode === "hideseek" && this.uiState.hideUntil) {
      this.uiState.hideCountdown = Math.max(0, this.uiState.hideUntil - Date.now());
    }
    if (this.uiState.killReadyInMs > 0) {
      this.uiState.killReadyInMs = Math.max(0, this.uiState.killReadyInMs - delta);
    }

    // proximity checks for UI prompts
    if (this.player) {
      let nearTaskId = null, nearTaskName = null;
      for (const t of this.taskList) {
        if (this.taskDoneIds.has(t.id)) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
        if (d < TASK_RANGE) { nearTaskId = t.id; nearTaskName = t.name; break; }
      }
      this.uiState.nearTaskId = nearTaskId;
      this.uiState.nearTaskName = nearTaskName;
      if (this._activeTaskId && this._activeTaskId !== nearTaskId) {
        this._activeTaskId = null;
        this._taskHoldMs = 0;
      }

      const body = this.nearestBody();
      this.uiState.nearBodyId = body && body.d <= REPORT_RANGE ? body.id : null;

      const kt = this.nearestAliveTarget();
      if (kt && kt.d <= KILL_RANGE) {
        this.uiState.killTargetId = kt.userId;
        this.uiState.killTargetName = kt.name;
      } else {
        this.uiState.killTargetId = null;
        this.uiState.killTargetName = null;
      }
    }

    // task hold (E key)
    if (this.keys.E.isDown && this.uiState.nearTaskId && !this.uiState.frozen && this.uiState.alive && this.uiState.role === "crew") {
      if (this._activeTaskId !== this.uiState.nearTaskId) {
        this._activeTaskId = this.uiState.nearTaskId;
        this._taskHoldMs = 0;
      }
      this._taskHoldMs += delta;
      this.uiState.taskHoldProgress = Math.min(1, this._taskHoldMs / TASK_HOLD_MS);
      if (this._taskHoldMs >= TASK_HOLD_MS) {
        this.taskDoneIds.add(this._activeTaskId);
        const spr = this.taskSprites.get(this._activeTaskId);
        if (spr) spr.setFillStyle(0x4caf50, 1);
        this.socket.emit("game:taskComplete", this._activeTaskId);
        this._activeTaskId = null;
        this._taskHoldMs = 0;
        this.uiState.taskHoldProgress = 0;
      }
    } else if (!this.keys.E.isDown) {
      this._activeTaskId = null;
      this._taskHoldMs = 0;
      this.uiState.taskHoldProgress = 0;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.attemptKill();
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.reportNearestBody();
    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) this.callEmergencyMeeting();

    if (this.player) {
      const canMove = !this.uiState.frozen && this.uiState.alive &&
        !(this.uiState.mode === "hideseek" && this.uiState.role === "impostor" && this.uiState.hideCountdown > 0);
      const speed = 220 * (this.settings.playerSpeed || 1);
      let vx = 0, vy = 0;
      if (canMove) {
        if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
        if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
        if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
        if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
      }
      const len = Math.hypot(vx, vy) || 1;
      this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
      this.nameLabel.setPosition(this.player.x, this.player.y - 40);

      this._sendTimer += delta;
      if (canMove && this._sendTimer > 1000 / SEND_HZ) {
        this._sendTimer = 0;
        this.socket.emit("game:move", { x: this.player.x, y: this.player.y, anim: len > 0.1 ? "walk" : "idle" });
      }
    }

    for (const [userId, { spr, label }] of this.otherSprites) {
      const t = this.otherTargets.get(userId);
      if (!t) continue;
      spr.x = Phaser.Math.Linear(spr.x, t.x, 0.25);
      spr.y = Phaser.Math.Linear(spr.y, t.y, 0.25);
      label.setPosition(spr.x, spr.y - 40);
    }

    this.updateHud();
  }

  updateHud() {
    if (!this.uiState.alive) {
      this.hudText.setText("Estás muerto — mirá en silencio");
      this.promptText.setVisible(false);
      return;
    }
    const lines = [];
    if (this.uiState.mode === "classic") {
      lines.push(`Tareas: ${this.uiState.taskDone}/${this.uiState.taskTotal}`);
      lines.push(`Reuniones de emergencia: ${this.uiState.emergencyLeft} (TAB)`);
      if (this.uiState.role === "impostor") {
        lines.push(this.uiState.killReadyInMs > 0
          ? `Matar listo en ${Math.ceil(this.uiState.killReadyInMs / 1000)}s`
          : "Matar listo (F)");
      }
    } else {
      if (this.uiState.role === "impostor" && this.uiState.hideCountdown > 0) {
        lines.push(`Esperando... ${Math.ceil(this.uiState.hideCountdown / 1000)}s`);
      } else if (this.uiState.role === "impostor") {
        lines.push("¡Buscá y atrapá! (F)");
      } else {
        lines.push("¡Escondete!");
      }
    }
    this.hudText.setText(lines.join("\n"));

    let prompt = null;
    if (this.uiState.nearTaskId && this.uiState.role === "crew") {
      const pct = Math.round(this.uiState.taskHoldProgress * 100);
      prompt = this.uiState.taskHoldProgress > 0 ? `Manteniendo E... ${pct}%` : `Mantené E: ${this.uiState.nearTaskName}`;
    } else if (this.uiState.nearBodyId) {
      prompt = "Presioná R para reportar el cuerpo";
    } else if (this.uiState.killTargetId && this.uiState.role === "impostor" && this.uiState.killReadyInMs <= 0) {
      prompt = `Presioná F para matar a ${this.uiState.killTargetName}`;
    }
    if (prompt && this.player) {
      this.promptText.setText(prompt).setVisible(true).setPosition(this.player.x, this.player.y - 60);
    } else {
      this.promptText.setVisible(false);
    }
  }
}
