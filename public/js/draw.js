/* Dibujo de personajes: tripulantes, sombreros, fantasmas y cuerpos. */
(function () {
  'use strict';
  const COL = {};
  for (const c of Shared.COLORS) COL[c.id] = c;
  const OUT = '#0b0d12';

  function col(id) { return COL[id] || COL.red; }

  function bodyPath(c) {
    c.beginPath();
    c.moveTo(-21, -24);
    c.lineTo(-21, -50);
    c.bezierCurveTo(-21, -80, 25, -80, 25, -50);
    c.lineTo(25, -22);
    c.quadraticCurveTo(25, -13, 16, -13);
    c.lineTo(-12, -13);
    c.quadraticCurveTo(-21, -13, -21, -24);
    c.closePath();
  }

  function ghostPath(c, t) {
    c.beginPath();
    c.moveTo(-21, -30);
    c.lineTo(-21, -50);
    c.bezierCurveTo(-21, -80, 25, -80, 25, -50);
    c.lineTo(25, -28);
    for (let i = 0; i <= 8; i++) {
      const x = 25 - i * 46 / 8;
      const y = -24 + Math.sin(t * 5 + i * 1.3) * 4 + (i % 2 ? 5 : -2);
      c.lineTo(x, y);
    }
    c.closePath();
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function leg(c, x, lift, color) {
    rr(c, x, -24 - lift, 16, 22, 7);
    c.fillStyle = color;
    c.fill();
    c.stroke();
  }

  function visor(c, glow) {
    rr(c, 3, -63, 30, 19, 9.5);
    c.fillStyle = '#95c9d9';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#4c7a93';
    c.beginPath();
    c.ellipse(18, -40, 20, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.ellipse(21, -57.5, 7, 3.2, 0, 0, Math.PI * 2);
    c.fill();
    if (glow) { c.fillStyle = glow; c.fillRect(0, -70, 40, 30); }
    c.restore();
    rr(c, 3, -63, 30, 19, 9.5);
    c.stroke();
  }

  function shade(c, color) {
    c.save();
    bodyPath(c);
    c.clip();
    c.fillStyle = color.shade;
    c.beginPath();
    c.ellipse(-26, -30, 20, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(-2, -68, 9, 4, -0.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // ------------------------------------------------------------ sombreros
  const HAT = {
    cap(c, k) {
      c.fillStyle = k.body; c.beginPath(); c.ellipse(2, -73, 22, 12, 0, Math.PI, 0); c.fill(); c.stroke();
      c.fillStyle = k.shade; rr(c, 6, -76, 30, 7, 3.5); c.fill(); c.stroke();
    },
    crown(c) {
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(-14, -70); c.lineTo(-16, -92); c.lineTo(-6, -82); c.lineTo(3, -97); c.lineTo(12, -82); c.lineTo(22, -92); c.lineTo(20, -70); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e8364f'; c.beginPath(); c.arc(3, -78, 3, 0, 7); c.fill();
      c.fillStyle = '#4fc3f7'; c.beginPath(); c.arc(-8, -76, 2.2, 0, 7); c.arc(14, -76, 2.2, 0, 7); c.fill();
    },
    party(c) {
      c.fillStyle = '#ff5fa2'; c.beginPath(); c.moveTo(-12, -71); c.lineTo(4, -106); c.lineTo(18, -71); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#ffe14d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-7, -82); c.lineTo(14, -82); c.moveTo(-2, -93); c.lineTo(10, -93); c.stroke();
      c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.fillStyle = '#7cf'; c.beginPath(); c.arc(4, -107, 4.5, 0, 7); c.fill(); c.stroke();
    },
    headphones(c) {
      c.lineWidth = 5; c.strokeStyle = '#222'; c.beginPath(); c.arc(2, -58, 26, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = OUT;
      c.fillStyle = '#e53935'; rr(c, -27, -64, 10, 18, 4); c.fill(); c.stroke(); rr(c, 22, -64, 10, 18, 4); c.fill(); c.stroke();
    },
    flower(c) {
      c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.ellipse(-8 + Math.cos(a) * 6, -76 + Math.sin(a) * 6, 5, 5, 0, 0, 7); c.fill(); c.stroke(); }
      c.fillStyle = '#ffcf33'; c.beginPath(); c.arc(-8, -76, 4, 0, 7); c.fill(); c.stroke();
    },
    chef(c) {
      c.fillStyle = '#fafafa';
      rr(c, -14, -84, 32, 14, 3); c.fill(); c.stroke();
      c.beginPath(); c.arc(-8, -90, 9, 0, 7); c.arc(3, -95, 10, 0, 7); c.arc(13, -90, 9, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#fafafa'; c.fillRect(-12, -92, 28, 10);
    },
    cowboy(c) {
      c.fillStyle = '#8d5a2b';
      c.beginPath(); c.ellipse(2, -72, 32, 7, 0, 0, 7); c.fill(); c.stroke();
      rr(c, -12, -94, 28, 22, 8); c.fill(); c.stroke();
      c.fillStyle = '#4a2c12'; c.fillRect(-12, -79, 28, 5);
    },
    horns(c) {
      c.fillStyle = '#c62828';
      c.beginPath(); c.moveTo(-14, -70); c.quadraticCurveTo(-26, -86, -16, -98); c.quadraticCurveTo(-14, -84, -4, -74); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(14, -72); c.quadraticCurveTo(28, -86, 20, -99); c.quadraticCurveTo(16, -84, 6, -76); c.closePath(); c.fill(); c.stroke();
    },
    halo(c, k, t) {
      c.save(); c.shadowColor = '#fff59d'; c.shadowBlur = 12;
      c.strokeStyle = '#ffe066'; c.lineWidth = 4.5; c.beginPath(); c.ellipse(2, -90 + Math.sin(t * 3) * 2, 17, 5, 0, 0, 7); c.stroke();
      c.restore(); c.lineWidth = 2.5; c.strokeStyle = OUT;
    },
    sprout(c) {
      c.strokeStyle = '#2e7d32'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, -72); c.lineTo(2, -86); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = OUT;
      c.fillStyle = '#66bb6a'; c.beginPath(); c.ellipse(-6, -89, 9, 5, -0.5, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.ellipse(10, -89, 9, 5, 0.5, 0, 7); c.fill(); c.stroke();
    },
    tophat(c) {
      c.fillStyle = '#222';
      c.beginPath(); c.ellipse(2, -72, 24, 5, 0, 0, 7); c.fill(); c.stroke();
      rr(c, -12, -102, 28, 30, 3); c.fill(); c.stroke();
      c.fillStyle = '#b71c1c'; c.fillRect(-12, -80, 28, 5);
    },
    beanie(c, k) {
      c.fillStyle = '#26a69a'; c.beginPath(); c.ellipse(2, -70, 22, 18, 0, Math.PI, 0); c.fill(); c.stroke();
      c.fillStyle = '#1b7e74'; rr(c, -21, -74, 46, 8, 4); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(2, -90, 5, 0, 7); c.fill(); c.stroke();
    },
    antenna(c, k, t) {
      c.beginPath(); c.moveTo(2, -73); c.lineTo(2 + Math.sin(t * 4) * 3, -98); c.stroke();
      c.fillStyle = (Math.floor(t * 3) % 2) ? '#ff5252' : '#ffeb3b';
      c.beginPath(); c.arc(2 + Math.sin(t * 4) * 3, -100, 5, 0, 7); c.fill(); c.stroke();
    },
    shein(c) {
      c.fillStyle = '#111'; rr(c, -12, -96, 30, 26, 3); c.fill(); c.stroke();
      c.strokeStyle = '#111'; c.lineWidth = 2.5; c.beginPath(); c.arc(3, -96, 8, Math.PI, 0); c.stroke();
      c.strokeStyle = OUT;
      c.fillStyle = '#fff'; c.fillRect(-6, -86, 18, 4); c.fillRect(-3, -80, 12, 2);
    },
  };

  // ------------------------------------------------------------ tripulante
  function bean(c, x, y, o) {
    o = o || {};
    const k = col(o.color);
    const s = o.scale || 1;
    const t = o.time != null ? o.time : performance.now() / 1000;
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -s : s, s);
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    c.lineJoin = 'round';
    c.lineWidth = 2.6;
    c.strokeStyle = OUT;

    if (o.ghost) {
      c.globalAlpha *= 0.55;
      c.translate(0, Math.sin(t * 2.4) * 4 - 6);
      // mochila
      c.fillStyle = k.shade; rr(c, -32, -58, 15, 28, 6); c.fill(); c.stroke();
      ghostPath(c, t); c.fillStyle = k.body; c.fill();
      c.save(); ghostPath(c, t); c.clip(); c.fillStyle = k.shade; c.beginPath(); c.ellipse(-26, -34, 18, 40, 0, 0, 7); c.fill(); c.restore();
      ghostPath(c, t); c.stroke();
      visor(c);
      if (o.hat && HAT[o.hat]) HAT[o.hat](c, k, t);
      c.restore();
      return;
    }

    if (!o.noShadow) {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.beginPath(); c.ellipse(2, 0, 25, 7, 0, 0, Math.PI * 2); c.fill();
    }

    const w = o.moving ? (o.walk || 0) : 0;
    const sw = o.moving ? Math.sin(w) : 0;
    const bob = o.moving ? Math.abs(Math.cos(w)) * 2.5 : 0;

    // pierna trasera
    c.save(); c.translate(sw * 5, 0); leg(c, -19, Math.max(0, sw) * 5, k.shade); c.restore();

    c.save();
    c.translate(0, -bob);
    if (o.lean) c.rotate(o.lean);
    // mochila
    c.fillStyle = k.shade;
    rr(c, -33, -57, 16, 30, 6); c.fill(); c.stroke();
    c.fillStyle = k.body;
    rr(c, -31, -55, 8, 24, 4); c.fill();
    // cuerpo
    bodyPath(c); c.fillStyle = k.body; c.fill();
    shade(c, k);
    bodyPath(c); c.stroke();
    visor(c, o.visorGlow);
    if (o.hat && HAT[o.hat]) { c.lineWidth = 2.5; HAT[o.hat](c, k, t); }
    c.restore();

    // pierna delantera
    c.save(); c.translate(-sw * 5, 0); leg(c, 5, Math.max(0, -sw) * 5, k.body);
    c.restore();
    c.restore();
  }

  // ------------------------------------------------------------ cuerpo
  function deadBody(c, x, y, colorId, o) {
    o = o || {};
    const k = col(colorId);
    c.save();
    c.translate(x, y);
    const s = o.scale || 1;
    c.scale(s, s);
    c.lineWidth = 2.6; c.strokeStyle = OUT; c.lineJoin = 'round';
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(2, 0, 26, 7, 0, 0, 7); c.fill();
    // charco
    c.fillStyle = 'rgba(120,0,10,0.35)';
    c.beginPath(); c.ellipse(-4, -2, 30, 9, 0.1, 0, 7); c.fill();
    leg(c, -19, 0, k.shade);
    leg(c, 5, 0, k.body);
    // media mitad inferior
    c.beginPath();
    c.moveTo(-21, -38);
    c.lineTo(-21, -24);
    c.quadraticCurveTo(-21, -13, -12, -13);
    c.lineTo(16, -13);
    c.quadraticCurveTo(25, -13, 25, -22);
    c.lineTo(25, -38);
    c.closePath();
    c.fillStyle = k.body; c.fill(); c.stroke();
    // interior cortado
    c.fillStyle = k.shade;
    c.beginPath(); c.ellipse(2, -38, 23, 7, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#b71c1c';
    c.beginPath(); c.ellipse(2, -38, 15, 4.5, 0, 0, 7); c.fill();
    // hueso
    c.fillStyle = '#f1efe6';
    rr(c, -1, -60, 7, 22, 3); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, -61, 5, 0, 7); c.arc(6, -61, 5, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#f1efe6'; c.fillRect(-1, -62, 7, 6);
    c.restore();
  }

  // ------------------------------------------------------------ utilidades
  const cache = new Map();
  function beanImage(colorId, hat, size, opts) {
    const key = colorId + '|' + hat + '|' + size + '|' + JSON.stringify(opts || {});
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    const dpr = 2;
    cv.width = size * dpr; cv.height = size * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const sc = size / 120;
    if (opts && opts.dead) deadBody(c, size / 2 - 2 * sc, size * 0.86, colorId, { scale: sc * 1.3 });
    else bean(c, size / 2 - 3 * sc, size * 0.93, { color: colorId, hat, scale: sc * (hat && hat !== 'none' ? 1.02 : 1.2), time: 0, noShadow: !!(opts && opts.noShadow), ghost: !!(opts && opts.ghost) });
    const url = cv.toDataURL();
    cache.set(key, url);
    return url;
  }

  window.Draw = { bean, deadBody, beanImage, col, rr, HAT };
})();
