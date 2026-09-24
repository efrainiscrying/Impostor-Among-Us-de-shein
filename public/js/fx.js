/* Partículas del mundo (polvo, confeti, sangre, humo, destellos) y globos de emotes. */
(function () {
  'use strict';
  const list = [];
  const MAX = 600;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const CONF = ['#ff453a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff'];

  function add(p) { if (list.length < MAX) list.push(p); }

  const Fx = {
    dust(x, y) {
      for (let i = 0; i < 3; i++) add({ k: 'dust', x: x + rnd(-10, 10), y: y + rnd(-2, 3), vx: rnd(-18, 18), vy: rnd(-14, -4), life: 0, max: rnd(0.35, 0.6), r: rnd(3, 6) });
    },
    confetti(x, y, n) {
      for (let i = 0; i < (n || 40); i++) {
        const a = rnd(-Math.PI, 0), v = rnd(150, 420);
        add({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.9, 1.6), rot: rnd(0, 6), vr: rnd(-12, 12), c: CONF[i % CONF.length], w: rnd(5, 9), h: rnd(8, 13) });
      }
    },
    blood(x, y) {
      for (let i = 0; i < 26; i++) {
        const a = rnd(-Math.PI, 0), v = rnd(80, 300);
        add({ k: 'blood', x, y: y - 35, gy: y + rnd(-6, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(1.4, 2.4), r: rnd(2.5, 6) });
      }
      add({ k: 'ring', x, y: y - 30, life: 0, max: 0.5, r: 20, c: '255,60,60' });
    },
    puff(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = rnd(0, Math.PI * 2), v = rnd(30, 110);
        add({ k: 'puff', x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 30, life: 0, max: rnd(0.5, 0.9), r: rnd(8, 16) });
      }
    },
    spark(x, y, c) { add({ k: 'spark', x: x + rnd(-18, 18), y: y + rnd(-60, -10), vx: rnd(-10, 10), vy: rnd(-40, -15), life: 0, max: rnd(0.6, 1.1), c: c || '255,255,255' }); },
    ring(x, y, c) { add({ k: 'ring', x, y, life: 0, max: 0.8, r: 30, c: c || '100,210,255' }); },
    text(x, y, s, c) { add({ k: 'text', x, y, s, c: c || '#30d158', life: 0, max: 1.3 }); },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.max) { list.splice(i, 1); continue; }
        if (p.k === 'conf') { p.vy += 700 * dt; p.vx *= 0.985; p.rot += p.vr * dt; }
        if (p.k === 'blood') { if (p.y < p.gy) { p.vy += 900 * dt; } else { p.y = p.gy; p.vx *= 0.7; p.vy = 0; } }
        if (p.k === 'puff' || p.k === 'dust') { p.vx *= 0.92; p.vy *= 0.92; }
        if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
      }
    },

    draw(c) {
      for (const p of list) {
        const k = p.life / p.max;
        switch (p.k) {
          case 'dust':
            c.fillStyle = `rgba(200,205,215,${0.35 * (1 - k)})`;
            c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k), 0, 7); c.fill(); break;
          case 'puff':
            c.fillStyle = `rgba(150,160,175,${0.55 * (1 - k)})`;
            c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * 1.5), 0, 7); c.fill(); break;
          case 'conf':
            c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3;
            c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.3)) + 1); c.restore(); break;
          case 'blood':
            c.fillStyle = `rgba(150,0,10,${1 - Math.max(0, k - 0.6) / 0.4})`;
            c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); break;
          case 'spark': {
            const a = Math.sin(k * Math.PI);
            c.fillStyle = `rgba(${p.c},${a})`;
            const s = 3 + a * 3;
            c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.3, p.y - s * 0.3); c.lineTo(p.x + s, p.y); c.lineTo(p.x + s * 0.3, p.y + s * 0.3);
            c.lineTo(p.x, p.y + s); c.lineTo(p.x - s * 0.3, p.y + s * 0.3); c.lineTo(p.x - s, p.y); c.lineTo(p.x - s * 0.3, p.y - s * 0.3); c.closePath(); c.fill();
            break;
          }
          case 'ring':
            c.strokeStyle = `rgba(${p.c},${1 - k})`; c.lineWidth = 4 * (1 - k) + 1;
            c.beginPath(); c.ellipse(p.x, p.y, p.r + k * 90, (p.r + k * 90) * 0.5, 0, 0, 7); c.stroke(); break;
          case 'text':
            c.save(); c.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
            c.font = '900 26px Inter, system-ui, sans-serif'; c.textAlign = 'center';
            c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.8)';
            const yy = p.y - 30 - k * 60, sc = k < 0.15 ? 0.5 + k / 0.15 * 0.7 : 1.2 - Math.min(0.2, (k - 0.15));
            c.translate(p.x, yy); c.scale(sc, sc);
            c.strokeText(p.s, 0, 0); c.fillStyle = p.c; c.fillText(p.s, 0, 0);
            c.restore(); break;
        }
      }
    },

    // Globo de emote sobre la cabeza con rebote tipo resorte
    bubble(c, x, y, emoji, age) {
      const dur = 2.6;
      if (age > dur) return;
      const inT = Math.min(1, age / 0.35);
      const spring = 1 + Math.sin(inT * Math.PI * 1.5) * (1 - inT) * 0.5;
      const out = age > dur - 0.3 ? (dur - age) / 0.3 : 1;
      const s = inT * spring * out;
      c.save();
      c.translate(x, y - Math.sin(age * 3) * 3);
      c.scale(s, s);
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, -32, 28, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(0, 4); c.lineTo(8, -8); c.fill();
      c.font = '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(emoji, 0, -30);
      c.restore();
    },

    confettiDom(el) {
      for (let i = 0; i < 90; i++) {
        const d = document.createElement('i');
        d.className = 'confetti';
        d.style.left = Math.random() * 100 + '%';
        d.style.background = CONF[i % CONF.length];
        d.style.animationDuration = rnd(2.4, 4.5) + 's';
        d.style.animationDelay = rnd(0, 1.2) + 's';
        d.style.transform = `rotate(${rnd(0, 360)}deg)`;
        el.appendChild(d);
        setTimeout(() => d.remove(), 6500);
      }
    },
  };
  window.Fx = Fx;
})();
