import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Card } from "@collection52/shared";
import type { OhHellGameView, SpadesGameView } from "../models";
import { suitSymbols } from "../client-config";
import { ResponsiveSelect } from "./ui";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
} from "./cards";

export function TrickBoard({
  kind,
  game,
  playerId,
  selected,
  setSelected,
  sendAction,
}: {
  kind: "spades" | "oh-hell";
  game: SpadesGameView | OhHellGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const [bid, setBid] = useState(0);
  const me = game.players.find((player) => player.id === playerId)!;
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const handSorting = useHandSorting(me.hand);
  const selectedCard = me.hand.find((card) => card.id === selected[0]);
  const canAct = current?.id === playerId && me.connected;
  const ohHell = kind === "oh-hell" ? (game as OhHellGameView) : undefined;
  const spades = kind === "spades" ? (game as SpadesGameView) : undefined;
  const maximumBid = ohHell?.handSize ?? 13;
  const cardText = (card: Card) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const canPlay = (card: Card) => {
    if (!canAct || game.phase !== "playing") return false;
    const leadSuit = game.trick[0]?.card.suit;
    if (
      leadSuit &&
      card.suit !== leadSuit &&
      me.hand.some((item) => item.suit === leadSuit)
    )
      return false;
    if (
      spades &&
      !leadSuit &&
      card.suit === "spades" &&
      !spades.spadesBroken &&
      me.hand.some((item) => item.suit !== "spades")
    )
      return false;
    return true;
  };
  const dealerForbiddenBid = (candidate: number) => {
    if (
      !ohHell ||
      playerId !== ohHell.dealerId ||
      !ohHell.rules.forbidExactBidTotal
    )
      return false;
    return (
      ohHell.players.reduce(
        (sum, player) => sum + (player.id === playerId ? 0 : (player.bid ?? 0)),
        candidate,
      ) === ohHell.handSize
    );
  };
  const phaseTitle = t(
    `${kind === "spades" ? "spades" : "ohHell"}Phase_${game.phase}`,
  );
  const playerName = (id: string) =>
    game.players.find((player) => player.id === id)?.name ?? "";
  return (
    <section
      className="game-board trick-game-board"
      aria-labelledby={`${kind}-game-title`}
    >
      <div className="status-card" aria-live="polite">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id={`${kind}-game-title`}>{phaseTitle}</h2>
        <dl>
          <div>
            <dt>{t("round")}</dt>
            <dd>{game.roundNumber}</dd>
          </div>
          <div>
            <dt>{t("turn")}</dt>
            <dd>
              {game.phase === "round-ended" || game.phase === "finished"
                ? "–"
                : current?.name}
            </dd>
          </div>
          {ohHell && (
            <div>
              <dt>{t("ohHellHandSize")}</dt>
              <dd>{ohHell.handSize}</dd>
            </div>
          )}
          {ohHell && (
            <div>
              <dt>{t("trump")}</dt>
              <dd>
                <span aria-hidden="true">{suitSymbols[ohHell.trumpSuit]} </span>
                {t(`suit_${ohHell.trumpSuit}`)}
              </dd>
            </div>
          )}
          {spades && (
            <div>
              <dt>{t("spadesBroken")}</dt>
              <dd>{t(spades.spadesBroken ? "yes" : "no")}</dd>
            </div>
          )}
        </dl>
      </div>

      <section
        className="panel trick-scoreboard"
        aria-labelledby={`${kind}-scores`}
      >
        <h2 id={`${kind}-scores`}>{t("scoresAndBids")}</h2>
        <div className="trick-player-grid">
          {game.players.map((player) => (
            <article
              key={player.id}
              className={player.id === game.currentPlayerId ? "current" : ""}
            >
              <h3>
                {player.name}
                {player.id === playerId ? ` (${t("you")})` : ""}
              </h3>
              {spades && (
                <p>
                  {t("teamLabel", {
                    team:
                      (player as SpadesGameView["players"][number]).teamId ===
                      "team-1"
                        ? 1
                        : 2,
                  })}
                </p>
              )}
              <dl>
                <div>
                  <dt>{t("bid")}</dt>
                  <dd>{player.bid ?? "–"}</dd>
                </div>
                <div>
                  <dt>{t("tricks")}</dt>
                  <dd>{player.tricks}</dd>
                </div>
                {ohHell && (
                  <div>
                    <dt>{t("score")}</dt>
                    <dd>
                      {(player as OhHellGameView["players"][number]).score}
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
        {spades && (
          <div className="team-score-row">
            {(["team-1", "team-2"] as const).map((teamId, index) => (
              <strong key={teamId}>
                {t("teamScore", {
                  team: index + 1,
                  score: spades.scores[teamId],
                  bags: spades.bags[teamId],
                })}
              </strong>
            ))}
          </div>
        )}
      </section>

      <section
        className="panel trick-table"
        aria-labelledby={`${kind}-table-title`}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("table")}</p>
            <h2 id={`${kind}-table-title`}>{t("currentTrick")}</h2>
          </div>
          {ohHell && (
            <div
              className="playing-card compact-card"
              role="img"
              aria-label={t("trumpCardLabel", {
                card: cardText(ohHell.trumpCard),
              })}
            >
              <CardFace card={ohHell.trumpCard} />
            </div>
          )}
        </div>
        <div
          className="trick-cards"
          role="group"
          aria-label={t("currentTrick")}
        >
          {game.trick.length ? (
            game.trick.map((play) => (
              <div key={play.playerId} className="trick-play">
                <span>{playerName(play.playerId)}</span>
                <div
                  className="playing-card"
                  role="img"
                  aria-label={cardText(play.card)}
                >
                  <CardFace card={play.card} />
                </div>
              </div>
            ))
          ) : (
            <p>{t("noCardsInTrick")}</p>
          )}
        </div>
      </section>

      <section className="hand panel" aria-labelledby={`${kind}-hand-title`}>
        <div className="section-heading hand-heading">
          <h2 id={`${kind}-hand-title`}>
            {t("yourHand", { count: me.hand.length })}
          </h2>
          <HandSortControls
            settings={handSorting.settings}
            setMode={handSorting.setMode}
            setDirection={handSorting.setDirection}
          />
        </div>
        <div
          className="hand-cards"
          role="group"
          aria-label={t("yourHand", { count: me.hand.length })}
        >
          {handSorting.cards.map((card, index) => {
            const playable = canPlay(card);
            return (
              <SortableHandCard
                key={card.id}
                cardId={card.id}
                moveCard={handSorting.moveCard}
                moveCardBy={handSorting.moveCardBy}
              >
                <button
                  className={`playing-card ${selected[0] === card.id ? "selected" : ""}`}
                  disabled={!playable}
                  aria-pressed={selected[0] === card.id}
                  aria-label={t("handCard", {
                    card: cardText(card),
                    index: index + 1,
                    count: me.hand.length,
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
      </section>

      <section
        className="actions panel"
        aria-labelledby={`${kind}-actions-title`}
      >
        <h2 id={`${kind}-actions-title`}>{t("actions")}</h2>
        {game.phase === "bidding" && canAct && (
          <div className="bid-controls">
            <ResponsiveSelect
              label={t("yourBid")}
              value={String(bid)}
              onChange={(value) => setBid(Number(value))}
              options={Array.from({ length: maximumBid + 1 }, (_, value) => ({
                value: String(value),
                label: value === 0 && spades ? t("nilBid") : String(value),
                disabled: dealerForbiddenBid(value),
              }))}
            />
            <button
              className="primary"
              disabled={dealerForbiddenBid(bid)}
              onClick={() => sendAction({ type: `${kind}:bid`, bid })}
            >
              {t("submitBid")}
            </button>
          </div>
        )}
        {game.phase === "playing" && (
          <button
            className="primary"
            disabled={!selectedCard || !canPlay(selectedCard)}
            onClick={() =>
              selectedCard &&
              sendAction({ type: `${kind}:play`, cardId: selectedCard.id })
            }
          >
            {t("playCard")}
          </button>
        )}
        {game.phase === "round-ended" && (
          <button
            className="primary"
            onClick={() => sendAction({ type: `${kind}:next-round` })}
          >
            {t("nextRound")}
          </button>
        )}
        {game.phase === "finished" && (
          <p className="result-banner" role="status">
            {spades
              ? t("spadesWinner", {
                  team: spades.result?.winnerTeamId === "team-1" ? 1 : 2,
                })
              : t("ohHellWinner", {
                  names: ohHell?.result?.winnerIds.map(playerName).join(", "),
                })}
          </p>
        )}
      </section>
    </section>
  );
}
