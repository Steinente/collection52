import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  LobbySummary,
  PublicLobby,
  RommeRules,
  StructuredEvent,
} from "@collection52/shared";
import type { LegalPageKind } from "./LegalPages";
import {
  defaultPreferences,
  hexColorParts,
  invitationCode,
  loadPreferences,
  loadRetainedLobby,
  retainedLobbyStorageKey,
  sessionKey,
  storageKeys,
  validHexColor,
} from "./client-config";
import type { Ack, AnyGameView, Preferences, RetainedLobby } from "./models";
import { Home } from "./components/home";
import {
  Dialog,
  Footer,
  ResponsiveSelect,
  SettingsDialog,
  TopLayerMessage,
} from "./components/ui";
import { socket } from "./socket";
import { useGameProtocol } from "./hooks/use-game-protocol";
const LobbyView = lazy(() =>
  import("./components/lobby").then((module) => ({
    default: module.LobbyView,
  })),
);
const LegalPage = lazy(() =>
  import("./LegalPages").then((module) => ({ default: module.LegalPage })),
);
const RulesContent = lazy(() =>
  import("./components/rules-content").then((module) => ({
    default: module.RulesContent,
  })),
);
const DeviceTransferDialog = lazy(() =>
  import("./components/device-transfer").then((module) => ({
    default: module.DeviceTransferDialog,
  })),
);

const initialDeviceTransferCode =
  new URLSearchParams(location.search).get("transfer")?.trim() ?? "";

function actionCueKey(game: AnyGameView | undefined, playerId: string): string {
  if (!game || !playerId) return "";
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player?.connected || game.phase === "finished") return "";
  if ("currentPlayerId" in game)
    return game.phase === "playing" && game.currentPlayerId === playerId
      ? `${game.id}:turn`
      : "";
  const durakPlayer = game.players.find(
    (candidate) => candidate.id === playerId,
  );
  if (!durakPlayer || durakPlayer.eliminated) return "";
  if (game.phase === "attack")
    return game.attackerId === playerId ? `${game.id}:attack` : "";
  if (game.phase === "defense")
    return game.defenderId === playerId ? `${game.id}:defense` : "";
  if (game.phase !== "throw-in") return "";
  const defenderIndex = game.players.findIndex(
    (candidate) => candidate.id === game.defenderId,
  );
  const circular = [
    ...game.players.slice(defenderIndex + 1),
    ...game.players.slice(0, defenderIndex),
  ];
  const original = game.players.find(
    (candidate) => candidate.id === game.roundAttackerId,
  );
  const eligible = [
    original,
    ...circular.filter((candidate) => candidate.id !== original?.id),
  ].filter((candidate): candidate is NonNullable<typeof candidate> =>
    Boolean(
      candidate &&
        !candidate.eliminated &&
        candidate.id !== game.defenderId &&
        (candidate.handCount ?? candidate.hand.length) > 0,
    ),
  );
  return eligible.find(
    (candidate) => !game.passedPlayerIds.includes(candidate.id),
  )?.id === playerId
    ? `${game.id}:throw-in`
    : "";
}

async function playTurnCue(contextRef: {
  current: AudioContext | undefined;
}): Promise<void> {
  try {
    const context =
      contextRef.current?.state === "closed"
        ? new AudioContext()
        : (contextRef.current ?? new AudioContext());
    contextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const now = context.currentTime;
    for (const [index, frequency] of [659.25, 880].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startsAt = now + index * 0.11;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startsAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.19);
    }
  } catch {
    /* Browsers may block audio until the first user interaction. */
  }
}

