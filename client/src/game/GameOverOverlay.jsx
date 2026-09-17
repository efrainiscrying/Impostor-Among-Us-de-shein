import Bean from "../components/Bean.jsx";

export default function GameOverOverlay({ payload, players, onExit }) {
  const roleByUser = new Map(payload.players.map((p) => [p.userId, p]));

  return (
    <div className="meeting-overlay">
      <div className="meeting-card result-card">
        <h1 className={payload.winner === "impostor" ? "winner-impostor" : "winner-crew"}>
          {payload.winner === "impostor" ? "GANARON LOS IMPOSTORES" : "GANÓ LA TRIPULACIÓN"}
        </h1>
        <p>{payload.reason}</p>

        <div className="reveal-list">
          {players.map((p) => {
            const info = roleByUser.get(p.userId);
            return (
              <div className="reveal-row" key={p.userId}>
                <Bean color={p.color} size={36} />
                <span className="player-name">{p.username}</span>
                <span className={info?.role === "impostor" ? "role-tag impostor" : "role-tag crew"}>
                  {info?.role === "impostor" ? "Impostor" : "Tripulante"}
                </span>
                {!info?.alive && <span className="dead-tag">eliminado</span>}
              </div>
            );
          })}
        </div>

        <button className="btn primary big" onClick={onExit} type="button">
          Volver al menú
        </button>
      </div>
    </div>
  );
}
