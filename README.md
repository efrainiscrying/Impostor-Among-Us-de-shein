# Among Us (Temu) 🚀🔪

Juego de deducción social **multijugador para el navegador**, inspirado en Among Us.
Cada amigo entra desde su computadora o celular con **su propia cuenta** (usuario + contraseña),
se une a tu sala con un enlace o un código de 6 letras, y juegan juntos en tiempo real.

Todo el arte (tripulantes, nave, animaciones) está dibujado por código y todos los sonidos se
sintetizan en el navegador: no hay imágenes ni audios externos.

## Qué incluye

**Idiomas**
- Español e inglés. La primera vez que abres el juego te pregunta el idioma; luego lo cambias
  cuando quieras con el botón 🌐 del menú o en **Ajustes → Idioma** (también en plena partida).
- Cada jugador ve el juego en su idioma, aunque jueguen juntos en la misma sala.

**Cuentas**
- Crear cuenta / iniciar sesión con usuario y contraseña (contraseñas cifradas con scrypt).
- La sesión se recuerda en el dispositivo. Estadísticas: partidas, victorias, tareas y eliminaciones.

**Salas**
- Crear sala (pública o privada), unirse con código o con enlace (`/?sala=CODIGO`), lista de salas públicas.
- Nave de espera donde caminas antes de empezar; portátil para personalizarte.
- 18 colores y 15 sombreros (el color es único dentro de cada sala).
- El anfitrión ajusta las reglas, agrega o quita **bots** y puede expulsar jugadores.
- De 2 a 15 jugadores. Con bots se puede jugar aunque sean solo 2 personas.

**Modos**
1. **Clásico**: tripulantes contra impostores. Tareas, eliminaciones, cuerpos, reportes, botón de
   emergencia, discusión, votación, expulsión, ventilas, sabotajes (luces, reactor, O2, puertas),
   fantasmas y chat de fantasmas.
2. **Escondite**: un buscador (que todos conocen) caza a los escondidos. Hay reloj, tiempo para
   esconderse, «escondite final» con pistas para el buscador, medidor de peligro con latidos, y
   las tareas restan tiempo al reloj.
3. **Carrera de tareas**: sin impostores; gana quien complete todas sus tareas primero.

**Reglas configurables**: número de impostores, enfriamiento y distancia de eliminación, velocidad,
visión de tripulación e impostor, reuniones de emergencia y su enfriamiento, tiempos de discusión y
votación, confirmar expulsiones, votos anónimos, barra de tareas (siempre / en reuniones / nunca),
tareas visuales, cantidad de tareas comunes, largas y cortas, y ajustes del modo Escondite.

**16 minijuegos**: cables, tarjeta, basura, asteroides, filtro de O2, dirección, escudos, colectores,
distribuidor, alinear motor, descargar/subir datos, escaneo médico, trazar rumbo, combustible y
arranque del reactor, además de los paneles para reparar sabotajes.

**Secreto de roles**: el servidor solo envía a cada jugador su propio rol. Solo los impostores ven a
sus compañeros en rojo; un tripulante nunca puede saber quién es el impostor por la interfaz.

## Jugar en tu computadora

Necesitas [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm start
```

Abre <http://localhost:3000>. Otras personas en tu misma red Wi-Fi pueden entrar con la IP de tu
computadora, por ejemplo `http://192.168.1.50:3000`.

## Compartirlo con amigos por internet

Para que tus amigos jueguen desde su casa, el servidor tiene que estar en internet.

### Opción A: Render (gratis)
1. Sube este repositorio a GitHub (ya lo está).
2. En <https://render.com> elige **New → Blueprint** y selecciona este repositorio.
   Render lee `render.yaml` y crea el servicio solo.
3. Cuando termine te da un enlace tipo `https://among-us-temu.onrender.com`. Mándaselo a tus amigos.

> En el plan gratuito el servidor «se duerme» si nadie lo usa y tarda unos segundos en despertar.
> Además, el disco no es permanente: **las cuentas se borran cuando Render reinicia el servicio**.
> Si quieres que las cuentas duren, agrega un disco persistente y define la variable
> `DATA_DIR` con la ruta del disco (por ejemplo `/var/data`).

### Opción B: tu computadora + túnel
Con el juego corriendo (`npm start`), en otra terminal:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Te da un enlace público `https://….trycloudflare.com` que funciona mientras tu computadora esté encendida.

### Opción C: Docker
```bash
docker build -t among-us-temu .
docker run -p 3000:3000 -v amongus-data:/data among-us-temu
```

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Moverse | WASD o flechas | Joystick |
| Usar / tarea | E o Espacio | Botón USAR |
| Reportar cuerpo | R | Botón REPORTAR |
| Matar (impostor) | Q | Botón MATAR |
| Ventila (impostor) | V | Botón VENTILA |
| Sabotaje (impostor) | G | Botón SABOTAJE |
| Mapa | Tab o M | Botón de mapa |
| Chat | Enter | Botón de chat |
| Cerrar ventana | Esc | ✕ |

## Modo developer

En el menú principal, **Modo developer** pide un código de 6 números (por defecto `314253`;
se puede cambiar arrancando el servidor con la variable `DEV_CODE`, por ejemplo
`DEV_CODE=123456 npm start`). El código se comprueba en el servidor y tiene límite de intentos.

Con el modo activo aparece el botón `</>` (o la tecla **F2**) con un panel para: elegir o cambiar tu
rol, atravesar paredes, velocidad x2/x3, teletransporte, ver todo el mapa, ver los roles de todos,
sin enfriamiento, congelar bots, matar/revivir, completar tareas, lanzar y reparar sabotajes,
convocar reuniones, forzar la victoria, probar cualquier minijuego y ver todas las animaciones.

Los poderes **solo funcionan en salas donde eres el único humano** (tú + bots), así nunca
afectan a una partida con tus amigos.

## Estructura

```
server/
  index.js   servidor HTTP + WebSocket y API de cuentas
  auth.js    cuentas (data/users.json)
  room.js    salas y reglas del juego (el servidor decide todo)
  bots.js    inteligencia de los bots (rutas, tareas, cazar, votar, chatear)
  dev.js     herramientas del modo developer
public/
  index.html, css/style.css
  js/shared.js  mapa, tareas, colores y ajustes (compartido con el servidor)
  js/i18n.js    idiomas (español / inglés) y selector de idioma
  js/app.js     pantallas, red, controles, HUD, reuniones y animaciones
  js/world.js   dibujo de la nave, efectos y visión con sombras
  js/draw.js    tripulantes, sombreros, fantasmas y cuerpos
  js/tasks.js   minijuegos
  js/audio.js   música, ambiente y efectos sintetizados
```