export function App() {
  const { t, i18n } = useTranslation();
  const legalPage = (
    { "/impressum": "imprint", "/datenschutz": "privacy" } as Record<
      string,
      LegalPageKind | undefined
    >
  )[location.pathname.replace(/\/$/, "") || "/"];
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [lobby, setLobby] = useState<PublicLobby>();
  const [playerId, setPlayerId] = useState("");
  const [connected, setConnected] = useState(socket.connected);
  const [hasConnected, setHasConnected] = useState(socket.connected);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState("");
  const [warning, setWarning] = useState<number>();
  const [events, setEvents] = useState<StructuredEvent[]>([]);
  const [retainedLobby, setRetainedLobby] = useState<RetainedLobby | undefined>(
    loadRetainedLobby,
  );
  const [incomingTransferCode, setIncomingTransferCode] = useState(
    initialDeviceTransferCode,
  );
  const [deviceTransferMode, setDeviceTransferMode] = useState<
    "send" | "receive" | undefined
  >(() =>
    initialDeviceTransferCode && !retainedLobby ? "receive" : undefined,
  );
  const [restoringSession, setRestoringSession] = useState(() => {
    const code = invitationCode();
    return Boolean(code && localStorage.getItem(sessionKey(code)));
  });
  const [prefs, setPrefs] = useState(loadPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selectedRommeVariant, setSelectedRommeVariant] = useState<
    RommeRules["variant"] | undefined
  >();
  const [historyOpen, setHistoryOpen] = useState(false);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const previousActionCue = useRef("");

  const announce = useCallback(
    (message: string) => {
      setNotice(message);
      if (!prefs.speech || !("speechSynthesis" in window)) return;
      const speechText = message.replace(/\b(\d{1,2})\.(?=\s|$)/g, "$1,");
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = i18n.language;
      utterance.rate = prefs.rate;
      utterance.volume = prefs.volume;
      speechSynthesis.speak(utterance);
    },
    [i18n.language, prefs],
  );
  const lobbyRef = useRef<PublicLobby | undefined>(lobby);
  const announceRef = useRef(announce);
  const translateRef = useRef(t);
  useEffect(() => {
    lobbyRef.current = lobby;
    announceRef.current = announce;
    translateRef.current = t;
  }, [lobby, announce, t]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.accent = prefs.accent;
    root.dataset.cardDesign = prefs.cardDesign;
    root.style.setProperty("--card-rank-scale", String(prefs.cardRankScale));
    root.style.setProperty("--card-suit-scale", String(prefs.cardSuitScale));
    root.classList.toggle("large-text", prefs.largeText);
    root.classList.toggle("high-contrast", prefs.highContrast);
    root.classList.toggle("reduce-motion", prefs.reducedMotion);
    localStorage.setItem(storageKeys.preferences, JSON.stringify(prefs));
    localStorage.setItem(storageKeys.theme, prefs.theme);
    if (prefs.accent === "custom") {
      const color = validHexColor(prefs.customAccent)
        ? prefs.customAccent
        : defaultPreferences.customAccent;
      const [red, green, blue] = hexColorParts(color);
      root.style.setProperty("--accent", color);
      root.style.setProperty("--accent-rgb", `${red} ${green} ${blue}`);
      root.style.setProperty(
        "--accent-2",
        `color-mix(in srgb, ${color} 20%, var(--surface))`,
      );
      root.style.setProperty(
        "--accent-contrast",
        (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#000" : "#fff",
      );
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-rgb");
      root.style.removeProperty("--accent-2");
      root.style.removeProperty("--accent-contrast");
    }
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    probe.hidden = true;
    document.body.append(probe);
    const resolvedAccent = getComputedStyle(probe).color;
    probe.remove();
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", resolvedAccent);
  }, [prefs]);
  useEffect(() => {
    if (!prefs.speech && "speechSynthesis" in window) speechSynthesis.cancel();
  }, [prefs.speech]);
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setHasConnected(true);
      const currentLobby = lobbyRef.current;
      const code = currentLobby?.code ?? invitationCode();
      if (code) {
        const token = localStorage.getItem(sessionKey(code));
        if (token)
          socket.emit("lobby:resume", { code, token }, (result) => {
            if (!result.ok) {
              if (lobbyRef.current) setError(result.error ?? "unknown_error");
              setRestoringSession(false);
            } else if (result.playerId) setPlayerId(result.playerId);
          });
      }
      socket.emit("lobby:list", setLobbies);
    };
    const onDisconnect = () => setConnected(false);
    const onState = (state: PublicLobby) => {
      const retained = {
        code: state.code,
        gameId: state.gameId,
        status: state.status,
      } as const;
      localStorage.setItem(retainedLobbyStorageKey, JSON.stringify(retained));
      setRetainedLobby(retained);
      setLobby(state);
      setEvents(state.events);
      setSelectedRommeVariant(
        state.gameId === "romme" ? state.rommeRules?.variant : undefined,
      );
      setRestoringSession(false);
    };
    const onClosed = ({ reason }: { reason: string }) => {
      const currentLobby = lobbyRef.current;
      if (currentLobby) localStorage.removeItem(sessionKey(currentLobby.code));
      localStorage.removeItem(retainedLobbyStorageKey);
      setRetainedLobby(undefined);
      setLobby(undefined);
      setSelectedRommeVariant(undefined);
      setRestoringSession(false);
      setPlayerId("");
      setWarning(undefined);
      setError(reason === "inactive" ? "lobby_not_found" : "");
      announceRef.current(translateRef.current("closed"));
      history.replaceState({}, "", location.pathname);
    };
    const onEvent = (event: StructuredEvent) => {
      setEvents((old) => [...old.slice(-99), event]);
      if (event.type === "player.left") {
        const effect = String(event.data.gameEffect ?? "none");
        const message = translateRef.current(`playerLeftNotice_${effect}`, {
          name: String(event.data.name ?? ""),
        });
        setInfo(message);
        announceRef.current(message);
      }
    };
    const onTransferred = () => {
      const currentLobby = lobbyRef.current;
      if (currentLobby) localStorage.removeItem(sessionKey(currentLobby.code));
      localStorage.removeItem(retainedLobbyStorageKey);
      setRetainedLobby(undefined);
      setLobby(undefined);
      setPlayerId("");
      setEvents([]);
      setWarning(undefined);
      setHistoryOpen(false);
      setSelectedRommeVariant(undefined);
      setDeviceTransferMode(undefined);
      history.replaceState({}, "", location.pathname);
      setInfo(translateRef.current("deviceTransferCompletedOldDevice"));
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lobby:list", setLobbies);
    socket.on("lobby:state", onState);
    socket.on("lobby:closed", onClosed);
    socket.on("lobby:warning", ({ closesAt }) => setWarning(closesAt));
    socket.on("game:event", onEvent);
    socket.on("session:transferred", onTransferred);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lobby:list", setLobbies);
      socket.off("lobby:state", onState);
      socket.off("lobby:closed", onClosed);
      socket.off("lobby:warning");
      socket.off("game:event", onEvent);
      socket.off("session:transferred", onTransferred);
    };
  }, []);

  useEffect(() => {
    if (!incomingTransferCode || lobby || deviceTransferMode) return;
    if (retainedLobby) {
      setError("transfer_requires_free_device");
      return;
    }
    setDeviceTransferMode("receive");
  }, [deviceTransferMode, incomingTransferCode, lobby, retainedLobby]);

  useEffect(() => {
    const code = lobby?.code;
    if (!code || !playerId) return;

    let lastConfirmation = 0;
    const confirmPresence = () => {
      if (document.visibilityState === "hidden") return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      const now = Date.now();
      if (now - lastConfirmation < 5_000) return;
      lastConfirmation = now;
      socket.emit("presence:active", (result) => {
        if (result.ok || result.error !== "not_in_lobby") return;
        const token = localStorage.getItem(sessionKey(code));
        if (!token) return;
        socket.emit("lobby:resume", { code, token }, (resumeResult) => {
          if (resumeResult.ok && resumeResult.playerId) {
            setPlayerId(resumeResult.playerId);
          }
        });
      });
    };
    const confirmWhenVisible = () => {
      if (document.visibilityState === "visible") confirmPresence();
    };

    window.addEventListener("focus", confirmPresence);
    window.addEventListener("online", confirmPresence);
    document.addEventListener("visibilitychange", confirmWhenVisible);
    document.addEventListener("pointerdown", confirmPresence, true);
    document.addEventListener("keydown", confirmPresence, true);
    const interval = window.setInterval(confirmPresence, 25_000);
    confirmPresence();

    return () => {
      window.removeEventListener("focus", confirmPresence);
      window.removeEventListener("online", confirmPresence);
      document.removeEventListener("visibilitychange", confirmWhenVisible);
      document.removeEventListener("pointerdown", confirmPresence, true);
      document.removeEventListener("keydown", confirmPresence, true);
      window.clearInterval(interval);
    };
  }, [lobby?.code, playerId]);

  const forgetRetainedLobby = (code: string) => {
    localStorage.removeItem(sessionKey(code));
    localStorage.removeItem(retainedLobbyStorageKey);
    setRetainedLobby(undefined);
  };
  const remember = (result: Ack) => {
    if (result.ok && result.code && result.token) {
      localStorage.setItem(sessionKey(result.code), result.token);
      setPlayerId(result.playerId ?? "");
      history.replaceState({}, "", `?lobby=${result.code}`);
    } else setError(result.error ?? "unknown_error");
  };
  const command = (
    event:
      | "game:start"
      | "game:restart"
      | "lobby:detach"
      | "lobby:close"
      | "lobby:keepalive",
  ) =>
    socket.emit(event, (result) => {
      if (!result.ok) setError(result.error ?? "unknown_error");
      else if (event === "lobby:detach") {
        setLobby(undefined);
        setPlayerId("");
        setWarning(undefined);
        setInfo(t("seatRetainedNotice"));
        history.replaceState({}, "", location.pathname);
      }
    });
  const resumeRetainedLobby = () => {
    if (!retainedLobby) return;
    const token = localStorage.getItem(sessionKey(retainedLobby.code));
    if (!token) {
      forgetRetainedLobby(retainedLobby.code);
      setError("invalid_session");
      return;
    }
    setRestoringSession(true);
    socket.emit(
      "lobby:resume",
      { code: retainedLobby.code, token },
      (result) => {
        if (!result.ok) {
          setRestoringSession(false);
          if (
            result.error === "lobby_not_found" ||
            result.error === "invalid_session"
          )
            forgetRetainedLobby(retainedLobby.code);
          setError(result.error ?? "unknown_error");
          return;
        }
        setPlayerId(result.playerId ?? "");
        history.replaceState({}, "", `?lobby=${retainedLobby.code}`);
      },
    );
  };
  const permanentlyLeaveRetainedLobby = () => {
    if (!retainedLobby || !confirm(t("confirmPermanentLeave"))) return;
    const token = localStorage.getItem(sessionKey(retainedLobby.code));
    if (!token) {
      forgetRetainedLobby(retainedLobby.code);
      return;
    }
    socket.emit(
      "lobby:leave",
      { code: retainedLobby.code, token },
      (result) => {
        if (!result.ok && result.error !== "lobby_not_found") {
          setError(result.error ?? "unknown_error");
          return;
        }
        forgetRetainedLobby(retainedLobby.code);
        setInfo(t("permanentlyLeftNotice"));
      },
    );
  };
  const game = lobby?.game as AnyGameView | undefined;
  const { protocolEntries, protocolOpen, setProtocolOpen } = useGameProtocol({
    lobby,
    game,
    playerId,
    events,
    announce,
  });
  useEffect(() => {
    if (!prefs.turnSound || audioContext.current?.state === "running") return;
    const unlock = () => {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      void context.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [prefs.turnSound]);
  useEffect(() => {
    const cue = actionCueKey(game, playerId);
    const previous = previousActionCue.current;
    previousActionCue.current = cue;
    if (prefs.turnSound && cue && cue !== previous)
      void playTurnCue(audioContext);
  }, [game, playerId, prefs.turnSound]);
  const showButtonFeedback = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>(
      "button, .paypal-button",
    );
    if (!target || target.matches(":disabled")) return;
    target.classList.remove("button-pressed");
    void target.offsetWidth;
    target.classList.add("button-pressed");
    window.setTimeout(() => target.classList.remove("button-pressed"), 420);
  };

  return (
    <div
      className={`app ${prefs.largeCards ? "large-cards" : ""}`}
      onClickCapture={showButtonFeedback}
    >
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="Collection52"
          onClick={(e) => {
            if (lobby && !legalPage) e.preventDefault();
          }}
        >
          <span className="brand-word">Collection</span>
          <span className="brand-card" aria-hidden="true">
            52
          </span>
        </a>
        <div className="header-actions">
          <label className="header-select">
            <span>{t("theme")}</span>
            <ResponsiveSelect
              label={t("theme")}
              value={prefs.theme}
              onChange={(value) =>
                setPrefs({ ...prefs, theme: value as Preferences["theme"] })
              }
              options={[
                { value: "system", label: t("themeSystem") },
                { value: "light", label: t("themeLight") },
                { value: "dark", label: t("themeDark") },
              ]}
            />
          </label>
          <label className="header-select">
            <span>{t("language")}</span>
            <ResponsiveSelect
              label={t("language")}
              value={i18n.language}
              onChange={(value) => void i18n.changeLanguage(value)}
              options={[
                { value: "de", label: "DE" },
                { value: "en", label: "EN" },
              ]}
            />
          </label>
          <button
            className="secondary"
            aria-label={t("settings")}
            onClick={() => setSettingsOpen(true)}
          >
            {t("settings")}
          </button>
        </div>
      </header>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
      {hasConnected && !connected && (
        <div className="banner warning" role="status">
          {t("connectionDisconnected")}
        </div>
      )}
      {error && (
        <TopLayerMessage className="floating-error" role="alert">
          <span className="floating-error-icon" aria-hidden="true">
            !
          </span>
          <span className="floating-error-message">
            {t("error", {
              message: t(`errors.${error}`, { defaultValue: error }),
            })}
          </span>
          <button
            className="floating-error-close"
            type="button"
            aria-label={t("dismiss")}
            onClick={() => setError("")}
          >
            <span aria-hidden="true" />
          </button>
        </TopLayerMessage>
      )}
      {info && (
        <TopLayerMessage className="floating-notice" role="status">
          <span className="floating-notice-icon" aria-hidden="true">
            ✓
          </span>
          <span>{info}</span>
          <button
            className="floating-error-close"
            type="button"
            aria-label={t("dismiss")}
            onClick={() => setInfo("")}
          >
            <span aria-hidden="true" />
          </button>
        </TopLayerMessage>
      )}
      {warning && lobby && (
        <div className="banner warning" role="alert">
          <span>
            {t("inactiveWarning", {
              time: new Date(warning).toLocaleTimeString(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
          <button onClick={() => command("lobby:keepalive")}>
            {t("keepAlive")}
          </button>
        </div>
      )}
      <main id="main">
        {legalPage ? (
          <Suspense fallback={<p className="legal-loading">{t("loading")}</p>}>
            <LegalPage kind={legalPage} />
          </Suspense>
        ) : restoringSession ? (
          <p className="legal-loading" role="status" aria-live="polite">
            {t("loading")}
          </p>
        ) : lobby ? (
          <Suspense fallback={<p className="legal-loading">{t("loading")}</p>}>
            <LobbyView
              lobby={lobby}
              playerId={playerId}
              game={game}
              events={events}
              historyOpen={historyOpen}
              setHistoryOpen={setHistoryOpen}
              protocolEntries={protocolEntries}
              protocolOpen={protocolOpen}
              setProtocolOpen={setProtocolOpen}
              setError={setError}
              setSelectedRommeVariant={setSelectedRommeVariant}
              command={command}
              announce={announce}
              openDeviceTransfer={() => setDeviceTransferMode("send")}
            />
          </Suspense>
        ) : (
          <Home
            lobbies={lobbies}
            remember={remember}
            retainedLobby={retainedLobby}
            resumeRetainedLobby={resumeRetainedLobby}
            permanentlyLeaveRetainedLobby={permanentlyLeaveRetainedLobby}
            openDeviceTransfer={() => setDeviceTransferMode("receive")}
          />
        )}
      </main>
      <Footer
        inLobby={Boolean(lobby && !legalPage)}
        openRules={() => setRulesOpen(true)}
      />
      {settingsOpen && (
        <SettingsDialog
          prefs={prefs}
          setPrefs={setPrefs}
          close={() => setSettingsOpen(false)}
          language={i18n.language}
          setLanguage={(lng) => void i18n.changeLanguage(lng)}
        />
      )}
      {rulesOpen && (
        <Dialog
          title={t(
            lobby?.gameId === "schwimmen"
              ? "knackRulesTitle"
              : lobby?.gameId === "mau-mau"
                ? "mauMauRulesTitle"
                : lobby?.gameId === "romme"
                  ? "rommeRulesTitle"
                  : "rulesTitle",
          )}
          close={() => setRulesOpen(false)}
        >
          <Suspense fallback={<p className="legal-loading">{t("loading")}</p>}>
            <RulesContent
              key={`romme-rules-${selectedRommeVariant ?? "classic"}`}
              gameId={lobby?.gameId ?? "durak"}
              rommeVariant={selectedRommeVariant ?? lobby?.rommeRules?.variant}
            />
          </Suspense>
        </Dialog>
      )}
      {deviceTransferMode && (
        <Suspense fallback={null}>
          <DeviceTransferDialog
            mode={deviceTransferMode}
            initialCode={
              deviceTransferMode === "receive" ? incomingTransferCode : ""
            }
            close={() => {
              setDeviceTransferMode(undefined);
              setIncomingTransferCode("");
              const url = new URL(location.href);
              url.searchParams.delete("transfer");
              history.replaceState(
                {},
                "",
                `${url.pathname}${url.search}${url.hash}`,
              );
            }}
            onClaimed={(result) => {
              if (!result.code || !result.token || !result.playerId) {
                setError("unknown_error");
                return;
              }
              setRestoringSession(true);
              localStorage.setItem(sessionKey(result.code), result.token);
              if (result.playerName)
                localStorage.setItem(storageKeys.playerName, result.playerName);
              setPlayerId(result.playerId);
              setIncomingTransferCode("");
              setDeviceTransferMode(undefined);
              history.replaceState({}, "", `?lobby=${result.code}`);
            }}
            announce={announce}
          />
        </Suspense>
      )}
    </div>
  );
}
