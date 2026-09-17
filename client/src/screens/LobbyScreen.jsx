import { useEffect, useState } from "react";
import Bean from "../components/Bean.jsx";

const PALETTE = [
  "#c51111", "#132ed1", "#117f2d", "#ed54ba", "#ef7d0d", "#f5f557",
  "#3f474e", "#d6e0f0", "#6b2fbb", "#71491e", "#38fedc", "#50ef39",
];

export default function LobbyScreen({ user, socket, initialState, onLeave, onGameStart }) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    function onState(s) {
      setState(s);
    }
    function onStart(payload) {
      onGameStart(payload);
    }
    socket.on("lobby:state", onState);
    socket.on("game:start", onStart);
    return () => {
      socket.off("lobby:state", onState);
      socket.off("game:start", onStart);
    };
  }, [socket, onGameStart]);

  const isHost = state.hostId === user.id;
  const me = state.players.find((p) => p.userId === user.id);
  const s = state.settings;

  function updateSettings(patch) {
    socket.emit("lobby:updateSettings", { ...s, ...patch });
  }

  function start() {
    setError("");
    socket.emit("lobby:start", (res) => {
      if (!res?.ok) setError(res?.error || "No se pudo iniciar.");
    });
  }

  function leave() {
    socket.emit("lobby:leave");
    onLeave();
  }

  return (
    <div className="screen lobby-screen">
      <div className="stars" />
      <div className="lobby-layout">
        <div className="lobby-card players-card">
          <div className="code-row">
            <span className="code-label">CÓDIGO</span>
            <span className="code">{state.code}</span>
            <button className="link" onClick={() => navigator.clipboard?.writeText(state.code)} type="button">
              copiar
            </button>
          </div>

          <div className="player-list">
            {state.players.map((p) => (
              <div className="player-row" key={p.userId}>
                <Bean color={p.color} size={36} />
                <span className="player-name">
                  {p.username} {p.userId === state.hostId && <span className="host-tag">HOST</span>}
                </span>
                <span className={p.ready ? "ready-tag ready" : "ready-tag"}>{p.ready ? "Listo" : "Esperando"}</span>
              </div>
            ))}
          </div>

          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={"swatch" + (me?.color === c ? " selected" : "")}
                style={{ background: c }}
                onClick={() => socket.emit("lobby:setColor", c)}
                type="button"
              />
            ))}
          </div>

          <div className="btn-row">
            <button className="btn secondary" onClick={() => socket.emit("lobby:toggleReady")} type="button">
              {me?.ready ? "Cancelar listo" : "Estoy listo"}
            </button>
            <button className="btn ghost" onClick={leave} type="button">
              Salir
            </button>
          </div>

          {isHost && (
            <button className="btn primary big" onClick={start} type="button">
              Iniciar partida
            </button>
          )}
          {error && <div className="error">{error}</div>}
        </div>

        <div className="lobby-card settings-card">
          <h3>Configuración {isHost ? "" : "(solo el host puede cambiarla)"}</h3>

          <div className="mode-toggle">
            <button
              className={s.mode === "classic" ? "mode-btn active" : "mode-btn"}
              disabled={!isHost}
              onClick={() => updateSettings({ mode: "classic" })}
              type="button"
            >
              Modo Clásico
              <small>Tareas + impostores</small>
            </button>
            <button
              className={s.mode === "hideseek" ? "mode-btn active" : "mode-btn"}
              disabled={!isHost}
              onClick={() => updateSettings({ mode: "hideseek" })}
              type="button"
            >
              Escondite
              <small>Escóndete del buscador</small>
            </button>
          </div>

          {s.mode === "classic" ? (
            <>
              <Field label={`Impostores: ${s.numImpostors}`}>
                <input type="range" min={1} max={3} value={s.numImpostors} disabled={!isHost}
                  onChange={(e) => updateSettings({ numImpostors: Number(e.target.value) })} />
              </Field>
              <Field label={`Velocidad jugador: ${s.playerSpeed.toFixed(2)}x`}>
                <input type="range" min={0.5} max={2} step={0.05} value={s.playerSpeed} disabled={!isHost}
                  onChange={(e) => updateSettings({ playerSpeed: Number(e.target.value) })} />
              </Field>
              <Field label={`Enfriamiento de matar: ${s.killCooldown}s`}>
                <input type="range" min={10} max={60} value={s.killCooldown} disabled={!isHost}
                  onChange={(e) => updateSettings({ killCooldown: Number(e.target.value) })} />
              </Field>
              <Field label={`Tiempo de discusión: ${s.discussionTime}s`}>
                <input type="range" min={0} max={120} value={s.discussionTime} disabled={!isHost}
                  onChange={(e) => updateSettings({ discussionTime: Number(e.target.value) })} />
              </Field>
              <Field label={`Tiempo de votación: ${s.votingTime}s`}>
                <input type="range" min={15} max={300} value={s.votingTime} disabled={!isHost}
                  onChange={(e) => updateSettings({ votingTime: Number(e.target.value) })} />
              </Field>
              <Field label={`Visión jugador: ${s.visionRadius.toFixed(2)}x`}>
                <input type="range" min={0.25} max={3} step={0.05} value={s.visionRadius} disabled={!isHost}
                  onChange={(e) => updateSettings({ visionRadius: Number(e.target.value) })} />
              </Field>
              <Field label={`Visión impostor: ${s.impostorVisionRadius.toFixed(2)}x`}>
                <input type="range" min={0.25} max={3} step={0.05} value={s.impostorVisionRadius} disabled={!isHost}
                  onChange={(e) => updateSettings({ impostorVisionRadius: Number(e.target.value) })} />
              </Field>
              <Field label={`Reuniones de emergencia: ${s.emergencyMeetings}`}>
                <input type="range" min={0} max={9} value={s.emergencyMeetings} disabled={!isHost}
                  onChange={(e) => updateSettings({ emergencyMeetings: Number(e.target.value) })} />
              </Field>
            </>
          ) : (
            <>
              <Field label={`Buscadores (impostores): ${s.seekerCount}`}>
                <input type="range" min={1} max={4} value={s.seekerCount} disabled={!isHost}
                  onChange={(e) => updateSettings({ seekerCount: Number(e.target.value) })} />
              </Field>
              <Field label={`Velocidad jugador: ${s.playerSpeed.toFixed(2)}x`}>
                <input type="range" min={0.5} max={2} step={0.05} value={s.playerSpeed} disabled={!isHost}
                  onChange={(e) => updateSettings({ playerSpeed: Number(e.target.value) })} />
              </Field>
              <Field label={`Tiempo para esconderse: ${s.hideTime}s`}>
                <input type="range" min={0} max={60} value={s.hideTime} disabled={!isHost}
                  onChange={(e) => updateSettings({ hideTime: Number(e.target.value) })} />
              </Field>
              <Field label={`Duración de ronda: ${s.roundTime}s`}>
                <input type="range" min={30} max={600} step={10} value={s.roundTime} disabled={!isHost}
                  onChange={(e) => updateSettings({ roundTime: Number(e.target.value) })} />
              </Field>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
