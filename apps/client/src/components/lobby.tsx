import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { PublicLobby, StructuredEvent } from "@collection52/shared";
import { eventTranslationKey, technicalEventTypes } from "../client-config";
import type {
  AnyGameView,
  DurakGameView,
  MauMauGameView,
  ProtocolEntry,
  RommeGameView,
  SchwimmenGameView,
} from "../models";
import { socket } from "../socket";
import { useConfirmation, useConfirmationChoice } from "./confirmation-dialog";
import {
  DurakBoard,
  MauMauBoard,
  RommeBoard,
  SchwimmenBoard,
  SchwimmenRoundResultPanel,
} from "./game-boards";

function avatarColorStyle(color: string): CSSProperties {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : "#0f745d";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return {
    "--player-accent": normalized,
    "--player-accent-contrast": brightness > 155 ? "#07110e" : "#ffffff",
  } as CSSProperties;
}
import { LobbySettings } from "./lobby-settings";

export function LobbyView({
  lobby,
  playerId,
  game,
  events,
  historyOpen,
  setHistoryOpen,
  protocolEntries,
  protocolOpen,
  setProtocolOpen,
  setError,
  setSelectedRommeVariant,
  command,
  announce,
  openDeviceTransfer,
  permanentlyLeave,
}: {
  lobby: PublicLobby;
  playerId: string;
  game: AnyGameView | undefined;
  events: StructuredEvent[];
  historyOpen: boolean;
  setHistoryOpen: (v: boolean) => void;
  protocolEntries: ProtocolEntry[];
  protocolOpen: boolean;
  setProtocolOpen: (v: boolean) => void;
  setError: (v: string) => void;
  setSelectedRommeVariant: (variant: "classic" | "gin") => void;
  command: (
    event:
      | "game:start"
      | "game:restart"
      | "lobby:detach"
      | "lobby:close"
      | "lobby:keepalive",
  ) => void;
  announce: (s: string) => void;
  openDeviceTransfer: () => void;
  permanentlyLeave: () => void;
}) {
  const { t } = useTranslation();
  const confirmAction = useConfirmation();
  const chooseAction = useConfirmationChoice();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [copiedAction, setCopiedAction] = useState<"code" | "link" | null>(
    null,
  );
  const copyFeedbackTimer = useRef<number | undefined>(undefined);
  const isHost = lobby.hostId === playerId;
  const me = game?.players.find((p) => p.id === playerId);
  const enoughPlayers = lobby.players.length >= 2;
  const everyoneConnected = lobby.players.every((player) => player.connected);
  const canStart = enoughPlayers && everyoneConnected;
  const protocolList = useRef<HTMLOListElement>(null);
  const protocolPinnedToBottom = useRef(true);
  const technicalEvents = events.filter((event) =>
    technicalEventTypes.has(event.type),
  );
  useEffect(() => {
    if (!protocolOpen || !protocolPinnedToBottom.current) return;
    const list = protocolList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [protocolEntries, protocolOpen]);
  useEffect(
    () => () => {
      if (copyFeedbackTimer.current !== undefined) {
        window.clearTimeout(copyFeedbackTimer.current);
      }
    },
    [],
  );
  const sendAction = (action: object) =>
    socket.emit(
      "game:action",
      { action, expectedVersion: game?.version },
      (result) => {
        if (!result.ok) setError(result.error ?? "unknown_error");
        else {
          setSelected([]);
          setTarget("");
        }
      },
    );
  const copy = async (
    text: string,
    message: string,
    action: "code" | "link",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(action);
      if (copyFeedbackTimer.current !== undefined) {
        window.clearTimeout(copyFeedbackTimer.current);
      }
      copyFeedbackTimer.current = window.setTimeout(() => {
        setCopiedAction(null);
        copyFeedbackTimer.current = undefined;
      }, 3000);
      announce(message);
    } catch {
      setError("clipboard_unavailable");
    }
  };
  const link = `${location.origin}${location.pathname}?lobby=${lobby.code}`;
  const displayedGameName =
    lobby.gameId === "romme"
      ? t(
          lobby.rommeRules?.variant === "gin"
            ? "rommeVariantGin"
            : "rommeVariantClassic",
        )
      : t(lobby.gameId);

  return (
    <>
      <section
        className={`lobby-heading ${game ? "in-game" : "waiting-compact"}`}
      >
        {game ? (
          <div
            className="game-context"
            aria-label={t("lobby", { code: lobby.code })}
          >
            <div className="game-identity">
              <span className="game-identity-label">{t("currentGame")}</span>
              <h1 className="game-context-name">{displayedGameName}</h1>
            </div>
            <span>
              {t(
                lobby.gameId === "romme"
                  ? lobby.rommeRules?.variant === "gin"
                    ? "cards52"
                    : "rommeCards110"
                  : lobby.deckSize === 32
                    ? "cards32"
                    : lobby.deckSize === 36
                      ? "cards36"
                      : "cards52",
              )}
            </span>
            <span className="game-context-code">
              {t("lobby", { code: lobby.code })}
            </span>
            <button
              className="game-context-transfer"
              type="button"
              aria-label={t("deviceTransferButton")}
              onClick={openDeviceTransfer}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="8" height="14" rx="2" />
                <rect x="13" y="7" width="8" height="14" rx="2" />
                <path d="m9 12 2-2 2 2M15 12l-2 2-2-2" />
              </svg>
              <span className="game-context-transfer-label">
                {t("deviceTransferButton")}
              </span>
            </button>
          </div>
        ) : (
          <>
            <div className="lobby-context">
              <div className="game-identity">
                <span className="game-identity-label">{t("currentGame")}</span>
                <h1 className="lobby-context-game">{displayedGameName}</h1>
              </div>
              <span>
                {t(
                  lobby.gameId === "romme"
                    ? lobby.rommeRules?.variant === "gin"
                      ? "cards52"
                      : "rommeCards110"
                    : lobby.deckSize === 32
                      ? "cards32"
                      : lobby.deckSize === 36
                        ? "cards36"
                        : "cards52",
                )}
              </span>
              <span className="game-context-code">
                {t("lobby", { code: lobby.code })}
              </span>
            </div>
            <div className="share-block">
              <div className="share-actions">
                <button
                  className={copiedAction === "code" ? "copy-success" : ""}
                  aria-label={t("copyCode")}
                  onClick={() => void copy(lobby.code, t("codeCopied"), "code")}
                >
                  <span aria-hidden="true">
                    {copiedAction === "code"
                      ? `✓ ${t("copied")}`
                      : t("copyCode")}
                  </span>
                </button>
                <button
                  className={copiedAction === "link" ? "copy-success" : ""}
                  aria-label={t("copyLink")}
                  onClick={() => void copy(link, t("linkCopied"), "link")}
                >
                  <span aria-hidden="true">
                    {copiedAction === "link"
                      ? `✓ ${t("copied")}`
                      : t("copyLink")}
                  </span>
                </button>
                {"share" in navigator && (
                  <button
                    onClick={() =>
                      void navigator.share({ title: "Collection52", url: link })
                    }
                  >
                    {t("share")}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <section
        className="players panel compact"
        aria-labelledby="players-title"
      >
        <h2 id="players-title">{t("playerList")}</h2>
        <ul>
          {lobby.players.map((p) => {
            const gamePlayer = game?.players.find(
              (player) => player.id === p.id,
            );
            const handCount = gamePlayer
              ? (gamePlayer.handCount ?? gamePlayer.hand.length)
              : undefined;
            const knackPlayer =
              lobby.gameId === "schwimmen"
                ? (gamePlayer as
                    | SchwimmenGameView["players"][number]
                    | undefined)
                : undefined;
            const lifeDetail = knackPlayer
              ? knackPlayer.eliminated
                ? t("knackEliminated")
                : knackPlayer.swimming
                  ? t("knackSwimming")
                  : t("knackLives", { count: knackPlayer.lives })
              : "";
            const visibleDetailParts = [
              handCount !== undefined && lobby.gameId !== "schwimmen"
                ? t("handCardsCount", { count: handCount })
                : "",
              lifeDetail,
            ].filter(Boolean);
            const accessibleDetailParts = [
              ...visibleDetailParts,
              p.isHost ? t("host") : "",
            ].filter(Boolean);
            const details = visibleDetailParts.join(" · ");
            const canKick = isHost && p.id !== playerId;
            return (
              <li
                key={p.id}
                className={[
                  knackPlayer?.eliminated ? "eliminated" : "",
                  canKick ? "kickable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={[p.name, ...accessibleDetailParts].join(", ")}
              >
                <span className="player-avatar-wrap" aria-hidden="true">
                  <span
                    className="avatar"
                    style={avatarColorStyle(p.accentColor)}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  {p.isHost && (
                    <span className="player-host-mark">
                      <svg viewBox="0 0 16 16">
                        <path d="m2.25 4.5 3.1 2.55L8 2.75l2.65 4.3 3.1-2.55-1.2 7H3.45l-1.2-7Z" />
                        <path d="M3.7 13h8.6" />
                      </svg>
                    </span>
                  )}
                  <i
                    className={`player-presence ${p.connected ? "online" : p.detached ? "away" : "offline"}`}
                  />
                </span>
                <span aria-hidden="true">
                  <strong>{p.name}</strong>
                  {details && <small>{details}</small>}
                </span>
                {canKick && (
                  <button
                    className="player-kick"
                    type="button"
                    aria-label={t("kickPlayerLabel", { name: p.name })}
                    title={t("kickPlayerLabel", { name: p.name })}
                    onClick={async () => {
                      const confirmed = await confirmAction({
                        title: t("kickPlayerLabel", { name: p.name }),
                        message: t("confirmKickPlayer", { name: p.name }),
                        confirmLabel: t("kickPlayer"),
                        tone: "danger",
                      });
                      if (!confirmed) return;
                      socket.emit(
                        "lobby:kick",
                        { playerId: p.id },
                        (result) => {
                          if (!result.ok)
                            setError(result.error ?? "unknown_error");
                        },
                      );
                    }}
                  >
                    {t("kickPlayer")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {isHost && !game && (
        <LobbySettings
          lobby={lobby}
          setError={setError}
          setSelectedRommeVariant={setSelectedRommeVariant}
        />
      )}
      {!game ? (
        <section className="waiting-room panel">
          <h2>{t("waiting")}</h2>
          <p>
            {t("playersCount", {
              count: lobby.playerCount,
              max: lobby.maxPlayers,
            })}
          </p>
          {isHost && (
            <>
              <button
                className="primary"
                disabled={!canStart}
                aria-describedby={
                  !canStart ? "start-game-requirement" : undefined
                }
                onClick={() => command("game:start")}
              >
                {t("startGame")}
              </button>
              {!canStart && (
                <p
                  id="start-game-requirement"
                  className="action-hint"
                  role="status"
                >
                  {t(
                    !enoughPlayers
                      ? "startNeedsPlayers"
                      : "startNeedsConnections",
                  )}
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <>
          {lobby.gameId === "schwimmen" ? (
            <SchwimmenBoard
              game={game as SchwimmenGameView}
              playerId={playerId}
              selected={selected}
              setSelected={setSelected}
              target={target}
              setTarget={setTarget}
              sendAction={sendAction}
            />
          ) : lobby.gameId === "mau-mau" ? (
            <MauMauBoard
              game={game as MauMauGameView}
              playerId={playerId}
              selected={selected}
              setSelected={setSelected}
              sendAction={sendAction}
            />
          ) : lobby.gameId === "romme" ? (
            <RommeBoard
              game={game as RommeGameView}
              playerId={playerId}
              selected={selected}
              setSelected={setSelected}
              sendAction={sendAction}
            />
          ) : (
            <DurakBoard
              game={game as DurakGameView}
              me={me as DurakGameView["players"][number] | undefined}
              playerId={playerId}
              selected={selected}
              setSelected={setSelected}
              target={target}
              setTarget={setTarget}
              sendAction={sendAction}
            />
          )}
          {lobby.gameId === "schwimmen" && (
            <SchwimmenRoundResultPanel
              game={game as SchwimmenGameView}
              sendAction={sendAction}
            />
          )}
          <section className="narration-log panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("automaticNarration")}</p>
                <h2>{t("gameProtocol")}</h2>
              </div>
              <button
                onClick={() => setProtocolOpen(!protocolOpen)}
                aria-expanded={protocolOpen}
              >
                {t(protocolOpen ? "hideProtocol" : "showProtocol")}
              </button>
            </div>
            {protocolOpen &&
              (protocolEntries.length ? (
                <ol
                  ref={protocolList}
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    protocolPinnedToBottom.current =
                      list.scrollHeight - list.scrollTop - list.clientHeight <=
                      8;
                  }}
                >
                  {protocolEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className={entry.private ? "private-entry" : undefined}
                    >
                      <time>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </time>
                      <span>
                        {entry.private && (
                          <small className="protocol-private-badge">
                            {t("privateProtocol")}
                          </small>
                        )}
                        {entry.text}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("noProtocol")}</p>
              ))}
          </section>
        </>
      )}
      <section className="utility panel">
        <div className="button-row">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            {t(historyOpen ? "hideTechnicalLog" : "showTechnicalLog")}
          </button>
        </div>
        {historyOpen && (
          <div>
            <h2>{t("technicalLog")}</h2>
            {technicalEvents.length ? (
              <ol className="history">
                {technicalEvents.map((e) => (
                  <li key={e.id}>
                    {new Date(e.timestamp).toLocaleTimeString()} ·{" "}
                    {t(eventTranslationKey(e.type), {
                      name:
                        lobby.players.find((p) => p.id === e.actorId)?.name ??
                        String(e.data.name ?? ""),
                      defaultValue: e.type,
                    })}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{t("noTechnicalLog")}</p>
            )}
          </div>
        )}
      </section>
      <section className="danger-zone panel">
        <div className="button-row">
          {isHost && game && (
            <button
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: t("restartGame"),
                  message: t("confirmRestart"),
                  confirmLabel: t("restartGame"),
                  tone: "danger",
                });
                if (confirmed) command("game:restart");
              }}
            >
              {t("restartGame")}
            </button>
          )}{" "}
          {!isHost && (
            <button
              onClick={async () => {
                const choice = await chooseAction({
                  title: t("leaveLobby"),
                  message: t("confirmTemporaryLeave"),
                  confirmLabel: t("returnToHome"),
                  alternativeLabel: t("leavePermanently"),
                  alternativeTone: "danger",
                });
                if (choice === "confirm") command("lobby:detach");
                if (choice === "alternative") permanentlyLeave();
              }}
            >
              {t("returnToHome")}
            </button>
          )}{" "}
          {isHost && (
            <button
              className="danger"
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: t("closeLobby"),
                  message: t("confirmClose"),
                  confirmLabel: t("closeLobby"),
                  tone: "danger",
                });
                if (confirmed) command("lobby:close");
              }}
            >
              {t("closeLobby")}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
