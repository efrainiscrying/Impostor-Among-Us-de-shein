import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import MainScene from "./MainScene.js";
import MeetingOverlay from "./MeetingOverlay.jsx";
import GameOverOverlay from "./GameOverOverlay.jsx";

export default function GameScreen({ user, socket, startPayload, onExit }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [meeting, setMeeting] = useState(null);
  const [meetingResult, setMeetingResult] = useState(null);
  const [votedIds, setVotedIds] = useState(new Set());
  const [chatMessages, setChatMessages] = useState([]);
  const [gameOver, setGameOver] = useState(null);
  const [hud, setHud] = useState({});

  useEffect(() => {
    if (!containerRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#0b0e17",
      physics: { default: "arcade", arcade: { debug: false } },
      scene: [MainScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.scene.start("main", {
      socket,
      selfId: user.id,
      players: startPayload.players,
      settings: startPayload.settings,
      isImpostor: startPayload.isImpostor,
      tasks: startPayload.tasks,
    });

    function onResize() {
      if (!containerRef.current) return;
      game.scale.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
    window.addEventListener("resize", onResize);

    const hudInterval = setInterval(() => {
      const scene = game.scene.getScene("main");
      if (scene?.uiState) setHud({ ...scene.uiState });
    }, 150);

    function onMeetingStart(payload) {
      setMeeting({ phase: "discussion", ...payload });
      setMeetingResult(null);
      setVotedIds(new Set());
      setChatMessages([]);
    }
    function onVotingStart(payload) {
      setMeeting((m) => (m ? { ...m, phase: "voting", endsAt: payload.endsAt } : m));
    }
    function onVoteUpdate({ voterId }) {
      setVotedIds((s) => new Set(s).add(voterId));
    }
    function onMeetingResult(payload) {
      setMeeting(null);
      setMeetingResult(payload);
      setTimeout(() => setMeetingResult(null), 4000);
    }
    function onChatMessage(msg) {
      setChatMessages((c) => [...c, msg]);
    }
    function onGameOver(payload) {
      setGameOver(payload);
    }

    socket.on("game:meetingStart", onMeetingStart);
    socket.on("game:votingStart", onVotingStart);
    socket.on("game:voteUpdate", onVoteUpdate);
    socket.on("game:meetingResult", onMeetingResult);
    socket.on("game:chatMessage", onChatMessage);
    socket.on("game:over", onGameOver);

    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(hudInterval);
      socket.off("game:meetingStart", onMeetingStart);
      socket.off("game:votingStart", onVotingStart);
      socket.off("game:voteUpdate", onVoteUpdate);
      socket.off("game:meetingResult", onMeetingResult);
      socket.off("game:chatMessage", onChatMessage);
      socket.off("game:over", onGameOver);
      game.scene.getScene("main")?.teardown?.();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [socket, user, startPayload]);

  function callScene(method) {
    const scene = gameRef.current?.scene.getScene("main");
    scene?.[method]?.();
  }

  return (
    <div className="screen game-screen">
      <div ref={containerRef} className="game-canvas-wrap" />
      <button className="btn ghost exit-btn" onClick={onExit} type="button">
        Salir de la partida
      </button>

      {!meeting && !meetingResult && !gameOver && hud.alive && (
        <div className="action-bar">
          {startPayload.settings.mode === "classic" && hud.nearTaskId && (
            <div className="action-hint">Mantené E: {hud.nearTaskName}</div>
          )}
          {startPayload.settings.mode === "classic" && hud.nearBodyId && (
            <button className="btn primary" onClick={() => callScene("reportNearestBody")} type="button">
              Reportar cuerpo (R)
            </button>
          )}
          {startPayload.settings.mode === "classic" && hud.role === "impostor" && (
            <button
              className="btn secondary"
              disabled={!hud.killTargetId || hud.killReadyInMs > 0}
              onClick={() => callScene("attemptKill")}
              type="button"
            >
              {hud.killReadyInMs > 0 ? `Matar (${Math.ceil(hud.killReadyInMs / 1000)}s)` : "Matar (F)"}
            </button>
          )}
          {startPayload.settings.mode === "classic" && (
            <button
              className="btn ghost"
              disabled={!hud.emergencyLeft}
              onClick={() => callScene("callEmergencyMeeting")}
              type="button"
            >
              Reunión de emergencia ({hud.emergencyLeft ?? 0})
            </button>
          )}
          {startPayload.settings.mode === "hideseek" && hud.role === "impostor" && (
            <button
              className="btn secondary"
              disabled={!hud.killTargetId || hud.hideCountdown > 0}
              onClick={() => callScene("attemptKill")}
              type="button"
            >
              {hud.hideCountdown > 0 ? `Esperando (${Math.ceil(hud.hideCountdown / 1000)}s)` : "Atrapar (F)"}
            </button>
          )}
        </div>
      )}

      {(meeting || meetingResult) && (
        <MeetingOverlay
          players={startPayload.players}
          meeting={meeting}
          votedIds={votedIds}
          chatMessages={chatMessages}
          onSendChat={(text) => socket.emit("game:chat", text)}
          onVote={(targetId) => socket.emit("game:vote", targetId)}
          result={meetingResult}
        />
      )}

      {gameOver && (
        <GameOverOverlay payload={gameOver} players={startPayload.players} onExit={onExit} />
      )}
    </div>
  );
}
