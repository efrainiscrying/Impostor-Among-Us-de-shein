/* Motor de sonido 100% sintetizado con WebAudio: efectos, ambiente y música. */
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, noiseBuf = null;
  const prefs = loadPrefs();

  function loadPrefs() {
    try { return Object.assign({ sfx: 0.8, music: 0.5, amb: 0.6 }, JSON.parse(localStorage.getItem('aut_audio') || '{}')); }
    catch (e) { return { sfx: 0.8, music: 0.5, amb: 0.6 }; }
  }
  function savePrefs() { try { localStorage.setItem('aut_audio', JSON.stringify(prefs)); } catch (e) { /* */ } }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    applyPrefs();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingMusic) { const m = pendingMusic; pendingMusic = null; music(m); }
  }

  function applyPrefs() {
    if (!ctx) return;
    sfxBus.gain.value = prefs.sfx;
    musicBus.gain.value = prefs.music * 0.55;
    ambBus.gain.value = prefs.amb * 0.7;
  }

  function now() { return ctx.currentTime; }

  // tono básico con envolvente
  function tone(f, dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = now() + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const v = (o.vol == null ? 0.3 : o.vol);
    const a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = o.filterType || 'lowpass';
      bq.frequency.value = o.filter;
      if (o.q) bq.Q.value = o.q;
      osc.connect(bq); node = bq;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  function noise(dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = now() + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = o.type || 'lowpass';
    bq.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.slide) bq.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    bq.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    const v = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq); bq.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  const S = {};
  S.init = init;
  S.prefs = prefs;
  S.set = function (k, v) { prefs[k] = v; savePrefs(); applyPrefs(); };

  // ---------------- Interfaz
  S.click = () => { tone(1400, 0.05, { type: 'triangle', vol: 0.12 }); tone(900, 0.06, { type: 'sine', vol: 0.1, delay: 0.015 }); };
  S.tap = () => tone(1800, 0.035, { type: 'sine', vol: 0.07 });
  S.hover = () => tone(2400, 0.02, { type: 'sine', vol: 0.025 });
  S.open = () => { tone(500, 0.18, { type: 'sine', vol: 0.12, slide: 900 }); noise(0.16, { freq: 3000, slide: 6000, vol: 0.04, type: 'bandpass' }); };
  S.close = () => { tone(800, 0.16, { type: 'sine', vol: 0.1, slide: 420 }); noise(0.12, { freq: 5000, slide: 2000, vol: 0.03, type: 'bandpass' }); };
  S.swoosh = () => noise(0.35, { freq: 400, slide: 4000, vol: 0.12, type: 'bandpass', q: 1.5, attack: 0.08 });
  S.pop = () => { tone(600, 0.08, { vol: 0.15, slide: 1200 }); };
  S.error = () => { tone(220, 0.12, { type: 'square', vol: 0.08, filter: 1200 }); tone(165, 0.18, { type: 'square', vol: 0.08, filter: 1200, delay: 0.1 }); };
  S.success = () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); };
  S.taskDone = () => {
    [659, 880, 1109, 1319].forEach((f, i) => tone(f, 0.45, { type: 'sine', vol: 0.16, delay: i * 0.06 }));
    tone(2637, 0.6, { type: 'sine', vol: 0.05, delay: 0.25 });
  };
  S.step = () => tone(1200 + Math.random() * 200, 0.05, { type: 'square', vol: 0.03, filter: 2500 });
  S.chat = () => { tone(1320, 0.07, { vol: 0.1 }); tone(1760, 0.1, { vol: 0.08, delay: 0.05 }); };
  S.join = () => { tone(523, 0.12, { type: 'triangle', vol: 0.1 }); tone(784, 0.18, { type: 'triangle', vol: 0.1, delay: 0.08 }); };
  S.leave = () => { tone(784, 0.12, { type: 'triangle', vol: 0.1 }); tone(523, 0.18, { type: 'triangle', vol: 0.1, delay: 0.08 }); };
  S.tick = () => tone(2000, 0.03, { type: 'square', vol: 0.04, filter: 3000 });
  S.type = () => { noise(0.03, { freq: 3000 + Math.random() * 2000, type: 'bandpass', vol: 0.08, q: 3 }); };
  S.countdown = (last) => tone(last ? 1320 : 880, last ? 0.4 : 0.15, { type: 'square', vol: 0.08, filter: 2000 });

  // ---------------- Movimiento y mundo
  let stepAlt = false;
  S.footstep = () => {
    stepAlt = !stepAlt;
    noise(0.07, { freq: stepAlt ? 900 : 700, type: 'bandpass', vol: 0.11, q: 1.2 });
    tone(stepAlt ? 95 : 80, 0.06, { vol: 0.07, type: 'sine' });
  };
  S.vent = () => {
    noise(0.25, { freq: 1800, slide: 400, type: 'bandpass', vol: 0.3, q: 2 });
    tone(140, 0.2, { type: 'square', vol: 0.12, filter: 600, slide: 60 });
    tone(520, 0.08, { type: 'triangle', vol: 0.12, delay: 0.1 });
    noise(0.3, { freq: 600, type: 'lowpass', vol: 0.15, delay: 0.12 });
  };
  S.ventMove = () => { noise(0.35, { freq: 300, slide: 1500, type: 'bandpass', vol: 0.18, attack: 0.1 }); tone(90, 0.3, { vol: 0.1, type: 'triangle' }); };
  S.door = () => {
    noise(0.12, { freq: 2000, slide: 300, vol: 0.25 });
    tone(70, 0.4, { type: 'square', vol: 0.18, filter: 300 });
    noise(0.5, { freq: 200, vol: 0.2, delay: 0.08 });
  };
  S.doorOpen = () => { noise(0.4, { freq: 300, slide: 2500, type: 'bandpass', vol: 0.12, attack: 0.05 }); };
  S.kill = () => {
    noise(0.12, { freq: 5000, slide: 1500, type: 'highpass', vol: 0.3 });
    tone(180, 0.25, { type: 'sawtooth', vol: 0.2, slide: 50, filter: 900 });
    noise(0.35, { freq: 500, slide: 120, vol: 0.35, delay: 0.08 });
    tone(60, 0.5, { type: 'sine', vol: 0.4, delay: 0.05, slide: 30 });
  };
  S.shot = () => { noise(0.25, { freq: 2500, slide: 300, vol: 0.45 }); tone(90, 0.3, { type: 'square', vol: 0.25, slide: 40, filter: 800 }); noise(0.6, { freq: 400, vol: 0.15, delay: 0.1 }); };
  S.emote = () => { tone(880, 0.08, { vol: 0.1, slide: 1320 }); tone(1320, 0.12, { vol: 0.07, delay: 0.06 }); };
  S.confetti = () => { for (let i = 0; i < 8; i++) tone(1200 + Math.random() * 1600, 0.06, { vol: 0.04, delay: i * 0.03 }); noise(0.2, { freq: 5000, type: 'highpass', vol: 0.08 }); };
  S.camStatic = () => noise(0.5, { freq: 3000, type: 'bandpass', vol: 0.12, q: 0.5 });
  S.stab = () => { noise(0.08, { freq: 7000, slide: 2500, type: 'highpass', vol: 0.25 }); tone(300, 0.1, { type: 'sawtooth', vol: 0.12, slide: 80, filter: 1500 }); };
  S.killReady = () => { tone(440, 0.1, { type: 'square', vol: 0.05, filter: 1000 }); tone(660, 0.14, { type: 'square', vol: 0.05, filter: 1000, delay: 0.08 }); };
  S.body = () => { tone(110, 1.2, { type: 'sawtooth', vol: 0.12, filter: 500 }); tone(116, 1.2, { type: 'sawtooth', vol: 0.12, filter: 500 }); };

  // ---------------- Reuniones
  S.report = () => {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.22, { type: 'square', vol: 0.12, filter: 2500, delay: i * 0.28 });
      tone(660, 0.22, { type: 'square', vol: 0.12, filter: 2500, delay: i * 0.28 + 0.12 });
    }
    tone(55, 1.2, { type: 'sawtooth', vol: 0.25, filter: 200 });
    noise(0.9, { freq: 200, vol: 0.25 });
  };
  S.emergency = () => {
    for (let i = 0; i < 4; i++) tone(520, 0.35, { type: 'sawtooth', vol: 0.12, slide: 980, filter: 3000, delay: i * 0.35 });
    tone(55, 1.4, { type: 'sawtooth', vol: 0.25, filter: 200 });
  };
  S.meetingHit = () => {
    tone(73, 1.6, { type: 'sawtooth', vol: 0.3, filter: 400 });
    tone(110, 1.6, { type: 'sawtooth', vol: 0.18, filter: 600 });
    tone(146.8, 1.6, { type: 'triangle', vol: 0.12 });
    noise(1.2, { freq: 800, slide: 100, vol: 0.3, attack: 0.01 });
  };
  S.vote = () => { tone(300, 0.08, { type: 'square', vol: 0.12, filter: 1200 }); noise(0.1, { freq: 1500, vol: 0.2 }); tone(1000, 0.1, { vol: 0.08, delay: 0.06 }); };
  S.voted = () => tone(1500, 0.06, { vol: 0.05 });
  S.reveal = () => { noise(0.2, { freq: 1000, vol: 0.12 }); tone(200, 0.2, { type: 'triangle', vol: 0.1 }); };
  S.eject = () => {
    noise(3.5, { freq: 150, slide: 2000, type: 'bandpass', vol: 0.12, attack: 1.2, q: 0.6 });
    tone(55, 4, { type: 'sine', vol: 0.12, attack: 0.5 });
    tone(82.4, 4, { type: 'sine', vol: 0.08, attack: 1 });
  };
  S.drum = () => { tone(60, 0.35, { vol: 0.35, slide: 40 }); noise(0.12, { freq: 400, vol: 0.12 }); };

  // ---------------- Roles y final
  S.shh = () => { noise(1.4, { freq: 4500, type: 'bandpass', vol: 0.18, attack: 0.25, q: 0.9 }); };
  S.roleCrew = () => {
    [261.6, 329.6, 392, 523.3].forEach((f, i) => tone(f, 2.4, { type: 'triangle', vol: 0.1, attack: 0.02 + i * 0.03 }));
    tone(1046, 1.5, { vol: 0.06, delay: 0.25 });
    S.drum();
  };
  S.roleImp = () => {
    [110, 130.8, 155.6, 196].forEach((f) => tone(f, 2.6, { type: 'sawtooth', vol: 0.09, filter: 900 }));
    tone(55, 2.6, { type: 'sine', vol: 0.3 });
    S.drum();
    noise(1.5, { freq: 300, vol: 0.12 });
  };
  S.victory = () => {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => tone(f, i === seq.length - 1 ? 1.4 : 0.22, { type: 'triangle', vol: 0.13, delay: i * 0.12 }));
    [261.6, 329.6, 392].forEach(f => tone(f, 2.2, { type: 'sine', vol: 0.08, delay: 0.72, attack: 0.1 }));
  };
  S.defeat = () => {
    [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 1.6 : 0.4, { type: 'triangle', vol: 0.13, delay: i * 0.35 }));
    [130.8, 155.6, 196].forEach(f => tone(f, 2, { type: 'sine', vol: 0.08, delay: 1.05, attack: 0.1 }));
  };

  // ---------------- Sabotaje
  let alarmTimer = null;
  S.alarm = (on, kind) => {
    clearInterval(alarmTimer);
    alarmTimer = null;
    if (!on || !ctx) return;
    const beep = () => {
      if (kind === 'reactor') { tone(740, 0.3, { type: 'square', vol: 0.07, filter: 2000 }); tone(555, 0.3, { type: 'square', vol: 0.07, filter: 2000, delay: 0.35 }); }
      else { tone(1000, 0.12, { type: 'square', vol: 0.05, filter: 2200 }); tone(1000, 0.12, { type: 'square', vol: 0.05, filter: 2200, delay: 0.2 }); }
    };
    beep();
    alarmTimer = setInterval(beep, kind === 'reactor' ? 900 : 1300);
  };
  S.lightsOff = () => { tone(400, 0.9, { type: 'sawtooth', vol: 0.15, slide: 40, filter: 1200 }); noise(0.3, { freq: 3000, vol: 0.12 }); };
  S.fixed = () => { tone(523, 0.2, { type: 'triangle', vol: 0.12 }); tone(784, 0.3, { type: 'triangle', vol: 0.12, delay: 0.1 }); tone(1046, 0.4, { type: 'triangle', vol: 0.1, delay: 0.2 }); };

  // ---------------- Minijuegos
  S.zap = () => { noise(0.15, { freq: 3000, type: 'bandpass', vol: 0.2, q: 4 }); tone(120, 0.12, { type: 'sawtooth', vol: 0.1 }); tone(1600, 0.1, { vol: 0.06, delay: 0.05 }); };
  S.swipe = () => noise(0.4, { freq: 800, slide: 3000, type: 'bandpass', vol: 0.12, q: 3 });
  S.beep = (f) => tone(f || 1200, 0.1, { type: 'square', vol: 0.06, filter: 3000 });
  S.laser = () => { tone(1800, 0.12, { type: 'sawtooth', vol: 0.08, slide: 300, filter: 4000 }); };
  S.boom = () => { noise(0.4, { freq: 1200, slide: 100, vol: 0.3 }); tone(80, 0.3, { vol: 0.2, slide: 40 }); };
  S.rumble = () => noise(0.25, { freq: 250, vol: 0.18 });
  S.suck = () => noise(0.3, { freq: 500, slide: 3000, type: 'bandpass', vol: 0.15 });
  S.switch = () => { tone(1800, 0.02, { type: 'square', vol: 0.1 }); noise(0.04, { freq: 4000, type: 'highpass', vol: 0.15 }); };
  S.simon = (i) => tone([262, 294, 330, 349, 392, 440, 494, 523, 587][i % 9], 0.28, { type: 'triangle', vol: 0.14 });
  S.scanHum = () => { tone(180, 1.5, { type: 'sawtooth', vol: 0.05, filter: 700, attack: 0.2 }); tone(360, 1.5, { vol: 0.04, attack: 0.2 }); };
  S.fill = (p) => tone(200 + p * 500, 0.08, { type: 'sine', vol: 0.05 });
  S.hand = () => { tone(90, 0.5, { type: 'sawtooth', vol: 0.08, filter: 500 }); noise(0.5, { freq: 1800, type: 'bandpass', vol: 0.06 }); };
  S.wrong = () => { tone(150, 0.3, { type: 'square', vol: 0.1, filter: 800 }); };

  // ---------------- Escondite
  S.heartbeat = (intensity) => {
    const v = 0.12 + intensity * 0.35;
    tone(55, 0.14, { vol: v, slide: 40 });
    tone(50, 0.16, { vol: v * 0.8, slide: 35, delay: 0.18 });
  };
  S.finalHide = () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 990, 0.2, { type: 'sawtooth', vol: 0.1, filter: 2500, delay: i * 0.22 }); };

  // ---------------- Música y ambiente
  let musicTimer = null, musicMode = null, pendingMusic = null, bar = 0;
  const PROG = [
    [146.8, 174.6, 220, 261.6, 329.6],  // Dm9
    [116.5, 146.8, 174.6, 220, 293.7],  // Bbmaj7
    [98, 146.8, 174.6, 233.1, 293.7],   // Gm9
    [110, 146.8, 164.8, 196, 277.2],    // A7sus
  ];
  function musicBar() {
    if (!ctx) return;
    const ch = PROG[bar % PROG.length];
    const dur = 4.2;
    ch.forEach((f, i) => {
      tone(f, dur + 0.8, { type: i ? 'triangle' : 'sine', vol: i ? 0.035 : 0.07, attack: 1.2, bus: musicBus, filter: 1400 });
      tone(f * 2, dur, { type: 'sine', vol: 0.012, attack: 1.5, bus: musicBus, detune: 7 });
    });
    const arp = [ch[2] * 2, ch[3] * 2, ch[4] * 2, ch[3] * 2, ch[2] * 4, ch[4] * 2, ch[3] * 2, ch[1] * 2];
    arp.forEach((f, i) => {
      if (Math.random() < 0.25) return;
      tone(f, 0.6, { type: 'triangle', vol: 0.025, bus: musicBus, delay: i * 0.5 + 0.05, filter: 3000 });
    });
    if (bar % 2 === 0) tone(ch[4] * 4, 2.5, { type: 'sine', vol: 0.012, bus: musicBus, delay: 1.2, attack: 0.6 });
    bar++;
  }
  function ambience() {
    if (!ctx) return;
    // zumbido grave de la nave
    tone(49, 6.5, { type: 'sawtooth', vol: 0.035, filter: 140, attack: 1.5, bus: ambBus });
    tone(49.4, 6.5, { type: 'sawtooth', vol: 0.035, filter: 140, attack: 1.5, bus: ambBus });
    noise(6.5, { freq: 220, vol: 0.05, attack: 2, bus: ambBus });
    // sonidos lejanos aleatorios
    const r = Math.random();
    if (r < 0.3) tone(1800 + Math.random() * 1500, 0.08, { type: 'sine', vol: 0.02, delay: 1 + Math.random() * 4, bus: ambBus });
    else if (r < 0.5) noise(0.8, { freq: 150 + Math.random() * 200, type: 'bandpass', q: 6, vol: 0.06, delay: Math.random() * 4, bus: ambBus, attack: 0.3 });
    else if (r < 0.62) { const d = Math.random() * 4; tone(300, 0.6, { type: 'sawtooth', vol: 0.02, slide: 200, filter: 600, delay: d, bus: ambBus }); }
  }
  function music(mode) {
    if (!ctx) { pendingMusic = mode; return; }
    if (musicMode === mode) return;
    clearInterval(musicTimer);
    musicMode = mode;
    if (mode === 'menu') { bar = 0; musicBar(); musicTimer = setInterval(musicBar, 4200); }
    else if (mode === 'ship') { ambience(); musicTimer = setInterval(ambience, 5200); }
  }
  S.music = music;
  S.stopMusic = () => { clearInterval(musicTimer); musicMode = null; };

  window.Sfx = S;
})();
