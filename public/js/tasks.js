/* Minijuegos de tareas y paneles de sabotaje. Lienzo lógico de 500x500. */
(function () {
  'use strict';
  const rr = Draw.rr;
  const W = 500;
  let cur = null;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function txt(c, s, x, y, size, color, align, font) {
    c.font = `${font || 700} ${size}px Inter, system-ui, sans-serif`;
    c.fillStyle = color || '#fff'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }
  function bg(c, top, bottom) {
    const g = c.createLinearGradient(0, 0, 0, W);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, W);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    for (let i = 0; i < W; i += 25) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, W); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); }
  }
  function button(c, x, y, w, h, label, color, pressed) {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, x, y + 5, w, h, 14); c.fill();
    c.fillStyle = color || '#3a86ff'; rr(c, x, y + (pressed ? 4 : 0), w, h, 14); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.stroke();
    txt(c, label, x + w / 2, y + h / 2 + (pressed ? 4 : 0), 20, '#fff');
  }
  const inBox = (x, y, bx, by, bw, bh) => x >= bx && x <= bx + bw && y >= by && y <= by + bh;

  // ================================================================ juegos
  const GAMES = {};

  GAMES.wires = () => {
    const cols = shuffle(['#ff3b30', '#0a84ff', '#ffd60a', '#ff2dff']);
    const right = shuffle(cols.slice());
    const ys = [110, 200, 290, 380];
    const conn = {};
    let drag = null;
    return {
      draw(c) {
        bg(c, '#2d323d', '#1c2027');
        for (const side of [0, 1]) { c.fillStyle = '#4a5160'; c.fillRect(side ? 450 : 0, 40, 50, 420); c.strokeStyle = '#111'; c.lineWidth = 3; c.strokeRect(side ? 450 : 0, 40, 50, 420); }
        ys.forEach((y, i) => {
          c.fillStyle = cols[i]; c.fillRect(0, y - 14, 60, 28);
          c.fillStyle = '#ffd54f'; rr(c, 56, y - 12, 18, 24, 4); c.fill();
          c.fillStyle = right[i]; c.fillRect(440, y - 14, 60, 28);
          c.fillStyle = '#ffd54f'; rr(c, 426, y - 12, 18, 24, 4); c.fill();
          c.fillStyle = conn[i] !== undefined ? '#34c759' : '#3a3a3a'; c.beginPath(); c.arc(20, y - 30, 6, 0, 7); c.fill();
        });
        c.lineCap = 'round';
        for (const i in conn) {
          const j = conn[i];
          c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 22; c.beginPath(); c.moveTo(70, ys[i] + 3); c.bezierCurveTo(250, ys[i], 250, ys[j], 430, ys[j] + 3); c.stroke();
          c.strokeStyle = cols[i]; c.lineWidth = 18; c.beginPath(); c.moveTo(70, ys[i]); c.bezierCurveTo(250, ys[i], 250, ys[j], 430, ys[j]); c.stroke();
        }
        if (drag) {
          c.strokeStyle = cols[drag.i]; c.lineWidth = 18;
          c.beginPath(); c.moveTo(70, ys[drag.i]); c.lineTo(drag.x, drag.y); c.stroke();
          c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(drag.x, drag.y, 12, 0, 7); c.fill();
        }
        c.lineCap = 'butt';
      },
      down(x, y) {
        ys.forEach((yy, i) => { if (conn[i] === undefined && Math.abs(y - yy) < 30 && x < 110) drag = { i, x, y }; });
      },
      move(x, y) { if (drag) { drag.x = x; drag.y = y; } },
      up(x, y) {
        if (!drag) return;
        const i = drag.i;
        drag = null;
        ys.forEach((yy, j) => {
          if (Math.abs(y - yy) < 34 && x > 380 && right[j] === cols[i] && !Object.values(conn).includes(j)) {
            conn[i] = j; Sfx.zap();
          }
        });
        if (Object.keys(conn).length === 4) this.finish();
      },
    };
  };

  GAMES.card = () => {
    let st = 'wallet', cx = 70, t0 = 0, msg = 'INSERTA LA TARJETA', msgCol = '#9aff9a', anim = 0, dragging = false;
    return {
      draw(c, t, dt) {
        bg(c, '#50606f', '#2c3540');
        c.fillStyle = '#1b2a1b'; rr(c, 60, 40, 380, 60, 8); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
        txt(c, msg, 250, 70, 20, msgCol, 'center', 800);
        c.fillStyle = '#22262d'; rr(c, 30, 150, 440, 70, 10); c.fill();
        c.fillStyle = '#0b0d10'; c.fillRect(30, 195, 440, 12);
        c.fillStyle = st === 'wallet' ? '#333' : '#34c759'; c.beginPath(); c.arc(455, 170, 7, 0, 7); c.fill();
        // cartera
        c.fillStyle = '#6d4c33'; rr(c, 90, 300, 320, 180, 18); c.fill(); c.strokeStyle = '#000'; c.stroke();
        let cardX, cardY;
        if (st === 'wallet') { cardX = 150; cardY = 280; }
        else if (st === 'moving') { anim = Math.min(1, anim + dt * 3); cardX = 150 + (cx - 150) * anim; cardY = 280 + (150 - 280) * anim; if (anim >= 1) st = 'ready'; }
        else { cardX = cx; cardY = 150; }
        c.fillStyle = '#e8f1ff'; rr(c, cardX - 70 + 70, cardY, 200, 110, 10); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#5f7fbf'; c.fillRect(cardX + 10, cardY + 14, 180, 18);
        c.fillStyle = '#c51111'; rr(c, cardX + 18, cardY + 44, 44, 50, 8); c.fill();
        txt(c, 'TRIPULANTE', cardX + 125, cardY + 60, 14, '#223', 'center');
        txt(c, 'TEMU AIRLINES', cardX + 125, cardY + 82, 11, '#556', 'center');
        c.fillStyle = '#7a5537'; rr(c, 90, 360, 320, 120, 18); c.fill();
        if (st === 'wallet') txt(c, 'Toca la tarjeta', 250, 420, 18, '#f3e2cf');
        if (st === 'ready' && !dragging) txt(c, 'Desliza → a velocidad constante', 250, 420, 17, '#f3e2cf');
      },
      down(x, y) {
        if (st === 'wallet' && inBox(x, y, 90, 270, 320, 200)) { st = 'moving'; anim = 0; cx = 0; Sfx.swipe(); msg = 'DESLIZA LA TARJETA'; msgCol = '#9aff9a'; }
        else if (st === 'ready' && inBox(x, y, cx - 20, 130, 240, 140)) { dragging = true; t0 = performance.now(); this.off = x - cx; }
      },
      move(x) {
        if (!dragging) return;
        cx = Math.max(0, Math.min(300, x - this.off));
        if (cx >= 299) {
          dragging = false;
          const d = (performance.now() - t0) / 1000;
          if (d < 0.5) { msg = 'DEMASIADO RÁPIDO.'; msgCol = '#ff6b6b'; Sfx.error(); }
          else if (d > 1.7) { msg = 'DEMASIADO LENTO.'; msgCol = '#ff6b6b'; Sfx.error(); }
          else { msg = 'ACEPTADO. GRACIAS.'; msgCol = '#9aff9a'; Sfx.success(); this.finish(); return; }
          cx = 0;
        }
      },
      up() {
        if (dragging) { dragging = false; if (cx < 299) { msg = 'MALA LECTURA. INTÉNTALO DE NUEVO.'; msgCol = '#ff6b6b'; Sfx.error(); } cx = 0; }
      },
    };
  };

  GAMES.garbage = () => {
    let lever = 0, held = false, prog = 0, lastR = 0;
    const junk = []; for (let i = 0; i < 26; i++) junk.push({ x: rnd(100, 330), y: rnd(120, 420), r: rnd(8, 18), c: ['#8d6e63', '#aed581', '#90a4ae', '#ffb74d', '#e57373', '#fff59d'][i % 6], vy: 0, rot: rnd(0, 6) });
    return {
      draw(c, t, dt) {
        bg(c, '#4b5260', '#2a2f39');
        c.fillStyle = '#1d2027'; rr(c, 80, 60, 280, 400, 12); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 4; c.stroke();
        const open = lever > 0.9 && held;
        if (open) { prog = Math.min(1, prog + dt / 2.4); if (t - lastR > 0.25) { Sfx.rumble(); lastR = t; } }
        c.fillStyle = open ? '#000' : '#5a616e'; c.fillRect(90, 440, 260, 16);
        for (const j of junk) {
          if (open) { j.vy += 900 * dt; j.y += j.vy * dt; }
          if (j.y > 470) continue;
          c.save(); c.translate(j.x, Math.min(j.y, 440 - j.r)); c.rotate(j.rot);
          c.fillStyle = j.c; rr(c, -j.r, -j.r * 0.7, j.r * 2, j.r * 1.4, 4); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.stroke();
          c.restore();
        }
        if (!held) lever = Math.max(0, lever - dt * 4);
        // palanca
        c.fillStyle = '#2c313a'; rr(c, 410, 100, 30, 320, 14); c.fill();
        const hy = 120 + lever * 260;
        c.strokeStyle = '#888'; c.lineWidth = 10; c.beginPath(); c.moveTo(425, 110); c.lineTo(425, hy); c.stroke();
        c.fillStyle = '#e53935'; c.beginPath(); c.arc(425, hy, 26, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#34c759'; c.fillRect(80, 30, 280 * prog, 12); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(80, 30, 280, 12);
        if (prog >= 1 && !this.done) this.finish();
      },
      down(x, y) { const hy = 120 + lever * 260; if (Math.hypot(x - 425, y - hy) < 45) { held = true; this.y0 = y - lever * 260; } },
      move(x, y) { if (held) lever = Math.max(0, Math.min(1, (y - this.y0) / 260)); },
      up() { held = false; },
    };
  };

  GAMES.asteroids = () => {
    const rocks = []; let spawn = 0, hits = 0, shots = [], booms = [], cross = { x: 250, y: 250 };
    const GOAL = 12;
    return {
      draw(c, t, dt) {
        c.fillStyle = '#020611'; c.fillRect(0, 0, W, W);
        for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect((i * 97 + t * 20) % W, (i * 53) % W, 2, 2); }
        spawn -= dt;
        if (spawn <= 0) { spawn = 0.55; rocks.push({ x: 540, y: rnd(40, 460), vx: -rnd(90, 170), vy: rnd(-40, 40), r: rnd(20, 34), rot: 0, vr: rnd(-2, 2) }); }
        for (const r of rocks) {
          r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
          c.save(); c.translate(r.x, r.y); c.rotate(r.rot);
          c.fillStyle = '#8d8175'; c.beginPath();
          for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const rad = r.r * (0.8 + ((k * 37) % 10) / 40); c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
          c.closePath(); c.fill(); c.strokeStyle = '#3e3731'; c.lineWidth = 3; c.stroke();
          c.fillStyle = '#6d635a'; c.beginPath(); c.arc(r.r * 0.2, -r.r * 0.2, r.r * 0.25, 0, 7); c.fill();
          c.restore();
        }
        for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x < -60) rocks.splice(i, 1);
        shots = shots.filter(s => t - s.t < 0.12);
        for (const s of shots) { c.strokeStyle = '#6cf'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, W); c.lineTo(s.x, s.y); c.moveTo(W, W); c.lineTo(s.x, s.y); c.stroke(); }
        booms = booms.filter(b => t - b.t < 0.5);
        for (const b of booms) { const k = (t - b.t) / 0.5; c.fillStyle = `rgba(255,${180 - k * 150},60,${1 - k})`; c.beginPath(); c.arc(b.x, b.y, 10 + k * 40, 0, 7); c.fill(); }
        c.strokeStyle = '#34c759'; c.lineWidth = 2; c.beginPath(); c.arc(cross.x, cross.y, 22, 0, 7); c.moveTo(cross.x - 32, cross.y); c.lineTo(cross.x + 32, cross.y); c.moveTo(cross.x, cross.y - 32); c.lineTo(cross.x, cross.y + 32); c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.5)'; rr(c, 150, 12, 200, 36, 10); c.fill();
        txt(c, `Destruidos: ${hits}/${GOAL}`, 250, 30, 18, '#9aff9a');
      },
      down(x, y) {
        cross = { x, y };
        shots.push({ x, y, t: performance.now() / 1000 }); Sfx.laser();
        for (let i = rocks.length - 1; i >= 0; i--) {
          const r = rocks[i];
          if (Math.hypot(r.x - x, r.y - y) < r.r + 10) {
            rocks.splice(i, 1); hits++; booms.push({ x: r.x, y: r.y, t: performance.now() / 1000 }); Sfx.boom();
            if (hits >= GOAL) this.finish();
            break;
          }
        }
      },
      move(x, y) { cross = { x, y }; },
    };
  };

  GAMES.filter = () => {
    const leaves = []; for (let i = 0; i < 6; i++) leaves.push({ x: rnd(200, 440), y: rnd(80, 420), a: rnd(0, 6), gone: 0 });
    let drag = null;
    return {
      draw(c, t, dt) {
        bg(c, '#3a5244', '#1f2e26');
        c.fillStyle = '#111'; rr(c, 10, 100, 70, 300, 10); c.fill();
        c.strokeStyle = '#4c5b52'; c.lineWidth = 4; for (let y = 115; y < 395; y += 16) { c.beginPath(); c.moveTo(18, y); c.lineTo(72, y); c.stroke(); }
        txt(c, '◀ Arrastra las hojas', 280, 30, 18, '#c8facc');
        for (const l of leaves) {
          if (l.gone >= 1) continue;
          if (l.gone > 0) { l.gone += dt * 3; l.x -= dt * 400; }
          else if (l !== drag) { l.x += Math.sin(t * 2 + l.a) * 0.3; l.y += Math.cos(t * 1.7 + l.a) * 0.3; }
          c.save(); c.translate(l.x, l.y); c.rotate(l.a + Math.sin(t + l.a) * 0.2); c.scale(1 - l.gone * 0.8, 1 - l.gone * 0.8);
          c.fillStyle = '#6aa84f'; c.beginPath(); c.ellipse(0, 0, 36, 18, 0, 0, 7); c.fill(); c.strokeStyle = '#274e13'; c.lineWidth = 3; c.stroke();
          c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, 0); c.stroke();
          c.restore();
        }
      },
      down(x, y) { drag = leaves.find(l => !l.gone && Math.hypot(l.x - x, l.y - y) < 40) || null; },
      move(x, y) {
        if (!drag) return;
        drag.x = x; drag.y = y;
        if (x < 90) { drag.gone = 0.01; drag = null; Sfx.suck(); if (leaves.every(l => l.gone)) setTimeout(() => this.finish(), 300); }
      },
      up() { drag = null; },
    };
  };

  GAMES.steering = () => {
    const a = rnd(0, 6.28), d = rnd(110, 180);
    const p = { x: 250 + Math.cos(a) * d, y: 250 + Math.sin(a) * d };
    let drag = false;
    return {
      draw(c) {
        c.fillStyle = '#04121f'; c.fillRect(0, 0, W, W);
        c.strokeStyle = '#1f6f8b'; c.lineWidth = 2;
        for (let r = 50; r <= 220; r += 50) { c.beginPath(); c.arc(250, 250, r, 0, 7); c.stroke(); }
        c.beginPath(); c.moveTo(30, 250); c.lineTo(470, 250); c.moveTo(250, 30); c.lineTo(250, 470); c.stroke();
        c.fillStyle = 'rgba(79,195,247,0.2)'; c.beginPath(); c.arc(250, 250, 20, 0, 7); c.fill();
        c.strokeStyle = '#ffd60a'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y, 28, 0, 7); c.moveTo(p.x - 42, p.y); c.lineTo(p.x + 42, p.y); c.moveTo(p.x, p.y - 42); c.lineTo(p.x, p.y + 42); c.stroke();
        txt(c, 'Centra la mira', 250, 485, 16, '#8fd8ff');
      },
      down(x, y) { if (Math.hypot(x - p.x, y - p.y) < 50) drag = true; },
      move(x, y) { if (drag) { p.x = x; p.y = y; } },
      up() { if (!drag) return; drag = false; if (Math.hypot(p.x - 250, p.y - 250) < 20) { p.x = 250; p.y = 250; this.finish(); } },
    };
  };

  GAMES.shields = () => {
    const pos = [[250, 250]]; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; pos.push([250 + Math.cos(a) * 125, 250 + Math.sin(a) * 125]); }
    const red = pos.map(() => false);
    shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3 + Math.floor(Math.random() * 3)).forEach(i => { red[i] = true; });
    return {
      draw(c, t) {
        bg(c, '#26313f', '#141a22');
        pos.forEach((p, i) => {
          c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(p[0] + Math.cos(a) * 66, p[1] + Math.sin(a) * 66); } c.closePath();
          c.fillStyle = red[i] ? '#ff453a' : (this.done ? `rgba(120,220,255,${0.6 + 0.4 * Math.sin(t * 8)})` : '#e8f4ff');
          c.fill(); c.strokeStyle = '#0c1118'; c.lineWidth = 5; c.stroke();
        });
      },
      down(x, y) {
        pos.forEach((p, i) => { if (Math.hypot(x - p[0], y - p[1]) < 58) { red[i] = !red[i]; Sfx.switch(); } });
        if (red.every(r => !r)) this.finish();
      },
    };
  };

  GAMES.manifolds = () => {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    let next = 1, flash = 0;
    const bx = i => 30 + (i % 5) * 90, by = i => 150 + Math.floor(i / 5) * 110;
    return {
      draw(c, t, dt) {
        bg(c, '#303a55', '#1a2033');
        txt(c, 'Pulsa del 1 al 10 en orden', 250, 70, 20, '#bcd0ff');
        flash = Math.max(0, flash - dt);
        nums.forEach((n, i) => {
          const lit = n < next;
          c.fillStyle = flash > 0 ? '#ff453a' : lit ? '#0a84ff' : '#dfe6f3';
          rr(c, bx(i), by(i), 80, 90, 10); c.fill(); c.strokeStyle = '#0b0f1a'; c.lineWidth = 3; c.stroke();
          txt(c, String(n), bx(i) + 40, by(i) + 45, 34, lit || flash > 0 ? '#fff' : '#1a2033');
        });
      },
      down(x, y) {
        nums.forEach((n, i) => {
          if (!inBox(x, y, bx(i), by(i), 80, 90)) return;
          if (n === next) { next++; Sfx.beep(600 + n * 60); if (next > 10) this.finish(); }
          else if (n >= next) { next = 1; flash = 0.5; Sfx.wrong(); }
        });
      },
    };
  };

  GAMES.calibrate = () => {
    const speeds = [2.2, 3.1, 4.0];
    const ang = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    let row = 0; const locked = [false, false, false]; let flash = 0;
    const colors = ['#ffd60a', '#0a84ff', '#30d158'];
    return {
      draw(c, t, dt) {
        bg(c, '#3d3f48', '#1f2026');
        flash = Math.max(0, flash - dt);
        for (let i = 0; i < 3; i++) {
          const y = 95 + i * 150;
          if (!locked[i]) ang[i] += speeds[i] * dt;
          c.fillStyle = '#15161b'; c.beginPath(); c.arc(130, y, 58, 0, 7); c.fill();
          c.fillStyle = colors[i] + '55'; c.beginPath(); c.moveTo(130, y); c.arc(130, y, 58, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35); c.closePath(); c.fill();
          c.strokeStyle = colors[i]; c.lineWidth = 6; c.beginPath(); c.moveTo(130, y); c.lineTo(130 + Math.cos(ang[i]) * 52, y + Math.sin(ang[i]) * 52); c.stroke();
          c.fillStyle = locked[i] ? colors[i] : '#555'; c.fillRect(215, y - 8, 120 * (locked[i] ? 1 : 0.3 + 0.2 * Math.sin(t * 5 + i)), 16);
          button(c, 350, y - 32, 130, 64, locked[i] ? 'OK' : 'CALIBRAR', flash > 0 ? '#ff453a' : (i === row ? '#0a84ff' : '#555'));
        }
      },
      down(x, y) {
        for (let i = 0; i < 3; i++) {
          const by = 95 + i * 150;
          if (!inBox(x, y, 350, by - 32, 130, 64) || i !== row) continue;
          const a = ((ang[i] + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (a < 0.4 || a > Math.PI * 2 - 0.4) { locked[i] = true; row++; Sfx.beep(900 + i * 200); if (row === 3) this.finish(); }
          else { row = 0; locked.fill(false); flash = 0.4; Sfx.wrong(); }
        }
      },
    };
  };

  GAMES.align = () => {
    let hy = Math.random() < 0.5 ? rnd(70, 180) : rnd(320, 430), drag = false;
    return {
      draw(c, t) {
        bg(c, '#2e3a42', '#172026');
        c.strokeStyle = '#6c7a86'; c.lineWidth = 16; c.beginPath(); c.arc(-260, 250, 420, -0.55, 0.55); c.stroke();
        c.strokeStyle = '#30d158'; c.setLineDash([12, 10]); c.lineWidth = 3; c.beginPath(); c.moveTo(150, 250); c.lineTo(480, 250); c.stroke(); c.setLineDash([]);
        const off = (hy - 250);
        c.strokeStyle = Math.abs(off) < 14 ? '#30d158' : '#ffb340'; c.lineWidth = 5; c.beginPath();
        for (let x = 150; x <= 480; x += 5) c.lineTo(x, 250 + off * (x - 150) / 330 + Math.sin(x * 0.08 + t * 10) * 4);
        c.stroke();
        c.fillStyle = '#dfe6ee'; rr(c, 120, hy - 26, 70, 52, 10); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
        txt(c, '⇕', 155, hy, 26, '#333');
        txt(c, 'Alinea la salida del motor', 300, 470, 17, '#b8e0c4');
      },
      down(x, y) { if (inBox(x, y, 100, hy - 40, 110, 80)) drag = true; },
      move(x, y) { if (drag) hy = Math.max(60, Math.min(440, y)); },
      up() { if (!drag) return; drag = false; if (Math.abs(hy - 250) < 14) { hy = 250; this.finish(); } },
    };
  };

  function transfer(up) {
    return () => {
      let started = false, prog = 0, files = [];
      const dur = 7.5;
      return {
        draw(c, t, dt) {
          bg(c, '#2c3e50', '#1b2631');
          const fx = (x, y, open) => {
            c.fillStyle = '#ffca28'; rr(c, x, y, 110, 80, 8); c.fill(); c.strokeStyle = '#6d4c00'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#ffb300'; rr(c, x, y - 12, 50, 20, 6); c.fill(); c.stroke();
            if (open) { c.fillStyle = '#ffe082'; c.fillRect(x + 6, y + 10, 98, 6); }
          };
          fx(40, 120, started);
          if (up) { c.fillStyle = '#e3f2fd'; c.beginPath(); c.arc(390, 150, 36, 0, 7); c.arc(430, 160, 30, 0, 7); c.arc(360, 170, 26, 0, 7); c.fill(); }
          else fx(350, 120, started);
          if (started && prog < 1) {
            prog = Math.min(1, prog + dt / dur);
            if (Math.random() < dt * 6) files.push({ k: 0 });
            if (Math.random() < dt * 3) Sfx.beep(1500 + Math.random() * 500);
          }
          files = files.filter(f => (f.k += dt * 1.2) < 1);
          for (const f of files) { const x = 150 + f.k * 210, y = 150 - Math.sin(f.k * Math.PI) * 70; c.fillStyle = '#fff'; c.fillRect(x - 10, y - 13, 20, 26); c.strokeStyle = '#555'; c.lineWidth = 1.5; c.strokeRect(x - 10, y - 13, 20, 26); }
          c.fillStyle = '#0f1a24'; rr(c, 40, 290, 420, 36, 10); c.fill();
          c.fillStyle = '#30d158'; rr(c, 44, 294, 412 * prog, 28, 8); c.fill();
          txt(c, started ? (prog >= 1 ? '¡Completado!' : `Tiempo estimado: ${Math.ceil((1 - prog) * dur)} s`) : (up ? 'Sube los datos a la nube' : 'Descarga los datos'), 250, 360, 18, '#cfe8ff');
          if (!started) button(c, 150, 400, 200, 64, up ? 'SUBIR' : 'DESCARGAR', '#0a84ff');
          if (prog >= 1 && !this.done) this.finish();
        },
        down(x, y) { if (!started && inBox(x, y, 150, 400, 200, 64)) { started = true; Sfx.click(); } },
      };
    };
  }
  GAMES.download = transfer(false);
  GAMES.upload = transfer(true);

  GAMES.scan = (spec, hooks) => {
    let prog = 0;
    const me = hooks.me || { name: '???', color: 'red' };
    const cname = (Shared.COLORS.find(c => c.id === me.color) || {}).name || '';
    const lines = [`ID: ${me.name.toUpperCase()}`, `ALTURA: 3' 6"`, `PESO: ${80 + Math.floor(Math.random() * 30)} lb`, `COLOR: ${cname.toUpperCase()}`, `SANGRE: ${['O-', 'A+', 'B-', 'AB+'][Math.floor(Math.random() * 4)]}`];
    hooks.send({ t: 'scan', on: true });
    Sfx.scanHum();
    let hum = 0;
    return {
      onClose() { hooks.send({ t: 'scan', on: false }); },
      draw(c, t, dt) {
        c.fillStyle = '#0b1d26'; c.fillRect(0, 0, W, W);
        prog = Math.min(1, prog + dt / 9);
        hum += dt; if (hum > 1.4) { hum = 0; Sfx.scanHum(); }
        Draw.bean(c, 140, 360, { color: me.color, hat: me.hat, scale: 2.4, visorGlow: 'rgba(80,255,120,0.15)' });
        c.fillStyle = 'rgba(48,209,88,0.25)'; c.fillRect(40, 60 + ((t * 160) % 320), 200, 8);
        c.strokeStyle = '#30d158'; c.lineWidth = 2; c.strokeRect(30, 40, 220, 360);
        lines.forEach((l, i) => { if (prog > (i + 1) / 6) txt(c, l, 270, 90 + i * 45, 18, '#7dffa6', 'left', 700); });
        c.fillStyle = '#132a36'; rr(c, 40, 430, 420, 30, 8); c.fill();
        c.fillStyle = '#30d158'; rr(c, 44, 434, 412 * prog, 22, 6); c.fill();
        txt(c, prog < 1 ? 'Escaneando… no te muevas' : 'Escaneo completo', 250, 480, 15, '#9ae6b4');
        if (prog >= 1 && !this.done) this.finish();
      },
    };
  };

  GAMES.course = () => {
    const pts = []; for (let i = 0; i < 5; i++) pts.push({ x: 60 + i * 95, y: i === 0 ? 250 : rnd(110, 390) });
    let reached = 0, ship = { x: pts[0].x, y: pts[0].y }, drag = false;
    return {
      draw(c, t) {
        c.fillStyle = '#0a1230'; c.fillRect(0, 0, W, W);
        for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect((i * 131) % W, (i * 71) % W, 2, 2); }
        c.fillStyle = '#e57373'; c.beginPath(); c.arc(430, 90, 30, 0, 7); c.fill();
        c.fillStyle = '#81c784'; c.beginPath(); c.arc(90, 420, 22, 0, 7); c.fill();
        c.setLineDash([10, 8]); c.strokeStyle = '#8ab4ff'; c.lineWidth = 3; c.beginPath(); pts.forEach(p => c.lineTo(p.x, p.y)); c.stroke(); c.setLineDash([]);
        pts.forEach((p, i) => { c.fillStyle = i <= reached ? '#30d158' : '#ffd60a'; c.beginPath(); c.arc(p.x, p.y, 12, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke(); });
        c.save(); c.translate(ship.x, ship.y);
        const nx = pts[Math.min(4, reached + 1)]; c.rotate(Math.atan2(nx.y - ship.y, nx.x - ship.x));
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(24, 0); c.lineTo(-16, -14); c.lineTo(-8, 0); c.lineTo(-16, 14); c.closePath(); c.fill(); c.strokeStyle = '#333'; c.stroke();
        c.restore();
        txt(c, 'Arrastra la nave por la ruta', 250, 480, 16, '#bcd0ff');
      },
      down(x, y) { if (Math.hypot(x - ship.x, y - ship.y) < 40) drag = true; },
      move(x, y) {
        if (!drag || reached >= 4) return;
        const a = pts[reached], b = pts[reached + 1];
        const abx = b.x - a.x, aby = b.y - a.y;
        const k = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby)));
        const px = a.x + abx * k, py = a.y + aby * k;
        if (Math.hypot(x - px, y - py) > 45) { drag = false; ship = { x: a.x, y: a.y }; Sfx.wrong(); return; }
        ship = { x: px, y: py };
        if (k > 0.97) { reached++; ship = { x: b.x, y: b.y }; Sfx.beep(700 + reached * 150); if (reached >= 4) this.finish(); }
      },
      up() { drag = false; },
    };
  };

  GAMES.fuel = (spec) => {
    let level = 0, held = false, tk = 0;
    return {
      draw(c, t, dt) {
        bg(c, '#3e3a36', '#221f1c');
        if (held && level < 1) { level = Math.min(1, level + dt / 3); tk += dt; if (tk > 0.12) { tk = 0; Sfx.fill(level); } }
        c.fillStyle = '#1a1a1a'; rr(c, 150, 60, 200, 300, 16); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 4; c.stroke();
        const g = c.createLinearGradient(0, 360, 0, 60); g.addColorStop(0, '#ff9f0a'); g.addColorStop(1, '#ffd60a');
        c.fillStyle = g; rr(c, 158, 352 - 284 * level, 184, 284 * level, 10); c.fill();
        for (let i = 1; i < 5; i++) { c.fillStyle = '#555'; c.fillRect(330, 60 + i * 60, 20, 3); }
        txt(c, spec.fill ? 'Llena el bidón' : 'Carga el motor', 250, 30, 20, '#ffe08a');
        button(c, 150, 390, 200, 70, level >= 1 ? '¡LLENO!' : 'MANTENER', level >= 1 ? '#30d158' : '#ff9f0a', held);
        if (level >= 1 && !this.done) this.finish();
      },
      down(x, y) { if (inBox(x, y, 150, 390, 200, 70)) held = true; },
      up() { held = false; },
    };
  };

  GAMES.simon = () => {
    const seq = []; for (let i = 0; i < 5; i++) seq.push(Math.floor(Math.random() * 9));
    let round = 1, showing = true, showT = -0.6, input = 0, lit = -1, litT = 0, pressed = -1, pressT = 0, err = 0;
    const cell = (i, ox) => [ox + (i % 3) * 70, 150 + Math.floor(i / 3) * 70];
    return {
      draw(c, t, dt) {
        bg(c, '#2a2f45', '#141727');
        for (let r = 0; r < 5; r++) { c.fillStyle = r < round - 1 ? '#30d158' : r === round - 1 ? '#ffd60a' : '#444'; c.beginPath(); c.arc(170 + r * 40, 80, 11, 0, 7); c.fill(); }
        err = Math.max(0, err - dt);
        if (showing) {
          showT += dt;
          const idx = Math.floor(showT / 0.6);
          if (showT >= 0 && idx < round) { const want = seq[idx]; if (lit !== want || Math.floor((showT - dt) / 0.6) !== idx) { lit = want; Sfx.simon(want); } litT = showT - idx * 0.6; }
          else if (idx >= round) { showing = false; lit = -1; input = 0; }
        }
        for (let i = 0; i < 9; i++) {
          const [x, y] = cell(i, 30);
          c.fillStyle = err > 0 ? '#ff453a' : (showing && lit === i && litT < 0.45) ? '#64d2ff' : '#11151f';
          rr(c, x, y, 62, 62, 8); c.fill();
          const [x2, y2] = cell(i, 262);
          c.fillStyle = pressed === i && t - pressT < 0.2 ? '#64d2ff' : '#d7dce6';
          rr(c, x2, y2, 62, 62, 8); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
        }
        txt(c, showing ? 'Observa…' : 'Repite la secuencia', 250, 400, 18, '#bcd0ff');
      },
      down(x, y) {
        if (showing) return;
        for (let i = 0; i < 9; i++) {
          const [x2, y2] = cell(i, 262);
          if (!inBox(x, y, x2, y2, 62, 62)) continue;
          pressed = i; pressT = performance.now() / 1000;
          Sfx.simon(i);
          if (seq[input] === i) {
            input++;
            if (input >= round) {
              if (round >= 5) return this.finish();
              round++; showing = true; showT = -0.7;
            }
          } else { err = 0.6; Sfx.wrong(); round = 1; showing = true; showT = -1; }
        }
      },
    };
  };

  // ================================================================ sabotajes
  GAMES.lights = (spec, hooks) => {
    let sw = (spec.sab && spec.sab.switches) ? spec.sab.switches.slice() : [true, true, true, true, true];
    return {
      onSab(s) { if (s && s.switches) sw = s.switches.slice(); },
      draw(c) {
        bg(c, '#4a4636', '#24221a');
        c.fillStyle = '#1e1e1e'; rr(c, 40, 60, 420, 380, 16); c.fill();
        txt(c, 'Enciende todos los interruptores', 250, 30, 18, '#ffe08a');
        sw.forEach((on, i) => {
          const x = 70 + i * 75;
          c.fillStyle = on ? '#30d158' : '#3a3a3a'; c.beginPath(); c.arc(x + 25, 110, 14, 0, 7); c.fill();
          if (on) { c.save(); c.shadowColor = '#30d158'; c.shadowBlur = 20; c.fill(); c.restore(); }
          c.fillStyle = '#555'; rr(c, x, 170, 50, 220, 10); c.fill();
          c.fillStyle = '#ddd'; rr(c, x + 5, on ? 180 : 290, 40, 90, 8); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
        });
      },
      down(x, y) {
        sw.forEach((on, i) => {
          const bx = 70 + i * 75;
          if (inBox(x, y, bx, 160, 50, 240)) { sw[i] = !sw[i]; Sfx.switch(); hooks.send({ t: 'fix', kind: 'lights', idx: i }); }
        });
      },
    };
  };

  GAMES.hand = (spec, hooks) => {
    let holding = false, sab = spec.sab || {};
    const idx = spec.idx;
    let hum = 0;
    return {
      onSab(s) { if (s) sab = s; },
      onClose() { if (holding) hooks.send({ t: 'fix', kind: 'reactor', idx, val: false }); },
      draw(c, t, dt) {
        bg(c, '#3a1c1c', '#1a0c0c');
        const other = sab.holds && sab.holds[1 - idx];
        txt(c, holding ? (other ? '¡Estabilizando!' : 'Esperando al otro escáner…') : 'Mantén la mano en el escáner', 250, 50, 20, holding ? '#64d2ff' : '#ffb3b3');
        c.fillStyle = holding ? '#0f3942' : '#222'; rr(c, 110, 100, 280, 320, 30); c.fill();
        c.save(); c.shadowColor = '#64d2ff'; c.shadowBlur = holding ? 30 : 0;
        c.strokeStyle = holding ? '#64d2ff' : '#555'; c.lineWidth = 4; rr(c, 110, 100, 280, 320, 30); c.stroke(); c.restore();
        c.font = '170px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = holding ? 1 : 0.4; c.fillText('✋', 250, 265); c.globalAlpha = 1;
        if (holding) { c.fillStyle = 'rgba(100,210,255,0.35)'; c.fillRect(115, 110 + ((t * 250) % 300), 270, 6); hum += dt; if (hum > 0.5) { hum = 0; Sfx.hand(); } }
        txt(c, other ? 'Otro tripulante está en el otro escáner' : 'Se necesitan 2 personas a la vez', 250, 460, 15, '#ffd0d0');
      },
      down(x, y) { if (inBox(x, y, 110, 100, 280, 320)) { holding = true; Sfx.hand(); hooks.send({ t: 'fix', kind: 'reactor', idx, val: true }); } },
      up() { if (holding) { holding = false; hooks.send({ t: 'fix', kind: 'reactor', idx, val: false }); } },
    };
  };

  GAMES.keypad = (spec, hooks) => {
    let sab = spec.sab || {}, entry = '', flash = 0, flashCol = '#ff453a';
    const idx = spec.idx;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✕', '0', '✓'];
    const kx = i => 250 + (i % 3) * 78, ky = i => 150 + Math.floor(i / 3) * 78;
    return {
      onSab(s) { if (s) sab = s; },
      draw(c, t, dt) {
        bg(c, '#2d3a33', '#16201b');
        flash = Math.max(0, flash - dt);
        // nota con el código
        c.save(); c.translate(120, 230); c.rotate(-0.08);
        c.fillStyle = '#fff59d'; c.fillRect(-90, -80, 180, 170);
        c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(-90, -80, 180, 18);
        txt(c, 'código de hoy', 0, -40, 15, '#6d5f00', 'center', 600);
        txt(c, sab.code || '-----', 0, 10, 36, '#3b2f00', 'center', 800);
        c.restore();
        c.fillStyle = flash > 0 ? flashCol : '#0d1511'; rr(c, 250, 70, 228, 60, 10); c.fill();
        txt(c, (sab.done && sab.done[idx]) ? 'CORRECTO' : entry.padEnd(5, '•'), 364, 100, 30, '#9aff9a', 'center', 800);
        keys.forEach((k, i) => {
          c.fillStyle = k === '✓' ? '#30d158' : k === '✕' ? '#ff453a' : '#e5e9ef';
          rr(c, kx(i), ky(i), 70, 70, 12); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
          txt(c, k, kx(i) + 35, ky(i) + 36, 26, k === '✓' || k === '✕' ? '#fff' : '#222');
        });
      },
      down(x, y) {
        keys.forEach((k, i) => {
          if (!inBox(x, y, kx(i), ky(i), 70, 70)) return;
          Sfx.beep(900 + i * 40);
          if (k === '✕') entry = '';
          else if (k === '✓') {
            if (entry === sab.code) { hooks.send({ t: 'fix', kind: 'o2', idx, val: entry }); flash = 0.6; flashCol = '#30d158'; Sfx.success(); }
            else { flash = 0.5; flashCol = '#ff453a'; Sfx.wrong(); }
            entry = '';
          } else if (entry.length < 5) entry += k;
        });
      },
    };
  };

  GAMES.emergency = (spec, hooks) => {
    let pressedT = 0, cover = 0;
    return {
      draw(c, t, dt) {
        const g = c.createRadialGradient(250, 250, 30, 250, 250, 360);
        g.addColorStop(0, '#50363b'); g.addColorStop(1, '#141015');
        c.fillStyle = g; c.fillRect(0, 0, W, W);
        txt(c, 'BOTÓN DE EMERGENCIA', 250, 50, 24, '#ff6b6b', 'center', 900);
        const left = spec.emergencies;
        const cd = spec.cooldown || 0;
        txt(c, cd > 0 ? `Disponible en ${Math.ceil(cd)} s` : `Reuniones restantes: ${left}`, 250, 88, 18, '#ffd0d0');
        c.fillStyle = '#6b7280'; c.beginPath(); c.ellipse(250, 300, 150, 90, 0, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 4; c.stroke();
        const down = pressedT > 0;
        c.fillStyle = '#7f0000'; c.beginPath(); c.ellipse(250, 290, 90, 52, 0, 0, 7); c.fill();
        c.fillStyle = '#ff2d2d'; c.beginPath(); c.ellipse(250, down ? 284 : 270, 90, 52, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(225, down ? 268 : 254, 40, 14, -0.2, 0, 7); c.fill();
        cover = Math.min(1, cover + dt * 2.5);
        c.save(); c.globalAlpha = 0.35 * (1 - cover);
        c.fillStyle = '#bde0ff'; c.beginPath(); c.ellipse(250, 250 - cover * 120, 120, 90, 0, Math.PI, 0); c.fill(); c.restore();
        if (left <= 0 || cd > 0) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 150, W, 260); txt(c, left <= 0 ? 'Sin reuniones' : 'Enfriando…', 250, 300, 30, '#fff'); }
      },
      down(x, y) {
        if (spec.emergencies <= 0 || (spec.cooldown || 0) > 0) return Sfx.error();
        if (Math.hypot((x - 250) / 90, (y - 272) / 52) < 1.1 && !pressedT) {
          pressedT = 1; Sfx.click(); hooks.send({ t: 'emergency' });
          setTimeout(() => close(), 250);
        }
      },
    };
  };

  // ================================================================ panel
  const $ = s => document.querySelector(s);

  function open(spec, hooks) {
    close(true);
    const factory = GAMES[spec.game];
    if (!factory) return;
    const ov = $('#taskOverlay');
    const cv = $('#taskCanvas');
    $('#taskTitle').textContent = spec.title || '';
    ov.classList.add('show');
    Sfx.open();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = W * dpr;
    const c = cv.getContext('2d');
    const game = factory(spec, hooks);
    game.done = false;
    game.finish = function () {
      if (this.done) return;
      this.done = true;
      Sfx.taskDone();
      $('#taskDone').classList.add('show');
      setTimeout(() => { if (cur && cur.game === game) { hooks.complete && hooks.complete(); close(); } }, 900);
    };
    const pt = (e) => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * W];
    };
    const onDown = (e) => { e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); if (!game.done && game.down) game.down(...pt(e)); };
    const onMove = (e) => { if (!game.done && game.move) game.move(...pt(e)); };
    const onUp = (e) => { if (!game.done && game.up) game.up(...pt(e)); };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    let last = performance.now();
    let raf = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.save();
      game.draw(c, now / 1000, dt);
      c.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    cur = {
      spec, game, hooks,
      cleanup() {
        cancelAnimationFrame(raf);
        cv.removeEventListener('pointerdown', onDown);
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp);
        cv.removeEventListener('pointercancel', onUp);
        if (game.onClose) game.onClose();
      },
    };
  }

  function close(silent) {
    if (!cur) return;
    const c = cur;
    cur = null;
    c.cleanup();
    $('#taskOverlay').classList.remove('show');
    $('#taskDone').classList.remove('show');
    if (!silent) Sfx.close();
    if (c.hooks.closed) c.hooks.closed();
  }

  function onSab(s) {
    if (!cur) return;
    if (['lights', 'hand', 'keypad'].indexOf(cur.spec.game) >= 0) {
      if (!s || !s.kind) {
        cur.game.done = true;
        $('#taskDone').classList.add('show');
        Sfx.fixed();
        setTimeout(() => close(true), 800);
      } else if (cur.game.onSab) cur.game.onSab(s);
    }
  }

  window.Tasks = { open, close, onSab, isOpen: () => !!cur, current: () => cur && cur.spec, GAMES };
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.querySelector('#taskClose');
    if (b) b.addEventListener('click', () => close());
  });
})();
