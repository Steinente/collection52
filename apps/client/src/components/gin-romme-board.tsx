import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { analyzeGinHand, type RommeCard } from "@collection52/shared";
import type { RommeGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
  useNewHandCards,
} from "./cards";

export function GinRommeBoard({
  game,
  playerId,
  selected,
  setSelected,
  sendAction,
}: {
  game: RommeGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const me = game.players.find((player) => player.id === playerId);
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const top = game.discard.at(-1);
  const canAct = game.phase === "playing" && game.currentPlayerId === playerId;
  const selectedCard = me?.hand.find((card) => card.id === selected[0]);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const analysis = analyzeGinHand(me?.hand ?? []);
  const afterDiscard = selectedCard
    ? analyzeGinHand(
        (me?.hand ?? []).filter((card) => card.id !== selectedCard.id),
      )
    : undefined;
  const name = (id?: string) =>
    game.players.find((player) => player.id === id)?.name ?? "–";
  const cardText = (card: RommeCard) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const opening = game.ginOpeningPasses !== undefined;
  const mayTakeDiscard = !opening || game.ginOpeningPasses! < 2;
  const mayDrawStock = !opening || game.ginOpeningPasses === 2;
  useEffect(() => {
    setSelected([]);
  }, [game.version]);
  const showCards = (cards: RommeCard[]) => (
    <div className="gin-result-cards">
      {cards.map((card) => (
        <span
          className="romme-table-card"
          key={card.id}
          aria-label={cardText(card)}
        >
          <CardFace card={card} />
        </span>
      ))}
    </div>
  );
  return (
    <section
      className="game-board romme-board gin-board"
      aria-labelledby="romme-title"
    >
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="romme-title">{t(`ginPhase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("ginRound")}</dt>
            <dd>{game.roundNumber}</dd>
          </div>
          <div>
            <dt>{t("turn")}</dt>
            <dd>
              {game.phase === "playing" ? name(game.currentPlayerId) : "–"}
            </dd>
          </div>
          <div>
            <dt>{t("rommeStock")}</dt>
            <dd>{game.deckCount}</dd>
          </div>
          <div>
            <dt>{t("ginDeadwood")}</dt>
            <dd>{t("ginPoints", { count: analysis.deadwoodPoints })}</dd>
          </div>
        </dl>
      </div>
      <div className="table panel romme-table gin-scoreboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("ginScore")}</p>
            <h2>{t("ginTarget", { count: game.rules.ginTargetScore })}</h2>
          </div>
        </div>
        <div className="gin-scores">
          {game.players.map((player) => (
            <div key={player.id}>
              <strong>{player.name}</strong>
              <span>
                {t("ginPoints", { count: game.scores?.[player.id] ?? 0 })}
              </span>
              {player.id === game.dealerId && <small>{t("ginDealer")}</small>}
            </div>
          ))}
        </div>
        {game.phase === "playing" && (
          <p className="action-hint">
            {opening
              ? t(
                  game.ginOpeningPasses === 2
                    ? "ginOpeningStockHint"
                    : "ginOpeningHint",
                )
              : t("ginMeldsStayHidden")}
          </p>
        )}
      </div>
      <div className="panel romme-discard">
        <div>
          <p className="eyebrow">{t("rommeDiscard")}</p>
          {top && (
            <span
              className={`romme-table-card ${game.discardCount > 1 ? "stacked" : ""}`}
              aria-label={cardText(top)}
            >
              <CardFace card={top} />
            </span>
          )}
        </div>
        <div className="button-row">
          <button
            className="primary"
            disabled={
              !canAct || game.hasDrawn || !mayDrawStock || game.deckCount <= 2
            }
            onClick={() => sendAction({ type: "romme:draw", source: "stock" })}
          >
            {t("rommeDrawStock")}
          </button>
          <button
            disabled={!canAct || game.hasDrawn || !top || !mayTakeDiscard}
            onClick={() =>
              sendAction({ type: "romme:draw", source: "discard" })
            }
          >
            {t("rommeTakeDiscard")}
          </button>
          {canAct && opening && game.ginOpeningPasses! < 2 && (
            <button onClick={() => sendAction({ type: "romme:pass-opening" })}>
              {t("ginPass")}
            </button>
          )}
        </div>
      </div>
      <div className="hand panel">
        <div className="section-heading hand-heading">
          <h2>{t("yourHand", { count: me?.hand.length ?? 0 })}</h2>
          <div className="hand-heading-tools">
            <HandSortControls
              settings={handSorting.settings}
              setMode={handSorting.setMode}
              setDirection={handSorting.setDirection}
            />
          </div>
        </div>
        <div className="hand-cards">
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
                disabled={!canAct || !game.hasDrawn}
                aria-pressed={selected[0] === card.id}
                aria-label={t("handCard", {
                  card: cardText(card),
                  index: index + 1,
                  count: me?.hand.length ?? 0,
                  state:
                    canAct && game.hasDrawn ? t("playable") : t("notPlayable"),
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
        {game.phase === "playing" && (
          <div className="gin-hand-summary">
            <span>{t("ginMeldCount", { count: analysis.melds.length })}</span>
            <span>
              {t("ginDeadwoodValue", { count: analysis.deadwoodPoints })}
            </span>
          </div>
        )}
      </div>
      {game.phase === "playing" && (
        <div className="actions panel romme-actions">
          <h2>{t("actions")}</h2>
          <div className="button-row">
            <button
              disabled={!canAct || !game.hasDrawn || !selectedCard}
              onClick={() =>
                selectedCard &&
                sendAction({ type: "romme:discard", cardId: selectedCard.id })
              }
            >
              {t("rommeDiscardCard")}
            </button>
            <button
              className="primary"
              disabled={
                !canAct ||
                !game.hasDrawn ||
                !selectedCard ||
                !afterDiscard ||
                afterDiscard.deadwoodPoints > 10
              }
              onClick={() =>
                selectedCard &&
                sendAction({ type: "romme:knock", cardId: selectedCard.id })
              }
            >
              {afterDiscard?.deadwoodPoints === 0
                ? t("ginDeclareGin")
                : t("ginKnock")}
            </button>
          </div>
          {selectedCard && afterDiscard && (
            <p className="action-hint">
              {t(
                afterDiscard.deadwoodPoints <= 10
                  ? "ginKnockReady"
                  : "ginKnockNotReady",
                { count: afterDiscard.deadwoodPoints },
              )}
            </p>
          )}
          {!canAct && current && (
            <p className="action-hint">
              {t("rommeWaitingFor", { name: current.name })}
            </p>
          )}
        </div>
      )}
      {game.roundResult && (
        <div className="result panel gin-round-result" role="status">
          <h2>
            {t(
              game.roundResult.reason === "stock"
                ? "ginStockRoundTitle"
                : "ginRoundResultTitle",
            )}
          </h2>
          <p>
            {game.roundResult.reason === "stock"
              ? t("ginStockRoundBody")
              : t(`ginResult_${game.roundResult.reason}`, {
                  winner: name(game.roundResult.winnerId),
                  knocker: name(game.roundResult.knockerId),
                  count: game.roundResult.pointsAwarded,
                })}
          </p>
          <div className="gin-reveals">
            {game.players.map((player) => {
              const result = game.roundResult!.analyses[player.id];
              return (
                <article key={player.id}>
                  <h3>
                    {player.name} ·{" "}
                    {t("ginDeadwoodValue", {
                      count: result?.deadwoodPoints ?? 0,
                    })}
                  </h3>
                  {result?.melds.map((meld, index) => (
                    <div key={index}>
                      <small>
                        {t(meld.kind === "set" ? "rommeSet" : "rommeRun")}
                      </small>
                      {showCards(meld.cards)}
                    </div>
                  ))}
                  {result?.deadwood.length ? (
                    <div>
                      <small>{t("ginDeadwood")}</small>
                      {showCards(result.deadwood)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          {game.phase === "round-ended" && (
            <button
              className="primary"
              onClick={() => sendAction({ type: "romme:next-round" })}
            >
              {t("ginNextRound")}
            </button>
          )}
          {game.phase === "finished" && (
            <p>
              {t("ginWinner", {
                name: name(game.result?.winnerId),
                count: game.result?.handPoints[game.result.winnerId] ?? 0,
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
