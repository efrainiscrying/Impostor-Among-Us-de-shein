import { useEffect, useRef, useState } from "react";
import Bean from "../components/Bean.jsx";

export default function MeetingOverlay({ players, meeting, votedIds, chatMessages, onSendChat, onVote, result }) {
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState("");
  const [myVote, setMyVote] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    setMyVote(null);
  }, [meeting?.phase]);

  if (result) {
    const target = players.find((p) => p.userId === result.ejectedUserId);
    return (
      <div className="meeting-overlay">
        <div className="meeting-card result-card">
          {result.ejectedUserId ? (
            <>
              <Bean color={target?.color || "#888"} size={80} />
              <h2>{target?.username || "Alguien"} fue expulsado</h2>
              <p>{result.wasImpostor ? "Era el impostor." : "No era el impostor."}</p>
            </>
          ) : (
            <h2>Nadie fue expulsado</h2>
          )}
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  const secsLeft = Math.max(0, Math.ceil((meeting.endsAt - now) / 1000));
  const isVoting = meeting.phase === "voting";

  function submitVote(targetId) {
    if (myVote) return;
    setMyVote(targetId || "skip");
    onVote(targetId);
  }

  return (
    <div className="meeting-overlay">
      <div className="meeting-card">
        <div className="meeting-header">
          <h2>{isVoting ? "Votación" : "Discusión"}</h2>
          <span className="timer">{secsLeft}s</span>
        </div>

        <div className="meeting-players">
          {players.map((p) => (
            <button
              key={p.userId}
              className={"vote-chip" + (myVote === p.userId ? " selected" : "") + (!isVoting ? " disabled" : "")}
              disabled={!isVoting || !!myVote}
              onClick={() => submitVote(p.userId)}
              type="button"
            >
              <Bean color={p.color} size={40} />
              <span>{p.username}</span>
              {votedIds.has(p.userId) && <span className="voted-dot" title="ya votó" />}
            </button>
          ))}
          {isVoting && (
            <button
              className={"vote-chip skip" + (myVote === "skip" ? " selected" : "")}
              disabled={!!myVote}
              onClick={() => submitVote(null)}
              type="button"
            >
              Saltear voto
            </button>
          )}
        </div>

        <div className="chat-box">
          <div className="chat-log">
            {chatMessages.map((m, i) => (
              <div key={i} className="chat-line">
                <b>{m.username}:</b> {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onSendChat(text.trim());
              setText("");
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí algo..." maxLength={200} />
            <button className="btn secondary" type="submit">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
