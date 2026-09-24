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
    pets: new Map(), emotes: new Map(), countdownEnd: 0,
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
    const hf = Math.sin(t * 0.3) > 0.8;
    Draw.bean(heroC, 170, 300 + Math.sin(t * 2) * 3, { color: u.color, hat: u.hat, scale: 3, moving: walking, walk: t * 9, flip: hf, time: t });
    Draw.pet(heroC, hf ? 290 : 60, 305, u.pet, { color: u.color, scale: 2, moving: walking, flip: hf, time: t });
  }

  // ================================================================ personalizar
  function openCustomize() {
    renderCustomize();
    openModal('mCustom');
  }
  function myLook() {
    if (App.room && App.you) { const m = App.meta.get(App.you); if (m) return { color: m.color, hat: m.hat, pet: m.pet || 'none' }; }
    return { color: App.user.color, hat: App.user.hat, pet: App.user.pet || 'none' };
  }
  function renderCustomize() {
    const look = myLook();
    const taken = new Set();
    if (App.room) for (const p of App.room.players) if (p.id !== App.you) taken.add(p.color);
    $('#colorGrid').innerHTML = S.COLORS.map(c => `<button class="swatch ${c.id === look.color ? 'sel' : ''} ${taken.has(c.id) ? 'taken' : ''}" title="${c.name}" data-c="${c.id}" style="background:${c.body}"></button>`).join('');
    $('#hatGrid').innerHTML = S.HATS.map(h => `<button class="hat ${h.id === look.hat ? 'sel' : ''}" title="${h.name}" data-h="${h.id}"><img src="${beanImg(look.color, h.id, 80, { noShadow: true })}" alt="${h.name}"></button>`).join('');
    $$('#colorGrid .swatch').forEach(b => b.addEventListener('click', () => setLook({ color: b.dataset.c })));
    $$('#hatGrid .hat').forEach(b => b.addEventListener('click', () => setLook({ hat: b.dataset.h })));
    $('#petGrid').innerHTML = S.PETS.map(h => `<button class="hat ${h.id === look.pet ? 'sel' : ''}" title="${h.name}" data-p="${h.id}"><img src="${Draw.petImage(h.id, look.color, 64)}" alt="${h.name}"></button>`).join('');
    $$('#petGrid .hat').forEach(b => b.addEventListener('click', () => setLook({ pet: b.dataset.p })));
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
    Draw.bean(custC, 115, 225 + Math.sin(t * 2) * 3, { color: look.color, hat: look.hat, scale: 2.2, moving: true, walk: t * 8, time: t });
    Draw.pet(custC, 210, 232, look.pet, { color: look.color, scale: 1.6, moving: true, time: t });
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
        App.user = m.user; renderHome(); updateDevUi();
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
      case 'emote': App.emotes.set(m.id, { e: m.e, t: now() }); Sfx.emote(); break;
      case 'countdown': onCountdown(m); break;
      case 'devResult': onDevResult(m); break;
      case 'devState': Object.assign(App.dev, { noclip: m.noclip, speed: m.speed, nocd: m.nocd, frozen: m.frozen, role: m.role, impostors: m.impostors }); renderDev(); updateDevUi(); break;
      case 'devRoles': App.devRoles = m.roles || {}; break;
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
    updateDevUi(); renderDev();
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
    $('#lbCount').textContent = n > r.settings.maxPlayers ? `${n} 🤪` : `${n}/${r.settings.maxPlayers}`;
    const host = r.hostId === App.you;
    const st = $('#lbStart');
    st.style.display = host ? '' : 'none';
    const min = S.MODES[r.settings.mode].min;
    st.classList.toggle('dim', n < min);
    st.textContent = App.countdownEnd ? 'Cancelar' : n < min ? `Faltan ${min - n}` : 'Empezar';
  }
  let cdTimer = null;
  function onCountdown(m) {
    clearInterval(cdTimer);
    const el = $('#countdown');
    if (!m.in) { App.countdownEnd = 0; el.classList.remove('show'); updateLobbyHud(); return; }
    App.countdownEnd = now() + m.in;
    el.classList.add('show');
    let last = -1;
    const tickCd = () => {
      const left = Math.ceil((App.countdownEnd - now()) / 1000);
      if (left <= 0 || !App.countdownEnd) { clearInterval(cdTimer); el.classList.remove('show'); return; }
      if (left !== last) {
        last = left;
        const b = $('#cdNum');
        b.textContent = left; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        Sfx.countdown(left === 1);
      }
    };
    tickCd();
    cdTimer = setInterval(tickCd, 100);
    updateLobbyHud();
  }

  $('#lbStart').addEventListener('click', () => {
    if (App.countdownEnd) return send({ t: 'start' });
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
      tasks: m.tasks || [], fake: m.fake, alive: m.alive, phase: m.phase, sub: m.sub || null, ventEnd: 0, ventReadyAt: 0,
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
    App.countdownEnd = 0; $('#countdown').classList.remove('show'); App.pets.clear();
    for (const p of App.players.values()) p.hidden = true;
    App.chatLog = [];
    $('#chatLog').innerHTML = '';
    Tasks.close(true); closeMap(); closeChat();
    $$('.modal.show').forEach(x => x.classList.remove('show'));
    hideGameOverlays(true);
    setupHud();
    App.devRoles = {};
    if (App.dev.xray && devSolo()) send({ t: 'dev', cmd: 'reveal' });
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
      const n = Math.min(G.settings.impostors, Math.max(1, Math.floor((all.length - 1) / 2)));
      const nTxt = `Hay <b>${n} impostor${n > 1 ? 'es' : ''}</b> entre nosotros.`;
      if (G.sub === 'sheriff') { title.textContent = 'Sheriff'; title.className = 'role-title sheriff'; sub.innerHTML = `${nTxt}<br>Dispara al impostor… <b>si fallas, mueres tú.</b>`; }
      else if (G.sub === 'engineer') { title.textContent = 'Ingeniero'; title.className = 'role-title eng'; sub.innerHTML = `${nTxt}<br>Puedes esconderte en las <b>ventilas</b> unos segundos.`; }
      else { title.textContent = 'Tripulante'; title.className = 'role-title crew'; sub.innerHTML = nTxt; }
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
    show('#actKill', G && (G.role === 'impostor' || G.role === 'seeker' || G.sub === 'sheriff'));
    show('#actVent', imp || (G && G.sub === 'engineer'));
    $('#actKill').querySelector('em').textContent = G && G.sub === 'sheriff' ? 'DISPARAR' : 'MATAR';
    show('#actSabotage', imp);
    updateChatButton();
    updateTaskPanel(true);
    updateDevUi(); renderDev();
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
    else head.textContent = !G.alive ? 'Eres un fantasma: termina tus tareas.' : G.sub === 'sheriff' ? 'Tareas · eres el Sheriff 🔫' : G.sub === 'engineer' ? 'Tareas · eres Ingeniero 🔧' : 'Tareas';
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
    if (m.done) {
      toast(`✓ ${tk.name}`);
      Fx.confetti(App.me.x, App.me.y - 60, 46); Fx.text(App.me.x, App.me.y - 70, '¡Tarea lista!'); Sfx.confetti();
      const f = $('#tpFill'); f.classList.remove('pulse-bar'); void f.offsetWidth; f.classList.add('pulse-bar');
    } else Fx.text(App.me.x, App.me.y - 70, `${tk.step}/${tk.steps.length}`, '#ffd60a');
    updateTaskPanel(true);
  }

  function doUse() {
    const G = App.G;
    const u = App.interact.use;
    if (!u) return;
    if (u.kind === 'laptop') return openCustomize();
    if (u.kind === 'admin') return openMap('admin');
    if (u.kind === 'cams') return openCams();
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
    if (!G.inVent) {
      const a = S.ADMIN_TABLE, sd = S.SECURITY_DESK;
      consider({ kind: 'admin' }, a.x, a.y, 150);
      consider({ kind: 'cams' }, sd.x, sd.y, 130);
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
    const hunter = G.alive && !G.inVent && (G.role === 'impostor' || G.sub === 'sheriff' || (G.role === 'seeker' && now() >= G.seekerReleaseAt));
    if (hunter) {
      const range = S.KILL_DISTANCES[G.settings.killDistance];
      let bd = Infinity;
      for (const p of App.players.values()) {
        if (p.hidden || !p.alive || G.mates.has(p.id)) continue;
        const d = Math.hypot(me.x - p.x, me.y - p.y);
        if (d <= range && d < bd && isVisible(p)) { bd = d; res.kill = p; }
      }
    }
    if (G.alive && (G.role === 'impostor' || G.sub === 'engineer')) {
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
    else if (i.use && i.use.kind === 'admin') label = 'ADMIN';
    else if (i.use && i.use.kind === 'cams') label = 'CÁMARAS';
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
      const vc = $('#ventCd');
      const ventLeft = G.inVent && G.ventEnd ? (G.ventEnd - t) / 1000 : (!G.inVent && G.ventReadyAt > t ? (G.ventReadyAt - t) / 1000 : 0);
      vc.classList.toggle('show', ventLeft > 0);
      vc.textContent = Math.ceil(ventLeft);
      set('#actVent', i.vent && (G.inVent || G.ventReadyAt <= t));
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
    Tasks.close(true); closeMap(); closeCams();
    if (m.misfire) { Sfx.shot(); App.shake = 14; Fx.blood(App.me.x, App.me.y); toast('💀 ¡Le disparaste a un inocente! El Sheriff cae.', true); }
    else playKillAnim(m.by, me);
    updateChatButton();
    setTimeout(() => { $('#ghostTip').classList.add('show'); setTimeout(() => $('#ghostTip').classList.remove('show'), 6000); }, 2600);
    updateTaskPanel(true);
  }

  function onKillFx(m) {
    const G = App.G;
    const d = Math.hypot(App.me.x - m.x, App.me.y - m.y);
    const vis = !G.alive || d < visionRadius() && Shared.lineOfSight(S.SHIP, built().vgrid, App.me.x, App.me.y - 20, m.x, m.y - 20, App.closedDoors);
    if (m.victim === App.you) return;
    if (vis || d < 200) { if (m.shot) Sfx.shot(); else Sfx.kill(); Fx.blood(m.x, m.y); if (d < 300) App.shake = 10; }
    const p = App.meta.get(m.victim);
    if (p) p.alive = false;
    const pl = App.players.get(m.victim);
    if (pl) pl.alive = false;
  }

  function onVent(m) {
    const G = App.G;
    const was = G.inVent;
    G.inVent = m.id;
    if (m.max) G.ventEnd = now() + m.max;
    if (!m.id) { G.ventEnd = 0; if (m.cd) G.ventReadyAt = now() + m.cd; }
    if (m.id) {
      const v = S.SHIP.vents.find(v => v.id === m.id);
      if (!was) Fx.puff(App.me.x, App.me.y);
      App.me.x = v.x; App.me.y = v.y;
      if (was) Sfx.ventMove(); else { Sfx.vent(); App.ventFx.push({ id: m.id, t: now() / 1000 }); }
    } else {
      Sfx.vent();
      if (was) { App.ventFx.push({ id: was, t: now() / 1000 }); Fx.puff(App.me.x, App.me.y); }
    }
    renderVentArrows();
  }

  function onVentFx(m) {
    const v = S.SHIP.vents.find(v => v.id === m.id);
    if (!v) return;
    App.ventFx.push({ id: m.id, t: now() / 1000 });
    if (isPointVisible(v.x, v.y)) { Sfx.vent(); Fx.puff(v.x, v.y); }
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
    Tasks.close(true); closeMap(); closeCams();
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
      const voters = M.results ? (M.results.voters[id] || []).map((c, i) => `<img style="animation-delay:${0.2 + Math.min(i * 0.25, 2.5)}s" src="${c === 'anon' ? beanImg('gray', 'none', 40, { noShadow: true }) : beanImg(c, 'none', 40, { noShadow: true })}">`).join('') : '';
      return `<div class="vcard ${alive ? '' : 'dead'} ${id === App.you ? 'me' : ''} ${M.picking === id ? 'picking' : ''}" data-id="${id}">
        ${id === M.caller ? `<span class="tag">${M.kind === 'report' ? '📢 REPORTÓ' : '🚨 CONVOCÓ'}</span>` : ''}
        <img src="${beanImg(p.color, p.hat, 80, { noShadow: true, ghost: false })}">
        <div class="vname ${nameImp}">${esc(p.name || '?')}</div>
        ${M.voted.has(id) && !M.results ? '<span class="ivoted">VOTÓ</span>' : ''}
        <div class="confirm"><button class="yes" data-v="${id}">${Icons.svg('check')}</button><button class="no" data-x="1">${Icons.svg('x')}</button></div>
        <div class="voters">${voters}</div>
      </div>`;
    }).join('');
    $('#skipVoters').innerHTML = M.results ? (M.results.voters.skip || []).map((c, i) => `<img style="animation-delay:${0.2 + Math.min(i * 0.25, 2.5)}s" src="${beanImg(c === 'anon' ? 'gray' : c, 'none', 40, { noShadow: true })}">`).join('') : '';
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
    for (let i = 0; i < Math.min(n, 12); i++) setTimeout(() => Sfx.reveal(), 200 + i * 250);
  }

  function onEject(m) {
    const G = App.G;
    $('#meeting').classList.remove('show');
    closeChat();
    G.phase = 'eject';
    if (m.id === App.you) G.alive = false;
    const p = m.id ? App.meta.get(m.id) : null;
    if (p) p.alive = false;
    playEjectAnim(m, () => {
      if (App.G && !App.G.alive && m.id === App.you) { $('#ghostTip').classList.add('show'); setTimeout(() => $('#ghostTip').classList.remove('show'), 6000); }
      updateChatButton();
    });
  }

  function playEjectAnim(m, done) {
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
      if (done) done();
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
    Tasks.close(true); closeMap(); closeCams();
    $('#meeting').classList.remove('show');
    const won = m.winners.indexOf(App.you) >= 0;
    const fx = $('#gameOver');
    const delay = App.fx && App.fx.kind === 'kill' ? 2600 : (App.fx && App.fx.kind === 'eject' ? 1500 : 300);
    setTimeout(() => {
      showGameOverScreen(m, won);
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

  function showGameOverScreen(m, won) {
    const fx = $('#gameOver');
    {
      hideGameOverlays(false);
      fx.classList.add('show');
      const title = $('#goTitle');
      if (m.mode === 'race') { const w = m.players.find(p => p.id === m.winners[0]); title.textContent = won ? '¡GANASTE!' : `¡GANA ${(w ? w.name : '').toUpperCase()}!`; }
      else title.textContent = won ? 'VICTORIA' : 'DERROTA';
      title.className = 'go-title ' + (won ? 'win' : 'lose');
      const roleTxt = { crew: 'La tripulación gana', impostor: 'Los impostores ganan', hiders: 'Los escondidos ganan', seeker: 'El buscador gana', racer: '' }[m.winner];
      $('#goReason').textContent = (roleTxt ? roleTxt + ' — ' : '') + m.reason;
      $('#goLineup').innerHTML = m.players.filter(p => m.winners.indexOf(p.id) >= 0).map((p, i) =>
        `<div class="lu ${p.id === App.you ? 'me' : ''}" style="animation-delay:${0.3 + i * 0.1}s"><img src="${beanImg(p.color, p.hat, 200, { ghost: !p.alive })}"><span style="color:${p.role === 'impostor' || p.role === 'seeker' ? '#ff453a' : p.sub === 'sheriff' ? '#ffd60a' : p.sub === 'engineer' ? '#ff9f0a' : '#fff'}">${esc(p.name)}${p.sub ? `<small class="go-sub">${p.sub === 'sheriff' ? 'Sheriff' : 'Ingeniero'}</small>` : ''}</span></div>`).join('');
      $('#goRank').innerHTML = m.ranking ? m.ranking.map((r, i) => { const p = m.players.find(x => x.id === r.id) || {}; return `<div><span>${i + 1}. ${esc(p.name || '?')}</span><span>${r.done}/${r.total}</span></div>`; }).join('') : '';
      if (won) { Sfx.victory(); Fx.confettiDom(fx); } else Sfx.defeat();
    }
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
    $('#meeting').classList.toggle('chat-open', open);
    if (open) {
      App.unread = 0; updateBadges();
      const G = App.G;
      $('#chatTitle').textContent = !G ? 'Chat de la sala' : G.phase === 'meeting' ? (G.alive ? 'Chat de la reunión' : 'Reunión · solo los fantasmas te leen 👻') : 'Chat de fantasmas 👻';
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
  let mapAdmin = false, mapTp = false;
  function openMap(sab) {
    const G = App.G;
    if (!G) return;
    mapAdmin = sab === 'admin';
    mapTp = sab === 'tp';
    mapSab = sab === true && G.role === 'impostor';
    $('#mapTitle').textContent = mapTp ? '🛠️ Toca el mapa para teletransportarte' : mapAdmin ? 'Administración · tripulantes por sala' : mapSab ? 'Sabotaje' : 'Mapa de la nave';
    $('#mapOverlay').classList.add('show');
    Sfx.open();
    renderSabButtons();
  }
  function closeMap() { if ($('#mapOverlay').classList.contains('show')) { $('#mapOverlay').classList.remove('show'); Sfx.close(); } }
  $('#btnMap').addEventListener('click', () => $('#mapOverlay').classList.contains('show') ? closeMap() : openMap(false));
  $('#mapClose').addEventListener('click', closeMap);
  $('#mapCanvas').addEventListener('click', e => {
    if (!mapTp) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = MAP_BOUNDS.x + (e.clientX - r.left) / r.width * MAP_BOUNDS.w;
    const y = MAP_BOUNDS.y + (e.clientY - r.top) / r.height * MAP_BOUNDS.h;
    send({ t: 'dev', cmd: 'tp', x, y });
    closeMap();
  });
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
    if (mapAdmin) {
      const pts = [];
      for (const p of App.players.values()) if (!p.hidden && p.alive) pts.push(p);
      if (G.alive && !G.inVent) pts.push(App.me);
      for (const b of App.bodies) pts.push(b);
      for (const r of S.SHIP.rooms) {
        const inside = pts.filter(p => Shared.inRect(r.r, p.x, p.y));
        inside.forEach((p, i) => {
          const x = r.r.x + r.r.w / 2 - (inside.length - 1) * 30 + i * 60, y = r.r.y + r.r.h / 2 + 70;
          c.fillStyle = p.color ? '#ff453a' : '#e6ecf5'; c.beginPath(); c.arc(x, y, 22, 0, 7); c.fill();
          c.strokeStyle = '#0b0d12'; c.lineWidth = 5; c.stroke();
        });
      }
    }
    if (!G.fake && !mapAdmin) {
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
      if ($('#camOverlay').classList.contains('show')) return closeCams();
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
      case 'F2': e.preventDefault(); if (isDev()) toggleDev(); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': sendEmote(+e.code.slice(5) - 1); break;
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


  // ================================================================ modo developer
  App.dev = { noclip: false, speed: 1, nocd: false, frozen: false, nofog: false, xray: false, role: null };
  App.devRoles = {};
  function isDev() { return !!(App.user && App.user.dev); }
  function devSolo() { return isDev() && !!App.room && App.room.players.filter(p => !p.bot).length === 1; }
  function devCmd(cmd, extra) { send(Object.assign({ t: 'dev', cmd }, extra || {})); }

  function openDevModal() {
    $('#devLoginBox').style.display = isDev() ? 'none' : '';
    $('#devOnBox').style.display = isDev() ? '' : 'none';
    $('#devCode').value = ''; $('#devError').textContent = '';
    openModal('mDev');
    if (!isDev()) setTimeout(() => $('#devCode').focus(), 350);
  }
  $('#mDevBtn').addEventListener('click', openDevModal);
  $('#devCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
  $('#devCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#devGo').click(); });
  $('#devGo').addEventListener('click', () => {
    const c = $('#devCode').value;
    if (c.length !== 6) { $('#devError').textContent = 'El código tiene 6 números.'; Sfx.error(); return; }
    send({ t: 'devLogin', code: c });
  });
  $('#devOff').addEventListener('click', () => send({ t: 'devLogout' }));
  $('#devTestRoom').addEventListener('click', () => { closeModal('mDev'); createTestRoom(); });
  function createTestRoom() { App.pendingBots = 5; send({ t: 'create', mode: 'classic', isPublic: false }); }

  function onDevResult(m) {
    if (!m.ok) {
      const e = $('#devError'); e.textContent = m.text; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake');
      Sfx.error(); return;
    }
    App.user = m.user;
    renderHome(); updateDevUi();
    closeModal('mDev');
    if (m.off) { toast('Modo developer desactivado'); toggleDev(false); return; }
    Sfx.success();
    toast('🛠️ Modo developer activado. Pulsa el botón </> o F2 dentro de una sala.');
    if (App.room) devCmd('state');
  }

  function updateDevUi() {
    const on = isDev();
    $('#mDevLabel').textContent = on ? 'Developer ✓' : 'Modo developer';
    $('#btnDev').classList.toggle('on', on);
    $('#devBadge').classList.toggle('show', devSolo());
    if (!on) $('#devPanel').classList.remove('show');
  }

  function toggleDev(force) {
    const panel = $('#devPanel');
    const open = force !== undefined ? force : !panel.classList.contains('show');
    if (open && !isDev()) return;
    panel.classList.toggle('show', open);
    if (open) { if (App.room) devCmd('state'); renderDev(); Sfx.open(); }
  }
  $('#btnDev').addEventListener('click', () => toggleDev());
  $('#devClose').addEventListener('click', () => toggleDev(false));

  const GAME_NAMES = {
    wires: 'Cables', card: 'Tarjeta', garbage: 'Basura', asteroids: 'Asteroides', filter: 'Filtro O2', steering: 'Dirección',
    shields: 'Escudos', manifolds: 'Colectores', calibrate: 'Distribuidor', align: 'Alinear motor', download: 'Descargar datos',
    upload: 'Subir datos', scan: 'Escaneo médico', course: 'Trazar rumbo', fuel: 'Combustible', simon: 'Arrancar reactor',
    lights: 'Luces (sabotaje)', hand: 'Reactor (sabotaje)', keypad: 'O2 (sabotaje)', emergency: 'Botón de emergencia',
  };
  const ROLE_NAMES = { crew: 'Tripulante', impostor: 'Impostor', sheriff: 'Sheriff', engineer: 'Ingeniero', hider: 'Escondido', seeker: 'Buscador', random: 'Aleatorio' };

  function renderDev() {
    if (!$('#devPanel').classList.contains('show')) return;
    const G = App.G, D = App.dev;
    const inRoom = !!App.room, lobby = inRoom && !G, solo = devSolo();
    const chip = (d, label, cls) => `<button class="dchip ${cls || ''}" data-d="${d}">${label}</button>`;
    const sec = t => `<div class="dev-sec">${t}</div>`;
    let h = '';
    if (!inRoom) h += `<div class="dev-status no">Crea una sala de pruebas para usar los poderes.</div><div class="dev-row">${chip('newroom', '🧪 Crear sala de pruebas', 'green')}</div>`;
    else if (solo) h += `<div class="dev-status ok">✅ Sala de pruebas: todos los poderes activos</div>`;
    else h += `<div class="dev-status no">⛔ Hay otros jugadores en la sala. Los poderes se desactivan para que la partida sea justa. Solo puedes probar minijuegos y animaciones.</div>`;

    if (inRoom && solo) {
      const mode = G ? G.mode : App.room.settings.mode;
      if (lobby) {
        h += sec('Partida');
        const nb = App.room.players.filter(p => p.bot).length;
        h += `<div class="dev-row">${chip('start', '▶ Empezar ya', 'green')}${chip('bots:1', '🤖 +1')}${chip('bots:3', '🤖 +3')}${chip('bots:10', '🤖 +10')}${chip('bots:25', '🤖 +25')}</div>`;
        h += `<div class="dev-row" style="margin-top:6px">${chip('bots:100', '🤪 MODO LOCURA (100 bots)', 'red')}${chip('clearbots', '🧹 Quitar bots')}</div>`;
        h += `<p class="dev-note">Bots en la sala: <b>${nb}</b> / 100</p>`;
        if (mode === 'classic') {
          h += sec('Impostores en la próxima partida');
          h += `<div class="dev-row">${[1, 2, 3, 5, 10, 20].map(n => chip('imps:' + n, '🔪 ' + n, (D.impostors || 0) === n ? 'sel' : '')).join('')}</div>`;
        }
        h += `<div class="dev-row" style="margin-top:6px">${['classic', 'hideseek', 'race'].map(m => chip('mode:' + m, S.MODES[m].name, mode === m ? 'sel' : '')).join('')}</div>`;
      }
      const roles = mode === 'classic' ? ['crew', 'impostor', 'sheriff', 'engineer'] : mode === 'hideseek' ? ['hider', 'seeker'] : [];
      if (roles.length) {
        const cur = G ? (G.sub || G.role) : (D.role || 'random');
        h += sec(lobby ? 'Mi rol en la próxima partida' : 'Mi rol (cambia al instante)');
        h += `<div class="dev-row">${(lobby ? ['random'].concat(roles) : roles).map(r => chip('role:' + r, ROLE_NAMES[r], cur === r ? 'sel' : '')).join('')}</div>`;
      }
      h += sec('Movimiento');
      h += `<div class="dev-row">${chip('noclip', '👻 Atravesar paredes', D.noclip ? 'sel' : '')}${[1, 2, 3].map(v => chip('speed:' + v, v + 'x', D.speed === v ? 'sel' : '')).join('')}</div>`;
      if (G) {
        h += `<div class="dev-row" style="margin-top:6px">${chip('tpmap', '📍 Teletransporte en el mapa')}</div>`;
        h += `<div class="dev-row" style="margin-top:6px">${S.SHIP.rooms.map(r => chip('tproom:' + r.id, r.name)).join('')}</div>`;
        h += sec('Visión');
        h += `<div class="dev-row">${chip('nofog', '🔦 Ver todo el mapa', D.nofog ? 'sel' : '')}${chip('xray', '🩻 Ver roles de todos', D.xray ? 'sel' : '')}</div>`;
        h += sec('Poderes');
        h += `<div class="dev-row">${chip('nocd', '⚡ Sin enfriamiento', D.nocd ? 'sel' : '')}${chip('freeze', '🧊 Congelar bots', D.frozen ? 'sel' : '')}${chip('revive', '✨ Revivir a todos', 'green')}</div>`;
        const victims = App.room.players.filter(p => p.id !== App.you && (App.meta.get(p.id) || {}).alive !== false);
        if (victims.length) h += `<div class="dev-row" style="margin-top:6px">${victims.map(p => chip('kill:' + p.id, '💀 ' + esc(p.name), 'red')).join('')}</div>`;
        h += sec('Tareas');
        h += `<div class="dev-row">${chip('tasks:mine', '✅ Completar mis tareas')}${chip('tasks:all', '🏁 Completar todas', 'green')}</div>`;
        if (mode === 'classic') {
          h += sec('Sabotajes');
          h += `<div class="dev-row">${chip('sab:lights', '💡 Luces')}${chip('sab:reactor', '☢️ Reactor')}${chip('sab:o2', '🫁 O2')}${chip('fixsab', '🔧 Reparar todo', 'green')}</div>`;
          const doorRooms = [...new Set(S.SHIP.doors.map(d => d.room))];
          h += `<div class="dev-row" style="margin-top:6px">${doorRooms.map(r => chip('door:' + r, '🚪 ' + (S.SHIP.rooms.find(x => x.id === r) || {}).name)).join('')}</div>`;
          h += sec('Reuniones');
          h += `<div class="dev-row">${chip('meeting', '🚨 Convocar reunión')}${chip('endvote', '⏱️ Terminar votación')}</div>`;
        }
        h += sec('Terminar partida');
        h += `<div class="dev-row">${chip('win:crew', mode === 'hideseek' ? '🙈 Ganan escondidos' : '🧑‍🚀 Gana tripulación', 'green')}${chip('win:impostor', mode === 'hideseek' ? '🔎 Gana buscador' : '🔪 Ganan impostores', 'red')}</div>`;
      }
    }
    h += sec('Probar minijuegos (no cuentan)');
    h += `<div class="dev-row">${Object.keys(GAME_NAMES).map(g => chip('test:' + g, GAME_NAMES[g])).join('')}</div>`;
    if (inRoom) {
      h += sec('Probar animaciones');
      h += `<div class="dev-row">${G ? chip('anim:role', '🎭 Revelar rol') : ''}${chip('anim:kill', '🔪 Muerte')}${chip('anim:meeting', '📢 Cadáver')}${chip('anim:emergency', '🚨 Emergencia')}${chip('anim:eject', '🚀 Expulsión')}${chip('anim:win', '🏆 Victoria')}${chip('anim:lose', '💔 Derrota')}${chip('anim:confetti', '🎉 Confeti')}</div>`;
    }
    h += `<p class="dev-note">Atajo: F2 abre y cierra este panel.</p>`;
    $('#devBody').innerHTML = h;
  }

  $('#devBody').addEventListener('click', e => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const d = b.dataset.d, i = d.indexOf(':');
    const a = i < 0 ? d : d.slice(0, i), v = i < 0 ? '' : d.slice(i + 1);
    Sfx.tap();
    switch (a) {
      case 'newroom': createTestRoom(); break;
      case 'start': devCmd('start'); toggleDev(false); break;
      case 'bots': devCmd('bots', { n: +v }); break;
      case 'clearbots': devCmd('clearbots'); break;
      case 'imps': devCmd('impostors', { n: +v }); break;
      case 'mode': devCmd('mode', { mode: v }); break;
      case 'role': devCmd('role', { role: v }); break;
      case 'noclip': devCmd('noclip', { on: !App.dev.noclip }); break;
      case 'speed': devCmd('speed', { v: +v }); break;
      case 'tpmap': toggleDev(false); openMap('tp'); break;
      case 'tproom': { const r = S.SHIP.rooms.find(x => x.id === v); if (r) devCmd('tp', { x: r.r.x + r.r.w / 2, y: r.r.y + r.r.h / 2 + 60 }); break; }
      case 'nofog': App.dev.nofog = !App.dev.nofog; renderDev(); break;
      case 'xray': App.dev.xray = !App.dev.xray; if (App.dev.xray) devCmd('reveal'); renderDev(); break;
      case 'nocd': devCmd('nocd', { on: !App.dev.nocd }); break;
      case 'freeze': devCmd('freeze', { on: !App.dev.frozen }); break;
      case 'revive': devCmd('revive'); break;
      case 'kill': devCmd('kill', { id: v }); setTimeout(renderDev, 300); break;
      case 'tasks': devCmd('tasks', { all: v === 'all' }); break;
      case 'test': devTestGame(v); break;
      case 'sab': devCmd('sab', { kind: v }); break;
      case 'door': devCmd('sab', { kind: 'doors', room: v }); break;
      case 'fixsab': devCmd('fixsab'); break;
      case 'meeting': devCmd('meeting'); toggleDev(false); break;
      case 'endvote': devCmd('endvote'); break;
      case 'win': devCmd('win', { team: v }); toggleDev(false); break;
      case 'anim': devAnim(v); break;
    }
  });

  function devTestGame(game) {
    const meta = App.meta.get(App.you);
    const me = meta || { name: App.user.username, color: App.user.color, hat: App.user.hat };
    const fakeSab = { switches: [false, true, false, true, false], holds: [false, false], done: [false, false], code: '31425' };
    toggleDev(false);
    Tasks.open({ game, title: '🛠️ Prueba · ' + GAME_NAMES[game], fill: game === 'fuel', idx: 0, sab: fakeSab, emergencies: 1, cooldown: 0 }, {
      me, test: true, send: () => {},
      complete: () => toast('✅ Minijuego completado (modo prueba: no cuenta en la partida)'),
    });
  }

  function devAnim(v) {
    const meta = App.meta.get(App.you);
    const me = meta || { name: App.user.username, color: App.user.color, hat: App.user.hat };
    toggleDev(false);
    const players = (App.room ? App.room.players : [me]).map(p => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, role: 'crew', alive: true }));
    switch (v) {
      case 'role': if (App.G) roleReveal(4500); break;
      case 'kill': playKillAnim({ color: 'red', hat: 'horns', name: 'Impostor' }, me); break;
      case 'meeting': meetingSplash({ kind: 'report', caller: App.you, bodyColor: 'lime' }); break;
      case 'emergency': meetingSplash({ kind: 'emergency', caller: App.you }); break;
      case 'eject': playEjectAnim({ id: 'preview', color: me.color, hat: me.hat, line1: `${me.name} era el impostor.`, line2: 'Quedan 0 impostores.' }); break;
      case 'win': case 'lose': {
        const won = v === 'win';
        const others = players.filter(p => p.id !== App.you).slice(0, 2).map(p => p.id);
        showGameOverScreen({ winner: won ? 'crew' : 'impostor', reason: 'Vista previa desde el modo developer', winners: won ? [App.you] : others, players, mode: 'classic' }, won);
        break;
      }
      case 'confetti': Fx.confetti(App.me.x, App.me.y - 60, 80); Sfx.confetti(); break;
    }
  }

  // ---------------- emotes
  function sendEmote(i) {
    const G = App.G;
    if (App.screen !== 'scrGame' || (G && G.phase === 'meeting')) return;
    send({ t: 'emote', e: i });
    $('#emoteWheel').classList.remove('show');
  }
  $('#emoteWheel').innerHTML = S.EMOTES.map((e, i) => `<button data-e="${i}">${e}<small>${i + 1}</small></button>`).join('');
  $$('#emoteWheel button').forEach(b => b.addEventListener('click', () => sendEmote(+b.dataset.e)));
  $('#btnEmote').addEventListener('click', () => { $('#emoteWheel').classList.toggle('show'); Sfx.pop(); });

  // ---------------- cámaras de seguridad
  function openCams() {
    const grid = $('#camGrid');
    grid.innerHTML = S.CAMERAS.map((cm, i) => `<div class="cam"><canvas data-i="${i}"></canvas><span>CAM ${i + 1} · ${cm.name}</span><i>● REC</i></div>`).join('');
    $('#camOverlay').classList.add('show');
    Sfx.camStatic();
  }
  function closeCams() { if ($('#camOverlay').classList.contains('show')) { $('#camOverlay').classList.remove('show'); Sfx.close(); } }
  $('#camClose').addEventListener('click', closeCams);
  $('#camOverlay').addEventListener('pointerdown', e => { if (e.target.id === 'camOverlay') closeCams(); });
  function drawCams(t) {
    if (!$('#camOverlay').classList.contains('show')) return;
    if (!App.G) return closeCams();
    const B = World.build(S.SHIP);
    const VW = 720, VH = 450;
    $$('#camGrid canvas').forEach(cv => {
      const cm = S.CAMERAS[+cv.dataset.i];
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const c = cv.getContext('2d');
      const k = cv.width / VW;
      const x0 = cm.x - VW / 2, y0 = cm.y - VH / 2;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#05070c'; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      c.drawImage(B.canvas, x0, y0, VW, VH, x0, y0, VW, VH);
      const ents = [];
      for (const b of App.bodies) if (Shared.inRect({ x: x0, y: y0, w: VW, h: VH }, b.x, b.y)) ents.push({ y: b.y, d: () => Draw.deadBody(c, b.x, b.y, b.color) });
      for (const p of App.players.values()) {
        if (p.hidden || !p.alive) continue;
        const meta = App.meta.get(p.id); if (!meta) continue;
        if (Shared.inRect({ x: x0 - 40, y: y0 - 40, w: VW + 80, h: VH + 120 }, p.x, p.y)) ents.push({ y: p.y, d: () => Draw.bean(c, p.x, p.y, { color: meta.color, hat: meta.hat, flip: p.f, moving: p.m, walk: p.walk, time: t }) });
      }
      ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = 'rgba(40,255,140,0.06)'; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = (t * 40) % 4; y < cv.height; y += 4) c.fillRect(0, y, cv.width, 1);
      const g = c.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.width * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
      if (Math.random() < 0.02) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, Math.random() * cv.height, cv.width, 6); }
    });
  }

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

  function fogActive() { const G = App.G; if (App.dev.nofog && devSolo()) return false; return G && G.alive && G.phase === 'play'; }

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
    fog.width = Math.ceil(cv.width / 2); fog.height = Math.ceil(cv.height / 2);
    App.cam.zoom = clamp(Math.min(H / 900, W / (W < H ? 640 : 1100)), 0.45, 1.2);
    renderVentArrows();
  }
  addEventListener('resize', resize);
  resize();

  function canMove() {
    const G = App.G;
    if (App.screen !== 'scrGame' || !App.me.init) return false;
    if (Tasks.isOpen() || anyModal() || $('#mapOverlay').classList.contains('show') || $('#camOverlay').classList.contains('show')) return false;
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
    drawCams(ts);
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
      const devFree = devSolo() && App.dev.noclip;
      if (devSolo() && App.dev.speed > 1) sp *= App.dev.speed;
      const dx = ix * sp * dt, dy = iy * sp * dt;
      if (ghost || devFree) { me.x = clamp(me.x + dx, 40, map.w - 40); me.y = clamp(me.y + dy, 40, map.h - 40); }
      else { const np = S.moveWithCollision(map, me.x, me.y, dx, dy, App.closedDoors); me.x = np.x; me.y = np.y; }
      if (Math.abs(ix) > 0.1) me.f = ix < 0 ? 1 : 0;
      me.walk += dt * 11 * Math.min(1, Math.hypot(ix, iy) + 0.3);
      const ph = Math.floor(me.walk / Math.PI);
      if (ph !== lastStepPhase) { lastStepPhase = ph; if (!G || G.alive) { Sfx.footstep(); Fx.dust(me.x, me.y); } }
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
      if (p.m) {
        const before = Math.floor(p.walk / Math.PI);
        p.walk += dt * 11;
        if (Math.floor(p.walk / Math.PI) !== before && !p.hidden && (p.alive || !G) && isVisible(p)) Fx.dust(p.x, p.y);
      }
      if (G && !p.alive && !p.hidden && Math.random() < dt * 3) Fx.spark(p.x, p.y, '200,220,255');
    }
    // mascotas: siguen a su dueño con retraso
    const followers = [];
    for (const p of App.players.values()) if (!p.hidden) followers.push([p.id, p.x, p.y, p.f, p.alive !== false]);
    if (App.me.init) followers.push([App.you, me.x, me.y, me.f, !G || G.alive]);
    for (const [id, ox, oy, f, alive] of followers) {
      const meta = App.meta.get(id);
      if (!meta || !meta.pet || meta.pet === 'none' || (G && !alive)) { App.pets.delete(id); continue; }
      let pp = App.pets.get(id);
      const tx = ox + (f ? 46 : -46), ty = oy + 6;
      if (!pp || Math.hypot(pp.x - tx, pp.y - ty) > 400) { pp = { x: tx, y: ty, f, m: 0 }; App.pets.set(id, pp); }
      const dx = tx - pp.x, dy = ty - pp.y, d = Math.hypot(dx, dy);
      const k = Math.min(1, dt * (d > 60 ? 6 : 3.5));
      pp.x += dx * k; pp.y += dy * k;
      pp.m = d > 6;
      if (Math.abs(dx) > 4) pp.f = dx < 0 ? 1 : 0;
    }
    Fx.update(dt);
    // cámara
    const c = App.cam;
    c.x += (me.x - c.x) * Math.min(1, dt * 14);
    c.y += (me.y - 40 - c.y) * Math.min(1, dt * 14);
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
    const target = visionRadius();
    App.visR = App.visR ? App.visR + (target - App.visR) * 0.08 : target;
    const R = App.visR;
    const eyeX = App.me.x, eyeY = App.me.y - 30;
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
    const visibleIds = new Set(visibleNames.map(n => n.meta.id));
    for (const [id, pp] of App.pets) {
      if (!visibleIds.has(id) || (id === App.you && G && G.inVent)) continue;
      if (fogOn && !World.canSee(map, B.vgrid, eyeX, eyeY, pp.x, pp.y - 10, R, App.closedDoors)) continue;
      const meta = App.meta.get(id);
      ents.push({ y: pp.y, draw: () => Draw.pet(ctx, pp.x, pp.y, meta.pet, { color: meta.color, flip: pp.f, moving: pp.m, time: ts }) });
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();
    Fx.draw(ctx);

    // niebla de visión
    if (fogOn) {
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fog.width, fog.height);
      const dark = G.sab && G.sab.kind === 'lights' && !isImp();
      fctx.fillStyle = dark ? 'rgba(2,3,8,0.94)' : 'rgba(6,8,18,0.78)';
      fctx.fillRect(0, 0, fog.width, fog.height);
      fctx.setTransform(worldT[0] / 2, 0, 0, worldT[3] / 2, worldT[4] / 2, worldT[5] / 2);
      const poly = World.visionPolygon(map, B.vgrid, eyeX, eyeY, R, App.closedDoors);
      World.drawFog(fctx, poly, eyeX, eyeY, R);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fog, 0, 0, cv.width, cv.height);
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
      if (G && App.dev.xray && devSolo() && App.devRoles[n.meta.id]) {
        const r = App.devRoles[n.meta.id];
        col = r.role === 'impostor' || r.role === 'seeker' ? '#ff453a' : r.sub === 'sheriff' ? '#ffd60a' : r.sub === 'engineer' ? '#ff9f0a' : '#8ee6ff';
      }
      const hatLift = n.meta.hat && n.meta.hat !== 'none' ? 26 : 0;
      const y = n.y - 88 - hatLift + (n.ghost ? -6 : 0);
      ctx.globalAlpha = n.ghost ? 0.6 : 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5;
      ctx.strokeText(n.meta.name, n.x, y);
      ctx.fillStyle = col;
      ctx.fillText(n.meta.name, n.x, y);
      ctx.globalAlpha = 1;
      const em = App.emotes.get(n.meta.id);
      if (em) {
        const age = (now() - em.t) / 1000;
        if (age > 2.7) App.emotes.delete(n.meta.id);
        else { Fx.bubble(ctx, n.x, y - 18, S.EMOTES[em.e], age); ctx.font = '800 17px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; }
      }
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
