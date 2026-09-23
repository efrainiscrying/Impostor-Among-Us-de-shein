/* Controlador principal: red, pantallas, entrada, bucle de juego, HUD y animaciones. */
(function () {
  'use strict';
  const S = Shared;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorName = id => (S.COLORS.find(c => c.id === id) || {}).name || id;
  const roomName = id => (S.SHIP.rooms.find(r => r.id === id) || {}).name || '';

  const App = {
    token: null, user: null, ws: null, connected: false, retry: 0,
    room: null, you: null, meta: new Map(),
    players: new Map(), me: { x: 700, y: 500, f: 0, m: 0, walk: 0, init: false },
    G: null, mapId: 'lobby', bodies: [], ventFx: [], closedDoors: [],
    cam: { x: 700, y: 500, zoom: 1 }, shake: 0,
    keys: {}, joy: { x: 0, y: 0 }, screen: 'scrSplash',
    chatOpen: false, unread: 0, pendingJoin: null, pendingBots: 0,
    lastSend: 0, lastSent: null, interact: {}, fx: null,
  };
  window.App = App;
  App._handle = m => handle(m);
  try { App.token = localStorage.getItem('aut_token'); } catch (e) { /* */ }

  // ================================================================ utilidades de UI
  function toast(text, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  function showScreen(id) {
    if (App.screen === id) return;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    App.screen = id;
    if (id === 'scrGame') Sfx.music('ship'); else Sfx.music('menu');
  }

  function openModal(id) { $('#' + id).classList.add('show'); Sfx.open(); }
  function closeModal(id) { const m = $('#' + id); if (m.classList.contains('show')) { m.classList.remove('show'); Sfx.close(); } }
  function anyModal() { return $$('.modal.show').length > 0; }
  $$('.modal').forEach(m => {
    m.addEventListener('pointerdown', e => { if (e.target === m) closeModal(m.id); });
    m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(m.id)));
  });

  function confirmBox(text, okLabel) {
    return new Promise(res => {
      const m = document.createElement('div');
      m.className = 'modal';
      m.innerHTML = `<div class="sheet glass small"><header><b>¿Seguro?</b></header><p style="margin:0 0 18px;color:var(--muted)">${esc(text)}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn ghost" data-a="0">Cancelar</button><button class="btn danger" data-a="1">${esc(okLabel || 'Sí')}</button></div></div>`;
      document.body.appendChild(m);
      requestAnimationFrame(() => m.classList.add('show'));
      m.addEventListener('click', e => {
        const a = e.target.closest('[data-a]');
        if (!a && e.target !== m) return;
        m.classList.remove('show');
        setTimeout(() => m.remove(), 400);
        Sfx.click();
        res(a ? a.dataset.a === '1' : false);
      });
    });
  }

  function beanImg(color, hat, size, opts) { return Draw.beanImage(color, hat || 'none', size || 96, opts); }

  // sonido en todos los botones
  document.addEventListener('pointerdown', e => {
    Sfx.init();
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    const b = e.target.closest('button, .swatch, .hat, .mode-card, .room-item');
    if (b && !b.closest('#actions')) Sfx.tap();
  }, true);

  // ================================================================ fondo de menú
  const bg = $('#menuBg');
  const bgc = bg.getContext('2d');
  const floaters = [];
  for (let i = 0; i < 7; i++) floaters.push(newFloater(true));
  function newFloater(init) {
    const c = S.COLORS[Math.floor(Math.random() * S.COLORS.length)].id;
    const h = S.HATS[Math.floor(Math.random() * S.HATS.length)].id;
    return { c, h, x: init ? Math.random() : -0.15, y: 0.1 + Math.random() * 0.8, s: 0.5 + Math.random() * 0.9, v: 0.008 + Math.random() * 0.02, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.8 };
  }
  function drawMenuBg(t, dt) {
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (bg.width !== w * dpr || bg.height !== h * dpr) { bg.width = w * dpr; bg.height = h * dpr; }
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    World.drawSpace(bgc, w, h, t * 40, t * 6, t);
    for (const f of floaters) {
      f.x += f.v * dt; f.r += f.vr * dt;
      if (f.x > 1.2) Object.assign(f, newFloater(false));
      bgc.save();
      bgc.translate(f.x * w, f.y * h + Math.sin(t + f.r) * 10);
      bgc.rotate(f.r);
      Draw.bean(bgc, 0, 36 * f.s, { color: f.c, hat: f.h, scale: f.s * 0.9, noShadow: true, time: t });
      bgc.restore();
    }
  }

  // ================================================================ autenticación
  let authMode = 'login';
  $$('#authSeg .seg').forEach(b => b.addEventListener('click', () => {
    authMode = b.dataset.mode;
    $$('#authSeg .seg').forEach(x => x.classList.toggle('active', x === b));
    $('#authSeg').classList.toggle('reg', authMode === 'register');
    $('.auth-card').classList.toggle('reg', authMode === 'register');
    $('#authSubmit').textContent = authMode === 'register' ? 'Crear cuenta' : 'Entrar';
    $('#authPass').autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
    $('#authHint').innerHTML = authMode === 'register' ? 'Elige un nombre (3-14 letras) y una contraseña que recuerdes.' : '¿No tienes cuenta? Toca <b>Crear cuenta</b>. Solo necesitas un usuario y una contraseña.';
    $('#authError').textContent = '';
  }));

  function authError(t) {
    const e = $('#authError');
    e.textContent = t;
    e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake');
    Sfx.error();
  }

  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('#authUser').value.trim(), password = $('#authPass').value;
    if (authMode === 'register' && password !== $('#authPass2').value) return authError('Las contraseñas no coinciden.');
    const btn = $('#authSubmit');
    btn.disabled = true;
    try {
      const r = await fetch('/api/' + (authMode === 'register' ? 'register' : 'login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok || data.error) return authError(data.error || 'Error de conexión.');
      App.token = data.token;
      try { localStorage.setItem('aut_token', data.token); } catch (err) { /* */ }
      Sfx.success();
      if (authMode === 'register') toast(`¡Cuenta creada! Bienvenido, ${data.user.username} 🚀`);
      onLoggedIn(data.user);
    } catch (err) {
      authError('No se pudo conectar con el servidor.');
    } finally { btn.disabled = false; }
  });

  async function checkSession() {
    if (!App.token) return false;
    try {
      const r = await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: App.token }) });
      if (!r.ok) return false;
      const d = await r.json();
      onLoggedIn(d.user);
      return true;
    } catch (e) { return false; }
  }

  function onLoggedIn(user) {
    App.user = user;
    renderHome();
    showScreen('scrHome');
    connect();
  }

  async function logout() {
    try { await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: App.token }) }); } catch (e) { /* */ }
    try { localStorage.removeItem('aut_token'); } catch (e) { /* */ }
    App.token = null; App.user = null;
    if (App.ws) { App.ws.onclose = null; App.ws.close(); App.ws = null; }
    showScreen('scrAuth');
  }

  // ================================================================ portada
  const params = new URLSearchParams(location.search);
  App.pendingJoin = (params.get('sala') || '').toUpperCase() || null;
  $('#btnStart').addEventListener('click', async () => {
    Sfx.init();
    Sfx.click();
    Sfx.music('menu');
    const ok = await checkSession();
    if (!ok) showScreen('scrAuth');
  });

  // ================================================================ menú principal
  function renderHome() {
    const u = App.user;
    if (!u) return;
    $('#chipName').textContent = u.username;
    $('#chipBean').src = beanImg(u.color, u.hat, 64, { noShadow: true });
    $('#heroName').textContent = u.username;
    const st = u.stats || {};
    $('#stats').innerHTML = [['Partidas', st.games || 0], ['Victorias', st.wins || 0], ['Tareas', st.tasks || 0], ['Eliminaciones', st.kills || 0]]
      .map(s => `<div class="stat glass"><b>${s[1]}</b><small>${s[0]}</small></div>`).join('');
  }

  let createMode = 'classic';
  const MODE_ICON = { classic: '🔪', hideseek: '🙈', race: '🏁' };
  function renderModeCards(el, sel, onPick, compact) {
    el.innerHTML = Object.keys(S.MODES).map(k => `<button class="mode-card ${k === sel ? 'active' : ''}" data-mode="${k}"><div class="mi">${MODE_ICON[k]}</div><b>${S.MODES[k].name}</b><small>${S.MODES[k].desc}</small></button>`).join('');
    el.querySelectorAll('.mode-card').forEach(b => b.addEventListener('click', () => onPick(b.dataset.mode)));
  }
  $('#mCreateBtn').addEventListener('click', () => {
    const pick = m => { createMode = m; renderModeCards($('#modeCards'), m, pick); };
    renderModeCards($('#modeCards'), createMode, pick);
    openModal('mCreate');
  });
  $('#createGo').addEventListener('click', () => {
    send({ t: 'create', mode: createMode, isPublic: $('#createPublic').checked });
    closeModal('mCreate');
  });
  $('#mJoinBtn').addEventListener('click', () => { openModal('mJoin'); setTimeout(() => $('#joinCode').focus(), 350); });
  $('#joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinGo').click(); });
  $('#joinGo').addEventListener('click', () => {
    const c = $('#joinCode').value.trim();
    if (c.length < 6) return toast('El código tiene 6 letras.', true);
    send({ t: 'join', code: c });
    closeModal('mJoin');
  });
  $('#mBrowseBtn').addEventListener('click', () => { $('#roomList').innerHTML = '<div class="empty">Buscando salas…</div>'; openModal('mBrowse'); send({ t: 'rooms' }); });
  $('#browseRefresh').addEventListener('click', () => send({ t: 'rooms' }));
  $('#mPracticeBtn').addEventListener('click', () => { App.pendingBots = 5; send({ t: 'create', mode: 'classic', isPublic: false }); });
  $('#mCustomBtn').addEventListener('click', openCustomize);
  $('#mSettingsBtn').addEventListener('click', openSettings);
  $('#mLogoutBtn').addEventListener('click', async () => { if (await confirmBox('Vas a cerrar sesión en este dispositivo.', 'Cerrar sesión')) logout(); });

  function renderRooms(list) {
    const el = $('#roomList');
    if (!list.length) { el.innerHTML = '<div class="empty">No hay salas públicas ahora mismo.<br>¡Crea una y compártela!</div>'; return; }
    el.innerHTML = list.map(r => `<button class="room-item" data-code="${r.code}"><div><b>Sala de ${esc(r.host)}</b><small>${MODE_ICON[r.mode]} ${S.MODES[r.mode].name} · ${r.code}</small></div><b>${r.count}/${r.max}</b></button>`).join('');
    el.querySelectorAll('.room-item').forEach(b => b.addEventListener('click', () => { send({ t: 'join', code: b.dataset.code }); closeModal('mBrowse'); }));
  }

  // hero animado
  const heroC = $('#heroCanvas').getContext('2d');
  function drawHero(t) {
    const u = App.user;
    if (!u || App.screen !== 'scrHome') return;
    heroC.setTransform(1, 0, 0, 1, 0, 0);
    heroC.clearRect(0, 0, 360, 360);
    const g = heroC.createRadialGradient(180, 250, 10, 180, 250, 170);
    g.addColorStop(0, 'rgba(100,160,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    heroC.fillStyle = g; heroC.fillRect(0, 0, 360, 360);
    const walking = Math.sin(t * 0.6) > 0.3;
    Draw.bean(heroC, 180, 300 + Math.sin(t * 2) * 3, { color: u.color, hat: u.hat, scale: 3, moving: walking, walk: t * 9, flip: Math.sin(t * 0.3) > 0.8, time: t });
  }

  // ================================================================ personalizar
  function openCustomize() {
    renderCustomize();
    openModal('mCustom');
  }
  function myLook() {
    if (App.room && App.you) { const m = App.meta.get(App.you); if (m) return { color: m.color, hat: m.hat }; }
    return { color: App.user.color, hat: App.user.hat };
  }
  function renderCustomize() {
    const look = myLook();
    const taken = new Set();
    if (App.room) for (const p of App.room.players) if (p.id !== App.you) taken.add(p.color);
    $('#colorGrid').innerHTML = S.COLORS.map(c => `<button class="swatch ${c.id === look.color ? 'sel' : ''} ${taken.has(c.id) ? 'taken' : ''}" title="${c.name}" data-c="${c.id}" style="background:${c.body}"></button>`).join('');
    $('#hatGrid').innerHTML = S.HATS.map(h => `<button class="hat ${h.id === look.hat ? 'sel' : ''}" title="${h.name}" data-h="${h.id}"><img src="${beanImg(look.color, h.id, 80, { noShadow: true })}" alt="${h.name}"></button>`).join('');
    $$('#colorGrid .swatch').forEach(b => b.addEventListener('click', () => setLook({ color: b.dataset.c })));
    $$('#hatGrid .hat').forEach(b => b.addEventListener('click', () => setLook({ hat: b.dataset.h })));
  }
  function setLook(ch) {
    if (App.room && App.G) return toast('No puedes cambiar tu aspecto durante la partida.', true);
    send(Object.assign({ t: 'profile' }, ch));
    if (!App.room) { Object.assign(App.user, ch); renderCustomize(); renderHome(); }
  }
  const custC = $('#customCanvas').getContext('2d');
  function drawCustom(t) {
    if (!$('#mCustom').classList.contains('show')) return;
    const look = myLook();
    custC.setTransform(1, 0, 0, 1, 0, 0);
    custC.clearRect(0, 0, 260, 260);
    Draw.bean(custC, 130, 225 + Math.sin(t * 2) * 3, { color: look.color, hat: look.hat, scale: 2.4, moving: true, walk: t * 8, time: t });
  }

  // ================================================================ ajustes
  function openSettings() {
    $('#volSfx').value = Sfx.prefs.sfx; $('#volMusic').value = Sfx.prefs.music; $('#volAmb').value = Sfx.prefs.amb;
    $('#settingsLeave').style.display = App.room ? '' : 'none';
    openModal('mSettings');
  }
  $('#volSfx').addEventListener('input', e => { Sfx.set('sfx', +e.target.value); Sfx.click(); });
  $('#volMusic').addEventListener('input', e => Sfx.set('music', +e.target.value));
  $('#volAmb').addEventListener('input', e => Sfx.set('amb', +e.target.value));
  $('#settingsLeave').addEventListener('click', async () => { closeModal('mSettings'); leaveRoom(); });

  // ================================================================ red
  function send(msg) {
    if (App.ws && App.ws.readyState === 1) App.ws.send(JSON.stringify(msg));
  }
  App.send = send;

  function connect() {
    if (App.ws && (App.ws.readyState === 0 || App.ws.readyState === 1)) return;
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    App.ws = ws;
    ws.onopen = () => { App.retry = 0; send({ t: 'auth', token: App.token }); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } handle(m); };
    ws.onclose = () => {
      App.connected = false;
      if (!App.token) return;
      $('#conn').classList.add('show');
      setTimeout(connect, Math.min(5000, 500 * Math.pow(1.6, App.retry++)));
    };
  }

  function handle(m) {
    const G = App.G;
    switch (m.t) {
      case 'hello':
        App.connected = true;
        $('#conn').classList.remove('show');
        App.user = m.user; renderHome();
        if (App.pendingJoin && !App.room) { send({ t: 'join', code: App.pendingJoin }); App.pendingJoin = null; }
        break;
      case 'authfail': logout(); toast('Tu sesión expiró. Inicia sesión otra vez.', true); break;
      case 'profile': App.user = m.user; renderHome(); if ($('#mCustom').classList.contains('show')) renderCustomize(); break;
      case 'rooms': renderRooms(m.list); break;
      case 'joined': onJoined(m); break;
      case 'room': onRoom(m); break;
      case 'left': goHome(); break;
      case 'kicked': toast(m.reason, true); goHome(); break;
      case 'error': toast(m.text, true); Sfx.error(); break;
      case 'toast': toast(m.text); break;
      case 'chat': addChat(m); break;
      case 's': onState(m); break;
      case 'pos': App.me.x = m.x; App.me.y = m.y; break;
      case 'start': onStart(m); break;
      case 'phase': if (G) onPhase(m.phase); break;
      case 'cd': if (G) G.killReadyAt = now() + m.killIn; break;
      case 'killed': if (G) onKilled(m); break;
      case 'killfx': if (G) onKillFx(m); break;
      case 'taskok': if (G) onTaskOk(m); break;
      case 'progress': if (G) { if (m.race) G.race = m.race; else G.progress = m; updateTaskPanel(true); } break;
      case 'vent': if (G) onVent(m); break;
      case 'ventfx': if (G) onVentFx(m); break;
      case 'sab': if (G) onSab(m); break;
      case 'doors': onDoors(m); break;
      case 'doorcd': if (G) G.doorReady[m.room] = now() + m.in; break;
      case 'meeting': if (G) onMeeting(m); break;
      case 'voted': if (G && G.meeting) { G.meeting.voted.add(m.id); Sfx.voted(); renderVoteCards(); } break;
      case 'results': if (G && G.meeting) onResults(m); break;
      case 'eject': if (G) onEject(m); break;
      case 'hstime': if (G) G.hsEndAt = now() + m.endIn; break;
      case 'final': if (G) { G.finalHide = true; G.hsEndAt = now() + m.endIn; Sfx.finalHide(); toast('¡ESCONDITE FINAL! El buscador es más rápido 😱'); } break;
      case 'ping': if (G) G.pings = { pts: m.pts, t: now() }; break;
      case 'gameover': onGameOver(m); break;
    }
  }

  // ================================================================ sala
  function onJoined(m) {
    const first = !App.room || App.room.code !== m.code;
    App.room = m;
    App.you = m.you;
    syncMeta(m.players);
    if (m.phase === 'lobby') enterLobby(first);
    showScreen('scrGame');
    history.replaceState(null, '', '?sala=' + m.code);
    if (first) {
      App.chatLog = [];
      $('#chatLog').innerHTML = '';
      Sfx.join();
      toast(`Entraste a la sala ${m.code}`);
    }
    if (App.pendingBots && m.hostId === App.you) {
      for (let i = 0; i < App.pendingBots; i++) setTimeout(() => send({ t: 'addBot' }), 60 * i);
      App.pendingBots = 0;
      setTimeout(() => toast('🤖 Bots añadidos. ¡Pulsa «Empezar»!'), 500);
    }
    updateLobbyHud();
  }

  function enterLobby() {
    App.G = null;
    App.mapId = 'lobby';
    App.me.init = false;
    App.bodies = [];
    App.closedDoors = [];
    App.players.clear();
    Tasks.close(true);
    closeMap();
    hideGameOverlays(true);
    setupHud();
  }

  function onRoom(m) {
    if (!App.room) return;
    const before = new Set(App.room.players.map(p => p.id));
    App.room = Object.assign(App.room, m);
    syncMeta(m.players);
    for (const p of m.players) if (!before.has(p.id) && p.id !== App.you) Sfx.join();
    for (const id of before) if (!m.players.find(p => p.id === id)) { App.players.delete(id); Sfx.leave(); }
    if (m.phase === 'lobby' && App.G && !App.G.over) { /* sigue la partida hasta el mensaje gameover */ }
    updateLobbyHud();
    if ($('#mRules').classList.contains('show')) renderRules();
    if ($('#mCustom').classList.contains('show')) renderCustomize();
  }

  function syncMeta(list) {
    for (const p of list) {
      const old = App.meta.get(p.id) || {};
      App.meta.set(p.id, Object.assign(old, p));
    }
  }

  function goHome() {
    App.room = null; App.you = null; App.G = null;
    App.players.clear(); App.meta.clear();
    Tasks.close(true); closeMap(); hideGameOverlays(true);
    Sfx.alarm(false);
    $$('.modal.show').forEach(m => m.classList.remove('show'));
    history.replaceState(null, '', location.pathname);
    showScreen('scrHome');
    renderHome();
  }

  async function leaveRoom() {
    const inGame = App.G && !App.G.over;
    if (!(await confirmBox(inGame ? 'Si sales ahora, abandonarás la partida en curso.' : 'Vas a salir de la sala.', 'Salir'))) return;
    send({ t: 'leave' });
    goHome();
  }
  $('#btnLeave').addEventListener('click', leaveRoom);

  $('#copyLink').addEventListener('click', async () => {
    const url = location.origin + '/?sala=' + App.room.code;
    try {
      if (navigator.share && document.body.classList.contains('touch')) await navigator.share({ title: 'Among Us (Temu)', text: '¡Únete a mi partida!', url });
      else { await navigator.clipboard.writeText(url); toast('🔗 ¡Enlace copiado! Mándalo a tus amigos.'); }
    } catch (e) { toast('Código de sala: ' + App.room.code); }
  });

  function updateLobbyHud() {
    const r = App.room;
    if (!r) return;
    $('#codeText').textContent = r.code;
    const n = r.players.length;
    $('#lbCount').textContent = `${n}/${r.settings.maxPlayers}`;
    const host = r.hostId === App.you;
    const st = $('#lbStart');
    st.style.display = host ? '' : 'none';
    const min = S.MODES[r.settings.mode].min;
    st.classList.toggle('dim', n < min);
    st.textContent = n < min ? `Faltan ${min - n}` : 'Empezar';
  }
  $('#lbStart').addEventListener('click', () => {
    const r = App.room;
    const min = S.MODES[r.settings.mode].min;
    if (r.players.length < min) { toast(`Se necesitan ${min} jugadores. Invita amigos o agrega bots en «Reglas».`, true); Sfx.error(); return; }
    send({ t: 'start' });
  });
  $('#lbCustom').addEventListener('click', openCustomize);
  $('#lbSettings').addEventListener('click', () => { renderRules(); openModal('mRules'); });

  // ---------------- reglas
  function renderRules() {
    const r = App.room;
    if (!r) return;
    const host = r.hostId === App.you;
    const s = r.settings;
    const pick = m => { if (!host) return; sendSettings({ mode: m }); };
    renderModeCards($('#rulesModes'), s.mode, pick, true);
    $('#rulesNote').textContent = host ? S.MODES[s.mode].desc : 'Solo el anfitrión puede cambiar las reglas.';
    const grid = $('#rulesGrid');
    grid.classList.toggle('readonly', !host);
    let html = '', group = '';
    for (const f of S.SETTINGS_SCHEMA) {
      if (f.modes && f.modes.indexOf(s.mode) < 0) continue;
      if (f.group !== group) { group = f.group; html += `<div class="rule group">${group}</div>`; }
      let val;
      if (f.type === 'bool') val = s[f.key] ? 'Sí' : 'No';
      else if (f.type === 'enum') val = f.options[s[f.key]];
      else val = s[f.key] + (f.unit || '');
      html += `<div class="rule"><span>${f.label}</span><div class="ctl"><button class="step" data-k="${f.key}" data-d="-1">−</button><span class="val">${val}</span><button class="step" data-k="${f.key}" data-d="1">+</button></div></div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
      const f = S.SETTINGS_SCHEMA.find(x => x.key === b.dataset.k);
      const d = +b.dataset.d;
      let v = s[f.key];
      if (f.type === 'bool') v = !v;
      else if (f.type === 'enum') v = (v + d + f.options.length) % f.options.length;
      else v = clamp(Math.round((v + d * f.step) * 100) / 100, f.min, f.max);
      sendSettings({ [f.key]: v });
    }));
    const bots = r.players.filter(p => p.bot).length;
    $('#botCount').textContent = bots;
    $('#botRow').style.display = host ? '' : 'none';
    $('#publicRow').style.display = host ? '' : 'none';
    $('#rulesPublic').checked = !!r.isPublic;
    $('#playerList').innerHTML = r.players.map(p => `<div class="pl ${p.connected === false ? 'off' : ''}"><img src="${beanImg(p.color, p.hat, 72, { noShadow: true })}"><b>${esc(p.name)}${p.bot ? ' 🤖' : ''}</b>${p.host ? `<span class="crown">${Icons.svg('crown')}</span>` : ''}${host && p.id !== App.you ? `<button class="kick" data-id="${p.id}" title="Expulsar">${Icons.svg('x')}</button>` : ''}</div>`).join('');
    $$('#playerList .kick').forEach(b => b.addEventListener('click', () => send({ t: 'kick', id: b.dataset.id })));
  }
  function sendSettings(ch) {
    const s = Object.assign({}, App.room.settings, ch);
    App.room.settings = s;
    send({ t: 'settings', settings: s });
    renderRules();
  }
  $('#botPlus').addEventListener('click', () => send({ t: 'addBot' }));
  $('#botMinus').addEventListener('click', () => send({ t: 'removeBot' }));
  $('#rulesPublic').addEventListener('change', e => send({ t: 'settings', settings: App.room.settings, isPublic: e.target.checked }));

  // ================================================================ estado de red
  function onState(m) {
    const seen = new Set();
    for (const e of m.p) {
      const [id, x, y, f, mv, alive, scan] = e;
      seen.add(id);
      if (id === App.you) {
        if (!App.me.init) { App.me.x = x; App.me.y = y; App.me.init = true; App.cam.x = x; App.cam.y = y; }
        continue;
      }
      let p = App.players.get(id);
      if (!p) { p = { id, x, y, tx: x, ty: y, walk: 0 }; App.players.set(id, p); }
      if (Math.hypot(p.x - x, p.y - y) > 350 || p.hidden) { p.x = x; p.y = y; }
      p.tx = x; p.ty = y; p.f = f; p.m = mv; p.alive = !!alive; p.scan = !!scan; p.hidden = false;
    }
    for (const [id, p] of App.players) if (!seen.has(id)) p.hidden = true;
    App.bodies = m.b.map(b => ({ id: b[0], x: b[1], y: b[2], color: (App.meta.get(b[0]) || {}).color || 'red' }));
  }

  // ================================================================ inicio de partida
  function onStart(m) {
    const t = now();
    syncMeta(m.players);
    const G = App.G = {
      mode: m.mode, settings: m.settings, role: m.role, mates: new Set(m.mates || []), seeker: m.seeker,
      tasks: m.tasks || [], fake: m.fake, alive: m.alive, phase: m.phase,
      killReadyAt: t + (m.killIn || 0), emergencies: m.emergencies,
      emergencyReadyAt: t + (m.introIn || 0) + m.settings.emergencyCooldown * 1000,
      hsEndAt: t + (m.hsEndIn || 0), seekerReleaseAt: t + (m.seekerIn || 0), finalHide: m.finalHide,
      progress: null, race: null, sab: null, meeting: null, inVent: null, doorReady: {},
      sabReadyAt: t + (m.introIn || 0) + 15000, pings: null, over: false,
    };
    App.mapId = 'ship';
    App.me.x = m.x; App.me.y = m.y; App.me.init = true; App.me.m = 0;
    App.cam.x = m.x; App.cam.y = m.y;
    App.bodies = []; App.closedDoors = []; App.ventFx = [];
    for (const p of App.players.values()) p.hidden = true;
    App.chatLog = [];
    $('#chatLog').innerHTML = '';
    Tasks.close(true); closeMap(); closeChat();
    $$('.modal.show').forEach(x => x.classList.remove('show'));
    hideGameOverlays(true);
    setupHud();
    if (m.intro) roleReveal(m.introIn);
    else if (!G.alive) $('#ghostTip').classList.add('show');
  }

  function isImp() { const G = App.G; return G && (G.role === 'impostor' || G.role === 'seeker'); }

  function roleReveal(ms) {
    const G = App.G;
    const fx = $('#roleReveal');
    const shh = $('#shh'), box = $('#roleBox');
    const me = App.meta.get(App.you);
    fx.classList.add('show');
    shh.classList.add('show'); box.classList.remove('show');
    $('#shhBean').style.backgroundImage = `url(${beanImg(me.color, me.hat, 220, { noShadow: true })})`;
    Sfx.shh();
    const title = $('#roleTitle'), sub = $('#roleSub');
    let lineupIds;
    const all = App.room.players.map(p => p.id);
    if (G.role === 'impostor') {
      title.textContent = 'Impostor'; title.className = 'role-title imp';
      const n = G.mates.size;
      sub.innerHTML = n > 1 ? `Tus compañeros impostores están contigo. <b>Elimina a la tripulación.</b>` : '<b>Elimina a la tripulación</b> sin que te descubran.';
      lineupIds = [...G.mates];
    } else if (G.role === 'crew') {
      title.textContent = 'Tripulante'; title.className = 'role-title crew';
      const n = Math.min(G.settings.impostors, Math.max(1, Math.floor((all.length - 1) / 2)));
      sub.innerHTML = `Hay <b>${n} impostor${n > 1 ? 'es' : ''}</b> entre nosotros.`;
      lineupIds = all;
    } else if (G.role === 'seeker') {
      title.textContent = 'Buscador'; title.className = 'role-title seek';
      sub.innerHTML = 'Atrapa a todos antes de que se acabe el tiempo. <b>Sales en 10 segundos.</b>';
      lineupIds = [App.you];
    } else if (G.role === 'hider') {
      title.textContent = 'Escondido'; title.className = 'role-title crew';
      const sk = App.meta.get(G.seeker);
      sub.innerHTML = `El buscador es <b>${esc(sk ? sk.name : '?')}</b>. ¡Escóndete y haz tareas!`;
      lineupIds = all.filter(id => id !== G.seeker);
    } else {
      title.textContent = 'Carrera'; title.className = 'role-title crew';
      sub.innerHTML = 'Completa todas tus tareas <b>antes que nadie</b>.';
      lineupIds = all;
    }
    const ordered = [App.you].concat(lineupIds.filter(id => id !== App.you));
    const arranged = [];
    ordered.forEach((id, i) => { if (i % 2) arranged.push(id); else arranged.unshift(id); });
    $('#lineup').innerHTML = arranged.map((id, i) => {
      const p = App.meta.get(id) || {};
      const center = id === App.you;
      const far = Math.abs(i - arranged.indexOf(App.you)) > 2;
      const nameCol = G.role === 'impostor' ? '#ff453a' : '#fff';
      return `<div class="lu ${center ? 'me' : ''} ${far ? 'far' : ''}" style="animation-delay:${0.4 + Math.abs(i - arranged.indexOf(App.you)) * 0.08}s;z-index:${center ? 9 : 5 - Math.abs(i - arranged.indexOf(App.you))}"><img src="${beanImg(p.color, p.hat, 200)}"><span style="color:${nameCol}">${esc(p.name || '')}</span></div>`;
    }).join('');
    setTimeout(() => {
      shh.classList.remove('show'); box.classList.add('show');
      if (G.role === 'impostor' || G.role === 'seeker') Sfx.roleImp(); else Sfx.roleCrew();
    }, 1500);
    setTimeout(() => { fx.classList.remove('show'); showBanner(); }, Math.max(4500, ms));
  }

  function showBanner() {
    const G = App.G;
    if (!G) return;
    if (G.mode === 'classic' && G.role === 'crew') toast('Completa tus tareas y descubre al impostor 🔎');
    if (G.role === 'impostor') toast('Usa SABOTAJE y las VENTILAS. ¡Que no te vean! 🔪');
    if (G.role === 'hider') toast('¡Corre a esconderte! El buscador sale pronto 🙈');
  }

  function onPhase(ph) {
    const G = App.G;
    G.phase = ph;
    if (ph === 'play') {
      G.meeting = null;
      G.emergencyReadyAt = now() + G.settings.emergencyCooldown * 1000;
      $('#meeting').classList.remove('show');
      $('#meetSplash').classList.remove('show');
      if (App.fx && App.fx.kind === 'eject') { /* termina solo */ }
      App.bodies = [];
      updateTaskPanel(true);
    }
  }

  // ================================================================ HUD
  function setupHud() {
    const G = App.G;
    const lobby = !G;
    $('#lobbyCode').style.display = lobby ? '' : 'none';
    $('#lobbyBar').classList.toggle('show', lobby);
    $('#taskPanel').classList.toggle('hidden', lobby);
    $('#hsTimer').style.display = G && G.mode === 'hideseek' ? 'flex' : 'none';
    $('#ghostTip').classList.remove('show');
    $('#danger').classList.remove('show');
    $('#vignette').style.opacity = 0;
    $('#sabFlash').classList.remove('on');
    $('#sabBanner').classList.remove('show');
    $('#ventArrows').innerHTML = '';
    const show = (id, on) => $(id).classList.toggle('show', !!on);
    const imp = G && G.role === 'impostor';
    show('#actUse', true);
    show('#actReport', G && G.mode === 'classic');
    show('#actKill', G && (G.role === 'impostor' || G.role === 'seeker'));
    show('#actVent', imp);
    show('#actSabotage', imp);
    updateChatButton();
    updateTaskPanel(true);
  }

  function updateChatButton() {
    const G = App.G;
    const can = !G || G.phase === 'meeting' || !G.alive;
    $('#btnChat').style.display = can ? '' : 'none';
    if (!can) closeChat();
  }

  let lastPanel = 0;
  function updateTaskPanel(force) {
    const G = App.G;
    if (!G) return;
    const t = now();
    if (!force && t - lastPanel < 300) return;
    lastPanel = t;
    const bar = $('#tpBar');
    const head = $('#tpHead');
    const list = $('#tpList');
    const showBar = G.mode === 'classic' && G.settings.taskBar !== 2;
    bar.style.display = showBar || G.mode === 'race' ? '' : 'none';
    if (G.mode === 'race' && G.race) {
      const mine = G.race.find(r => r.id === App.you);
      $('#tpFill').style.width = mine ? (mine.done / Math.max(1, mine.total) * 100) + '%' : '0';
      bar.querySelector('.tp-label').textContent = 'TU PROGRESO';
    } else if (G.progress) {
      $('#tpFill').style.width = (G.progress.done / Math.max(1, G.progress.total) * 100) + '%';
      bar.querySelector('.tp-label').textContent = 'TAREAS COMPLETADAS';
    }
    let html = '';
    if (G.sab && G.alive && G.sab.kind) {
      const txt = { lights: 'Electricidad: arreglar las luces', reactor: `Reactor: fusión en ${Math.max(0, Math.ceil((G.sab.endsAt - t) / 1000))} s`, o2: `O2: oxígeno agotándose ${Math.max(0, Math.ceil((G.sab.endsAt - t) / 1000))} s` }[G.sab.kind];
      html += `<li class="sab">⚠ ${txt}</li>`;
    }
    if (G.role === 'impostor') head.innerHTML = 'Sabotea y elimina a la tripulación.<br><small style="opacity:.7">Tareas falsas:</small>';
    else if (G.role === 'seeker') head.textContent = 'Atrapa a todos los escondidos.';
    else if (G.role === 'hider') head.textContent = G.alive ? 'Sobrevive y haz tareas (restan tiempo).' : 'Fantasma: sigue haciendo tareas.';
    else if (G.role === 'racer') head.textContent = '¡Completa todo antes que nadie!';
    else head.textContent = G.alive ? 'Tareas' : 'Eres un fantasma: termina tus tareas.';
    head.className = 'tp-head' + (isImp() ? ' imp' : '');
    const near = App.interact.use && App.interact.use.kind === 'task' ? App.interact.use.task.id : null;
    for (const tk of G.tasks) {
      const st = tk.steps[Math.min(tk.step, tk.steps.length - 1)];
      const multi = tk.steps.length > 1 ? ` (${tk.step}/${tk.steps.length})` : '';
      const cls = G.fake ? 'fake' : tk.done ? 'done' : (tk.step > 0 ? 'part' : '') + (near === tk.id ? ' near' : '');
      html += `<li class="${cls}">${esc(roomName(st.room))}: ${esc(tk.name)}${multi}</li>`;
    }
    if (G.mode === 'race' && G.race) {
      const top = G.race.slice().sort((a, b) => b.done - a.done).slice(0, 4);
      html += '<li style="margin-top:6px;opacity:.7;font-weight:800">CLASIFICACIÓN</li>' + top.map((r, i) => `<li>${i + 1}. ${esc((App.meta.get(r.id) || {}).name || '?')} — ${r.done}/${r.total}</li>`).join('');
    }
    if (list.innerHTML !== html) list.innerHTML = html;
  }
  $('#tpHead').addEventListener('click', () => $('#taskPanel').classList.toggle('collapsed'));

  // ================================================================ tareas
  function onTaskOk(m) {
    const tk = App.G.tasks.find(t => t.id === m.id);
    if (!tk) return;
    tk.step = m.step; tk.done = m.done;
    if (m.done) toast(`✓ ${tk.name}`);
    updateTaskPanel(true);
  }

  function doUse() {
    const G = App.G;
    const u = App.interact.use;
    if (!u) return;
    if (u.kind === 'laptop') return openCustomize();
    if (!G) return;
    const me = App.meta.get(App.you);
    if (u.kind === 'task') {
      const st = u.task.steps[u.task.step];
      Tasks.open({ game: st.game, title: `${roomName(st.room)}: ${u.task.name}`, fill: st.fill }, {
        me, send,
        complete: () => send({ t: 'task', id: u.task.id, step: u.task.step }),
      });
    } else if (u.kind === 'sab') {
      const titles = { lights: 'Electricidad: reparar las luces', hand: 'Reactor: detener la fusión', keypad: 'O2: restaurar el oxígeno' };
      Tasks.open({ game: u.game, idx: u.idx, sab: G.sab, title: titles[u.game] }, { me, send });
    } else if (u.kind === 'button') {
      Tasks.open({ game: 'emergency', emergencies: G.emergencies, cooldown: Math.max(0, (G.emergencyReadyAt - now()) / 1000), title: 'Cafetería: botón de emergencia' }, {
        me, send: (msg) => { if (msg.t === 'emergency') G.emergencies = Math.max(0, G.emergencies - 1); send(msg); },
      });
    }
  }

  function computeInteract() {
    const G = App.G;
    const me = App.me;
    const res = { use: null, report: null, kill: null, vent: null, highlights: [] };
    const map = S.MAPS[App.mapId];
    if (!G) {
      if (App.room && map.laptop && Math.hypot(me.x - map.laptop.x, me.y - (map.laptop.y + 40)) < 140) res.use = { kind: 'laptop' };
      if (map.laptop) res.highlights.push({ x: map.laptop.x, y: map.laptop.y + 30, strong: !!res.use });
      return res;
    }
    if (G.phase !== 'play') return res;
    let best = Infinity;
    const consider = (cand, x, y, range) => {
      const d = Math.hypot(me.x - x, me.y - y);
      if (d <= range && d < best) { best = d; res.use = cand; }
      return d;
    };
    if (!G.fake && !G.inVent) {
      for (const tk of G.tasks) {
        if (tk.done) continue;
        const st = tk.steps[tk.step];
        const d = consider({ kind: 'task', task: tk }, st.x, st.y, S.INTERACT_RANGE);
        if (d < 520) res.highlights.push({ x: st.x, y: st.y, wall: World.wallTopFor(map, st.x, st.y), strong: d <= S.INTERACT_RANGE });
      }
    }
    if (G.alive && G.sab && G.sab.kind && !G.inVent) {
      const game = { lights: 'lights', reactor: 'hand', o2: 'keypad' }[G.sab.kind];
      S.SABOTAGE_STATIONS[G.sab.kind].forEach((st, idx) => {
        const d = consider({ kind: 'sab', game, idx }, st.x, st.y, S.INTERACT_RANGE);
        res.highlights.push({ x: st.x, y: st.y, wall: World.wallTopFor(map, st.x, st.y), strong: d <= S.INTERACT_RANGE, color: '#ff453a' });
      });
    }
    if (G.alive && G.mode === 'classic' && !G.inVent) {
      const b = S.SHIP.button;
      const d = consider({ kind: 'button' }, b.x, b.y, S.BUTTON_RANGE);
      if (d < 400) res.highlights.push({ x: b.x, y: b.y + 20, strong: d <= S.BUTTON_RANGE, color: '#ff6b6b' });
    }
    if (G.alive && G.mode === 'classic' && !G.inVent) {
      let bd = Infinity;
      for (const b of App.bodies) {
        const d = Math.hypot(me.x - b.x, me.y - b.y);
        if (d < S.REPORT_RANGE && d < bd && Shared.lineOfSight(map, built().vgrid, me.x, me.y - 20, b.x, b.y - 20, App.closedDoors)) { bd = d; res.report = b; }
      }
    }
    const hunter = G.alive && !G.inVent && (G.role === 'impostor' || (G.role === 'seeker' && now() >= G.seekerReleaseAt));
    if (hunter) {
      const range = S.KILL_DISTANCES[G.settings.killDistance];
      let bd = Infinity;
      for (const p of App.players.values()) {
        if (p.hidden || !p.alive || G.mates.has(p.id)) continue;
        const d = Math.hypot(me.x - p.x, me.y - p.y);
        if (d <= range && d < bd && isVisible(p)) { bd = d; res.kill = p; }
      }
    }
    if (G.alive && G.role === 'impostor') {
      if (G.inVent) res.vent = { exit: true };
      else for (const v of map.vents) if (Math.hypot(me.x - v.x, me.y - v.y) <= S.VENT_RANGE) res.vent = v;
    }
    return res;
  }

  let lastBtn = '';
  function updateActions() {
    const G = App.G;
    const i = App.interact;
    const set = (id, on) => $(id).classList.toggle('on', !!on);
    set('#actUse', i.use);
    let label = 'USAR';
    if (i.use && i.use.kind === 'laptop') label = 'PERSONALIZAR';
    else if (i.use && i.use.kind === 'button') label = 'EMERGENCIA';
    else if (i.use && i.use.kind === 'sab') label = 'REPARAR';
    if ($('#useLabel').textContent !== label) $('#useLabel').textContent = label;
    set('#actReport', i.report);
    const t = now();
    if (G) {
      const cd = Math.max(0, (G.killReadyAt - t) / 1000);
      const kc = $('#killCd');
      const releaseLeft = G.role === 'seeker' ? Math.max(0, (G.seekerReleaseAt - t) / 1000) : 0;
      const shown = Math.max(cd, releaseLeft);
      kc.classList.toggle('show', shown > 0 && G.phase === 'play');
      kc.textContent = Math.ceil(shown);
      set('#actKill', i.kill && shown <= 0);
      if (G.wasCd && shown <= 0 && G.phase === 'play' && G.alive) Sfx.killReady();
      G.wasCd = shown > 0;
      set('#actVent', i.vent);
      $('#actVent').querySelector('em').textContent = G.inVent ? 'SALIR' : 'VENTILA';
      set('#actSabotage', G.role === 'impostor' && G.phase === 'play' && !G.inVent);
    }
    const key = [i.use && i.use.kind, !!i.report, !!i.kill, !!i.vent].join();
    if (key !== lastBtn) { lastBtn = key; updateTaskPanel(true); }
  }

  $('#actUse').addEventListener('click', doUse);
  $('#actReport').addEventListener('click', doReport);
  $('#actKill').addEventListener('click', doKill);
  $('#actVent').addEventListener('click', doVent);
  $('#actSabotage').addEventListener('click', () => openMap(true));

  function doReport() { const b = App.interact.report; if (b) send({ t: 'report', id: b.id }); }
  function doKill() {
    const G = App.G;
    const p = App.interact.kill;
    if (!p || !G || now() < G.killReadyAt) return;
    send({ t: 'kill', id: p.id });
  }
  function doVent() {
    const G = App.G;
    const v = App.interact.vent;
    if (!v || !G) return;
    send({ t: 'vent', a: G.inVent ? 'exit' : 'enter' });
  }

  // ================================================================ eventos de juego
  function onKilled(m) {
    const G = App.G;
    G.alive = false;
    const me = App.meta.get(App.you);
    if (me) me.alive = false;
    Tasks.close(true); closeMap();
    playKillAnim(m.by, me);
    updateChatButton();
    setTimeout(() => { $('#ghostTip').classList.add('show'); setTimeout(() => $('#ghostTip').classList.remove('show'), 6000); }, 2600);
    updateTaskPanel(true);
  }

  function onKillFx(m) {
    const G = App.G;
    const d = Math.hypot(App.me.x - m.x, App.me.y - m.y);
    const vis = !G.alive || d < visionRadius() && Shared.lineOfSight(S.SHIP, built().vgrid, App.me.x, App.me.y - 20, m.x, m.y - 20, App.closedDoors);
    if (m.victim === App.you) return;
    if (vis || d < 200) { Sfx.kill(); if (d < 300) App.shake = 10; }
    const p = App.meta.get(m.victim);
    if (p) p.alive = false;
    const pl = App.players.get(m.victim);
    if (pl) pl.alive = false;
  }

  function onVent(m) {
    const G = App.G;
    const was = G.inVent;
    G.inVent = m.id;
    if (m.id) {
      const v = S.SHIP.vents.find(v => v.id === m.id);
      App.me.x = v.x; App.me.y = v.y;
      if (was) Sfx.ventMove(); else { Sfx.vent(); App.ventFx.push({ id: m.id, t: now() / 1000 }); }
    } else {
      Sfx.vent();
      if (was) App.ventFx.push({ id: was, t: now() / 1000 });
    }
    renderVentArrows();
  }

  function onVentFx(m) {
    const v = S.SHIP.vents.find(v => v.id === m.id);
    if (!v) return;
    App.ventFx.push({ id: m.id, t: now() / 1000 });
    if (isPointVisible(v.x, v.y)) Sfx.vent();
  }

  function renderVentArrows() {
    const G = App.G;
    const el = $('#ventArrows');
    el.innerHTML = '';
    if (!G || !G.inVent) return;
    const v = S.SHIP.vents.find(x => x.id === G.inVent);
    for (const id of v.links) {
      const o = S.SHIP.vents.find(x => x.id === id);
      const a = Math.atan2(o.y - v.y, o.x - v.x);
      const b = document.createElement('button');
      b.className = 'vent-arrow';
      const r = Math.min(innerWidth, innerHeight) * 0.28;
      b.style.left = (innerWidth / 2 + Math.cos(a) * r) + 'px';
      b.style.top = (innerHeight / 2 - 30 + Math.sin(a) * r) + 'px';
      b.innerHTML = `<div style="transform:rotate(${a}rad);width:100%;height:100%">${Icons.svg('play')}</div>`;
      b.addEventListener('click', () => send({ t: 'vent', a: 'move', to: id }));
      el.appendChild(b);
    }
  }

  function onSab(m) {
    const G = App.G;
    const prev = G.sab && G.sab.kind;
    if (m.kind) {
      G.sab = Object.assign({}, m, { endsAt: now() + (m.endsIn || 0) });
      if (prev !== m.kind) {
        if (m.kind === 'lights') { Sfx.lightsOff(); if (!isImp()) toast('💡 ¡Sabotearon las luces! Ve a Electricidad.'); }
        else { Sfx.alarm(true, m.kind); toast(m.kind === 'reactor' ? '☢️ ¡Fusión del reactor! Se necesitan 2 personas.' : '🫁 ¡Oxígeno agotándose! Ve a O2 y Administración.'); }
      }
    } else {
      G.sab = null;
      Sfx.alarm(false);
      if (m.fixed) { Sfx.fixed(); toast('✅ Sabotaje reparado'); G.sabReadyAt = now() + S.SABOTAGE_COOLDOWN * 1000; }
    }
    $('#sabFlash').classList.toggle('on', !!(G.sab && G.sab.kind !== 'lights'));
    Tasks.onSab(G.sab);
    updateTaskPanel(true);
  }

  function onDoors(m) {
    App.closedDoors = m.closed || [];
    if (m.slam || m.open) {
      const ds = S.SHIP.doors.filter(d => d.room === (m.slam || m.open));
      if (ds.some(d => isPointVisible(d.r.x + d.r.w / 2, d.r.y + d.r.h / 2) || Math.hypot(d.r.x - App.me.x, d.r.y - App.me.y) < 500)) m.slam ? Sfx.door() : Sfx.doorOpen();
    }
  }

  // ================================================================ reuniones
  function onMeeting(m) {
    const G = App.G;
    G.phase = 'meeting';
    Tasks.close(true); closeMap();
    G.sab = null; Sfx.alarm(false); $('#sabFlash').classList.remove('on');
    App.closedDoors = [];
    if (G.inVent) { G.inVent = null; renderVentArrows(); }
    const t = now();
    G.meeting = {
      kind: m.kind, caller: m.caller, body: m.body, bodyColor: m.bodyColor,
      discussEnd: t + m.discussIn, voteEnd: t + m.voteIn, voted: new Set(m.voted), alive: new Set(m.alive),
      picking: null, myVote: null, results: null,
    };
    for (const [id, p] of App.meta) p.alive = G.meeting.alive.has(id);
    if (m.players) syncMeta(m.players);
    updateChatButton();
    if (m.stage === 'intro') {
      meetingSplash(m);
      setTimeout(showTablet, 3000);
    } else showTablet();
  }

  function meetingSplash(m) {
    const fx = $('#meetSplash');
    fx.classList.add('show');
    const caller = App.meta.get(m.caller) || {};
    $('#msText').textContent = m.kind === 'report' ? '¡CADÁVER REPORTADO!' : '¡REUNIÓN DE EMERGENCIA!';
    $('#msText').style.animation = 'none'; void $('#msText').offsetWidth; $('#msText').style.animation = '';
    if (m.kind === 'report') Sfx.report(); else Sfx.emergency();
    Sfx.meetingHit();
    const cv = $('#meetCanvas');
    const c = cv.getContext('2d');
    const t0 = now();
    App.fx = {
      kind: 'meet', draw() {
        const t = (now() - t0) / 1000;
        const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h));
        g.addColorStop(0, m.kind === 'report' ? '#5a1a0a' : '#5a0a14'); g.addColorStop(1, '#0a0204');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.save(); c.translate(w / 2, h / 2); c.rotate(t * 0.3);
        for (let i = 0; i < 24; i++) {
          c.rotate(Math.PI / 12);
          c.fillStyle = i % 2 ? 'rgba(255,80,60,0.12)' : 'rgba(255,200,80,0.06)';
          c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.max(w, h), -60); c.lineTo(Math.max(w, h), 60); c.closePath(); c.fill();
        }
        c.restore();
        const s = Math.min(w, h) / 320;
        const k = Math.min(1, t / 0.5);
        const bob = Math.sin(t * 8) * 4;
        Draw.bean(c, w * 0.36 - (1 - k) * 200, h * 0.78 + bob, { color: caller.color, hat: caller.hat, scale: s, noShadow: true, time: t });
        if (m.kind === 'report') {
          Draw.deadBody(c, w * 0.64 + (1 - k) * 200, h * 0.8, m.bodyColor, { scale: s });
          c.save(); c.translate(w * 0.36 + 60 * s, h * 0.78 - 60 * s + bob); c.rotate(-0.3);
          c.fillStyle = '#ffd60a'; c.strokeStyle = '#000'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(0, -12 * s); c.lineTo(40 * s, -30 * s); c.lineTo(40 * s, 30 * s); c.lineTo(0, 12 * s); c.closePath(); c.fill(); c.stroke();
          c.restore();
        } else {
          c.fillStyle = '#7f0000'; c.beginPath(); c.ellipse(w * 0.62, h * 0.8, 70 * s, 30 * s, 0, 0, 7); c.fill();
          c.fillStyle = '#ff2d2d'; c.beginPath(); c.ellipse(w * 0.62, h * 0.78 - (t % 0.6 < 0.15 ? 0 : 8), 60 * s, 25 * s, 0, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 4; c.stroke();
        }
      },
    };
    setTimeout(() => { fx.classList.remove('show'); if (App.fx && App.fx.kind === 'meet') App.fx = null; }, 3000);
  }

  function showTablet() {
    const G = App.G;
    if (!G || !G.meeting) return;
    $('#meeting').classList.add('show');
    renderVoteCards();
    Sfx.swoosh();
  }

  function renderVoteCards() {
    const G = App.G;
    const M = G.meeting;
    if (!M) return;
    const ids = App.room.players.map(p => p.id);
    ids.sort((a, b) => (M.alive.has(b) ? 1 : 0) - (M.alive.has(a) ? 1 : 0));
    const iAlive = M.alive.has(App.you);
    const canVote = iAlive && !M.myVote && now() >= M.discussEnd && !M.results;
    $('#voteGrid').innerHTML = ids.map(id => {
      const p = App.meta.get(id) || {};
      const alive = M.alive.has(id);
      const nameImp = (G.role === 'impostor' && G.mates.has(id)) ? 'imp' : '';
      const voters = M.results ? (M.results.voters[id] || []).map((c, i) => `<img style="animation-delay:${0.2 + i * 0.25}s" src="${c === 'anon' ? beanImg('gray', 'none', 40, { noShadow: true }) : beanImg(c, 'none', 40, { noShadow: true })}">`).join('') : '';
      return `<div class="vcard ${alive ? '' : 'dead'} ${id === App.you ? 'me' : ''} ${M.picking === id ? 'picking' : ''}" data-id="${id}">
        ${id === M.caller ? `<span class="tag">${M.kind === 'report' ? '📢 REPORTÓ' : '🚨 CONVOCÓ'}</span>` : ''}
        <img src="${beanImg(p.color, p.hat, 80, { noShadow: true, ghost: false })}">
        <div class="vname ${nameImp}">${esc(p.name || '?')}</div>
        ${M.voted.has(id) && !M.results ? '<span class="ivoted">VOTÓ</span>' : ''}
        <div class="confirm"><button class="yes" data-v="${id}">${Icons.svg('check')}</button><button class="no" data-x="1">${Icons.svg('x')}</button></div>
        <div class="voters">${voters}</div>
      </div>`;
    }).join('');
    $('#skipVoters').innerHTML = M.results ? (M.results.voters.skip || []).map((c, i) => `<img style="animation-delay:${0.2 + i * 0.25}s" src="${beanImg(c === 'anon' ? 'gray' : c, 'none', 40, { noShadow: true })}">`).join('') : '';
    $('#skipBtn').disabled = !canVote;
    $$('#voteGrid .vcard').forEach(card => card.addEventListener('click', e => {
      const id = card.dataset.id;
      if (e.target.closest('.yes')) { castVote(id); e.stopPropagation(); return; }
      if (e.target.closest('.no')) { M.picking = null; renderVoteCards(); e.stopPropagation(); return; }
      if (!canVote || !M.alive.has(id)) return;
      M.picking = M.picking === id ? null : id;
      Sfx.tap();
      renderVoteCards();
    }));
  }

  function castVote(id) {
    const M = App.G.meeting;
    if (!M || M.myVote) return;
    M.myVote = id; M.picking = null;
    send({ t: 'vote', id });
    Sfx.vote();
    renderVoteCards();
  }
  $('#skipBtn').addEventListener('click', () => castVote('skip'));
  $('#meetChatBtn').addEventListener('click', () => toggleChat());

  function updateMeetingTimer() {
    const G = App.G;
    if (!G || !G.meeting || !$('#meeting').classList.contains('show')) return;
    const M = G.meeting;
    const t = now();
    let txt, hint = '';
    if (M.results) { txt = 'Resultados'; }
    else if (t < M.discussEnd) { txt = `Discusión: ${Math.ceil((M.discussEnd - t) / 1000)} s`; hint = 'Hablen en el chat antes de votar'; }
    else {
      txt = `Votación termina en: ${Math.max(0, Math.ceil((M.voteEnd - t) / 1000))} s`;
      hint = !M.alive.has(App.you) ? 'Los fantasmas no votan 👻' : M.myVote ? 'Voto emitido ✓' : 'Toca un jugador para votar';
      if (!M.votingOpened) { M.votingOpened = true; renderVoteCards(); Sfx.pop(); }
    }
    const el = $('#meetTimer');
    if (el.textContent !== txt) { el.textContent = txt; }
    if ($('#meetHint').textContent !== hint) $('#meetHint').textContent = hint;
  }

  function onResults(m) {
    const M = App.G.meeting;
    M.results = m;
    M.picking = null;
    renderVoteCards();
    const n = Object.values(m.voters).reduce((a, v) => a + v.length, 0);
    for (let i = 0; i < n; i++) setTimeout(() => Sfx.reveal(), 200 + i * 250);
  }

  function onEject(m) {
    const G = App.G;
    $('#meeting').classList.remove('show');
    closeChat();
    G.phase = 'eject';
    if (m.id === App.you) G.alive = false;
    const p = m.id ? App.meta.get(m.id) : null;
    if (p) p.alive = false;
    const fx = $('#ejectFx');
    fx.classList.add('show');
    $('#ejLine1').textContent = ''; $('#ejLine2').textContent = '';
    Sfx.eject();
    const cv = $('#ejectCanvas'), c = cv.getContext('2d');
    const t0 = now();
    const stars = []; for (let i = 0; i < 220; i++) stars.push([Math.random(), Math.random(), Math.random() * 2 + 0.5]);
    let typed1 = 0, typed2 = 0;
    App.fx = {
      kind: 'eject', draw() {
        const t = (now() - t0) / 1000;
        const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
        for (const s of stars) {
          const x = ((s[0] * w - t * 60 * s[2]) % w + w) % w;
          c.fillStyle = `rgba(255,255,255,${0.3 + s[2] / 3})`; c.fillRect(x, s[1] * h, s[2], s[2]);
        }
        if (m.id) {
          const k = t / 6;
          const x = -120 + k * (w + 240), y = h * 0.42 + Math.sin(t * 1.2) * 20;
          c.save(); c.translate(x, y); c.rotate(t * 2.2);
          Draw.bean(c, 0, 45, { color: m.color, hat: m.hat, scale: Math.min(w, h) / 500, noShadow: true, time: t });
          c.restore();
        }
        if (t > 1.3) {
          const want = Math.min(m.line1.length, Math.floor((t - 1.3) * 22));
          if (want > typed1) { typed1 = want; $('#ejLine1').textContent = m.line1.slice(0, want); Sfx.type(); }
        }
        const t2 = 1.5 + m.line1.length / 22;
        if (m.line2 && t > t2 + 0.3) {
          const want = Math.min(m.line2.length, Math.floor((t - t2 - 0.3) * 22));
          if (want > typed2) { typed2 = want; $('#ejLine2').textContent = m.line2.slice(0, want); Sfx.type(); }
        }
      },
    };
    setTimeout(() => {
      fx.classList.remove('show');
      if (App.fx && App.fx.kind === 'eject') App.fx = null;
      if (App.G && !App.G.alive && m.id === App.you) { $('#ghostTip').classList.add('show'); setTimeout(() => $('#ghostTip').classList.remove('show'), 6000); }
      updateChatButton();
    }, 7300);
  }

  // ================================================================ animación de muerte
  function playKillAnim(by, victim) {
    const fx = $('#killFx');
    fx.classList.add('show');
    const cv = $('#killCanvas'), c = cv.getContext('2d');
    const t0 = now();
    Sfx.kill();
    setTimeout(() => Sfx.stab(), 550);
    const blood = []; for (let i = 0; i < 30; i++) blood.push([Math.random() * 6.28, 100 + Math.random() * 260, 3 + Math.random() * 7]);
    App.fx = {
      kind: 'kill', draw() {
        const t = (now() - t0) / 1000;
        const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
        const band = Math.min(1, t / 0.35);
        const bh = h * 0.5 * band;
        const g = c.createLinearGradient(0, h / 2 - bh / 2, 0, h / 2 + bh / 2);
        g.addColorStop(0, '#3a0000'); g.addColorStop(0.5, '#8a0000'); g.addColorStop(1, '#3a0000');
        c.fillStyle = g; c.fillRect(0, h / 2 - bh / 2, w, bh);
        c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const y = h / 2 - bh / 2 + ((i * 53 + t * 900) % bh); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        const s = Math.min(w, h) / 380;
        const lunge = t < 0.5 ? 0 : t < 0.7 ? (t - 0.5) / 0.2 : 1;
        const kx = w * 0.3 + lunge * w * 0.12, ky = h / 2 + 80 * s;
        const vx = w * 0.62, vy = h / 2 + 80 * s;
        const killed = t > 0.68;
        if (killed) {
          const k = Math.min(1, (t - 0.68) / 0.6);
          for (const b of blood) { c.fillStyle = `rgba(160,0,0,${1 - k * 0.3})`; c.beginPath(); c.arc(vx + Math.cos(b[0]) * b[1] * k * s, vy - 50 * s + Math.sin(b[0]) * b[1] * k * s * 0.5, b[2] * s, 0, 7); c.fill(); }
          Draw.deadBody(c, vx, vy, victim.color, { scale: s * 1.1 });
        } else {
          Draw.bean(c, vx, vy + Math.sin(t * 30) * (t > 0.4 ? 3 : 0), { color: victim.color, hat: victim.hat, scale: s * 1.1, flip: true, noShadow: true, time: t });
        }
        Draw.bean(c, kx, ky, { color: by.color, hat: by.hat, scale: s * 1.1, noShadow: true, time: t, lean: lunge * 0.15 });
        // cuchillo
        c.save(); c.translate(kx + 40 * s, ky - 40 * s); c.rotate(-0.6 + lunge * 1.2);
        c.fillStyle = '#d7dde5'; c.strokeStyle = '#000'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(70 * s, -10 * s); c.lineTo(80 * s, 0); c.lineTo(0, 10 * s); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#5d4037'; c.fillRect(-26 * s, -7 * s, 26 * s, 14 * s); c.strokeRect(-26 * s, -7 * s, 26 * s, 14 * s);
        c.restore();
        if (t > 0.66 && t < 0.8) { c.fillStyle = `rgba(255,255,255,${(0.8 - t) * 6})`; c.fillRect(0, 0, w, h); }
      },
    };
    setTimeout(() => { fx.classList.remove('show'); if (App.fx && App.fx.kind === 'kill') App.fx = null; }, 2500);
  }

  // ================================================================ fin de partida
  function onGameOver(m) {
    const G = App.G;
    if (G) G.over = true;
    Sfx.alarm(false);
    Tasks.close(true); closeMap();
    $('#meeting').classList.remove('show');
    const won = m.winners.indexOf(App.you) >= 0;
    const fx = $('#gameOver');
    const delay = App.fx && App.fx.kind === 'kill' ? 2600 : (App.fx && App.fx.kind === 'eject' ? 1500 : 300);
    setTimeout(() => {
      hideGameOverlays(false);
      fx.classList.add('show');
      const title = $('#goTitle');
      if (m.mode === 'race') { const w = m.players.find(p => p.id === m.winners[0]); title.textContent = won ? '¡GANASTE!' : `¡GANA ${(w ? w.name : '').toUpperCase()}!`; }
      else title.textContent = won ? 'VICTORIA' : 'DERROTA';
      title.className = 'go-title ' + (won ? 'win' : 'lose');
      const roleTxt = { crew: 'La tripulación gana', impostor: 'Los impostores ganan', hiders: 'Los escondidos ganan', seeker: 'El buscador gana', racer: '' }[m.winner];
      $('#goReason').textContent = (roleTxt ? roleTxt + ' — ' : '') + m.reason;
      $('#goLineup').innerHTML = m.players.filter(p => m.winners.indexOf(p.id) >= 0).map((p, i) =>
        `<div class="lu ${p.id === App.you ? 'me' : ''}" style="animation-delay:${0.3 + i * 0.1}s"><img src="${beanImg(p.color, p.hat, 200, { ghost: !p.alive })}"><span style="color:${p.role === 'impostor' || p.role === 'seeker' ? '#ff453a' : '#fff'}">${esc(p.name)}</span></div>`).join('');
      $('#goRank').innerHTML = m.ranking ? m.ranking.map((r, i) => { const p = m.players.find(x => x.id === r.id) || {}; return `<div><span>${i + 1}. ${esc(p.name || '?')}</span><span>${r.done}/${r.total}</span></div>`; }).join('') : '';
      if (won) Sfx.victory(); else Sfx.defeat();
      App.G = null;
      App.mapId = 'lobby';
      App.me.init = false;
      App.bodies = [];
      App.closedDoors = [];
      App.players.clear();
      for (const p of App.meta.values()) p.alive = true;
      setupHud();
      updateLobbyHud();
    }, delay);
  }
  $('#goContinue').addEventListener('click', () => { $('#gameOver').classList.remove('show'); Sfx.swoosh(); });

  function hideGameOverlays(all) {
    ['#roleReveal', '#killFx', '#meetSplash', '#ejectFx'].forEach(s => $(s).classList.remove('show'));
    $('#meeting').classList.remove('show');
    if (all) $('#gameOver').classList.remove('show');
    App.fx = null;
  }

  // ================================================================ chat
  function toggleChat(force) {
    const open = force !== undefined ? force : !App.chatOpen;
    App.chatOpen = open;
    $('#chat').classList.toggle('show', open);
    if (open) {
      App.unread = 0; updateBadges();
      const G = App.G;
      $('#chatTitle').textContent = G && !G.alive ? 'Chat de fantasmas 👻' : G ? 'Chat de la reunión' : 'Chat de la sala';
      setTimeout(() => $('#chatInput').focus(), 300);
      const log = $('#chatLog'); log.scrollTop = log.scrollHeight;
      Sfx.open();
    } else { $('#chatInput').blur(); }
  }
  function closeChat() { if (App.chatOpen) toggleChat(false); }
  $('#btnChat').addEventListener('click', () => toggleChat());
  $('#chatClose').addEventListener('click', () => toggleChat(false));
  $('#chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#chatInput');
    const text = inp.value.trim();
    if (!text) return;
    send({ t: 'chat', text });
    inp.value = '';
  });
  function updateBadges() {
    const b = App.unread;
    [$('#chatBadge'), $('#meetBadge')].forEach(el => { el.textContent = b > 9 ? '9+' : b; el.classList.toggle('show', b > 0); });
  }
  function addChat(m) {
    const log = $('#chatLog');
    const el = document.createElement('div');
    if (m.sys) { el.className = 'msg sys'; el.textContent = m.text; }
    else {
      const mine = m.id === App.you;
      el.className = 'msg' + (mine ? ' me' : '') + (m.ghost ? ' ghost' : '');
      el.innerHTML = `<img src="${beanImg(m.color, m.hat, 60, { noShadow: true, ghost: !!m.ghost })}"><div class="bubble"><b>${esc(m.name)}</b>${esc(m.text)}</div>`;
      if (!mine) Sfx.chat();
      if (!App.chatOpen && !mine) { App.unread++; updateBadges(); }
    }
    log.appendChild(el);
    while (log.children.length > 120) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  // ================================================================ mapa
  let mapSab = false;
  function openMap(sab) {
    const G = App.G;
    if (!G) return;
    mapSab = !!sab && G.role === 'impostor';
    $('#mapTitle').textContent = mapSab ? 'Sabotaje' : 'Mapa de la nave';
    $('#mapOverlay').classList.add('show');
    Sfx.open();
    renderSabButtons();
  }
  function closeMap() { if ($('#mapOverlay').classList.contains('show')) { $('#mapOverlay').classList.remove('show'); Sfx.close(); } }
  $('#btnMap').addEventListener('click', () => $('#mapOverlay').classList.contains('show') ? closeMap() : openMap(false));
  $('#mapClose').addEventListener('click', closeMap);
  $('#mapOverlay').addEventListener('pointerdown', e => { if (e.target.id === 'mapOverlay') closeMap(); });

  const MAP_BOUNDS = { x: 20, y: 60, w: 4000, h: 2330 };
  function renderSabButtons() {
    const el = $('#sabButtons');
    el.innerHTML = '';
    if (!mapSab) return;
    const pct = (x, y) => [((x - MAP_BOUNDS.x) / MAP_BOUNDS.w * 100) + '%', ((y - MAP_BOUNDS.y) / MAP_BOUNDS.h * 100) + '%'];
    const add = (x, y, icon, onClick, cls) => {
      const b = document.createElement('button');
      b.className = 'sab-btn ' + (cls || '');
      const [l, t] = pct(x, y);
      b.style.left = l; b.style.top = t;
      b.innerHTML = Icons.svg(icon);
      b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      el.appendChild(b);
      return b;
    };
    const G = App.G;
    const mk = (kind, x, y, icon) => {
      const b = add(x, y, icon, () => { send({ t: 'sabotage', kind }); closeMap(); });
      b.dataset.kind = kind;
    };
    mk('lights', 1260, 1700, 'lights');
    mk('reactor', 270, 1200, 'reactor');
    mk('o2', 2770, 960, 'o2');
    const rooms = [...new Set(S.SHIP.doors.map(d => d.room))];
    for (const r of rooms) {
      const rm = S.SHIP.rooms.find(x => x.id === r);
      const b = add(rm.r.x + rm.r.w - 55, rm.r.y + rm.r.h - 50, 'door', () => { send({ t: 'sabotage', kind: 'doors', room: r }); closeMap(); }, 'door');
      b.dataset.room = r;
    }
    updateSabButtons();
  }
  function updateSabButtons() {
    const G = App.G;
    if (!G || !mapSab) return;
    const t = now();
    $$('#sabButtons .sab-btn').forEach(b => {
      let cool;
      if (b.dataset.kind) cool = !!G.sab || t < G.sabReadyAt;
      else cool = (G.doorReady[b.dataset.room] || 0) > t || (G.sab && G.sab.kind !== 'lights');
      b.classList.toggle('cool', cool);
    });
  }

  function drawMap(t) {
    if (!$('#mapOverlay').classList.contains('show')) return;
    const G = App.G;
    if (!G) return closeMap();
    const cv = $('#mapCanvas');
    const wrap = $('#mapWrap');
    const W = wrap.clientWidth - 20;
    const H = W * MAP_BOUNDS.h / MAP_BOUNDS.w;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; }
    const c = cv.getContext('2d');
    const k = W / MAP_BOUNDS.w;
    c.setTransform(dpr * k, 0, 0, dpr * k, -MAP_BOUNDS.x * k * dpr, -MAP_BOUNDS.y * k * dpr);
    c.clearRect(MAP_BOUNDS.x, MAP_BOUNDS.y, MAP_BOUNDS.w, MAP_BOUNDS.h);
    c.fillStyle = mapSab ? '#3d1720' : '#16365c';
    c.strokeStyle = mapSab ? '#ff6b6b' : '#64d2ff';
    c.lineWidth = 10;
    for (const r of S.SHIP.rects) c.strokeRect(r.x, r.y, r.w, r.h);
    for (const r of S.SHIP.rects) c.fillRect(r.x, r.y, r.w, r.h);
    c.font = '800 64px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const r of S.SHIP.rooms) {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillText(r.name, r.r.x + r.r.w / 2, r.r.y + r.r.h / 2 - (mapSab ? 40 : 0));
    }
    if (!G.fake) {
      for (const tk of G.tasks) {
        if (tk.done) continue;
        const st = tk.steps[tk.step];
        c.fillStyle = '#ffd60a';
        c.beginPath(); c.arc(st.x, st.y, 30 + Math.sin(t * 5) * 5, 0, 7); c.fill();
        c.fillStyle = '#000'; c.font = '900 44px Inter'; c.fillText('!', st.x, st.y + 2);
      }
    }
    if (G.sab && G.sab.kind) {
      for (const st of S.SABOTAGE_STATIONS[G.sab.kind]) { c.fillStyle = `rgba(255,59,48,${0.5 + 0.5 * Math.sin(t * 8)})`; c.beginPath(); c.arc(st.x, st.y, 50, 0, 7); c.fill(); }
    }
    if (G.pings && t * 1000 - G.pings.t < 4000 && G.role === 'seeker') {
      for (const p of G.pings.pts) { c.fillStyle = 'rgba(255,69,58,0.8)'; c.beginPath(); c.arc(p[0], p[1], 40, 0, 7); c.fill(); }
    }
    const me = App.meta.get(App.you) || {};
    Draw.bean(c, App.me.x, App.me.y + 30, { color: me.color, hat: me.hat, scale: 1.6, time: t, noShadow: true, ghost: !G.alive });
    updateSabButtons();
  }

  // ================================================================ entrada
  const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  addEventListener('keydown', e => {
    const typing = document.activeElement && (document.activeElement.tagName === 'INPUT');
    if (e.key === 'Escape') {
      if (Tasks.isOpen()) return Tasks.close();
      if ($('#mapOverlay').classList.contains('show')) return closeMap();
      if (App.chatOpen) return toggleChat(false);
      const m = $$('.modal.show').pop(); if (m) return closeModal(m.id);
      return;
    }
    if (typing) return;
    if (App.screen !== 'scrGame') return;
    if (KEYMAP[e.code]) { App.keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    const G = App.G;
    switch (e.code) {
      case 'KeyE': case 'Space': e.preventDefault(); if (!Tasks.isOpen() && !anyModal()) doUse(); break;
      case 'KeyR': doReport(); break;
      case 'KeyQ': doKill(); break;
      case 'KeyV': doVent(); break;
      case 'KeyG': if (G && G.role === 'impostor') openMap(true); break;
      case 'Tab': case 'KeyM': e.preventDefault(); if (G) { $('#mapOverlay').classList.contains('show') ? closeMap() : openMap(false); } break;
      case 'Enter': if ($('#btnChat').style.display !== 'none' || (G && G.phase === 'meeting')) { e.preventDefault(); toggleChat(true); } break;
    }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) App.keys[KEYMAP[e.code]] = false; });
  addEventListener('blur', () => { App.keys = {}; });

  // joystick
  (function () {
    const js = $('#joystick'), knob = $('#knob');
    let id = null, cx = 0, cy = 0;
    js.addEventListener('pointerdown', e => {
      id = e.pointerId; js.setPointerCapture(id);
      const r = js.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = e => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy), max = js.clientWidth * 0.36;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transition = 'none';
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      App.joy = { x: dx / max, y: dy / max };
    };
    const up = e => {
      if (e.pointerId !== id) return;
      id = null; App.joy = { x: 0, y: 0 };
      knob.style.transition = ''; knob.style.transform = '';
    };
    js.addEventListener('pointermove', move);
    js.addEventListener('pointerup', up);
    js.addEventListener('pointercancel', up);
  })();

  $('#btnGear').addEventListener('click', openSettings);

  // ================================================================ visión
  function built() { return World.build(S.MAPS[App.mapId]); }

  function visionRadius() {
    const G = App.G;
    if (!G) return 5000;
    const imp = G.role === 'impostor' || G.role === 'seeker';
    let r = S.BASE_VISION * (imp ? G.settings.impVision : G.settings.crewVision);
    if (!imp && G.sab && G.sab.kind === 'lights') r *= 0.35;
    return Math.max(140, r);
  }

  function fogActive() { const G = App.G; return G && G.alive && G.phase === 'play'; }

  function isPointVisible(x, y) {
    if (!fogActive()) return true;
    return World.canSee(S.SHIP, built().vgrid, App.me.x, App.me.y - 20, x, y - 20, App.visR || visionRadius(), App.closedDoors);
  }
  function isVisible(p) { return isPointVisible(p.x, p.y); }

  // ================================================================ bucle principal
  const cv = $('#game');
  const ctx = cv.getContext('2d');
  const fog = document.createElement('canvas');
  const fctx = fog.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    fog.width = cv.width; fog.height = cv.height;
    App.cam.zoom = clamp(Math.min(H / 900, W / (W < H ? 640 : 1100)), 0.45, 1.2);
    renderVentArrows();
  }
  addEventListener('resize', resize);
  resize();

  function canMove() {
    const G = App.G;
    if (App.screen !== 'scrGame' || !App.me.init) return false;
    if (Tasks.isOpen() || anyModal() || $('#mapOverlay').classList.contains('show')) return false;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return false;
    if (App.fx || $('#roleReveal').classList.contains('show')) return false;
    if (!G) return true;
    if (G.phase !== 'play' || G.inVent) return false;
    if (G.role === 'seeker' && now() < G.seekerReleaseAt) return false;
    return true;
  }

  let lastT = now(), lastStepPhase = 0, heartT = 0;
  function frame() {
    const t = now();
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const ts = t / 1000;
    if (App.screen !== 'scrGame') {
      drawMenuBg(ts, dt);
      drawHero(ts);
      drawCustom(ts);
      requestAnimationFrame(frame);
      return;
    }
    drawCustom(ts);
    update(dt, t);
    render(ts, dt);
    if (App.fx) App.fx.draw();
    drawMap(ts);
    requestAnimationFrame(frame);
  }

  function update(dt, t) {
    const G = App.G;
    const me = App.me;
    const map = S.MAPS[App.mapId];
    // movimiento local
    let ix = 0, iy = 0;
    if (canMove()) {
      ix = (App.keys.r ? 1 : 0) - (App.keys.l ? 1 : 0) + App.joy.x;
      iy = (App.keys.d ? 1 : 0) - (App.keys.u ? 1 : 0) + App.joy.y;
      const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      if (l < 0.15) { ix = 0; iy = 0; }
    }
    const moving = ix !== 0 || iy !== 0;
    if (moving) {
      const settings = G ? G.settings : App.room ? App.room.settings : { playerSpeed: 1 };
      let sp = S.BASE_SPEED * settings.playerSpeed;
      if (G && G.role === 'seeker') sp *= G.settings.seekerSpeed * (G.finalHide ? 1.1 : 1);
      const ghost = G && !G.alive;
      if (ghost) sp *= 1.25;
      const dx = ix * sp * dt, dy = iy * sp * dt;
      if (ghost) { me.x = clamp(me.x + dx, 40, map.w - 40); me.y = clamp(me.y + dy, 40, map.h - 40); }
      else { const np = S.moveWithCollision(map, me.x, me.y, dx, dy, App.closedDoors); me.x = np.x; me.y = np.y; }
      if (Math.abs(ix) > 0.1) me.f = ix < 0 ? 1 : 0;
      me.walk += dt * 11 * Math.min(1, Math.hypot(ix, iy) + 0.3);
      const ph = Math.floor(me.walk / Math.PI);
      if (ph !== lastStepPhase) { lastStepPhase = ph; if (!G || G.alive) Sfx.footstep(); }
    }
    me.m = moving ? 1 : 0;
    // envío
    if (App.me.init && t - App.lastSend > 50) {
      const s = App.lastSent;
      const changed = !s || Math.abs(s.x - me.x) > 0.5 || Math.abs(s.y - me.y) > 0.5 || s.m !== me.m || s.f !== me.f;
      if (changed || t - App.lastSend > 500) {
        App.lastSend = t;
        App.lastSent = { x: me.x, y: me.y, m: me.m, f: me.f };
        send({ t: 'move', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f: me.f, m: me.m });
      }
    }
    // interpolación de otros
    for (const p of App.players.values()) {
      const k = Math.min(1, dt * 12);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
      if (p.m) p.walk += dt * 11;
    }
    // cámara
    const c = App.cam;
    c.x += (me.x - c.x) * Math.min(1, dt * 7);
    c.y += (me.y - 40 - c.y) * Math.min(1, dt * 7);
    App.shake *= Math.pow(0.02, dt);
    // interacciones
    App.interact = computeInteract();
    updateActions();
    updateTaskPanel(false);
    updateMeetingTimer();
    // escondite
    if (G && G.mode === 'hideseek') {
      const left = Math.max(0, G.hsEndAt - t);
      const rel = Math.max(0, G.seekerReleaseAt - t);
      $('#hsLabel').textContent = rel > 0 && G.phase === 'play' ? 'EL BUSCADOR SALE EN' : G.finalHide ? '¡ESCONDITE FINAL!' : 'TIEMPO RESTANTE';
      const show = rel > 0 && G.phase === 'play' ? rel : left;
      $('#hsTime').textContent = `${Math.floor(show / 60000)}:${String(Math.floor(show / 1000) % 60).padStart(2, '0')}`;
      $('#hsTimer').classList.toggle('final', !!G.finalHide);
      $('#hsFill').style.width = clamp(left / (G.settings.hideTime * 1000) * 100, 0, 100) + '%';
      if (G.role === 'hider' && G.alive && G.phase === 'play') {
        const sk = App.players.get(G.seeker);
        let inten = 0;
        if (sk && !sk.hidden && sk.alive) inten = clamp(1 - (Math.hypot(sk.x - me.x, sk.y - me.y) - 180) / 700, 0, 1);
        $('#danger').classList.toggle('show', inten > 0);
        $('#vignette').style.opacity = inten * 0.85;
        if (inten > 0) {
          heartT -= dt;
          if (heartT <= 0) { heartT = 1.2 - inten * 0.75; Sfx.heartbeat(inten); }
          $('.danger-dot').style.transform = `scale(${1 + Math.max(0, Math.sin(t / 1000 * (4 + inten * 8))) * 0.3 * (0.5 + inten)})`;
        }
      } else { $('#danger').classList.remove('show'); $('#vignette').style.opacity = 0; }
    }
    // cartel de sabotaje
    if (G && G.sab && G.sab.kind && G.phase === 'play') {
      const b = $('#sabBanner');
      const left = Math.max(0, Math.ceil((G.sab.endsAt - t) / 1000));
      const txt = G.sab.kind === 'lights' ? '💡 Luces saboteadas' : G.sab.kind === 'reactor' ? `☢️ ¡FUSIÓN DEL REACTOR EN ${left} s!` : `🫁 ¡OXÍGENO AGOTADO EN ${left} s!`;
      if (b.textContent !== txt) b.textContent = txt;
      b.classList.add('show');
    } else $('#sabBanner').classList.remove('show');
    App.ventFx = App.ventFx.filter(v => t / 1000 - v.t < 0.7);
  }

  function render(ts) {
    const G = App.G;
    const map = S.MAPS[App.mapId];
    const B = built();
    const cam = App.cam;
    const z = cam.zoom;
    const sx = (Math.random() - 0.5) * App.shake, sy = (Math.random() - 0.5) * App.shake;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    World.drawSpace(ctx, W, H, cam.x, cam.y, ts);
    const ox = W / 2 - cam.x * z + sx, oy = H / 2 - cam.y * z + sy;
    const worldT = [DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy];
    ctx.setTransform(...worldT);
    // porción visible del mapa
    const vx = Math.max(0, cam.x - W / 2 / z - 50), vy = Math.max(0, cam.y - H / 2 / z - 50);
    const vw = Math.min(map.w - vx, W / z + 100), vh = Math.min(map.h - vy, H / z + 100);
    if (vw > 0 && vh > 0) ctx.drawImage(B.canvas, vx, vy, vw, vh, vx, vy, vw, vh);
    World.drawLive(ctx, map, ts, { sab: G && G.sab && G.sab.kind, ventFx: App.ventFx, closedDoors: App.closedDoors, highlights: App.interact.highlights || [] });

    const fogOn = fogActive();
    const R = App.visR = visionRadius();
    const eyeX = App.me.x, eyeY = App.me.y - 20;
    const iAmGhost = G && !G.alive;
    // entidades ordenadas por profundidad
    const ents = [];
    for (const b of App.bodies) {
      if (fogOn && !World.canSee(map, B.vgrid, eyeX, eyeY, b.x, b.y - 20, R, App.closedDoors)) continue;
      ents.push({ y: b.y - 1, draw: () => Draw.deadBody(ctx, b.x, b.y, b.color) });
    }
    const visibleNames = [];
    for (const p of App.players.values()) {
      if (p.hidden) continue;
      const meta = App.meta.get(p.id);
      if (!meta) continue;
      const ghost = G && !p.alive;
      if (ghost && !iAmGhost) continue;
      if (fogOn && !ghost && !World.canSee(map, B.vgrid, eyeX, eyeY, p.x, p.y - 20, R, App.closedDoors)) continue;
      ents.push({ y: p.y, draw: () => drawPlayer(p.x, p.y, meta, { flip: p.f, moving: p.m, walk: p.walk, ghost, scan: p.scan }, ts) });
      visibleNames.push({ x: p.x, y: p.y, meta, ghost });
    }
    const myMeta = App.meta.get(App.you);
    if (myMeta && App.me.init && !(G && G.inVent)) {
      ents.push({ y: App.me.y, draw: () => drawPlayer(App.me.x, App.me.y, myMeta, { flip: App.me.f, moving: App.me.m, walk: App.me.walk, ghost: iAmGhost, scan: Tasks.isOpen() && Tasks.current().game === 'scan' }, ts) });
      visibleNames.push({ x: App.me.x, y: App.me.y, meta: myMeta, ghost: iAmGhost, me: true });
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    // niebla de visión
    if (fogOn) {
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fog.width, fog.height);
      const dark = G.sab && G.sab.kind === 'lights' && !isImp();
      fctx.fillStyle = dark ? 'rgba(2,3,8,0.95)' : 'rgba(4,6,14,0.84)';
      fctx.fillRect(0, 0, fog.width, fog.height);
      fctx.setTransform(...worldT);
      const poly = World.visionPolygon(map, B.vgrid, eyeX, eyeY, R, App.closedDoors);
      World.drawFog(fctx, poly, eyeX, eyeY, R);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fog, 0, 0);
      ctx.setTransform(...worldT);
    }

    // pings del buscador
    if (G && G.pings && G.role === 'seeker') {
      const age = (now() - G.pings.t) / 1000;
      if (age < 3) for (const p of G.pings.pts) {
        ctx.strokeStyle = `rgba(255,69,58,${1 - age / 3})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p[0], p[1] - 30, 30 + age * 60, 0, 7); ctx.stroke();
      }
    }

    // nombres
    ctx.font = '800 17px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const n of visibleNames) {
      let col = '#ffffff';
      if (G && G.role === 'impostor' && (n.me || G.mates.has(n.meta.id))) col = '#ff453a';
      if (G && G.mode === 'hideseek' && n.meta.id === G.seeker) col = '#ff453a';
      const hatLift = n.meta.hat && n.meta.hat !== 'none' ? 26 : 0;
      const y = n.y - 88 - hatLift + (n.ghost ? -6 : 0);
      ctx.globalAlpha = n.ghost ? 0.6 : 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5;
      ctx.strokeText(n.meta.name, n.x, y);
      ctx.fillStyle = col;
      ctx.fillText(n.meta.name, n.x, y);
      ctx.globalAlpha = 1;
    }

    // flechas a sabotajes
    if (G && G.sab && G.sab.kind && G.alive && G.phase === 'play' && !isImp()) {
      const sts = S.SABOTAGE_STATIONS[G.sab.kind];
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      for (const st of sts) {
        const px = (st.x - cam.x) * z + W / 2, py = (st.y - cam.y) * z + H / 2;
        if (px > 30 && px < W - 30 && py > 30 && py < H - 30) continue;
        const a = Math.atan2(py - H / 2, px - W / 2);
        const r = Math.min(W, H) / 2 - 50;
        const ax = W / 2 + Math.cos(a) * r, ay = H / 2 + Math.sin(a) * r;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
        ctx.fillStyle = `rgba(255,59,48,${0.7 + 0.3 * Math.sin(ts * 8)})`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-14, -18); ctx.lineTo(-6, 0); ctx.lineTo(-14, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    // tinte rojo de alarma
    if (G && G.sab && (G.sab.kind === 'reactor' || G.sab.kind === 'o2')) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,0,0,${0.06 + 0.06 * Math.sin(ts * 5)})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }

  function drawPlayer(x, y, meta, o, t) {
    if (o.scan && App.G && App.G.settings.visualTasks) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 8);
      const g = ctx.createLinearGradient(0, y - 110, 0, y);
      g.addColorStop(0, 'rgba(48,209,88,0)'); g.addColorStop(1, 'rgba(48,209,88,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, y - 110, 80, 110);
      ctx.fillStyle = 'rgba(120,255,160,0.8)';
      ctx.fillRect(x - 40, y - 110 + ((t * 120) % 110), 80, 4);
      ctx.restore();
    }
    Draw.bean(ctx, x, y, { color: meta.color, hat: meta.hat, flip: o.flip, moving: o.moving, walk: o.walk, ghost: o.ghost, time: t });
  }

  // ================================================================ arranque
  Icons.hydrate();
  requestAnimationFrame(frame);
  Sfx.music('menu');
})();
