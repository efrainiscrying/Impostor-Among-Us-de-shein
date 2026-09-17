import { useState } from "react";
import Bean from "../components/Bean.jsx";
import * as api from "../api.js";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? api.login : api.register;
      const { token, user } = await fn(username.trim(), password);
      localStorage.setItem("impostor_token", token);
      localStorage.setItem("impostor_user", JSON.stringify(user));
      onAuthed(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="stars" />
      <div className="auth-card">
        <div className="logo-row">
          <Bean color="#c51111" size={72} />
          <h1 className="title">IMPOSTOR</h1>
          <Bean color="#132ed1" size={72} />
        </div>
        <p className="subtitle">Un juego de deducción social — creado por nosotros</p>

        <div className="tabs">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")} type="button">
            Iniciar sesión
          </button>
          <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")} type="button">
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label>
            Usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_nombre"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
