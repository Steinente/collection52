import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { canPlayMauMauCard, type Card, type Suit } from "@collection52/shared";
import { suitSymbols } from "../client-config";
import type { MauMauGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
  useNewHandCards,
} from "./cards";

export function MauMauBoard({
  game,
  playerId,
  selected,
  setSelected,
  sendAction,
}: {
  game: MauMauGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const [chosenSuit, setChosenSuit] = useState<Suit>();
  const me = game.players.find((player) => player.id === playerId);
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const topCard = game.discard.at(-1);
  const selectedCard = me?.hand.find((card) => card.id === selected[0]);
  const canAct =
    game.phase === "playing" &&
    current?.id === playerId &&
    Boolean(me?.connected);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const isPlayable = (card: Card) =>
    Boolean(
      canAct &&
        topCard &&
        (!game.drawnCardId || game.drawnCardId === card.id) &&
        (!game.pendingDraw || card.rank === "7") &&
        canPlayMauMauCard(card, topCard, game.activeSuit) &&
        !(
          game.rules.forbidJackOnJack &&
          card.rank === "jack" &&
          topCard.rank === "jack"
        ) &&
        !(
          game.rules.forbidJackAsFinal &&
          card.rank === "jack" &&
          me?.hand.length === 1
        ),
    );
  const hasPlayableCard = Boolean(me?.hand.some(isPlayable));
  const playReady = Boolean(
    canAct &&
      selectedCard &&
      isPlayable(selectedCard) &&
      (selectedCard.rank !== "jack" || chosenSuit),
  );
  useEffect(() => {
    setChosenSuit(undefined);
  }, [selectedCard?.id]);
  const playerName = (id?: string) =>
    game.players.find((player) => player.id === id)?.name ?? "";
  return (
    <section
      className="game-board mau-mau-board"
      aria-labelledby="mau-mau-game-title"
    >
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="mau-mau-game-title">{t(`mauMauPhase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("turn")}</dt>
            <dd>
              {game.phase === "playing"
                ? playerName(game.currentPlayerId)
                : "–"}
            </dd>
          </div>
          <div>
            <dt>{t("mauMauActiveSuit")}</dt>
            <dd>
              <span
                aria-hidden="true"
                className={
                  game.activeSuit === "hearts" || game.activeSuit === "diamonds"
                    ? "red-suit"
                    : ""
                }
              >
                {suitSymbols[game.activeSuit]}{" "}
              </span>
              {t(`suit_${game.activeSuit}`)}
            </dd>
          </div>
          <div>
            <dt>{t("mauMauStock")}</dt>
            <dd>{game.deckCount}</dd>
          </div>
          <div>
            <dt>
              {game.pendingDraw ? t("mauMauPendingDraw") : t("mauMauDirection")}
            </dt>
            <dd>
              {game.pendingDraw
                ? `+${game.pendingDraw}`
                : t(
                    game.direction === 1
                      ? "mauMauClockwise"
                      : "mauMauCounterClockwise",
                  )}
            </dd>
          </div>
        </dl>
      </div>
      <div className="table panel mau-mau-table">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("mauMauDiscard")}</p>
            <h2>{t("mauMauTopCard")}</h2>
          </div>
          <span
            className="knack-stock"
            aria-label={t("deck", { count: game.deckCount })}
          >
            🂠 × {game.deckCount}
          </span>
        </div>
        <div className="mau-mau-piles">
          {topCard && (
            <div
              className={`mau-mau-discard-card ${game.discardCount > 1 ? "stacked" : ""}`}
              role="img"
              aria-label={cardText(topCard)}
            >
              <CardFace card={topCard} />
            </div>
          )}
          <div className="mau-mau-suit">
            <span>{t("mauMauRequestedSuit")}</span>
            <strong>
              <span aria-hidden="true">{suitSymbols[game.activeSuit]} </span>
              {t(`suit_${game.activeSuit}`)}
            </strong>
          </div>
        </div>
      </div>
      <div className="hand panel">
        <div className="section-heading hand-heading">
          <h2>{t("yourHand", { count: me?.hand.length ?? 0 })}</h2>
          <div className="hand-heading-tools">
            {game.drawnCardId && (
              <span className="mau-mau-drawn-hint">
                {t("mauMauDrawnChoice")}
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
          {handSorting.cards.map((card, index) => {
            const playable = isPlayable(card);
            return (
              <SortableHandCard
                key={card.id}
                cardId={card.id}
                moveCard={handSorting.moveCard}
                moveCardBy={handSorting.moveCardBy}
              >
                <button
                  data-card-id={card.id}
                  className={`playing-card ${selected[0] === card.id ? "selected" : ""} ${game.drawnCardId === card.id ? "just-drawn" : ""} ${newCardIds.has(card.id) ? "newly-drawn" : ""}`}
                  disabled={!playable}
                  aria-pressed={selected[0] === card.id}
                  aria-label={t("handCard", {
                    card: cardText(card),
                    index: index + 1,
                    count: me?.hand.length ?? 0,
                    state: playable ? t("playable") : t("notPlayable"),
                  })}
                  onClick={() =>
                    setSelected(selected[0] === card.id ? [] : [card.id])
                  }
                >
                  <CardFace card={card} />
                </button>
              </SortableHandCard>
            );
          })}
        </div>
      </div>
      {game.phase === "playing" && (
        <div className="actions panel mau-mau-actions">
          <h2>{t("actions")}</h2>
          {selectedCard?.rank === "jack" && (
            <fieldset className="mau-mau-suit-choice">
              <legend>{t("mauMauChooseSuit")}</legend>
              {(["clubs", "diamonds", "hearts", "spades"] as Suit[]).map(
                (suit) => (
                  <button
                    type="button"
                    key={suit}
                    className={chosenSuit === suit ? "selected" : ""}
                    aria-pressed={chosenSuit === suit}
                    onClick={() => setChosenSuit(suit)}
                  >
                    <span aria-hidden="true">{suitSymbols[suit]}</span>
                    {t(`suit_${suit}`)}
                  </button>
                ),
              )}
            </fieldset>
          )}
          <div className="button-row">
            <button
              className="primary"
              disabled={!playReady}
              onClick={() =>
                selectedCard &&
                sendAction({
                  type: "mau-mau:play",
                  cardId: selectedCard.id,
                  ...(selectedCard.rank === "jack" ? { chosenSuit } : {}),
                })
              }
            >
              {t("mauMauPlayCard")}
            </button>
            {game.drawnCardId ? (
              <button
                disabled={!canAct}
                onClick={() => sendAction({ type: "mau-mau:pass" })}
              >
                {t("mauMauKeepCard")}
              </button>
            ) : (
              <button
                disabled={!canAct || (!game.pendingDraw && hasPlayableCard)}
                onClick={() => sendAction({ type: "mau-mau:draw" })}
              >
                {t(game.pendingDraw ? "mauMauTakePenalty" : "mauMauDrawCard", {
                  count: game.pendingDraw,
                })}
              </button>
            )}
          </div>
          {!canAct && current && (
            <p className="action-hint">
              {t("mauMauWaitingFor", { name: current.name })}
            </p>
          )}
          {canAct && !game.drawnCardId && hasPlayableCard && (
            <p className="action-hint">
              {t(game.pendingDraw ? "mauMauStackHint" : "mauMauPlayableHint", {
                count: game.pendingDraw,
              })}
            </p>
          )}
        </div>
      )}
      {game.phase === "finished" && (
        <div className="result panel" role="status">
          <h2>{t("result")}</h2>
          <p>
            {t("mauMauWinner", { name: playerName(game.result?.winnerId) })}
          </p>
        </div>
      )}
    </section>
  );
}
