/* Idiomas: español (original) e inglés.
   Todo el texto del juego está escrito en español; T() lo traduce al idioma elegido.
   Las claves con {} son plantillas: sirven para textos con nombres o números dentro
   (también los que manda el servidor), y lo capturado se traduce a su vez. */
(function () {
  'use strict';

  const EN = {
    // ---------------------------------------------------------------- portada, login y menú
    'Edición de navegador · juega con tus amigos': 'Browser edition · play with your friends',
    'Toca para comenzar': 'Tap to start',
    'Hecho para ti y tus amigos · v1.0': 'Made for you and your friends · v1.0',
    'Iniciar sesión': 'Log in',
    'Crear cuenta': 'Sign up',
    'Usuario': 'Username',
    'Tu nombre en el juego': 'Your in-game name',
    'Contraseña': 'Password',
    'Repite la contraseña': 'Repeat password',
    'Entrar': 'Enter',
    '¿No tienes cuenta? Toca <b>Crear cuenta</b>. Solo necesitas un usuario y una contraseña.': "Don't have an account? Tap <b>Sign up</b>. All you need is a username and a password.",
    'Elige un nombre (3-14 letras) y una contraseña que recuerdes.': "Pick a name (3-14 letters) and a password you'll remember.",
    'Las contraseñas no coinciden.': "Passwords don't match.",
    'Error de conexión.': 'Connection error.',
    '¡Cuenta creada! Bienvenido, {} 🚀': 'Account created! Welcome, {0} 🚀',
    'No se pudo conectar con el servidor.': "Couldn't connect to the server.",
    'Tu sesión expiró. Inicia sesión otra vez.': 'Your session expired. Please log in again.',
    'Crear partida': 'Create game',
    'Tú eres el anfitrión y eliges las reglas': "You're the host and pick the rules",
    'Unirse con código': 'Join with code',
    'Escribe el código que te mandaron': 'Type the code you were sent',
    'Salas públicas': 'Public rooms',
    'Encuentra partidas abiertas': 'Find open games',
    'Práctica con bots': 'Practice with bots',
    'Juega ya mismo contra la IA': 'Play right now against the AI',
    'Personalizar': 'Customize',
    'Ajustes': 'Settings',
    'Salir': 'Exit',
    'Modo developer': 'Developer mode',
    'Idioma': 'Language',
    'Partidas': 'Games',
    'Victorias': 'Wins',
    'Tareas': 'Tasks',
    'Eliminaciones': 'Kills',
    'El código tiene 6 letras.': 'The code has 6 letters.',
    'Buscando salas…': 'Looking for rooms…',
    'Vas a cerrar sesión en este dispositivo.': "You're about to log out on this device.",
    'Cerrar sesión': 'Log out',
    'No hay salas públicas ahora mismo.<br>¡Crea una y compártela!': 'No public rooms right now.<br>Create one and share it!',
    'Sala de {}': "{0}'s room",
    'No puedes cambiar tu aspecto durante la partida.': "You can't change your look during a game.",
    '¿Seguro?': 'Are you sure?',
    'Cancelar': 'Cancel',
    'Sí': 'Yes',
    'No': 'No',

    // ---------------------------------------------------------------- modales
    'Sala pública': 'Public room',
    'Aparece en «Salas públicas»': 'Shows up in "Public rooms"',
    'Crear sala': 'Create room',
    'Unirse': 'Join',
    'Color': 'Color',
    'Sombrero': 'Hat',
    'Mascota': 'Pet',
    'Efectos': 'Effects',
    'Música': 'Music',
    'Ambiente': 'Ambience',
    'moverse': 'move',
    'Espacio': 'Space',
    'usar ·': 'use ·',
    'reportar': 'report',
    'matar ·': 'kill ·',
    'ventila ·': 'vent ·',
    'sabotaje': 'sabotage',
    'mapa ·': 'map ·',
    'chat ·': 'chat ·',
    'cerrar': 'close',
    'Salir de la sala': 'Leave room',
    'Reglas de la partida': 'Game rules',
    'Jugadores': 'Players',
    'Bots': 'Bots',
    'Expulsar': 'Kick',
    'Reconectando…': 'Reconnecting…',

    // ---------------------------------------------------------------- sala
    'Entraste a la sala {}': 'You joined room {0}',
    '🤖 Bots añadidos. ¡Pulsa «Empezar»!': '🤖 Bots added. Press "Start"!',
    'Si sales ahora, abandonarás la partida en curso.': "If you leave now, you'll abandon the current game.",
    'Vas a salir de la sala.': "You're about to leave the room.",
    '¡Únete a mi partida!': 'Join my game!',
    '🔗 ¡Enlace copiado! Mándalo a tus amigos.': '🔗 Link copied! Send it to your friends.',
    'Código de sala: {}': 'Room code: {0}',
    'Faltan {}': 'Need {0} more',
    'Empezar': 'Start',
    'Se necesitan {} jugadores. Invita amigos o agrega bots en «Reglas».': '{0} players needed. Invite friends or add bots in "Rules".',
    'Solo el anfitrión puede cambiar las reglas.': 'Only the host can change the rules.',
    'Reglas': 'Rules',
    'CÓDIGO': 'CODE',
    'Copiar invitación': 'Copy invite',
    'Chat (Enter)': 'Chat (Enter)',
    'Panel developer (F2)': 'Developer panel (F2)',
    'Mapa (Tab)': 'Map (Tab)',
    'La partida empieza en': 'Game starts in',

    // ---------------------------------------------------------------- HUD
    'TAREAS COMPLETADAS': 'TASKS COMPLETED',
    'TU PROGRESO': 'YOUR PROGRESS',
    'TIEMPO': 'TIME',
    'SABOTAJE': 'SABOTAGE',
    'VENTILA': 'VENT',
    'MATAR': 'KILL',
    'DISPARAR': 'SHOOT',
    'REPORTAR': 'REPORT',
    'USAR': 'USE',
    'PERSONALIZAR': 'CUSTOMIZE',
    'EMERGENCIA': 'EMERGENCY',
    'REPARAR': 'FIX',
    'ADMIN': 'ADMIN',
    'CÁMARAS': 'CAMERAS',
    'SALIR': 'EXIT',
    'PELIGRO': 'DANGER',
    '🛠️ DEV · SALA DE PRUEBAS': '🛠️ DEV · TEST ROOM',
    'Eres un fantasma 👻 Termina tus tareas para ayudar a tu equipo.': "You're a ghost 👻 Finish your tasks to help your team.",
    'Chat': 'Chat',
    'Escribe un mensaje…': 'Type a message…',
    'Mapa de la nave': 'Ship map',
    'Cámaras de seguridad': 'Security cameras',
    '¡Tarea completada!': 'Task complete!',
    '¡Tarea lista!': 'Task done!',
    'EL BUSCADOR SALE EN': 'SEEKER RELEASED IN',
    '¡ESCONDITE FINAL!': 'FINAL HIDE!',
    'TIEMPO RESTANTE': 'TIME LEFT',
    '¡ESCONDITE FINAL! El buscador es más rápido 😱': 'FINAL HIDE! The seeker is faster 😱',
    '💡 Luces saboteadas': '💡 Lights sabotaged',
    '☢️ ¡FUSIÓN DEL REACTOR EN {} s!': '☢️ REACTOR MELTDOWN IN {0} s!',
    '🫁 ¡OXÍGENO AGOTADO EN {} s!': '🫁 OXYGEN DEPLETED IN {0} s!',
    'Electricidad: arreglar las luces': 'Electrical: fix the lights',
    'Reactor: fusión en {} s': 'Reactor: meltdown in {0} s',
    'O2: oxígeno agotándose {} s': 'O2: oxygen depleting {0} s',
    'Sabotea y elimina a la tripulación.<br><small style="opacity:.7">Tareas falsas:</small>': 'Sabotage and eliminate the crew.<br><small style="opacity:.7">Fake tasks:</small>',
    'Atrapa a todos los escondidos.': 'Catch all the hiders.',
    'Sobrevive y haz tareas (restan tiempo).': 'Survive and do tasks (they cut the clock).',
    'Fantasma: sigue haciendo tareas.': 'Ghost: keep doing tasks.',
    '¡Completa todo antes que nadie!': 'Finish everything before anyone else!',
    'Eres un fantasma: termina tus tareas.': "You're a ghost: finish your tasks.",
    'Tareas · eres el Sheriff 🔫': "Tasks · you're the Sheriff 🔫",
    'Tareas · eres Ingeniero 🔧': "Tasks · you're an Engineer 🔧",
    'CLASIFICACIÓN': 'LEADERBOARD',
    'Electricidad: reparar las luces': 'Electrical: fix the lights',
    'Reactor: detener la fusión': 'Reactor: stop the meltdown',
    'O2: restaurar el oxígeno': 'O2: restore the oxygen',
    'Cafetería: botón de emergencia': 'Cafeteria: emergency button',
    '💀 ¡Le disparaste a un inocente! El Sheriff cae.': '💀 You shot an innocent! The Sheriff goes down.',
    '💡 ¡Sabotearon las luces! Ve a Electricidad.': '💡 The lights were sabotaged! Go to Electrical.',
    '☢️ ¡Fusión del reactor! Se necesitan 2 personas.': '☢️ Reactor meltdown! It takes 2 people.',
    '🫁 ¡Oxígeno agotándose! Ve a O2 y Administración.': '🫁 Oxygen depleting! Go to O2 and Admin.',
    '✅ Sabotaje reparado': '✅ Sabotage fixed',
    'Sabotaje': 'Sabotage',
    '🛠️ Toca el mapa para teletransportarte': '🛠️ Tap the map to teleport',
    'Administración · tripulantes por sala': 'Admin · crewmates per room',
    'CAM {} · {}': 'CAM {0} · {1}',

    // ---------------------------------------------------------------- roles
    'Impostor': 'Impostor',
    'Tripulante': 'Crewmate',
    'Sheriff': 'Sheriff',
    'Ingeniero': 'Engineer',
    'Buscador': 'Seeker',
    'Escondido': 'Hider',
    'Carrera': 'Race',
    'Aleatorio': 'Random',
    'Tus compañeros impostores están contigo. <b>Elimina a la tripulación.</b>': 'Your fellow impostors are with you. <b>Eliminate the crew.</b>',
    '<b>Elimina a la tripulación</b> sin que te descubran.': "<b>Eliminate the crew</b> without getting caught.",
    'Hay <b>1 impostor</b> entre nosotros.': 'There is <b>1 impostor</b> among us.',
    'Hay <b>{} impostores</b> entre nosotros.': 'There are <b>{0} impostors</b> among us.',
    'Dispara al impostor… <b>si fallas, mueres tú.</b>': 'Shoot the impostor… <b>if you miss, you die.</b>',
    'Puedes esconderte en las <b>ventilas</b> unos segundos.': 'You can hide in the <b>vents</b> for a few seconds.',
    'Atrapa a todos antes de que se acabe el tiempo. <b>Sales en 10 segundos.</b>': 'Catch everyone before time runs out. <b>You get out in 10 seconds.</b>',
    'El buscador es <b>{}</b>. ¡Escóndete y haz tareas!': 'The seeker is <b>{0}</b>. Hide and do tasks!',
    'Completa todas tus tareas <b>antes que nadie</b>.': 'Complete all your tasks <b>before anyone else</b>.',
    'Completa tus tareas y descubre al impostor 🔎': 'Do your tasks and find the impostor 🔎',
    'Usa SABOTAJE y las VENTILAS. ¡Que no te vean! 🔪': "Use SABOTAGE and the VENTS. Don't get seen! 🔪",
    '¡Corre a esconderte! El buscador sale pronto 🙈': 'Run and hide! The seeker comes out soon 🙈',

    // ---------------------------------------------------------------- reuniones
    '¡CADÁVER REPORTADO!': 'DEAD BODY REPORTED!',
    '¡REUNIÓN DE EMERGENCIA!': 'EMERGENCY MEETING!',
    '¿Quién es el impostor?': 'Who is the impostor?',
    'Omitir voto': 'Skip vote',
    '📢 REPORTÓ': '📢 REPORTED',
    '🚨 CONVOCÓ': '🚨 CALLED',
    'VOTÓ': 'VOTED',
    'TU VOTO': 'YOUR VOTE',
    'Resultados': 'Results',
    'Discusión: {} s': 'Discussion: {0} s',
    'Hablen en el chat antes de votar': 'Talk in the chat before voting',
    'Votación termina en: {} s': 'Voting ends in: {0} s',
    'Los fantasmas no votan 👻': "Ghosts don't vote 👻",
    'Voto emitido ✓': 'Vote cast ✓',
    'Toca un jugador para votar': 'Tap a player to vote',
    'Chat de la sala': 'Room chat',
    'Chat de la reunión': 'Meeting chat',
    'Reunión · solo los fantasmas te leen 👻': 'Meeting · only ghosts can read you 👻',
    'Chat de fantasmas 👻': 'Ghost chat 👻',

    // ---------------------------------------------------------------- fin de partida
    '¡GANASTE!': 'YOU WON!',
    '¡GANA {}!': '{0} WINS!',
    'VICTORIA': 'VICTORY',
    'DERROTA': 'DEFEAT',
    'La tripulación gana': 'Crewmates win',
    'Los impostores ganan': 'Impostors win',
    'Los escondidos ganan': 'Hiders win',
    'El buscador gana': 'Seeker wins',
    'Continuar': 'Continue',

    // ---------------------------------------------------------------- modo developer
    '🛠️ Modo developer': '🛠️ Developer mode',
    '🛠️ Panel developer': '🛠️ Developer panel',
    'Introduce el código de acceso para activar las herramientas de prueba.': 'Enter the access code to turn on the testing tools.',
    '✅ Modo developer <b>activo</b> en tu cuenta.<br>Los poderes solo funcionan en <b>salas de prueba</b> donde eres el único humano (con bots), así nunca afectan a tus amigos.': "✅ Developer mode is <b>on</b> for your account.<br>Powers only work in <b>test rooms</b> where you're the only human (with bots), so they never affect your friends.",
    'Crear sala de pruebas': 'Create test room',
    'Desactivar modo developer': 'Turn off developer mode',
    'El código tiene 6 números.': 'The code has 6 digits.',
    'Modo developer desactivado': 'Developer mode turned off',
    '🛠️ Modo developer activado. Pulsa el botón </> o F2 dentro de una sala.': '🛠️ Developer mode on. Press the </> button or F2 inside a room.',
    'Crea una sala de pruebas para usar los poderes.': 'Create a test room to use the powers.',
    '🧪 Crear sala de pruebas': '🧪 Create test room',
    '✅ Sala de pruebas: todos los poderes activos': '✅ Test room: all powers active',
    '⛔ Hay otros jugadores en la sala. Los poderes se desactivan para que la partida sea justa. Solo puedes probar minijuegos y animaciones.': '⛔ There are other players in the room. Powers are disabled to keep the game fair. You can only test minigames and animations.',
    'Partida': 'Game',
    '▶ Empezar ya': '▶ Start now',
    '🤪 MODO LOCURA (100 bots)': '🤪 CRAZY MODE (100 bots)',
    '🧹 Quitar bots': '🧹 Remove bots',
    'Bots en la sala: <b>{}</b> / 100': 'Bots in the room: <b>{0}</b> / 100',
    'Impostores en la próxima partida': 'Impostors next game',
    'Mi rol en la próxima partida': 'My role next game',
    'Mi rol (cambia al instante)': 'My role (changes instantly)',
    'Movimiento': 'Movement',
    '👻 Atravesar paredes': '👻 Walk through walls',
    '📍 Teletransporte en el mapa': '📍 Teleport on the map',
    'Visión': 'Vision',
    '🔦 Ver todo el mapa': '🔦 See the whole map',
    '🩻 Ver roles de todos': "🩻 See everyone's role",
    'Poderes': 'Powers',
    '⚡ Sin enfriamiento': '⚡ No cooldown',
    '🧊 Congelar bots': '🧊 Freeze bots',
    '✨ Revivir a todos': '✨ Revive everyone',
    '✅ Completar mis tareas': '✅ Complete my tasks',
    '🏁 Completar todas': '🏁 Complete all',
    'Sabotajes': 'Sabotages',
    '💡 Luces': '💡 Lights',
    '🔧 Reparar todo': '🔧 Fix everything',
    '🚪 {}': '🚪 {0}',
    '🚨 Convocar reunión': '🚨 Call meeting',
    '⏱️ Terminar votación': '⏱️ End voting',
    'Terminar partida': 'End game',
    '🙈 Ganan escondidos': '🙈 Hiders win',
    '🧑‍🚀 Gana tripulación': '🧑‍🚀 Crew wins',
    '🔎 Gana buscador': '🔎 Seeker wins',
    '🔪 Ganan impostores': '🔪 Impostors win',
    'Probar minijuegos (no cuentan)': "Test minigames (they don't count)",
    'Probar animaciones': 'Test animations',
    '🎭 Revelar rol': '🎭 Role reveal',
    '🔪 Muerte': '🔪 Death',
    '📢 Cadáver': '📢 Body',
    '🚨 Emergencia': '🚨 Emergency',
    '🚀 Expulsión': '🚀 Ejection',
    '🏆 Victoria': '🏆 Victory',
    '💔 Derrota': '💔 Defeat',
    '🎉 Confeti': '🎉 Confetti',
    'Atajo: F2 abre y cierra este panel.': 'Shortcut: F2 opens and closes this panel.',
    '🛠️ Prueba · {}': '🛠️ Test · {0}',
    '✅ Minijuego completado (modo prueba: no cuenta en la partida)': "✅ Minigame completed (test mode: it doesn't count)",
    'Vista previa desde el modo developer': 'Preview from developer mode',
    'Cables': 'Wires', 'Tarjeta': 'Card', 'Basura': 'Garbage', 'Asteroides': 'Asteroids', 'Filtro O2': 'O2 filter',
    'Dirección': 'Steering', 'Colectores': 'Manifolds', 'Distribuidor': 'Distributor', 'Alinear motor': 'Align engine',
    'Descargar datos': 'Download data', 'Subir datos': 'Upload data', 'Combustible': 'Fuel',
    'Luces (sabotaje)': 'Lights (sabotage)', 'Reactor (sabotaje)': 'Reactor (sabotage)', 'O2 (sabotaje)': 'O2 (sabotage)',
    'Botón de emergencia': 'Emergency button',

    // ---------------------------------------------------------------- datos compartidos
    'Rojo': 'Red', 'Azul': 'Blue', 'Verde': 'Green', 'Rosa': 'Pink', 'Naranja': 'Orange', 'Amarillo': 'Yellow',
    'Negro': 'Black', 'Blanco': 'White', 'Morado': 'Purple', 'Marrón': 'Brown', 'Cian': 'Cyan', 'Lima': 'Lime',
    'Granate': 'Maroon', 'Rosado': 'Rose', 'Plátano': 'Banana', 'Gris': 'Gray', 'Canela': 'Tan', 'Coral': 'Coral',
    'Nada': 'None', 'Gorra': 'Cap', 'Corona': 'Crown', 'Fiesta': 'Party hat', 'Auriculares': 'Headphones', 'Flor': 'Flower',
    'Chef': 'Chef', 'Vaquero': 'Cowboy hat', 'Cuernos': 'Horns', 'Aureola': 'Halo', 'Brote': 'Sprout', 'Chistera': 'Top hat',
    'Gorro': 'Beanie', 'Antena': 'Antenna', 'Bolsa Temu': 'Temu bag',
    'Ninguna': 'None', 'Mini tripulante': 'Mini crewmate', 'Perrito': 'Puppy', 'Gatito': 'Kitty', 'Robot': 'Robot',
    'Hámster': 'Hamster', 'Alien': 'Alien', 'OVNI': 'UFO', 'Slime': 'Slime',
    'Clásico': 'Classic',
    'Encuentra al impostor antes de que elimine a la tripulación.': 'Find the impostor before they wipe out the crew.',
    'Escondite': 'Hide and Seek',
    'Un buscador te caza. Escóndete, haz tareas y sobrevive al reloj.': 'A seeker hunts you. Hide, do tasks and outlast the clock.',
    'Carrera de tareas': 'Task Race',
    'Sin impostores. Gana quien complete todas sus tareas primero.': 'No impostors. Whoever finishes all their tasks first wins.',
    'Máx. jugadores': 'Max players', 'Sala': 'Room', 'Impostores': 'Impostors',
    'Enfriamiento de eliminación': 'Kill cooldown', 'Distancia de eliminación': 'Kill distance',
    'Corta': 'Short', 'Normal': 'Normal', 'Larga': 'Long',
    'Visión del impostor': 'Impostor vision', 'Ingenieros (usan ventilas)': 'Engineers (use vents)', 'Roles': 'Roles',
    'Sheriff (dispara al impostor)': 'Sheriff (shoots the impostor)', 'Velocidad del jugador': 'Player speed',
    'Tripulación': 'Crew', 'Visión de la tripulación': 'Crew vision', 'Reuniones de emergencia': 'Emergency meetings',
    'Reuniones': 'Meetings', 'Enfriamiento de emergencia': 'Emergency cooldown', 'Tiempo de discusión': 'Discussion time',
    'Tiempo de votación': 'Voting time', 'Confirmar expulsiones': 'Confirm ejects', 'Votos anónimos': 'Anonymous votes',
    'Barra de tareas': 'Task bar', 'Siempre': 'Always', 'En reuniones': 'In meetings', 'Nunca': 'Never',
    'Tareas visuales': 'Visual tasks', 'Tareas comunes': 'Common tasks', 'Tareas largas': 'Long tasks', 'Tareas cortas': 'Short tasks',
    'Tiempo de escondite': 'Hide time', 'Escondite final': 'Final hide', 'Segundos por tarea': 'Seconds per task',
    'Enfriamiento del buscador': 'Seeker cooldown', 'Velocidad del buscador': 'Seeker speed',
    'Motor superior': 'Upper Engine', 'Reactor': 'Reactor', 'Motor inferior': 'Lower Engine', 'Seguridad': 'Security',
    'Enfermería': 'MedBay', 'Cafetería': 'Cafeteria', 'Armas': 'Weapons', 'O2': 'O2', 'Navegación': 'Navigation',
    'Escudos': 'Shields', 'Comunicaciones': 'Communications', 'Almacén': 'Storage', 'Administración': 'Admin',
    'Electricidad': 'Electrical',
    'Deslizar tarjeta': 'Swipe card', 'Arreglar cables': 'Fix wiring', 'Vaciar basura': 'Empty garbage',
    'Destruir asteroides': 'Clear asteroids', 'Limpiar filtro de O2': 'Clean O2 filter', 'Estabilizar dirección': 'Stabilize steering',
    'Activar escudos': 'Prime shields', 'Desbloquear colectores': 'Unlock manifolds', 'Calibrar distribuidor': 'Calibrate distributor',
    'Alinear motor superior': 'Align upper engine', 'Alinear motor inferior': 'Align lower engine', 'Escaneo médico': 'Submit scan',
    'Trazar rumbo': 'Chart course', 'Transferir datos': 'Transfer data', 'Cargar combustible': 'Fuel engines',
    'Arrancar reactor': 'Start reactor',
    'Pasillo superior': 'Upper hallway', 'Pasillo izquierdo': 'Left hallway', 'Pasillo derecho': 'Right hallway', 'Pasillo inferior': 'Lower hallway',
    'CAFETERÍA': 'CAFETERIA', 'NÚCLEO': 'CORE', 'FRÁGIL': 'FRAGILE',

    // ---------------------------------------------------------------- minijuegos
    'INSERTA LA TARJETA': 'PLEASE INSERT CARD', 'TRIPULANTE': 'CREWMATE', 'Toca la tarjeta': 'Tap the card',
    'Desliza → a velocidad constante': 'Swipe → at a steady speed', 'DESLIZA LA TARJETA': 'PLEASE SWIPE CARD',
    'DEMASIADO RÁPIDO.': 'TOO FAST. TRY AGAIN.', 'DEMASIADO LENTO.': 'TOO SLOW. TRY AGAIN.', 'ACEPTADO. GRACIAS.': 'ACCEPTED. THANK YOU.',
    'MALA LECTURA. INTÉNTALO DE NUEVO.': 'BAD READ. TRY AGAIN.',
    'Destruidos: {}': 'Destroyed: {0}', '◀ Arrastra las hojas': '◀ Drag out the leaves', 'Centra la mira': 'Center the crosshair',
    'Pulsa del 1 al 10 en orden': 'Press 1 to 10 in order', 'CALIBRAR': 'CALIBRATE', 'Alinea la salida del motor': 'Align the engine output',
    '¡Completado!': 'Complete!', 'Tiempo estimado: {} s': 'Estimated time: {0} s', 'Sube los datos a la nube': 'Upload the data to the cloud',
    'Descarga los datos': 'Download the data', 'SUBIR': 'UPLOAD', 'DESCARGAR': 'DOWNLOAD',
    'ALTURA: {}': 'HEIGHT: {0}', 'PESO: {} lb': 'WEIGHT: {0} lb', 'SANGRE: {}': 'BLOOD: {0}',
    'Escaneando… no te muevas': "Scanning… don't move", 'Escaneo completo': 'Scan complete',
    'Arrastra la nave por la ruta': 'Drag the ship along the route', 'Llena el bidón': 'Fill the can', 'Carga el motor': 'Fuel the engine',
    '¡LLENO!': 'FULL!', 'MANTENER': 'HOLD', 'Observa…': 'Watch…', 'Repite la secuencia': 'Repeat the sequence',
    'Enciende todos los interruptores': 'Turn on all the switches', '¡Estabilizando!': 'Stabilizing!',
    'Esperando al otro escáner…': 'Waiting for the other scanner…', 'Mantén la mano en el escáner': 'Keep your hand on the scanner',
    'Otro tripulante está en el otro escáner': 'Another crewmate is on the other scanner',
    'Se necesitan 2 personas a la vez': 'It takes 2 people at once', 'código de hoy': "today's code", 'CORRECTO': 'CORRECT',
    'BOTÓN DE EMERGENCIA': 'EMERGENCY BUTTON', 'Disponible en {} s': 'Available in {0} s', 'Reuniones restantes: {}': 'Meetings left: {0}',
    'Sin reuniones': 'No meetings left', 'Enfriando…': 'Cooling down…',

    // ---------------------------------------------------------------- mensajes del servidor
    'Has abierto el juego en otra pestaña.': 'You opened the game in another tab.',
    'La partida ya empezó. Espera a que termine.': 'The game already started. Wait for it to end.',
    'La sala está llena.': 'The room is full.',
    '{} se unió a la sala.': '{0} joined the room.',
    '{} salió de la sala.': '{0} left the room.',
    '{} se desconectó.': '{0} disconnected.',
    '{} ahora es el anfitrión.': '{0} is now the host.',
    'El anfitrión te expulsó de la sala.': 'The host kicked you from the room.',
    'Ese color ya lo tiene otro jugador.': 'Another player already has that color.',
    'El modo {} necesita al menos {} jugadores. ¡Agrega bots!': '{0} mode needs at least {1} players. Add bots!',
    'El anfitrión canceló el inicio.': 'The host canceled the start.',
    'Ya no te quedan reuniones de emergencia.': 'You have no emergency meetings left.',
    'Espera {} s para usar el botón.': 'Wait {0} s to use the button.',
    '¡No puedes convocar una reunión durante una emergencia crítica!': "You can't call a meeting during a critical emergency!",
    '¡{} completó todas sus tareas primero!': '{0} finished all their tasks first!',
    'Ventila disponible en {} s': 'Vent available in {0} s',
    'Nadie fue expulsado. (Empate)': 'No one was ejected. (Tie)',
    'Nadie fue expulsado. (Omitido)': 'No one was ejected. (Skipped)',
    '{} era un impostor.': '{0} was An Impostor.',
    '{} era el impostor.': '{0} was The Impostor.',
    '{} no era un impostor.': '{0} was not An Impostor.',
    '{} no era el impostor.': '{0} was not The Impostor.',
    '{} fue expulsado.': '{0} was ejected.',
    'Queda 1 impostor.': '1 Impostor remains.',
    'Quedan {} impostores.': '{0} Impostors remain.',
    '¡El reactor se fundió! La nave explotó.': 'The reactor melted down! The ship exploded.',
    '¡Se acabó el oxígeno! La tripulación se asfixió.': 'The oxygen ran out! The crew suffocated.',
    '¡Los escondidos sobrevivieron hasta el final!': 'The hiders survived until the end!',
    '¡Todos los impostores fueron eliminados!': 'All impostors were eliminated!',
    '¡La tripulación completó todas las tareas!': 'The crew completed all the tasks!',
    'Los impostores superan en número a la tripulación.': 'The impostors outnumber the crew.',
    '¡El buscador atrapó a todos!': 'The seeker caught everyone!',
    'El buscador abandonó la partida.': 'The seeker left the game.',
    '🛠️ Los poderes de developer solo funcionan en salas sin otros jugadores (solo bots).': '🛠️ Developer powers only work in rooms without other players (bots only).',
    '🎲 Rol aleatorio en la próxima partida': '🎲 Random role next game',
    '✅ Tendrás ese rol en la próxima partida': "✅ You'll get that role next game",
    'Ese rol no existe en este modo': "That role doesn't exist in this mode",
    'No hay suelo cerca de ese punto': 'No floor near that spot',
    '🤖 Ya tienes el máximo: 100 bots': '🤖 You already have the max: 100 bots',
    '🤪 MODO LOCURA: {} bots': '🤪 CRAZY MODE: {0} bots',
    '🔪 {} impostor(es) en la próxima partida (si hay jugadores suficientes)': '🔪 {0} impostor(s) next game (if there are enough players)',
    'Tareas completadas desde el modo developer': 'Tasks completed from developer mode',
    '✨ Todos revividos': '✨ Everyone revived',
    'Victoria forzada desde el modo developer': 'Victory forced from developer mode',
    'El usuario debe tener 3-14 letras, números o _.': 'Usernames need 3-14 letters, numbers or _.',
    'La contraseña debe tener al menos 4 caracteres.': 'The password needs at least 4 characters.',
    'Ese usuario ya existe. Prueba otro nombre.': 'That username is taken. Try another one.',
    'Usuario o contraseña incorrectos.': 'Wrong username or password.',
    'Demasiados intentos. Espera un minuto.': 'Too many attempts. Wait a minute.',
    'Sesión expirada': 'Session expired',
    'Código incorrecto.': 'Wrong code.',
    'No existe una sala con ese código.': "There's no room with that code.",

    // ---------------------------------------------------------------- lo que dicen los bots
    'Encontré el cuerpo de {} en {}.': "I found {0}'s body in {1}.",
    'Convoqué la reunión: {} es muy sospechoso.': 'I called the meeting: {0} is super sus.',
    'Convoqué la reunión, algo raro está pasando.': "I called the meeting, something weird is going on.",
    'Fue {}, lo vi.': 'It was {0}, I saw it.',
    '{} estaba muy cerca, sospechoso.': '{0} was really close, sus.',
    'Voto por {}.': 'Voting {0}.',
    'Yo estaba en {} haciendo tareas.': 'I was in {0} doing tasks.',
    '¿Dónde?': 'Where?',
    'No vi nada :(': "I didn't see anything :(",
    'Estaba en {}.': 'I was in {0}.',
    '¿Quién fue?': 'Who was it?',
    'Yo soy inocente.': "I'm innocent.",
    'Skip por ahora.': 'Skip for now.',
    'la cafetería': 'the cafeteria',
    'un pasillo': 'a hallway',
  };

  const DICTS = { en: EN };
  const LANGS = { es: 'Español', en: 'English' };
  const KEY = 'aut_lang';

  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* */ }
  const lang = LANGS[stored] ? stored : 'es';
  const dict = DICTS[lang] || null;

  // Plantillas: '{} era el impostor.' -> /^(.+?) era el impostor\.$/
  const patterns = [];
  if (dict) {
    for (const k in dict) {
      if (k.indexOf('{}') < 0) continue;
      const parts = k.split('{}');
      const re = new RegExp('^' + parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\s\\S]+?)') + '$');
      patterns.push({ re, out: dict[k], lit: parts.join('').length });
    }
    // primero las más específicas (así "{} no era el impostor." gana a "{} era el impostor.")
    patterns.sort((a, b) => b.lit - a.lit);
  }

  const cache = new Map();
  function T(s, depth) {
    if (!dict || s == null) return s;
    s = String(s);
    if (!s) return s;
    let r = cache.get(s);
    if (r !== undefined) return r;
    r = dict[s];
    if (r === undefined) {
      r = s;
      if ((depth || 0) < 3) {
        for (const p of patterns) {
          const m = p.re.exec(s);
          if (!m) continue;
          r = p.out.replace(/\{(\d)\}/g, (_, i) => T(m[+i + 1], (depth || 0) + 1));
          break;
        }
      }
    }
    if (cache.size > 3000) cache.clear();
    cache.set(s, r);
    return r;
  }

  // Traduce en su sitio los nombres de los datos compartidos (colores, salas, tareas, reglas…)
  function translateShared(S) {
    if (!dict || !S) return;
    const names = list => list && list.forEach(o => { if (o.name) o.name = T(o.name); });
    names(S.COLORS); names(S.HATS); names(S.PETS); names(S.CAMERAS);
    for (const k in S.MODES) { S.MODES[k].name = T(S.MODES[k].name); S.MODES[k].desc = T(S.MODES[k].desc); }
    for (const f of S.SETTINGS_SCHEMA) {
      f.label = T(f.label); f.group = T(f.group);
      if (f.options) f.options = f.options.map(o => T(o));
    }
    for (const id in S.MAPS) names(S.MAPS[id].rooms);
    for (const k in S.TASKS) S.TASKS[k].name = T(S.TASKS[k].name);
  }

  // Traduce el HTML fijo de la página
  function translateDOM(root) {
    if (!dict) return;
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const k = el.innerHTML.trim().replace(/\s+/g, ' ');
      if (dict[k] !== undefined) el.innerHTML = dict[k];
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentNode.closest('script,style,[data-i18n-html]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const raw = n.nodeValue, k = raw.trim();
      if (!k) continue;
      const v = T(k);
      if (v !== k) n.nodeValue = raw.replace(k, v);
    }
    root.querySelectorAll('[placeholder],[title]').forEach(el => {
      for (const a of ['placeholder', 'title']) if (el.hasAttribute(a)) el.setAttribute(a, T(el.getAttribute(a)));
    });
  }

  // ---------------------------------------------------------------- selector de idioma
  function setLang(l) {
    if (!LANGS[l]) return;
    try { localStorage.setItem(KEY, l); } catch (e) { /* */ }
    if (l === lang) { closePicker(); return; }
    try { sessionStorage.setItem('aut_relang', '1'); } catch (e) { /* */ }
    location.reload();
  }

  let picker = null;
  function openPicker(first) {
    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'lang-pick';
      picker.innerHTML = `<div class="lang-card glass">
          <div class="lang-globe">🌐</div>
          <h2>Elige tu idioma<small>Choose your language</small></h2>
          <div class="lang-opts">
            <button class="lang-opt" data-l="es"><span class="flag">🇪🇸</span><b>Español</b><small>Jugar en español</small></button>
            <button class="lang-opt" data-l="en"><span class="flag">🇺🇸</span><b>English</b><small>Play in English</small></button>
          </div>
          <p class="lang-foot">Puedes cambiarlo después en Ajustes · You can change it later in Settings</p>
        </div>`;
      picker.addEventListener('click', e => {
        const b = e.target.closest('[data-l]');
        if (b) { if (window.Sfx) try { Sfx.init(); Sfx.click(); } catch (err) { /* */ } setLang(b.dataset.l); }
        else if (e.target === picker && !picker.classList.contains('first')) closePicker();
      });
      document.body.appendChild(picker);
    }
    picker.classList.toggle('first', !!first);
    picker.querySelectorAll('.lang-opt').forEach(b => b.classList.toggle('sel', !first && b.dataset.l === lang));
    requestAnimationFrame(() => picker.classList.add('show'));
  }
  function closePicker() { if (picker) picker.classList.remove('show'); }

  let switched = false;
  try { switched = sessionStorage.getItem('aut_relang') === '1'; sessionStorage.removeItem('aut_relang'); } catch (e) { /* */ }

  window.T = T;
  window.I18N = {
    lang, T, LANGS, setLang, openPicker, closePicker, translateDOM,
    chosen: !!stored, justSwitched: switched,
  };

  document.documentElement.lang = lang;
  if (window.Shared) translateShared(window.Shared);
  if (document.body) translateDOM(document.body);
  if (!stored) document.addEventListener('DOMContentLoaded', () => openPicker(true));
  if (!stored && document.readyState !== 'loading') setTimeout(() => openPicker(true), 0);
})();
