import { useState } from "react";
import Bean from "../components/Bean.jsx";

export default function MenuScreen({ user, socket, onEnterLobby, onLogout }) {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function createLobby() {
    setBusy(true);
    setError("");
    socket.emit("lobby:create", (res) => {
      setBusy(false);
      if (!res?.ok) return setError(res?.error || "No se pudo crear la sala.");
      onEnterLobby(res.state);
    });
  }

  function joinLobby(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError("");
    socket.emit("lobby:join", { code: joinCode.trim().toUpperCase() }, (res) => {
      setBusy(false);
      if (!res?.ok) return setError(res?.error || "No se pudo unir a la sala.");
      onEnterLobby(res.state);
    });
  }

  return (
    <div className="screen menu-screen">
      <div className="stars" />
      <div className="menu-card">
        <div className="menu-header">
          <Bean color={user.color} size={48} />
          <div>
            <div className="hello">Hola, {user.username}</div>
            <button className="link" onClick={onLogout} type="button">
              Cerrar sesión
            </button>
          </div>
        </div>

        <button className="btn primary big" onClick={createLobby} disabled={busy} type="button">
          Crear sala
        </button>

        <div className="divider">o</div>

        <form onSubmit={joinLobby} className="form row">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO DE SALA"
            maxLength={6}
            style={{ letterSpacing: "0.2em", textAlign: "center" }}
          />
          <button className="btn secondary" type="submit" disabled={busy}>
            Unirse
          </button>
        </form>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
