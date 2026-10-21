import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  scoreKnackHand,
  type Card,
  type KnackRoundResult,
} from "@collection52/shared";
import type { SchwimmenGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
  useNewHandCards,
} from "./cards";

export function SchwimmenRoundResultPanel({
  game,
  sendAction,
}: {
  game: SchwimmenGameView;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const panel = useRef<HTMLElement>(null);
  const scrolledResult = useRef("");
  const roundResult = game.roundResult ?? game.lastRoundResult;
  useEffect(() => {
    if (!game.roundResult) return;
    const resultKey = `${game.id}:${game.roundNumber}:${game.roundResult.reason}`;
    if (scrolledResult.current === resultKey) return;
    scrolledResult.current = resultKey;
    const frame = window.requestAnimationFrame(() =>
      panel.current?.scrollIntoView({
        behavior:
          document.documentElement.classList.contains("reduce-motion") ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        block: "center",
      }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [game.id, game.roundNumber, game.roundResult]);
  if (!roundResult) return null;
  const playerName = (id: string) =>
    game.players.find((player) => player.id === id)?.name ?? "";
  const scoreText = (score: KnackRoundResult["scores"][number]) =>
    score.label === "fire"
      ? t("knackFire")
      : score.label === "thirty-one"
        ? t("knackThirtyOne")
        : t("knackPoints", { score: String(score.score).replace(".", ",") });
  const title =
    game.phase === "finished"
      ? t("knackGameOver")
      : t(game.roundResult ? "knackRoundResult" : "knackLastRoundResult");
  return (
    <section
      ref={panel}
      className="result panel knack-round-result"
      role="status"
    >
      <div>
        <p className="eyebrow">{t(`knackReason_${roundResult.reason}`)}</p>
        <h2>{title}</h2>
      </div>
      <ol>
        {[...roundResult.scores]
          .sort((left, right) => right.score - left.score)
          .map((score) => (
            <li
              key={score.playerId}
              className={
                roundResult.loserIds.includes(score.playerId) ? "lost-life" : ""
              }
            >
              <strong>{playerName(score.playerId)}</strong>
              <span>{scoreText(score)}</span>
              {roundResult.loserIds.includes(score.playerId) && (
                <small>{t("knackLifeLost")}</small>
              )}
            </li>
          ))}
      </ol>
      {game.phase === "round-ended" && game.roundResult && (
        <button
          className="primary"
          onClick={() => sendAction({ type: "schwimmen:next-round" })}
        >
          {t("knackNextRound")}
        </button>
      )}
      {game.phase === "finished" && (
        <p className="knack-winner">
          {t("knackWinner", { name: playerName(game.result?.winnerId ?? "") })}
        </p>
      )}
    </section>
  );
}

export function SchwimmenBoard({
  game,
  playerId,
  selected,
  setSelected,
  target,
  setTarget,
  sendAction,
}: {
  game: SchwimmenGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  target: string;
  setTarget: (value: string) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const me = game.players.find((player) => player.id === playerId);
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const playerName = (id?: string) =>
    game.players.find((player) => player.id === id)?.name ?? "";
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const canAct =
    game.phase === "playing" &&
    current?.id === playerId &&
    Boolean(me?.connected && !me.eliminated);
  const selectedCard = me?.hand.find((card) => card.id === selected[0]);
  const centerCard = game.center.find((card) => card.id === target);
  const ownScore = me?.hand.length === 3 ? scoreKnackHand(me.hand) : undefined;
  return (
    <section
      className="game-board knack-board"
      aria-labelledby="knack-game-title"
    >
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="knack-game-title">{t(`knackPhase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("knackRound")}</dt>
            <dd>{game.roundNumber}</dd>
          </div>
          <div>
            <dt>{t("turn")}</dt>
            <dd>
              {game.phase === "playing"
                ? playerName(game.currentPlayerId)
                : "–"}
            </dd>
          </div>
          <div>
            <dt>{t("knackStock")}</dt>
            <dd>{game.deckCount}</dd>
          </div>
          <div>
            <dt>{t("knackYourScore")}</dt>
            <dd>
              {ownScore === undefined
                ? "–"
                : ownScore === 32
                  ? t("knackFire")
                  : ownScore === 31
                    ? t("knackThirtyOne")
                    : String(ownScore).replace(".", ",")}
            </dd>
          </div>
          {game.closingPlayerId && (
            <div className="knack-closing">
              <dt>{t("knackKnocked")}</dt>
              <dd>{playerName(game.closingPlayerId)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="table panel knack-table">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("knackExchange")}</p>
            <h2>{t("knackCenter")}</h2>
          </div>
          <span
            className="knack-stock"
            aria-label={t("deck", { count: game.deckCount })}
          >
            🂠 × {game.deckCount}
          </span>
        </div>
        <div
          className="knack-center-cards"
          role="group"
          aria-label={t("knackCenter")}
        >
          {game.center.map((card, index) => (
            <button
              key={card.id}
              className={`playing-card ${target === card.id ? "selected" : ""}`}
              disabled={!canAct}
              aria-pressed={target === card.id}
              aria-label={t("knackCenterCard", {
                card: cardText(card),
                index: index + 1,
              })}
              onClick={() => setTarget(target === card.id ? "" : card.id)}
            >
              <CardFace card={card} />
            </button>
          ))}
        </div>
      </div>
      <div className="hand panel">
        <div className="section-heading hand-heading">
          <h2>{t("yourHand", { count: me?.hand.length ?? 0 })}</h2>
          <div className="hand-heading-tools">
            {ownScore !== undefined && (
              <span className="knack-score-badge">
                {t("knackScoreBadge", {
                  score:
                    ownScore === 32
                      ? t("knackFire")
                      : String(ownScore).replace(".", ","),
                })}
              </span>
            )}
            <HandSortControls
              settings={handSorting.settings}
              setMode={handSorting.setMode}
              setDirection={handSorting.setDirection}
            />
          </div>
        </div>
        <div
          className="hand-cards"
          role="group"
          aria-label={t("yourHand", { count: me?.hand.length ?? 0 })}
        >
          {handSorting.cards.map((card, index) => (
            <SortableHandCard
              key={card.id}
              cardId={card.id}
              moveCard={handSorting.moveCard}
              moveCardBy={handSorting.moveCardBy}
            >
              <button
                data-card-id={card.id}
                className={`playing-card ${selected[0] === card.id ? "selected" : ""} ${newCardIds.has(card.id) ? "newly-drawn" : ""}`}
                disabled={!canAct}
                aria-pressed={selected[0] === card.id}
                aria-label={t("handCard", {
                  card: cardText(card),
                  index: index + 1,
                  count: me?.hand.length ?? 0,
                  state: canAct ? t("playable") : t("notPlayable"),
                })}
                onClick={() =>
                  setSelected(selected[0] === card.id ? [] : [card.id])
                }
              >
                <CardFace card={card} />
              </button>
            </SortableHandCard>
          ))}
        </div>
      </div>
      {game.phase === "playing" && (
        <div className="actions panel">
          <h2>{t("actions")}</h2>
          <div className="button-row">
            <button
              className="primary"
              disabled={!canAct || !selectedCard || !centerCard}
              onClick={() =>
                sendAction({
                  type: "schwimmen:swap-one",
                  handCardId: selectedCard?.id,
                  centerCardId: centerCard?.id,
                })
              }
            >
              {t("knackSwapOne")}
            </button>
            <button
              disabled={!canAct}
              onClick={() => sendAction({ type: "schwimmen:swap-all" })}
            >
              {t("knackSwapAll")}
            </button>
            <button
              disabled={!canAct}
              onClick={() => sendAction({ type: "schwimmen:pass" })}
            >
              {t("knackPass")}
            </button>
            <button
              disabled={!canAct || Boolean(game.closingPlayerId)}
              onClick={() => sendAction({ type: "schwimmen:knock" })}
            >
              {t("knackKnock")}
            </button>
          </div>
          {!canAct && current && (
            <p className="action-hint">
              {t("knackWaitingFor", { name: current.name })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
