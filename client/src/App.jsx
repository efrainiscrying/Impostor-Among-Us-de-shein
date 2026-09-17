import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./screens/AuthScreen.jsx";
import MenuScreen from "./screens/MenuScreen.jsx";
import LobbyScreen from "./screens/LobbyScreen.jsx";
import GameScreen from "./game/GameScreen.jsx";
import { connectSocket, disconnectSocket } from "./socket.js";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("impostor_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("impostor_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState("menu"); // "menu" | "lobby" | "game"
  const [lobbyState, setLobbyState] = useState(null);
  const [startPayload, setStartPayload] = useState(null);

  useEffect(() => {
    if (token) {
      const s = connectSocket(token);
      setSocket(s);
      return () => disconnectSocket();
    }
  }, [token]);

  const onAuthed = useCallback((tok, u) => {
    setToken(tok);
    setUser(u);
  }, []);

  function logout() {
    localStorage.removeItem("impostor_token");
    localStorage.removeItem("impostor_user");
    disconnectSocket();
    setToken(null);
    setUser(null);
    setSocket(null);
    setView("menu");
  }

  if (!token || !user) {
    return <AuthScreen onAuthed={onAuthed} />;
  }

  if (!socket) {
    return <div className="screen"><div className="stars" /><p style={{ color: "#fff" }}>Conectando…</p></div>;
  }

  if (view === "menu") {
    return (
      <MenuScreen
        user={user}
        socket={socket}
        onLogout={logout}
        onEnterLobby={(state) => {
          setLobbyState(state);
          setView("lobby");
        }}
      />
    );
  }

  if (view === "lobby") {
    return (
      <LobbyScreen
        user={user}
        socket={socket}
        initialState={lobbyState}
        onLeave={() => setView("menu")}
        onGameStart={(payload) => {
          setStartPayload(payload);
          setView("game");
        }}
      />
    );
  }

  if (view === "game") {
    return (
      <GameScreen
        user={user}
        socket={socket}
        startPayload={startPayload}
        onExit={() => {
          socket.emit("lobby:leave");
          setView("menu");
        }}
      />
    );
  }

  return null;
}
