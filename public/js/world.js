/* Renderizado del mundo: nave pre-dibujada, decoración, efectos, visión y niebla. */
(function () {
  'use strict';
  const G = Shared.GRID;
  const WALL = 100;
  const OUT = '#12151c';
  const rr = Draw.rr;
  const built = {};

  // ------------------------------------------------------------ patrones de suelo
  function tile(size, fn) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    fn(cv.getContext('2d'), size);
    return cv;
  }

  const FLOORS = {
    caf: () => tile(80, (c, s) => {
      c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#8d96a1'; c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2);
      c.strokeStyle = 'rgba(40,50,60,0.35)'; c.lineWidth = 2; c.strokeRect(1, 1, s - 2, s - 2);
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(2, 2); c.lineTo(s - 2, 2); c.stroke();
    }),
    metal: () => tile(80, (c, s) => {
      c.fillStyle = '#626a77'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#4d5460'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
      c.fillStyle = '#7b8492'; [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 2.5, 0, 7); c.fill(); });
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
      for (let i = 16; i < s; i += 8) { c.beginPath(); c.moveTo(i, 14); c.lineTo(i - 6, s - 14); c.stroke(); }
    }),
    reactor: () => tile(80, (c, s) => {
      c.fillStyle = '#3d4659'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#2f3646'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
      c.strokeStyle = 'rgba(80,200,255,0.10)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, s / 2); c.lineTo(s, s / 2); c.moveTo(s / 2, 0); c.lineTo(s / 2, s); c.stroke();
    }),
    dark: () => tile(60, (c, s) => {
      c.fillStyle = '#4f5767'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#3e4553'; c.lineWidth = 2; c.strokeRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(3, 3, s - 6, 6);
    }),
    med: () => tile(60, (c, s) => {
      c.fillStyle = '#b9c7d0'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#9fb0bc'; c.lineWidth = 2; c.strokeRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(4, 4, s - 8, 4);
    }),
    green: () => tile(60, (c, s) => {
      c.fillStyle = '#6b8577'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#587066'; c.lineWidth = 2; c.strokeRect(0, 0, s, s);
      c.fillStyle = 'rgba(160,255,190,0.07)'; c.fillRect(6, 6, s - 12, s - 12);
    }),
    blue: () => tile(80, (c, s) => {
      c.fillStyle = '#56708f'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#46607c'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
      c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2; c.strokeRect(10, 10, s - 20, s - 20);
    }),
    storage: () => tile(80, (c, s) => {
      c.fillStyle = '#7d7568'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#6a6357'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 6;
      for (let i = -s; i < s * 2; i += 20) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + s, s); c.stroke(); }
    }),
    elec: () => tile(60, (c, s) => {
      c.fillStyle = '#4b4e59'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#3b3e47'; c.lineWidth = 2; c.strokeRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,220,80,0.05)'; c.fillRect(0, 0, s / 2, s / 2);
    }),
    hall: () => tile(40, (c, s) => {
      c.fillStyle = '#6d7482'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#5b616e'; c.lineWidth = 2; c.strokeRect(0, 0, s, s);
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2;
      for (let i = 6; i < s; i += 7) { c.beginPath(); c.moveTo(i, 5); c.lineTo(i, s - 5); c.stroke(); }
    }),
    lobby: () => tile(80, (c, s) => {
      c.fillStyle = '#5d6879'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#4b5565'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(6, 6, s - 12, 5);
    }),
  };

  const WALLCOL = {
    caf: ['#566273', '#8995a6'], metal: ['#4a4f5b', '#7a808d'], reactor: ['#343c52', '#5f6c8a'], dark: ['#3f4655', '#6e7789'],
    med: ['#6f8494', '#aebfcb'], green: ['#44604f', '#7fa08b'], blue: ['#3e5673', '#7390b0'], storage: ['#5b554c', '#8f8779'],
    elec: ['#3c3f4a', '#686c79'], hall: ['#4e5461', '#7d8492'], lobby: ['#465163', '#78859a'],
  };

  // ------------------------------------------------------------ primitivas
  // aclara/oscurece un color hex
  function shadeHex(hex, amt) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const n = parseInt(hex.slice(1, 7), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function rivets(c, x, y, w, h, col) {
    c.fillStyle = col || 'rgba(255,255,255,0.35)';
    for (const [px, py] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) { c.beginPath(); c.arc(px, py, 1.8, 0, 7); c.fill(); }
  }
  function grime(c, x, y, w, h, seed, n) {
    for (let i = 0; i < (n || Math.floor(w * h / 250)); i++) {
      const a = Math.sin((seed + i) * 12.9898) * 43758.5453, b = Math.sin((seed + i) * 78.233) * 12345.678;
      const fx = a - Math.floor(a), fy = b - Math.floor(b);
      c.fillStyle = i % 3 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)';
      c.fillRect(x + fx * w, y + fy * h, 1 + (i % 3), 1 + ((i >> 1) % 2));
    }
  }

  function box(c, x, y, w, h, H, top, front, r) {
    // huella (x,y,w,h), altura H: cara frontal con degradado + tapa con bisel
    r = r || 3;
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    const fy = y + h - H;
    const gf = c.createLinearGradient(0, fy, 0, fy + H);
    gf.addColorStop(0, shadeHex(front, 18)); gf.addColorStop(1, shadeHex(front, -28));
    c.fillStyle = gf; rr(c, x, fy, w, H, r); c.fill();
    // líneas de panel en el frente
    c.save(); rr(c, x, fy, w, H, r); c.clip();
    c.fillStyle = 'rgba(0,0,0,0.14)';
    for (let px = x + 24; px < x + w - 8; px += 34) c.fillRect(px, fy + 4, 2, H - 8);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, fy + H - 5, w, 5);
    grime(c, x, fy, w, H, x + y);
    c.restore();
    c.strokeStyle = OUT; rr(c, x, fy, w, H, r); c.stroke();
    // tapa
    const gt = c.createLinearGradient(0, y - H, 0, y - H + h);
    gt.addColorStop(0, shadeHex(top, 22)); gt.addColorStop(1, shadeHex(top, -10));
    c.fillStyle = gt; rr(c, x, y - H, w, h, r); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + r + 2, y - H + 2.5); c.lineTo(x + w - r - 2, y - H + 2.5); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.strokeRect(x + 6, y - H + 6, w - 12, h - 12);
    if (w > 40 && h > 24) rivets(c, x + 2, y - H + 2, w - 4, h - 4);
  }

  function screen(c, x, y, w, h, color) {
    c.fillStyle = '#0d1a24'; rr(c, x, y, w, h, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0.2)');
    c.fillStyle = g; c.globalAlpha = 0.75; rr(c, x + 3, y + 3, w - 6, h - 6, 2); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
    for (let i = y + 8; i < y + h - 4; i += 6) { c.beginPath(); c.moveTo(x + 6, i); c.lineTo(x + 6 + (w - 12) * (0.3 + ((i * 7) % 10) / 14), i); c.stroke(); }
  }

  function panel(c, x, y, w, h, fill) {
    c.fillStyle = fill || '#8a93a3'; rr(c, x, y, w, h, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x + 4, y + 4, w - 8, 3);
  }

  function roundTable(c, cx, cy, rx, ry, H, top, side) {
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx + 6, cy + 6, rx, ry, 0, 0, 7); c.fill();
    const gs = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
    gs.addColorStop(0, shadeHex(side, -25)); gs.addColorStop(0.35, shadeHex(side, 20)); gs.addColorStop(1, shadeHex(side, -35));
    c.fillStyle = gs;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); c.lineTo(cx - rx, cy - H); c.ellipse(cx, cy - H, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill(); c.stroke();
    const gt = c.createRadialGradient(cx - rx * 0.3, cy - H - ry * 0.4, 4, cx, cy - H, rx);
    gt.addColorStop(0, shadeHex(top, 30)); gt.addColorStop(1, shadeHex(top, -18));
    c.fillStyle = gt; c.beginPath(); c.ellipse(cx, cy - H, rx, ry, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy - H, rx * 0.82, ry * 0.8, 0, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(cx - rx * 0.35, cy - H - ry * 0.35, rx * 0.35, ry * 0.2, -0.2, 0, 7); c.fill();
  }

  function stool(c, x, y) {
    c.lineWidth = 2; c.strokeStyle = OUT;
    c.fillStyle = '#555d6b'; c.fillRect(x - 3, y - 14, 6, 14);
    c.fillStyle = '#c8ccd3'; c.beginPath(); c.ellipse(x, y - 14, 12, 6, 0, 0, 7); c.fill(); c.stroke();
  }

  function crate(c, x, y, w, h, H, col) {
    col = col || '#b08850';
    const front = shadeHex(col, -32);
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    const fy = y + h - H;
    // frente con tablones
    c.fillStyle = front; rr(c, x, fy, w, H, 3); c.fill();
    c.save(); rr(c, x, fy, w, H, 3); c.clip();
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i % 2 ? shadeHex(front, 8) : shadeHex(front, -6);
      c.fillRect(x, fy + i * H / 4, w, H / 4);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, fy + i * H / 4, w, 1.5);
    }
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const yy = fy + 4 + i * H / 6; c.beginPath(); c.moveTo(x + 4, yy); c.bezierCurveTo(x + w * 0.3, yy + 2, x + w * 0.6, yy - 2, x + w - 4, yy + 1); c.stroke(); }
    c.strokeStyle = shadeHex(front, -30); c.lineWidth = 6;
    c.beginPath(); c.moveTo(x + 6, fy + 6); c.lineTo(x + w - 6, fy + H - 6); c.moveTo(x + w - 6, fy + 6); c.lineTo(x + 6, fy + H - 6); c.stroke();
    c.strokeStyle = shadeHex(front, 12); c.lineWidth = 3; c.stroke();
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2.5; rr(c, x, fy, w, H, 3); c.stroke();
    // tapa
    const gt = c.createLinearGradient(0, y - H, 0, y - H + h);
    gt.addColorStop(0, shadeHex(col, 18)); gt.addColorStop(1, shadeHex(col, -8));
    c.fillStyle = gt; rr(c, x, y - H, w, h, 3); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let px = x + w / 3; px < x + w - 4; px += w / 3) c.fillRect(px, y - H + 2, 2, h - 4);
    // esquinas metálicas
    c.fillStyle = '#9aa3b2';
    for (const [px, py] of [[x, fy], [x + w - 10, fy], [x, fy + H - 10], [x + w - 10, fy + H - 10]]) { c.fillRect(px, py, 10, 10); c.strokeStyle = OUT; c.lineWidth = 1.5; c.strokeRect(px, py, 10, 10); }
    // sello
    if (w > 60 && H > 36) { c.save(); c.globalAlpha = 0.45; c.fillStyle = '#1c1c1c'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText(T('FRÁGIL'), x + w / 2, fy + H / 2 + 4); c.restore(); }
  }

  function plant(c, x, y) {
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.fillStyle = '#9e6b43'; c.beginPath(); c.moveTo(x - 16, y - 30); c.lineTo(x + 16, y - 30); c.lineTo(x + 11, y); c.lineTo(x - 11, y); c.closePath(); c.fill(); c.stroke();
    const leaves = [[-14, -50, -0.6], [12, -52, 0.6], [0, -64, 0], [-6, -44, -1.2], [8, -42, 1.1]];
    for (const l of leaves) { c.fillStyle = '#3f9b52'; c.beginPath(); c.ellipse(x + l[0], y + l[1], 9, 20, l[2], 0, 7); c.fill(); c.stroke(); }
  }

  function barrel(c, x, y, col) {
    col = col || '#c0392b';
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + 3, y + 2, 18, 6, 0, 0, 7); c.fill();
    const g = c.createLinearGradient(x - 16, 0, x + 16, 0);
    g.addColorStop(0, shadeHex(col, -45)); g.addColorStop(0.3, shadeHex(col, 35)); g.addColorStop(0.55, col); g.addColorStop(1, shadeHex(col, -55));
    c.fillStyle = g; rr(c, x - 16, y - 46, 32, 46, 6); c.fill(); c.stroke();
    for (const ry of [y - 38, y - 12]) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 16, ry, 32, 4); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x - 16, ry, 32, 1.5); }
    c.fillStyle = 'rgba(255,255,255,0.8)'; rr(c, x - 9, y - 30, 18, 12, 2); c.fill();
    c.fillStyle = '#1c1c1c'; c.beginPath(); c.moveTo(x, y - 28); c.lineTo(x + 5, y - 20); c.lineTo(x - 5, y - 20); c.closePath(); c.fill();
    c.fillStyle = shadeHex(col, 15); c.beginPath(); c.ellipse(x, y - 46, 15, 5, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(x + 6, y - 46, 2.5, 0, 7); c.fill();
  }

  function stars(c, x, y, w, h, seed) {
    c.fillStyle = '#060a18'; rr(c, x, y, w, h, 6); c.fill();
    let s = seed || 7;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < w * h / 180; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.fillRect(x + r() * w, y + r() * h, 1.6, 1.6); }
    c.strokeStyle = '#2b313c'; c.lineWidth = 5; rr(c, x, y, w, h, 6); c.stroke();
    c.strokeStyle = 'rgba(160,210,255,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 10, y + h - 10); c.lineTo(x + 30, y + 10); c.stroke();
  }

  function vent(c, x, y) {
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.fillStyle = '#3a404b'; rr(c, x - 30, y - 16, 60, 32, 5); c.fill(); c.stroke();
    c.fillStyle = '#747d8c'; rr(c, x - 26, y - 13, 52, 26, 4); c.fill();
    c.strokeStyle = '#2a2f38'; c.lineWidth = 3;
    for (let i = -18; i <= 18; i += 9) { c.beginPath(); c.moveTo(x + i, y - 9); c.lineTo(x + i, y + 9); c.stroke(); }
  }

  // ------------------------------------------------------------ objetos de tarea
  function wallTopFor(map, x, y) {
    for (const r of map.rooms) {
      if (Shared.inRect(r.r, x, y) && y - r.r.y < 80) return r.r.y;
    }
    return null;
  }

  function taskObject(c, map, game, x, y, extra) {
    const wt = wallTopFor(map, x, y);
    if (game === 'scan') {
      c.fillStyle = '#2d3b48'; c.beginPath(); c.ellipse(x, y, 42, 20, 0, 0, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#56c4d6'; c.beginPath(); c.ellipse(x, y, 32, 14, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 22, 9, 0, 0, 7); c.stroke();
      return;
    }
    if (wt != null) {
      const py = wt - 78, ph = 62, pw = 54, px = x - pw / 2;
      if (game === 'wires' || game === 'lights') {
        panel(c, px, py, pw, ph, game === 'lights' ? '#c5a33a' : '#7c8595');
        const cols = ['#e53935', '#1e88e5', '#fdd835', '#d81b60'];
        cols.forEach((cl, i) => { c.strokeStyle = cl; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 8, py + 14 + i * 11); c.bezierCurveTo(px + 25, py + 20 + i * 8, px + 30, py + 8 + i * 12, px + pw - 8, py + 14 + ((i + 2) % 4) * 11); c.stroke(); });
        if (game === 'lights') { c.fillStyle = '#222'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('⚡', x, py + ph - 8); }
      } else if (game === 'card') {
        panel(c, px + 6, py + 10, pw - 12, ph - 10, '#6d7a8c');
        c.fillStyle = '#1a1d25'; c.fillRect(px + 12, py + 30, pw - 24, 5);
        c.fillStyle = '#4caf50'; c.fillRect(px + 14, py + 18, 6, 6);
      } else if (game === 'garbage') {
        panel(c, px - 6, py - 6, pw + 12, ph + 10, '#6b7280');
        c.fillStyle = '#2b2f37'; rr(c, px + 4, py + 8, pw - 8, ph - 22, 4); c.fill();
        c.fillStyle = '#c62828'; c.fillRect(px + pw - 2, py + 18, 8, 26);
      } else if (game === 'filter') {
        panel(c, px - 4, py + 4, pw + 8, ph - 4, '#79967f');
        c.strokeStyle = '#3b4a3f'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(px + 6, py + 16 + i * 9); c.lineTo(px + pw - 6, py + 16 + i * 9); c.stroke(); }
      } else if (game === 'shields') {
        panel(c, px - 6, py, pw + 12, ph, '#5b6577');
        for (let i = 0; i < 3; i++) { c.fillStyle = i === 1 ? '#ef5350' : '#e3f2fd'; c.beginPath(); c.arc(px + 12 + i * 18, py + 30, 8, 0, 7); c.fill(); }
      } else if (game === 'manifolds' || game === 'hand') {
        panel(c, px, py, pw, ph, '#566180');
        if (game === 'hand') { c.fillStyle = '#26c6da'; c.globalAlpha = 0.7; rr(c, px + 10, py + 10, pw - 20, ph - 20, 8); c.fill(); c.globalAlpha = 1; c.fillStyle = '#0a3940'; c.font = '26px sans-serif'; c.textAlign = 'center'; c.fillText('✋', x, py + 42); }
        else for (let i = 0; i < 10; i++) { c.fillStyle = '#90caf9'; c.fillRect(px + 7 + (i % 5) * 9, py + 16 + Math.floor(i / 5) * 16, 6, 10); }
      } else if (game === 'keypad') {
        panel(c, px + 6, py + 6, pw - 12, ph - 6, '#8d99a8');
        for (let i = 0; i < 9; i++) { c.fillStyle = '#eceff1'; c.fillRect(px + 13 + (i % 3) * 10, py + 16 + Math.floor(i / 3) * 10, 7, 7); }
      } else {
        panel(c, px, py, pw, ph, '#6c7686');
        screen(c, px + 6, py + 8, pw - 12, ph - 22, game === 'calibrate' ? '#ffca28' : game === 'download' || game === 'upload' ? '#29b6f6' : '#66bb6a');
      }
      return;
    }
    // consola de suelo
    if (game === 'fuel') {
      if (extra && extra.fill) { barrel(c, x - 30, y - 16, '#e53935'); barrel(c, x + 6, y - 18, '#fbc02d'); }
      else { panel(c, x - 22, y - 70, 44, 50, '#8d6e63'); c.fillStyle = '#212121'; c.beginPath(); c.arc(x, y - 45, 10, 0, 7); c.fill(); }
      return;
    }
    if (game === 'align') {
      box(c, x - 34, y - 60, 68, 36, 26, '#78909c', '#546e7a');
      screen(c, x - 24, y - 84, 48, 22, '#ffb74d');
      return;
    }
    if (game === 'simon') {
      box(c, x - 40, y - 56, 80, 34, 30, '#5c6bc0', '#3949ab');
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 4 ? '#90caf9' : '#1de9b6'; c.fillRect(x - 30 + (i % 3) * 12, y - 84 + Math.floor(i / 3) * 9, 9, 6); }
      return;
    }
    if (game === 'asteroids') return; // lo cubre el asiento del artillero
    box(c, x - 30, y - 56, 60, 32, 28, '#7d8797', '#586170');
    screen(c, x - 22, y - 82, 44, 24, game === 'steering' || game === 'course' ? '#4fc3f7' : '#81c784');
  }

  // ------------------------------------------------------------ decoración por sala
  function decorate(c, map) {
    if (map.id === 'lobby') return decorateLobby(c, map);
    // Cafetería
    stars(c, 1720, 36, 180, 58, 3); stars(c, 2180, 36, 180, 58, 9);
    c.fillStyle = '#3d4452'; rr(c, 1960, 30, 160, 70, 6); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#ffeb3b'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText(T('CAFETERÍA'), 2040, 75);
    for (const t of [[1800, 280], [2280, 280], [1800, 660], [2280, 660]]) {
      stool(c, t[0] - 78, t[1] + 20); stool(c, t[0] + 78, t[1] + 20);
      roundTable(c, t[0], t[1] + 18, 66, 34, 22, '#d6dbe2', '#9aa2ae');
      stool(c, t[0], t[1] + 72);
    }
    // mesa del botón
    roundTable(c, 2040, 488, 74, 38, 26, '#cfd6de', '#8f98a6');
    c.fillStyle = '#3b3f48'; c.beginPath(); c.ellipse(2040, 462, 34, 17, 0, 0, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#8a0000'; c.beginPath(); c.ellipse(2040, 458, 24, 11, 0, 0, 7); c.fill();
    c.fillStyle = '#ff2d2d'; c.beginPath(); c.ellipse(2040, 452, 24, 11, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(2032, 449, 9, 3.5, -0.2, 0, 7); c.fill();
    c.fillStyle = 'rgba(190,225,255,0.25)'; c.beginPath(); c.ellipse(2040, 446, 30, 22, 0, Math.PI, 0); c.fill();
    // máquinas expendedoras
    for (const vx of [1690, 2390]) { box(c, vx - 26, 690, 52, 40, 80, '#e3e7ec', '#c62828'); c.fillStyle = '#90caf9'; c.fillRect(vx - 18, 648, 36, 36); }

    // Motores
    engine(c, 290, 420, 250, 140);
    engine(c, 290, 1760, 250, 140);
    // Reactor
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    for (const py of [1000, 1400]) { c.fillStyle = '#4b5570'; c.fillRect(80, py - 14, 380, 10); }
    reactorCore(c);
    // Seguridad
    box(c, 920, 1125, 200, 35, 45, '#5f6b7c', '#434c59');
    for (let i = 0; i < 4; i++) screen(c, 928 + i * 48, 1030, 42, 34, i % 2 ? '#80cbc4' : '#a5d6a7');
    stool(c, 1020, 1210);
    // Enfermería
    for (const by of [700, 840]) {
      box(c, 1090, by, 60, 100, 18, '#eceff1', '#b0bec5');
      c.fillStyle = '#90caf9'; rr(c, 1095, by - 14, 50, 22, 6); c.fill();
    }
    c.fillStyle = '#e53935'; c.fillRect(1340, 560, 40, 12); c.fillRect(1354, 546, 12, 40);
    // Armas
    stars(c, 2900, 150, 300, 70, 21);
    box(c, 3110, 380, 140, 60, 40, '#607d8b', '#455a64');
    c.fillStyle = '#263238'; rr(c, 3150, 300, 60, 45, 8); c.fill(); c.stroke();
    c.fillStyle = '#b0bec5'; c.fillRect(3175, 250, 10, 60); c.strokeRect(3175, 250, 10, 60);
    // O2
    plant(c, 2640, 910); plant(c, 2640, 1060); plant(c, 2740, 1060);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#b2dfdb'; rr(c, 2820 + i * 22, 752, 18, 56, 8); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    // Navegación
    stars(c, 3700, 850, 240, 70, 33);
    box(c, 3870, 1130, 70, 130, 40, '#546e7a', '#37474f');
    screen(c, 3878, 1080, 54, 40, '#4fc3f7');
    stool(c, 3820, 1210);
    // Escudos
    for (let i = 0; i < 5; i++) {
      const hx = 2920 + i * 80, hy = 1560;
      c.fillStyle = 'rgba(160,220,255,0.3)'; c.strokeStyle = '#90caf9'; c.lineWidth = 2;
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(hx + Math.cos(a) * 26, hy + Math.sin(a) * 26); } c.closePath(); c.fill(); c.stroke();
    }
    // Comunicaciones
    box(c, 2360, 2150, 120, 40, 36, '#6d7a8c', '#4c5666');
    screen(c, 2380, 2100, 80, 36, '#80deea');
    c.fillStyle = '#90a4ae'; c.beginPath(); c.arc(2660, 2240, 40, Math.PI, 0); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); c.moveTo(2660, 2240); c.lineTo(2660, 2280); c.stroke();
    // Almacén
    crate(c, 1790, 1490, 110, 70, 60); crate(c, 2090, 1690, 110, 70, 60, '#a1885a'); crate(c, 1790, 1780, 90, 50, 44, '#7d9c6a');
    crate(c, 1800, 1460, 70, 30, 40, '#c49a5f');
    barrel(c, 2180, 2040, '#546e7a'); barrel(c, 2140, 2050, '#607d8b');
    // Administración
    box(c, 2450, 1310, 170, 70, 30, '#37474f', '#263238', 10);
    // Electricidad
    for (let i = 0; i < 3; i++) { c.strokeStyle = ['#ffca28', '#ef5350', '#42a5f5'][i]; c.lineWidth = 4; c.beginPath(); c.moveTo(1190, 1440 + i * 14); c.bezierCurveTo(1300, 1470 + i * 10, 1420, 1420, 1530, 1450 + i * 12); c.stroke(); }
    // Pasillos: franjas de seguridad en las puertas
    for (const d of map.doors) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      if (d.dir === 'v') { c.fillRect(d.r.x + 14, d.r.y, 12, d.r.h); }
      else { c.fillRect(d.r.x, d.r.y + 14, d.r.w, 12); }
    }
  }

  function engine(c, x, y, w, h) {
    c.lineWidth = 3; c.strokeStyle = OUT;
    // tobera con anillos
    const gn = c.createLinearGradient(0, y - 90, 0, y + h);
    gn.addColorStop(0, '#546e7a'); gn.addColorStop(0.5, '#37474f'); gn.addColorStop(1, '#1f2a30');
    c.fillStyle = gn;
    c.beginPath(); c.moveTo(x + 10, y - 60); c.lineTo(x - 50, y - 90); c.lineTo(x - 50, y + h - 10); c.lineTo(x + 10, y + h - 30); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2;
    for (let i = 1; i < 4; i++) { const xx = x - 50 + i * 15; c.beginPath(); c.moveTo(xx, y - 90 + i * 7.5); c.lineTo(xx, y + h - 10 - i * 5); c.stroke(); }
    // cuerpo cilíndrico
    c.strokeStyle = OUT; c.lineWidth = 3;
    const g = c.createLinearGradient(0, y - 110, 0, y + h);
    g.addColorStop(0, '#cfd8dc'); g.addColorStop(0.25, '#b0bec5'); g.addColorStop(0.6, '#78909c'); g.addColorStop(1, '#37474f');
    c.fillStyle = g;
    rr(c, x, y - 110, w, h + 100, 30); c.fill(); c.stroke();
    c.save(); rr(c, x, y - 110, w, h + 100, 30); c.clip();
    // bandas y paneles
    for (let i = 1; i < 4; i++) {
      const bx = x + i * w / 4;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(bx - 3, y - 110, 6, h + 100);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(bx - 3, y - 110, 1.5, h + 100);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let yy = y - 95; yy < y + h - 10; yy += 22) { c.beginPath(); c.arc(bx + 7, yy, 1.8, 0, 7); c.arc(bx - 7, yy, 1.8, 0, 7); c.fill(); }
    }
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y - 100, w, 6);
    grime(c, x, y - 110, w, h + 100, x + y, 160);
    c.restore();
    // rejilla de ventilación
    c.fillStyle = '#1f2a30'; rr(c, x + 40, y - 60, 90, 40, 6); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#546e7a'; for (let i = 0; i < 6; i++) c.fillRect(x + 46 + i * 14, y - 54, 8, 28);
    // placa de advertencia
    hazard(c, x + w - 60, y + 6, 44, 18); c.strokeStyle = OUT; c.lineWidth = 2; c.strokeRect(x + w - 60, y + 6, 44, 18);
    // luces de estado
    c.fillStyle = '#30d158'; c.beginPath(); c.arc(x + 160, y - 40, 5, 0, 7); c.fill();
    c.fillStyle = '#ffd60a'; c.beginPath(); c.arc(x + 176, y - 40, 5, 0, 7); c.fill();
    c.fillStyle = '#263238'; rr(c, x + 150, y + 20, 60, 26, 4); c.fill();
    c.fillStyle = '#4fc3f7'; c.globalAlpha = 0.7; c.fillRect(x + 154, y + 24, 52, 18); c.globalAlpha = 1;
  }

  function reactorCore(c) {
    const cx = 240;
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    // base octogonal
    box(c, 150, 1130, 180, 140, 90, '#7986cb', '#3949ab', 20);
    // anillos de contención
    for (const ry of [1095, 1150, 1205]) {
      c.fillStyle = '#9fa8da'; rr(c, 160, ry, 160, 12, 5); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(166, ry + 2, 148, 2);
      for (let i = 0; i < 6; i++) { c.fillStyle = '#303f9f'; c.beginPath(); c.arc(172 + i * 27, ry + 6, 2.2, 0, 7); c.fill(); }
    }
    // cámara del núcleo (vidrio)
    c.fillStyle = '#0d1654'; rr(c, 180, 1060, 120, 150, 14); c.fill(); c.stroke();
    const gl = c.createLinearGradient(180, 0, 300, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.05)'); gl.addColorStop(0.25, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.35, 'rgba(255,255,255,0.03)'); gl.addColorStop(1, 'rgba(255,255,255,0.08)');
    c.fillStyle = gl; rr(c, 184, 1064, 112, 142, 12); c.fill();
    // barras de combustible
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(120,230,255,0.35)'; rr(c, 198 + i * 24, 1080, 10, 110, 5); c.fill(); }
    // tuberías laterales
    for (const sx of [128, 332]) { c.fillStyle = '#5c6bc0'; rr(c, sx, 1100, 20, 120, 8); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(sx + 4, 1104, 4, 112); }
    // consola del reactor
    c.fillStyle = '#ffd60a'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText(T('NÚCLEO'), cx, 1265);
  }

  function decorateLobby(c) {
    stars(c, 360, 150, 220, 70, 4); stars(c, 820, 150, 220, 70, 11);
    box(c, 330, 300, 200, 40, 30, '#8d6e63', '#6d4c41');
    box(c, 870, 300, 200, 40, 30, '#8d6e63', '#6d4c41');
    crate(c, 560, 640, 120, 60, 50); crate(c, 700, 650, 140, 50, 40, '#8fa06a');
    // portátil
    box(c, 650, 250, 100, 30, 26, '#90a4ae', '#607d8b');
    c.fillStyle = '#263238'; rr(c, 668, 196, 64, 34, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#4fc3f7'; c.globalAlpha = 0.8; rr(c, 672, 200, 56, 26, 3); c.fill(); c.globalAlpha = 1;
    barrel(c, 1150, 720, '#e53935'); barrel(c, 250, 720, '#fbc02d');
  }


  // ------------------------------------------------------------ más utilería
  function seeded(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function pipeH(c, x1, x2, y, r, col) {
    const g = c.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, '#2a2f38'); g.addColorStop(0.35, col || '#9aa3b2'); g.addColorStop(1, '#3a404c');
    c.fillStyle = g; c.fillRect(x1, y - r, x2 - x1, r * 2);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x1, y + r, x2 - x1, 3);
  }
  function pipeV(c, x, y1, y2, r, col) {
    const g = c.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, '#2a2f38'); g.addColorStop(0.35, col || '#9aa3b2'); g.addColorStop(1, '#3a404c');
    c.fillStyle = g; c.fillRect(x - r, y1, r * 2, y2 - y1);
  }
  function lightPool(c, x, y, rx, ry, col, a) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill();
    c.restore();
  }
  function wallLamp(c, x, y, col) {
    c.fillStyle = '#20242c'; rr(c, x - 16, y - 6, 32, 12, 4); c.fill();
    c.fillStyle = col || '#fff3c4'; rr(c, x - 12, y - 3, 24, 6, 3); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y + 4, 0, x, y + 4, 60);
    g.addColorStop(0, 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.lineTo(x + 46, y + 70); c.lineTo(x - 46, y + 70); c.closePath(); c.fill();
    c.restore();
  }
  function hazard(c, x, y, w, h) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = '#f2c230'; c.fillRect(x, y, w, h);
    c.fillStyle = '#1c1c1c';
    for (let i = -h - w; i < w + h; i += 16) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 8, y + h); c.lineTo(x + i + 8 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
    c.restore();
  }
  function poster(c, x, y, w, h, bg, draw) {
    c.fillStyle = '#1b1f27'; rr(c, x - 3, y - 3, w + 6, h + 6, 4); c.fill();
    c.fillStyle = bg; rr(c, x, y, w, h, 3); c.fill();
    if (draw) draw(c, x, y, w, h);
  }
  function rack(c, x, y, w, h) {
    // mueble alto apoyado en la pared: base en y
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    c.fillStyle = '#2c313b'; rr(c, x, y - h, w, h, 4); c.fill(); c.stroke();
    for (let yy = y - h + 8; yy < y - 10; yy += 14) {
      c.fillStyle = '#3d4450'; c.fillRect(x + 5, yy, w - 10, 10);
      c.fillStyle = seeded(x + yy) > 0.5 ? '#30d158' : '#64d2ff'; c.fillRect(x + w - 12, yy + 3, 4, 4);
      if (seeded(yy * 3 + x) > 0.6) { c.fillStyle = '#ff9f0a'; c.fillRect(x + w - 20, yy + 3, 4, 4); }
    }
  }
  function locker(c, x, y, n, col) {
    for (let i = 0; i < n; i++) {
      const lx = x + i * 30;
      c.fillStyle = col || '#6f8196'; rr(c, lx, y - 80, 28, 80, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 3; k++) c.fillRect(lx + 7, y - 70 + k * 5, 14, 2);
      c.fillStyle = '#dfe6ee'; c.fillRect(lx + 21, y - 45, 3, 10);
    }
  }
  function tank(c, x, y, col, h) {
    h = h || 70;
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    const g = c.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, col); g.addColorStop(0.4, '#ffffff55'); g.addColorStop(1, col);
    c.fillStyle = col; rr(c, x - 20, y - h, 40, h, 14); c.fill();
    c.fillStyle = g; rr(c, x - 20, y - h, 40, h, 14); c.fill(); c.stroke();
    c.fillStyle = '#20242c'; c.fillRect(x - 6, y - h - 8, 12, 10);
  }
  function chair(c, x, y, col) {
    c.lineWidth = 2; c.strokeStyle = OUT;
    c.fillStyle = '#39404c'; c.fillRect(x - 3, y - 12, 6, 12);
    c.fillStyle = col || '#4f6d8f'; rr(c, x - 14, y - 22, 28, 12, 5); c.fill(); c.stroke();
    rr(c, x - 12, y - 42, 24, 20, 6); c.fill(); c.stroke();
  }
  function cable(c, pts, col) {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1] + 3); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1] + 3); c.stroke();
    c.strokeStyle = col; c.lineWidth = 5;
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
    c.lineCap = 'butt';
  }
  function decal(c, x, y, r, col) {
    c.save(); c.globalAlpha = 0.35;
    c.strokeStyle = col; c.lineWidth = 4;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.7, 0, 7); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); c.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); c.stroke(); }
    c.restore();
  }

  // Iluminación de ambiente por sala (antes de los muebles)
  const ROOM_LIGHT = {
    caf: 'rgba(255,245,220,A)', metal: 'rgba(255,190,120,A)', reactor: 'rgba(90,200,255,A)', dark: 'rgba(170,190,255,A)',
    med: 'rgba(210,245,255,A)', green: 'rgba(140,255,170,A)', blue: 'rgba(120,190,255,A)', storage: 'rgba(255,220,160,A)',
    elec: 'rgba(255,220,90,A)', lobby: 'rgba(220,230,255,A)',
  };
  function ambient(c, map) {
    for (const r of map.rooms) {
      const col = ROOM_LIGHT[r.floor] || 'rgba(255,255,255,A)';
      const nx = Math.max(1, Math.round(r.r.w / 260)), ny = Math.max(1, Math.round(r.r.h / 260));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = r.r.x + (i + 0.5) * r.r.w / nx, y = r.r.y + (j + 0.5) * r.r.h / ny;
        lightPool(c, x, y, Math.min(r.r.w / nx, r.r.h / ny) * 0.75, Math.min(r.r.w / nx, r.r.h / ny) * 0.5, col, 0.13);
      }
      // oscurecer esquinas
      const g = c.createRadialGradient(r.r.x + r.r.w / 2, r.r.y + r.r.h / 2, Math.min(r.r.w, r.r.h) * 0.35, r.r.x + r.r.w / 2, r.r.y + r.r.h / 2, Math.hypot(r.r.w, r.r.h) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
      c.fillStyle = g; c.fillRect(r.r.x, r.r.y, r.r.w, r.r.h);
    }
    // luces guía de los pasillos
    for (const h of map.halls) {
      const horiz = h.w >= h.h;
      const len = horiz ? h.w : h.h;
      for (let d = 20; d < len - 10; d += 40) {
        for (const side of [0, 1]) {
          const x = horiz ? h.x + d : (side ? h.x + h.w - 8 : h.x + 6);
          const y = horiz ? (side ? h.y + h.h - 8 : h.y + 6) : h.y + d;
          if (Shared.roomAt(map, x, y)) continue;
          c.fillStyle = '#0e1a22'; c.fillRect(x - 3, y - 2, 6, 4);
          c.fillStyle = '#64d2ff'; c.fillRect(x - 2, y - 1, 4, 2);
          lightPool(c, x, y, 14, 10, 'rgba(100,210,255,A)', 0.35);
        }
      }
    }
  }

  // Detalles de las paredes frontales: tuberías, lámparas, paneles y carteles
  function wallDetails(c, map, F, cols, rows) {
    for (let j = 0; j < rows; j++) {
      let i = 0;
      while (i < cols) {
        const isWall = (ii) => F(ii, j) && !F(ii, j - 1) && !F(ii, j - 2) && !F(ii, j - 3) && !F(ii, j - 4);
        if (!isWall(i)) { i++; continue; }
        let k = i;
        while (k < cols && isWall(k)) k++;
        const x0 = i * G, x1 = k * G, y0 = j * G;
        if (x1 - x0 >= 80) {
          // zócalo metálico y tubería
          c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x0, y0 - 26, x1 - x0, 14);
          c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x0, y0 - 13, x1 - x0, 3);
          pipeH(c, x0, x1, y0 - 90, 4, seeded(j) > 0.5 ? '#8b95a6' : '#a88f6a');
          for (let x = x0 + 30; x < x1 - 10; x += 120) { c.fillStyle = '#2a2f38'; c.fillRect(x, y0 - 96, 8, 12); }
          // lámparas
          const n = Math.max(1, Math.floor((x1 - x0) / 240));
          for (let m = 0; m < n; m++) {
            const lx = x0 + (m + 0.5) * (x1 - x0) / n;
            wallLamp(c, lx, y0 - 78);
            lightPool(c, lx, y0 + 50, 110, 55, 'rgba(255,240,210,A)', 0.09);
          }
          // rejillas de ventilación y carteles aleatorios
          for (let x = x0 + 50; x < x1 - 70; x += 170) {
            const r = seeded(x * 7 + j);
            if (r < 0.25) {
              c.fillStyle = '#20242c'; rr(c, x, y0 - 60, 34, 22, 3); c.fill();
              c.fillStyle = '#4a5160'; for (let q = 0; q < 4; q++) c.fillRect(x + 4, y0 - 56 + q * 5, 26, 2);
            } else if (r < 0.38) {
              poster(c, x, y0 - 66, 30, 36, '#f2c230', (cc, px, py, pw, ph) => { cc.fillStyle = '#1c1c1c'; cc.beginPath(); cc.moveTo(px + pw / 2, py + 6); cc.lineTo(px + pw - 5, py + ph - 6); cc.lineTo(px + 5, py + ph - 6); cc.closePath(); cc.fill(); cc.fillStyle = '#f2c230'; cc.fillRect(px + pw / 2 - 1.5, py + 14, 3, 9); });
            } else if (r < 0.46) {
              poster(c, x, y0 - 70, 44, 32, '#2c5282', (cc, px, py, pw, ph) => { cc.fillStyle = '#fff'; cc.font = 'bold 9px sans-serif'; cc.textAlign = 'center'; cc.fillText('TEMU', px + pw / 2, py + 14); cc.fillStyle = '#ff7a18'; cc.fillRect(px + 8, py + 20, pw - 16, 4); });
            }
          }
        }
        i = k;
      }
    }
  }

  // Detalles a nivel del suelo (debajo de los muebles)
  function floorProps(c) {
    pipeV(c, 200, 960, 1070, 8, '#7986cb'); pipeV(c, 280, 960, 1070, 8, '#7986cb');
    pipeV(c, 200, 1270, 1440, 8, '#7986cb'); pipeV(c, 280, 1270, 1440, 8, '#7986cb');
    decal(c, 240, 1200, 120, '#64d2ff');
    decal(c, 1300, 900, 60, '#30d158');
    decal(c, 3700, 1190, 110, '#64d2ff');
    cable(c, [3250, 1790, 3150, 1850, 3000, 1850, 2900, 1800], '#3949ab');
    cable(c, [2395, 2200, 2480, 2260, 2600, 2250, 2650, 2200], '#455a64');
    hazard(c, 1960, 1720, 160, 12); hazard(c, 1960, 1880, 160, 12);
    cable(c, [1500, 1745, 1420, 1700, 1330, 1690, 1250, 1640], '#e53935');
    cable(c, [1510, 1760, 1440, 1780, 1360, 1760, 1290, 1780], '#1e88e5');
    for (const ey of [0, 1340]) hazard(c, 280, 580 + ey, 270, 10);
  }

  // Utilería extra por sala
  function propsShip(c) {
    // Cafetería
    box(c, 1760, 150, 170, 26, 22, '#c9ced6', '#8a929e'); box(c, 2150, 150, 170, 26, 22, '#c9ced6', '#8a929e');
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#ffb74d', '#81c784', '#e57373', '#fff176'][i]; c.beginPath(); c.ellipse(1785 + i * 40, 142, 12, 5, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(2175 + i * 40, 142, 12, 5, 0, 0, 7); c.fill(); }
    for (const p of [[1665, 400], [2415, 610]]) { c.fillStyle = '#4a5160'; rr(c, p[0] - 14, p[1] - 34, 28, 34, 6); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.fillStyle = '#2a2f38'; c.fillRect(p[0] - 10, p[1] - 30, 20, 5); }
    // Motores: tanques y tuberías
    for (const ey of [0, 1340]) {
      tank(c, 590, 380 + ey, '#b71c1c', 60); tank(c, 590, 720 + ey, '#1565c0', 60);
      pipeH(c, 540, 580, 470 + ey, 6); pipeH(c, 540, 580, 530 + ey, 6);
    }
    // Reactor
    poster(c, 390, 900, 40, 40, '#f2c230', (cc, x, y) => { cc.fillStyle = '#1c1c1c'; for (let i = 0; i < 3; i++) { cc.beginPath(); cc.moveTo(x + 20, y + 20); cc.arc(x + 20, y + 20, 15, i * 2.09 - 0.5, i * 2.09 + 0.5); cc.closePath(); cc.fill(); } cc.fillStyle = '#f2c230'; cc.beginPath(); cc.arc(x + 20, y + 20, 4, 0, 7); cc.fill(); cc.fillStyle = '#1c1c1c'; cc.beginPath(); cc.arc(x + 20, y + 20, 2.5, 0, 7); cc.fill(); });
    // Seguridad
    rack(c, 895, 1390, 36, 90); chair(c, 980, 1205, '#455a64');
    // Enfermería
    c.fillStyle = '#90a4ae'; c.fillRect(1205, 690, 4, 70); c.fillStyle = '#b3e5fc'; rr(c, 1196, 690, 22, 26, 6); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    box(c, 1330, 670, 90, 26, 36, '#eceff1', '#b0bec5'); c.fillStyle = '#90caf9'; c.fillRect(1350, 640, 22, 10);
    // Armas
    crate(c, 2840, 560, 70, 50, 40, '#6d7d5a'); crate(c, 2845, 520, 50, 30, 30, '#7d8d6a');
    chair(c, 3180, 395, '#37474f');
    // O2
    tank(c, 2920, 1075, '#80cbc4', 70);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#4e7a5f'; rr(c, 2700 + i * 34, 1050, 28, 18, 4); c.fill(); c.fillStyle = '#7fe0a0'; c.beginPath(); c.arc(2714 + i * 34, 1050, 9, Math.PI, 0); c.fill(); }
    // Navegación
    chair(c, 3820, 1080, '#37474f'); chair(c, 3820, 1320, '#37474f');
    // Escudos: generadores
    for (const gy of [1780, 1960]) {
      tank(c, 3250, gy, '#5c6bc0', 80);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(3250, gy - 40, 0, 3250, gy - 40, 70); g.addColorStop(0, 'rgba(120,170,255,0.35)'); g.addColorStop(1, 'rgba(120,170,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(3250, gy - 40, 70, 0, 7); c.fill(); c.restore();
    }
    // Comunicaciones
    rack(c, 2335, 2300, 36, 100); rack(c, 2375, 2300, 36, 100); rack(c, 2685, 2150, 30, 90);
    // Almacén
    crate(c, 1985, 1950, 90, 40, 36, '#8d6e63'); crate(c, 2140, 1500, 70, 40, 40, '#a1887f');
    barrel(c, 1760, 1680, '#1565c0'); barrel(c, 1795, 1690, '#1565c0');
    // Administración
    for (const p of [[2445, 1420], [2535, 1425], [2625, 1420]]) chair(c, p[0], p[1], '#2e4a6b');
    // Electricidad
    box(c, 1470, 1740, 60, 40, 60, '#fdd835', '#c6a700');
    c.fillStyle = '#1c1c1c'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('⚡', 1500, 1712);
    rack(c, 1190, 1810, 34, 80);
    // Pasillos
    crate(c, 720, 1580, 50, 30, 30, '#8d6e63');
    barrel(c, 1500, 1990, '#546e7a');
    crate(c, 3010, 1500, 44, 30, 30, '#7d8d6a');
  }

  // ------------------------------------------------------------ construcción
  function build(map) {
    if (built[map.id]) return built[map.id];
    const cv = document.createElement('canvas');
    cv.width = map.w; cv.height = map.h;
    const c = cv.getContext('2d');
    const cols = Math.ceil(map.w / G), rows = Math.ceil(map.h / G);
    const floor = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) floor[j * cols + i] = Shared.inFloor(map, i * G + G / 2, j * G + G / 2) ? 1 : 0;
    const F = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && floor[j * cols + i];

    // casco
    const hull = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let h = 0;
      for (let dj = -2; dj <= 7 && !h; dj++) for (let di = -2; di <= 2 && !h; di++) if (F(i + di, j + dj)) h = 1;
      hull[j * cols + i] = h;
    }
    const H = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && hull[j * cols + i];
    c.fillStyle = '#0c0f16';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (H(i, j) || H(i - 1, j) || H(i + 1, j) || H(i, j - 1) || H(i, j + 1)) c.fillRect(i * G - 4, j * G - 4, G + 8, G + 8);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!H(i, j)) continue;
      c.fillStyle = ((i >> 2) + (j >> 2)) % 2 ? '#3a4150' : '#373e4c';
      c.fillRect(i * G, j * G, G, G);
    }
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 2;
    for (let j = 0; j < rows; j += 4) for (let i = 0; i < cols; i++) if (H(i, j)) { c.beginPath(); c.moveTo(i * G, j * G); c.lineTo(i * G + G, j * G); c.stroke(); }

    // suelos
    const pats = {};
    const pat = (k) => pats[k] || (pats[k] = c.createPattern(FLOORS[k](), 'repeat'));
    for (const h of map.halls) { c.fillStyle = pat('hall'); c.fillRect(h.x, h.y, h.w, h.h); }
    for (const r of map.rooms) { c.fillStyle = pat(r.floor); c.fillRect(r.r.x, r.r.y, r.r.w, r.r.h); }
    // sombreado interior de las salas
    for (const r of map.rooms) {
      const g = c.createRadialGradient(r.r.x + r.r.w / 2, r.r.y + r.r.h / 2, 10, r.r.x + r.r.w / 2, r.r.y + r.r.h / 2, Math.max(r.r.w, r.r.h) * 0.75);
      g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
      c.fillStyle = g; c.fillRect(r.r.x, r.r.y, r.r.w, r.r.h);
    }

    for (const r of map.rooms) grime(c, r.r.x, r.r.y, r.r.w, r.r.h, r.r.x * 3 + r.r.y, Math.floor(r.r.w * r.r.h / 900));
    for (const h of map.halls) grime(c, h.x, h.y, h.w, h.h, h.x + h.y * 7, Math.floor(h.w * h.h / 900));
    ambient(c, map);
    // franjas de peligro en las puertas
    for (const d of map.doors) {
      if (d.dir === 'v') { hazard(c, d.r.x + 2, d.r.y, 8, d.r.h); hazard(c, d.r.x + d.r.w - 10, d.r.y, 8, d.r.h); }
      else { hazard(c, d.r.x, d.r.y + 2, d.r.w, 8); hazard(c, d.r.x, d.r.y + d.r.h - 10, d.r.w, 8); }
    }

    // paredes frontales (vista 3/4)
    const roomAtCell = (x, y) => Shared.roomAt(map, x, y);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!F(i, j) || F(i, j - 1)) continue;
      const rm = roomAtCell(i * G + G / 2, j * G + G / 2);
      const wc = WALLCOL[rm ? rm.floor : 'hall'];
      let hgt = 0;
      while (hgt < WALL / G && !F(i, j - 1 - hgt)) hgt++;
      const y0 = j * G, top = y0 - hgt * G;
      const g = c.createLinearGradient(0, y0 - WALL, 0, y0);
      g.addColorStop(0, wc[0]); g.addColorStop(0.85, wc[1]); g.addColorStop(1, wc[1]);
      c.fillStyle = g; c.fillRect(i * G, top, G, y0 - top);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(i * G, y0 - 10, G, 10);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(i * G, y0 - 40, G, 3);
      if (i % 4 === 0) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(i * G, top, 2, y0 - top - 10); }
      c.fillStyle = OUT; c.fillRect(i * G, top - 4, G, 5);
    }
    // bordes laterales e inferiores
    c.fillStyle = '#1a1e27';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!F(i, j)) continue;
      if (!F(i - 1, j)) c.fillRect(i * G - 10, j * G - (F(i - 1, j - 1) ? 0 : 0), 10, G);
      if (!F(i + 1, j)) c.fillRect(i * G + G, j * G, 10, G);
      if (!F(i, j + 1)) {
        c.fillRect(i * G - (F(i - 1, j) ? 0 : 10), j * G + G, G + (F(i + 1, j) ? 0 : 10) + (F(i - 1, j) ? 0 : 10) - (F(i - 1, j) ? 0 : 0), 16);
      }
    }
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (F(i, j) && !F(i, j + 1)) c.fillRect(i * G, j * G + G, G, 2);
    // sombra suave dentro del suelo junto a las paredes
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!F(i, j)) continue;
      if (!F(i, j - 1)) c.fillRect(i * G, j * G, G, 12);
      if (!F(i - 1, j)) c.fillRect(i * G, j * G, 8, G);
    }

    wallDetails(c, map, F, cols, rows);
    // remaches del casco
    c.fillStyle = 'rgba(255,255,255,0.07)';
    for (let j = 0; j < rows; j += 2) for (let i = 0; i < cols; i += 2) if (H(i, j) && !F(i, j) && !F(i, j + 1) && !F(i, j + 2) && !F(i, j + 3) && !F(i, j + 4) && !F(i, j + 5)) c.fillRect(i * G + 9, j * G + 9, 3, 3);

    // decoraciones
    if (map.id === 'ship') floorProps(c);
    decorate(c, map);
    if (map.id === 'ship') propsShip(c);
    for (const v of map.vents) vent(c, v.x, v.y);
    if (map.id === 'ship') {
      const seen = new Set();
      for (const k in Shared.TASKS) {
        for (const st of Shared.TASKS[k].steps) {
          for (const o of (st.options || [st])) {
            const key = o.x + ',' + o.y;
            if (seen.has(key)) continue;
            seen.add(key);
            taskObject(c, map, o.game, o.x, o.y, o);
          }
        }
      }
      taskObject(c, map, 'lights', Shared.SABOTAGE_STATIONS.lights[0].x, Shared.SABOTAGE_STATIONS.lights[0].y);
      for (const s of Shared.SABOTAGE_STATIONS.reactor) taskObject(c, map, 'hand', s.x, s.y);
      for (const s of Shared.SABOTAGE_STATIONS.o2) taskObject(c, map, 'keypad', s.x, s.y);
    }
    built[map.id] = { canvas: cv, vgrid: Shared.buildVisionGrid(map), map };
    return built[map.id];
  }

  // ------------------------------------------------------------ fondo espacial
  const starLayers = [];
  (function () {
    let s = 42;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let l = 0; l < 3; l++) {
      const arr = [];
      for (let i = 0; i < 140; i++) arr.push([r() * 1400, r() * 1400, 0.5 + r() * (l + 1) * 0.7, 0.3 + r() * 0.7]);
      starLayers.push(arr);
    }
  })();

  function drawSpace(c, w, h, cx, cy, t) {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#04050b'); g.addColorStop(0.6, '#070a18'); g.addColorStop(1, '#0c0a1c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const neb = c.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, Math.max(w, h) * 0.6);
    neb.addColorStop(0, 'rgba(90,60,160,0.16)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = neb; c.fillRect(0, 0, w, h);
    starLayers.forEach((arr, l) => {
      const f = 0.03 + l * 0.05;
      for (const st of arr) {
        const x = ((st[0] - cx * f - t * (4 + l * 6)) % 1400 + 1400) % 1400;
        const y = ((st[1] - cy * f) % 1400 + 1400) % 1400;
        for (let ox = 0; ox < w; ox += 1400) for (let oy = 0; oy < h; oy += 1400) {
          c.globalAlpha = st[3] * (0.7 + 0.3 * Math.sin(t * 2 + st[0]));
          c.fillStyle = '#fff';
          c.fillRect(x + ox, y + oy, st[2], st[2]);
        }
      }
    });
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ efectos animados
  function drawLive(c, map, t, info) {
    if (map.id === 'ship') {
      // llamas de los motores
      for (const ey of [420, 1760]) {
        for (let k = 0; k < 3; k++) {
          const fl = 60 + Math.sin(t * 20 + k * 2 + ey) * 12 + k * 10;
          const g = c.createRadialGradient(240, ey + 40, 4, 240 - fl * 0.6, ey + 40, fl);
          g.addColorStop(0, 'rgba(255,255,220,0.9)'); g.addColorStop(0.3, 'rgba(255,170,40,0.7)'); g.addColorStop(1, 'rgba(255,60,0,0)');
          c.fillStyle = g;
          c.beginPath(); c.ellipse(240 - fl * 0.5, ey + 40, fl, 40 - k * 6, 0, 0, 7); c.fill();
        }
      }
      // núcleo del reactor
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const crit = info.sab === 'reactor';
      const g = c.createRadialGradient(240, 1140, 5, 240, 1140, 90);
      g.addColorStop(0, crit ? 'rgba(255,80,60,0.95)' : 'rgba(120,240,255,0.95)');
      g.addColorStop(1, crit ? 'rgba(255,0,0,0)' : 'rgba(0,160,255,0)');
      c.fillStyle = g; c.globalAlpha = 0.6 + pulse * 0.4;
      c.beginPath(); c.ellipse(240, 1140, 60, 70, 0, 0, 7); c.fill(); c.globalAlpha = 1;
      // holograma de administración
      c.save();
      c.globalAlpha = 0.55 + 0.2 * Math.sin(t * 6);
      c.strokeStyle = '#69f0ae'; c.lineWidth = 2;
      c.strokeRect(2470, 1255, 130, 40);
      c.beginPath(); c.moveTo(2480, 1275); c.lineTo(2590, 1275); c.moveTo(2535, 1260); c.lineTo(2535, 1290); c.stroke();
      c.restore();
      // luces parpadeantes
      for (let i = 0; i < 26; i++) {
        const x = 300 + (i * 977) % 3500, y = 200 + (i * 613) % 2000;
        if (!Shared.inFloor(map, x, y + 40)) continue;
        if (Math.sin(t * (1.5 + i % 4) + i) > 0.6) { c.fillStyle = i % 3 ? '#4fc3f7' : '#ff5252'; c.fillRect(x, y, 4, 4); }
      }
    }
    // ventilas animadas
    for (const vfx of info.ventFx) {
      const v = map.vents.find(v => v.id === vfx.id);
      if (!v) continue;
      const k = Math.min(1, (t - vfx.t) / 0.6);
      const open = Math.sin(k * Math.PI);
      c.fillStyle = '#111'; rr(c, v.x - 26, v.y - 13, 52, 26, 4); c.fill();
      c.save(); c.translate(v.x, v.y - 13); c.scale(1, 1 - open * 1.6);
      c.fillStyle = '#747d8c'; rr(c, -26, 0, 52, 26, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    // puertas
    for (const d of map.doors) {
      const closed = info.closedDoors.indexOf(d.id) >= 0;
      if (!closed) continue;
      c.lineWidth = 2.5; c.strokeStyle = OUT;
      if (d.dir === 'v') {
        c.fillStyle = '#7b8494'; rr(c, d.r.x + 8, d.r.y - 70, 24, d.r.h + 70, 3); c.fill(); c.stroke();
        c.fillStyle = '#ffca28'; for (let y = d.r.y - 60; y < d.r.y + d.r.h - 10; y += 30) c.fillRect(d.r.x + 12, y, 16, 8);
      } else {
        c.fillStyle = '#5d6674'; rr(c, d.r.x, d.r.y - 70, d.r.w, 76, 3); c.fill(); c.stroke();
        c.fillStyle = '#8a93a3'; rr(c, d.r.x, d.r.y + 6, d.r.w, 30, 3); c.fill(); c.stroke();
        c.fillStyle = '#ffca28'; for (let x = d.r.x + 8; x < d.r.x + d.r.w - 10; x += 26) c.fillRect(x, d.r.y - 40, 14, 10);
      }
    }
    // resaltado de objetos interactivos
    for (const h of info.highlights) {
      const a = h.strong ? 0.9 : 0.35 + 0.15 * Math.sin(t * 4);
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = h.color || '#ffe94d';
      c.lineWidth = h.strong ? 4 : 3;
      c.shadowColor = h.color || '#ffe94d'; c.shadowBlur = 14;
      if (h.wall) { rr(c, h.x - 34, h.wall - 84, 68, 74, 8); c.stroke(); }
      else { c.beginPath(); c.ellipse(h.x, h.y - 30, 48, 42, 0, 0, 7); c.stroke(); }
      c.restore();
    }
  }

  // ------------------------------------------------------------ visión
  // Rayos con refinamiento binario: el borde de las sombras queda exacto y no tiembla al caminar
  function visionPolygon(map, vg, ox, oy, radius, closedDoors) {
    const pts = [];
    const N = 360;
    const doors = map.doors.filter(d => closedDoors.indexOf(d.id) >= 0);
    const blocked = (x, y) => {
      const i = Math.floor(x / G), j = Math.floor(y / G);
      if (i < 0 || j < 0 || i >= vg.cols || j >= vg.rows || vg.g[j * vg.cols + i]) return true;
      for (let k = 0; k < doors.length; k++) if (Shared.inRect(doors[k].r, x, y)) return true;
      return false;
    };
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let d = 0, hit = false;
      const step = 10;
      while (d < radius) {
        d += step;
        if (blocked(ox + dx * d, oy + dy * d)) { hit = true; break; }
      }
      if (hit) {
        let lo = d - step, hi = d;
        for (let it = 0; it < 5; it++) {
          const mid = (lo + hi) / 2;
          if (blocked(ox + dx * mid, oy + dy * mid)) hi = mid; else lo = mid;
        }
        d = lo;
        // deja ver un poco de la pared (más en las paredes de arriba, que tienen cara frontal)
        d += dy < -0.15 ? WALL * 0.95 : 12;
      }
      d = Math.min(d, radius);
      pts.push(ox + dx * d, oy + dy * d);
    }
    return pts;
  }

  function drawFog(fc, pts, ox, oy, radius) {
    fc.save();
    fc.globalCompositeOperation = 'destination-out';
    const g = fc.createRadialGradient(ox, oy, radius * 0.62, ox, oy, radius);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fc.fillStyle = g;
    if ('filter' in fc) fc.filter = 'blur(5px)';
    fc.beginPath();
    fc.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) fc.lineTo(pts[i], pts[i + 1]);
    fc.closePath();
    fc.fill();
    fc.restore();
  }

  function canSee(map, vg, ax, ay, bx, by, radius, closedDoors) {
    if (Math.hypot(bx - ax, by - ay) > radius * 0.95) return false;
    return Shared.lineOfSight(map, vg, ax, ay, bx, by, closedDoors);
  }

  window.World = { build, drawSpace, drawLive, visionPolygon, drawFog, canSee, wallTopFor, WALL };
})();
