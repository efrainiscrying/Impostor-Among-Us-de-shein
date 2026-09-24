/* Datos compartidos entre servidor y cliente: mapas, tareas, colores, ajustes y geometría. */
(function (root) {
  'use strict';

  const PLAYER_R = 18;      // radio horizontal de colisión
  const PLAYER_RV = 10;     // radio vertical de colisión (perspectiva)
  const BASE_SPEED = 260;   // unidades por segundo con velocidad 1x
  const BASE_VISION = 380;  // radio de visión con visión 1x
  const GRID = 20;          // tamaño de celda para visión / rutas

  const COLORS = [
    { id: 'red', name: 'Rojo', body: '#c51111', shade: '#7a0838' },
    { id: 'blue', name: 'Azul', body: '#132ed1', shade: '#09158e' },
    { id: 'green', name: 'Verde', body: '#117f2d', shade: '#0a4d2e' },
    { id: 'pink', name: 'Rosa', body: '#ed54ba', shade: '#ab2bad' },
    { id: 'orange', name: 'Naranja', body: '#ef7d0d', shade: '#b33e15' },
    { id: 'yellow', name: 'Amarillo', body: '#f5f557', shade: '#c38823' },
    { id: 'black', name: 'Negro', body: '#3f474e', shade: '#1e1f26' },
    { id: 'white', name: 'Blanco', body: '#d6e0f0', shade: '#8394bf' },
    { id: 'purple', name: 'Morado', body: '#6b2fbb', shade: '#3b177c' },
    { id: 'brown', name: 'Marrón', body: '#71491e', shade: '#5e2615' },
    { id: 'cyan', name: 'Cian', body: '#38fedc', shade: '#24a8be' },
    { id: 'lime', name: 'Lima', body: '#50ef39', shade: '#15a742' },
    { id: 'maroon', name: 'Granate', body: '#6b2b3c', shade: '#41151f' },
    { id: 'rose', name: 'Rosado', body: '#ecc0d3', shade: '#de92b3' },
    { id: 'banana', name: 'Plátano', body: '#fffebe', shade: '#d2bc89' },
    { id: 'gray', name: 'Gris', body: '#758593', shade: '#46565f' },
    { id: 'tan', name: 'Canela', body: '#928776', shade: '#51413e' },
    { id: 'coral', name: 'Coral', body: '#ec7578', shade: '#b4434e' },
  ];

  const HATS = [
    { id: 'none', name: 'Nada' },
    { id: 'cap', name: 'Gorra' },
    { id: 'crown', name: 'Corona' },
    { id: 'party', name: 'Fiesta' },
    { id: 'headphones', name: 'Auriculares' },
    { id: 'flower', name: 'Flor' },
    { id: 'chef', name: 'Chef' },
    { id: 'cowboy', name: 'Vaquero' },
    { id: 'horns', name: 'Cuernos' },
    { id: 'halo', name: 'Aureola' },
    { id: 'sprout', name: 'Brote' },
    { id: 'tophat', name: 'Chistera' },
    { id: 'beanie', name: 'Gorro' },
    { id: 'antenna', name: 'Antena' },
    { id: 'temu', name: 'Bolsa Temu' },
  ];

  const PETS = [
    { id: 'none', name: 'Ninguna' },
    { id: 'mini', name: 'Mini tripulante' },
    { id: 'dog', name: 'Perrito' },
    { id: 'cat', name: 'Gatito' },
    { id: 'robot', name: 'Robot' },
    { id: 'hamster', name: 'Hámster' },
    { id: 'alien', name: 'Alien' },
    { id: 'ufo', name: 'OVNI' },
    { id: 'slime', name: 'Slime' },
  ];

  const EMOTES = ['👋', '😂', '😱', '❤️', '🤔', '😡', '👀', '🎉'];

  const MODES = {
    classic: { name: 'Clásico', desc: 'Encuentra al impostor antes de que elimine a la tripulación.', min: 3 },
    hideseek: { name: 'Escondite', desc: 'Un buscador te caza. Escóndete, haz tareas y sobrevive al reloj.', min: 2 },
    race: { name: 'Carrera de tareas', desc: 'Sin impostores. Gana quien complete todas sus tareas primero.', min: 1 },
  };

  // Esquema de ajustes (para validar en el servidor y construir la UI)
  const SETTINGS_SCHEMA = [
    { key: 'maxPlayers', label: 'Máx. jugadores', type: 'num', min: 2, max: 15, step: 1, def: 10, group: 'Sala' },
    { key: 'impostors', label: 'Impostores', type: 'num', min: 1, max: 3, step: 1, def: 1, group: 'Impostores', modes: ['classic'] },
    { key: 'killCooldown', label: 'Enfriamiento de eliminación', type: 'num', min: 10, max: 60, step: 2.5, def: 25, unit: 's', group: 'Impostores', modes: ['classic'] },
    { key: 'killDistance', label: 'Distancia de eliminación', type: 'enum', options: ['Corta', 'Normal', 'Larga'], def: 1, group: 'Impostores', modes: ['classic', 'hideseek'] },
    { key: 'impVision', label: 'Visión del impostor', type: 'num', min: 0.25, max: 5, step: 0.25, def: 1.5, unit: 'x', group: 'Impostores', modes: ['classic', 'hideseek'] },
    { key: 'engineers', label: 'Ingenieros (usan ventilas)', type: 'num', min: 0, max: 2, step: 1, def: 0, group: 'Roles', modes: ['classic'] },
    { key: 'sheriffs', label: 'Sheriff (dispara al impostor)', type: 'num', min: 0, max: 1, step: 1, def: 0, group: 'Roles', modes: ['classic'] },
    { key: 'playerSpeed', label: 'Velocidad del jugador', type: 'num', min: 0.5, max: 3, step: 0.25, def: 1, unit: 'x', group: 'Tripulación' },
    { key: 'crewVision', label: 'Visión de la tripulación', type: 'num', min: 0.25, max: 5, step: 0.25, def: 1, unit: 'x', group: 'Tripulación' },
    { key: 'emergencyMeetings', label: 'Reuniones de emergencia', type: 'num', min: 0, max: 9, step: 1, def: 1, group: 'Reuniones', modes: ['classic'] },
    { key: 'emergencyCooldown', label: 'Enfriamiento de emergencia', type: 'num', min: 0, max: 60, step: 5, def: 15, unit: 's', group: 'Reuniones', modes: ['classic'] },
    { key: 'discussionTime', label: 'Tiempo de discusión', type: 'num', min: 0, max: 120, step: 15, def: 15, unit: 's', group: 'Reuniones', modes: ['classic'] },
    { key: 'votingTime', label: 'Tiempo de votación', type: 'num', min: 15, max: 300, step: 15, def: 120, unit: 's', group: 'Reuniones', modes: ['classic'] },
    { key: 'confirmEjects', label: 'Confirmar expulsiones', type: 'bool', def: true, group: 'Reuniones', modes: ['classic'] },
    { key: 'anonymousVotes', label: 'Votos anónimos', type: 'bool', def: false, group: 'Reuniones', modes: ['classic'] },
    { key: 'taskBar', label: 'Barra de tareas', type: 'enum', options: ['Siempre', 'En reuniones', 'Nunca'], def: 0, group: 'Tareas', modes: ['classic'] },
    { key: 'visualTasks', label: 'Tareas visuales', type: 'bool', def: true, group: 'Tareas', modes: ['classic'] },
    { key: 'commonTasks', label: 'Tareas comunes', type: 'num', min: 0, max: 2, step: 1, def: 1, group: 'Tareas' },
    { key: 'longTasks', label: 'Tareas largas', type: 'num', min: 0, max: 3, step: 1, def: 1, group: 'Tareas' },
    { key: 'shortTasks', label: 'Tareas cortas', type: 'num', min: 0, max: 5, step: 1, def: 2, group: 'Tareas' },
    { key: 'hideTime', label: 'Tiempo de escondite', type: 'num', min: 60, max: 360, step: 15, def: 180, unit: 's', group: 'Escondite', modes: ['hideseek'] },
    { key: 'finalHideTime', label: 'Escondite final', type: 'num', min: 20, max: 120, step: 5, def: 50, unit: 's', group: 'Escondite', modes: ['hideseek'] },
    { key: 'taskTimeBonus', label: 'Segundos por tarea', type: 'num', min: 0, max: 15, step: 1, def: 5, unit: 's', group: 'Escondite', modes: ['hideseek'] },
    { key: 'seekerCooldown', label: 'Enfriamiento del buscador', type: 'num', min: 2.5, max: 30, step: 2.5, def: 10, unit: 's', group: 'Escondite', modes: ['hideseek'] },
    { key: 'seekerSpeed', label: 'Velocidad del buscador', type: 'num', min: 0.75, max: 2, step: 0.05, def: 1.1, unit: 'x', group: 'Escondite', modes: ['hideseek'] },
  ];

  function defaultSettings() {
    const s = { mode: 'classic' };
    for (const f of SETTINGS_SCHEMA) s[f.key] = f.def;
    return s;
  }

  function sanitizeSettings(input, prev) {
    const s = Object.assign({}, prev || defaultSettings());
    if (input && MODES[input.mode]) s.mode = input.mode;
    for (const f of SETTINGS_SCHEMA) {
      if (!input || !(f.key in input)) continue;
      const v = input[f.key];
      if (f.type === 'bool') s[f.key] = !!v;
      else if (f.type === 'enum') {
        const n = Math.round(Number(v));
        if (n >= 0 && n < f.options.length) s[f.key] = n;
      } else {
        let n = Number(v);
        if (!isFinite(n)) continue;
        n = Math.min(f.max, Math.max(f.min, n));
        n = Math.round(n / f.step) * f.step;
        s[f.key] = Math.round(n * 100) / 100;
      }
    }
    return s;
  }

  const KILL_DISTANCES = [120, 170, 240];

  // ------------------------------------------------------------------
  //  MAPA PRINCIPAL: "La Skeleta" (nave)
  // ------------------------------------------------------------------
  const R = (x1, y1, x2, y2) => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

  const SHIP_ROOMS = [
    { id: 'upperEngine', name: 'Motor superior', r: R(200, 300, 640, 760), floor: 'metal' },
    { id: 'reactor', name: 'Reactor', r: R(60, 960, 480, 1440), floor: 'reactor' },
    { id: 'lowerEngine', name: 'Motor inferior', r: R(200, 1640, 640, 2100), floor: 'metal' },
    { id: 'security', name: 'Seguridad', r: R(880, 1100, 1160, 1400), floor: 'dark' },
    { id: 'medbay', name: 'Enfermería', r: R(1060, 640, 1440, 1000), floor: 'med' },
    { id: 'cafeteria', name: 'Cafetería', r: R(1640, 120, 2440, 820), floor: 'caf' },
    { id: 'weapons', name: 'Armas', r: R(2820, 240, 3280, 680), floor: 'dark' },
    { id: 'o2', name: 'O2', r: R(2600, 820, 2940, 1080), floor: 'green' },
    { id: 'navigation', name: 'Navegación', r: R(3480, 940, 3960, 1440), floor: 'blue' },
    { id: 'shields', name: 'Escudos', r: R(2860, 1620, 3300, 2060), floor: 'dark' },
    { id: 'comms', name: 'Comunicaciones', r: R(2320, 2020, 2720, 2340), floor: 'dark' },
    { id: 'storage', name: 'Almacén', r: R(1720, 1360, 2240, 2080), floor: 'storage' },
    { id: 'admin', name: 'Administración', r: R(2340, 1200, 2720, 1500), floor: 'blue' },
    { id: 'electrical', name: 'Electricidad', r: R(1180, 1500, 1540, 1820), floor: 'elec' },
  ];

  const SHIP_HALLS = [
    R(600, 420, 1680, 540),    // pasillo superior
    R(1180, 520, 1300, 660),   // entrada enfermería
    R(700, 520, 820, 1960),    // pasillo izquierdo
    R(460, 1140, 720, 1260),   // entrada reactor
    R(800, 1200, 900, 1320),   // entrada seguridad
    R(600, 1880, 1740, 2000),  // pasillo inferior
    R(1300, 1800, 1420, 1900), // entrada electricidad
    R(1920, 800, 2040, 1380),  // cafetería-almacén
    R(2020, 1210, 2360, 1320), // entrada administración (separada del almacén)
    R(2420, 400, 2840, 520),   // cafetería-armas
    R(3000, 660, 3120, 1700),  // pasillo derecho
    R(2920, 920, 3020, 1040),  // entrada O2
    R(3100, 1120, 3500, 1240), // entrada navegación
    R(2220, 1880, 2880, 2000), // pasillo inferior derecho
    R(2460, 1980, 2580, 2040), // entrada comunicaciones
  ];

  const SHIP_DOORS = [
    { id: 'caf_w', room: 'cafeteria', r: R(1620, 420, 1660, 540), dir: 'v' },
    { id: 'caf_e', room: 'cafeteria', r: R(2420, 400, 2460, 520), dir: 'v' },
    { id: 'caf_s', room: 'cafeteria', r: R(1920, 800, 2040, 840), dir: 'h' },
    { id: 'med', room: 'medbay', r: R(1180, 620, 1300, 660), dir: 'h' },
    { id: 'sec', room: 'security', r: R(860, 1200, 900, 1320), dir: 'v' },
    { id: 'elec', room: 'electrical', r: R(1300, 1820, 1420, 1860), dir: 'h' },
    { id: 'sto_w', room: 'storage', r: R(1700, 1880, 1740, 2000), dir: 'v' },
    { id: 'sto_n', room: 'storage', r: R(1920, 1340, 2040, 1380), dir: 'h' },
    { id: 'sto_e', room: 'storage', r: R(2220, 1880, 2260, 2000), dir: 'v' },
    { id: 'ue', room: 'upperEngine', r: R(640, 420, 680, 540), dir: 'v' },
    { id: 'le', room: 'lowerEngine', r: R(640, 1880, 680, 2000), dir: 'v' },
  ];

  // Obstáculos (colisión a la altura de los pies)
  const SHIP_OBSTACLES = [
    { r: R(1975, 430, 2105, 510), kind: 'buttonTable' },
    { r: R(1740, 245, 1860, 315), kind: 'table' },
    { r: R(2220, 245, 2340, 315), kind: 'table' },
    { r: R(1740, 625, 1860, 695), kind: 'table' },
    { r: R(2220, 625, 2340, 695), kind: 'table' },
    { r: R(290, 420, 540, 560), kind: 'engine' },
    { r: R(290, 1760, 540, 1900), kind: 'engine' },
    { r: R(150, 1130, 330, 1270), kind: 'core' },
    { r: R(2450, 1310, 2620, 1380), kind: 'adminTable' },
    { r: R(1790, 1490, 1900, 1560), kind: 'crate' },
    { r: R(2090, 1690, 2200, 1760), kind: 'crate' },
    { r: R(1790, 1780, 1880, 1830), kind: 'crate' },
    { r: R(3110, 380, 3250, 440), kind: 'seat' },
    { r: R(3870, 1130, 3940, 1260), kind: 'navConsole' },
    { r: R(1090, 700, 1150, 800), kind: 'bed' },
    { r: R(1090, 840, 1150, 940), kind: 'bed' },
    { r: R(920, 1125, 1120, 1160), kind: 'secDesk' },
  ];

  const SHIP_VENTS = [
    { id: 'ue', x: 360, y: 690, links: ['re1'] },
    { id: 're1', x: 420, y: 1040, links: ['ue'] },
    { id: 're2', x: 420, y: 1380, links: ['le'] },
    { id: 'le', x: 360, y: 1700, links: ['re2'] },
    { id: 'sec', x: 1100, y: 1350, links: ['med', 'elec'] },
    { id: 'med', x: 1380, y: 940, links: ['sec', 'elec'] },
    { id: 'elec', x: 1240, y: 1600, links: ['sec', 'med'] },
    { id: 'caf', x: 2380, y: 770, links: ['adm', 'hall'] },
    { id: 'adm', x: 2660, y: 1450, links: ['caf', 'hall'] },
    { id: 'hall', x: 1980, y: 1080, links: ['caf', 'adm'] },
    { id: 'wea', x: 3200, y: 600, links: ['nav1'] },
    { id: 'nav1', x: 3560, y: 1000, links: ['wea'] },
    { id: 'nav2', x: 3560, y: 1390, links: ['shi'] },
    { id: 'shi', x: 2940, y: 1990, links: ['nav2'] },
  ];

  const P = (room, x, y, game, extra) => Object.assign({ room, x, y, game }, extra || {});

  // Definición de tareas. Los pasos con `options` eligen una ubicación al azar.
  const TASKS = {
    card: { name: 'Deslizar tarjeta', kind: 'common', steps: [P('admin', 2680, 1250, 'card')] },
    wires: { name: 'Arreglar cables', kind: 'common', steps: [P('electrical', 1260, 1530, 'wires'), P('storage', 2190, 1400, 'wires'), P('admin', 2400, 1240, 'wires')] },
    garbage: { name: 'Vaciar basura', kind: 'short', steps: [P('cafeteria', 2390, 170, 'garbage')] },
    asteroids: { name: 'Destruir asteroides', kind: 'short', steps: [P('weapons', 3180, 480, 'asteroids')] },
    filter: { name: 'Limpiar filtro de O2', kind: 'short', steps: [P('o2', 2780, 870, 'filter')] },
    steering: { name: 'Estabilizar dirección', kind: 'short', steps: [P('navigation', 3900, 1310, 'steering')] },
    shields: { name: 'Activar escudos', kind: 'short', steps: [P('shields', 3100, 1670, 'shields')] },
    manifolds: { name: 'Desbloquear colectores', kind: 'short', steps: [P('reactor', 260, 1000, 'manifolds')] },
    calibrate: { name: 'Calibrar distribuidor', kind: 'short', steps: [P('electrical', 1480, 1540, 'calibrate')] },
    alignUp: { name: 'Alinear motor superior', kind: 'short', steps: [P('upperEngine', 250, 620, 'align')] },
    alignLow: { name: 'Alinear motor inferior', kind: 'short', steps: [P('lowerEngine', 250, 2000, 'align')] },
    scan: { name: 'Escaneo médico', kind: 'short', visual: true, steps: [P('medbay', 1300, 900, 'scan')] },
    course: { name: 'Trazar rumbo', kind: 'short', steps: [P('navigation', 3900, 1040, 'course')] },
    upload: {
      name: 'Transferir datos', kind: 'long', steps: [
        P('?', 0, 0, 'download', { options: [P('comms', 2600, 2070, 'download'), P('weapons', 2880, 290, 'download'), P('navigation', 3540, 1180, 'download'), P('electrical', 1400, 1540, 'download'), P('cafeteria', 1700, 170, 'download')] }),
        P('admin', 2580, 1240, 'upload'),
      ],
    },
    fuel: { name: 'Cargar combustible', kind: 'long', steps: [P('storage', 1780, 1990, 'fuel', { fill: true }), P('upperEngine', 240, 460, 'fuel'), P('storage', 1780, 1990, 'fuel', { fill: true }), P('lowerEngine', 240, 1830, 'fuel')] },
    reactor: { name: 'Arrancar reactor', kind: 'long', steps: [P('reactor', 360, 1400, 'simon')] },
  };

  const SABOTAGE_STATIONS = {
    lights: [{ x: 1360, y: 1530, room: 'electrical' }],
    reactor: [{ x: 110, y: 1030, room: 'reactor' }, { x: 110, y: 1390, room: 'reactor' }],
    o2: [{ x: 2880, y: 1040, room: 'o2' }, { x: 2400, y: 1460, room: 'admin' }],
  };

  const SHIP = {
    id: 'ship',
    name: 'La Skeleta',
    w: 4100, h: 2480,
    rooms: SHIP_ROOMS,
    rects: SHIP_ROOMS.map(r => r.r).concat(SHIP_HALLS),
    halls: SHIP_HALLS,
    doors: SHIP_DOORS,
    obstacles: SHIP_OBSTACLES,
    vents: SHIP_VENTS,
    button: { x: 2040, y: 470 },
    spawnCenter: { x: 2040, y: 470 },
    spawnRadius: 190,
  };

  // Nave de espera (lobby)
  const LOBBY = {
    id: 'lobby',
    name: 'Nave de espera',
    w: 1400, h: 900,
    rooms: [{ id: 'lobby', name: '', r: R(200, 240, 1200, 740), floor: 'lobby' }],
    rects: [R(200, 240, 1200, 740), R(80, 420, 220, 580)],
    halls: [R(80, 420, 220, 580)],
    doors: [],
    obstacles: [
      { r: R(330, 300, 530, 340), kind: 'bench' },
      { r: R(870, 300, 1070, 340), kind: 'bench' },
      { r: R(560, 640, 840, 700), kind: 'crates' },
    ],
    vents: [],
    laptop: { x: 700, y: 300 },
    spawnCenter: { x: 700, y: 500 },
    spawnRadius: 150,
  };

  const MAPS = { ship: SHIP, lobby: LOBBY };

  // ------------------------------------------------------------------
  //  Geometría
  // ------------------------------------------------------------------
  function inRect(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function inFloor(map, x, y) {
    const rs = map.rects;
    for (let i = 0; i < rs.length; i++) if (inRect(rs[i], x, y)) return true;
    return false;
  }

  function pointFree(map, x, y, closedDoors) {
    if (!inFloor(map, x, y)) return false;
    const obs = map.obstacles;
    for (let i = 0; i < obs.length; i++) if (inRect(obs[i].r, x, y)) return false;
    if (closedDoors && closedDoors.length) {
      for (let i = 0; i < map.doors.length; i++) {
        const d = map.doors[i];
        if (closedDoors.indexOf(d.id) >= 0 && inRect(d.r, x, y)) return false;
      }
    }
    return true;
  }

  function canStand(map, x, y, closedDoors) {
    return pointFree(map, x, y, closedDoors) &&
      pointFree(map, x - PLAYER_R, y, closedDoors) &&
      pointFree(map, x + PLAYER_R, y, closedDoors) &&
      pointFree(map, x, y - PLAYER_RV, closedDoors) &&
      pointFree(map, x, y + PLAYER_RV, closedDoors);
  }

  // Mueve con deslizamiento contra paredes
  function moveWithCollision(map, x, y, dx, dy, closedDoors) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (canStand(map, x + sx, y + sy, closedDoors)) { x += sx; y += sy; }
      else if (sx && canStand(map, x + sx, y, closedDoors)) x += sx;
      else if (sy && canStand(map, x, y + sy, closedDoors)) y += sy;
    }
    return { x, y };
  }

  function roomAt(map, x, y) {
    for (const r of map.rooms) if (inRect(r.r, x, y)) return r;
    return null;
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Rejilla de visión (true = bloquea la vista)
  function buildVisionGrid(map) {
    const cols = Math.ceil(map.w / GRID), rows = Math.ceil(map.h / GRID);
    const g = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      g[j * cols + i] = inFloor(map, i * GRID + GRID / 2, j * GRID + GRID / 2) ? 0 : 1;
    }
    return { cols, rows, g };
  }

  // Rejilla para rutas de bots (true = libre para estar de pie)
  function buildWalkGrid(map) {
    const cols = Math.ceil(map.w / GRID), rows = Math.ceil(map.h / GRID);
    const g = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      g[j * cols + i] = canStand(map, i * GRID + GRID / 2, j * GRID + GRID / 2) ? 1 : 0;
    }
    return { cols, rows, g };
  }

  function lineOfSight(map, vgrid, ax, ay, bx, by, closedDoors) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / (GRID / 2));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const i = Math.floor(x / GRID), j = Math.floor(y / GRID);
      if (i < 0 || j < 0 || i >= vgrid.cols || j >= vgrid.rows) return false;
      if (vgrid.g[j * vgrid.cols + i]) return false;
      if (closedDoors && closedDoors.length) {
        for (const door of map.doors) if (closedDoors.indexOf(door.id) >= 0 && inRect(door.r, x, y)) return false;
      }
    }
    return true;
  }

  function spawnPoints(map, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
      let x = map.spawnCenter.x + Math.cos(a) * map.spawnRadius;
      let y = map.spawnCenter.y + Math.sin(a) * map.spawnRadius * 0.8;
      let tries = 0;
      while (!canStand(map, x, y) && tries++ < 40) {
        x = map.spawnCenter.x + (Math.random() - 0.5) * map.spawnRadius * 2;
        y = map.spawnCenter.y + (Math.random() - 0.5) * map.spawnRadius * 1.6;
      }
      pts.push({ x: Math.round(x), y: Math.round(y) });
    }
    return pts;
  }

  const Shared = {
    PLAYER_R, PLAYER_RV, BASE_SPEED, BASE_VISION, GRID, COLORS, HATS, PETS, EMOTES, MODES,
    SETTINGS_SCHEMA, KILL_DISTANCES, TASKS, SABOTAGE_STATIONS, MAPS, SHIP, LOBBY,
    defaultSettings, sanitizeSettings, inRect, inFloor, pointFree, canStand, moveWithCollision,
    roomAt, dist, buildVisionGrid, buildWalkGrid, lineOfSight, spawnPoints,
    SABOTAGE_TIMES: { reactor: 45, o2: 45, lights: 0 },
    SABOTAGE_COOLDOWN: 30, DOOR_TIME: 10, DOOR_COOLDOWN: 25,
    ADMIN_TABLE: { x: 2535, y: 1420 }, SECURITY_DESK: { x: 1020, y: 1210 },
    CAMERAS: [{ x: 1140, y: 480, name: 'Pasillo superior' }, { x: 760, y: 1500, name: 'Pasillo izquierdo' }, { x: 3060, y: 1180, name: 'Pasillo derecho' }, { x: 2240, y: 1940, name: 'Pasillo inferior' }],
    ENGINEER_VENT_TIME: 10, ENGINEER_VENT_COOLDOWN: 15,
    INTERACT_RANGE: 110, REPORT_RANGE: 190, BUTTON_RANGE: 170, VENT_RANGE: 90,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Shared;
  else root.Shared = Shared;
})(typeof self !== 'undefined' ? self : this);
