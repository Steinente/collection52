import { useTranslation } from "react-i18next";
import type { Card } from "@collection52/shared";
import type { CheatGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
} from "./cards";

export function CheatBoard({
  game,
  playerId,
  selected,
  setSelected,
  sendAction,
}: {
  game: CheatGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const me = game.players.find((player) => player.id === playerId)!;
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const handSorting = useHandSorting(me.hand);
  const canPlay =
    game.phase === "playing" &&
    current?.id === playerId &&
    me.connected &&
    !game.pendingWinnerId;
  const canChallenge =
    game.phase === "playing" &&
    game.lastPlay &&
    game.lastPlay.playerId !== playerId;
  const canAccept =
    game.phase === "playing" &&
    current?.id === playerId &&
    Boolean(game.lastPlay);
  const playerName = (id?: string) =>
    game.players.find((player) => player.id === id)?.name ?? "";
  const cardText = (card: Card) =>
    t("card", { suit: t(`suit_${card.suit}`), rank: t(`rank_${card.rank}`) });
  const toggle = (id: string) => {
    if (selected.includes(id))
      setSelected(selected.filter((value) => value !== id));
    else if (selected.length < game.rules.maxCardsPerTurn)
      setSelected([...selected, id]);
  };
  return (
    <section
      className="game-board cheat-board"
      aria-labelledby="cheat-game-title"
    >
      <div className="status-card" aria-live="polite">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="cheat-game-title">{t(`cheatPhase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("turn")}</dt>
            <dd>{game.phase === "playing" ? current?.name : "–"}</dd>
          </div>
          <div>
            <dt>{t("cheatRequiredClaim")}</dt>
            <dd>{t(`rank_${game.currentRank}`)}</dd>
          </div>
          <div>
            <dt>{t("cheatPile")}</dt>
            <dd>{game.pileCount}</dd>
          </div>
        </dl>
      </div>
      <section
        className="panel cheat-players"
        aria-labelledby="cheat-players-title"
      >
        <h2 id="cheat-players-title">{t("players")}</h2>
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
              <p>
                {t("cardsRemaining", {
                  count:
                    player.id === playerId
                      ? player.hand.length
                      : player.handCount,
                })}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel cheat-pile" aria-labelledby="cheat-pile-title">
        <p className="eyebrow">{t("cheatPile")}</p>
        <h2 id="cheat-pile-title">
          {game.lastPlay
            ? t("cheatLastClaim", {
                player: playerName(game.lastPlay.playerId),
                count: game.lastPlay.count,
                rank: t(`rank_${game.lastPlay.claimedRank}`),
              })
            : t("cheatNoClaim")}
        </h2>
        <div
          className="card-back-stack"
          role="img"
          aria-label={t("faceDownCards", { count: game.pileCount })}
        >
          🂠 <strong>× {game.pileCount}</strong>
        </div>
        {game.lastChallenge && (
          <div className="challenge-result" role="status">
            <p>
              {t(
                game.lastChallenge.truthful
                  ? "cheatChallengeTruth"
                  : "cheatChallengeLie",
                {
                  challenged: playerName(game.lastChallenge.challengedId),
                  loser: playerName(game.lastChallenge.loserId),
                },
              )}
            </p>
            <div className="revealed-cards">
              {game.lastChallenge.cards.map((card) => (
                <div
                  key={card.id}
                  className="playing-card compact-card"
                  role="img"
                  aria-label={cardText(card)}
                >
                  <CardFace card={card} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="hand panel" aria-labelledby="cheat-hand-title">
        <div className="section-heading hand-heading">
          <h2 id="cheat-hand-title">
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
          {handSorting.cards.map((card, index) => (
            <SortableHandCard
              key={card.id}
              cardId={card.id}
              moveCard={handSorting.moveCard}
              moveCardBy={handSorting.moveCardBy}
            >
              <button
                className={`playing-card ${selected.includes(card.id) ? "selected" : ""}`}
                disabled={!canPlay}
                aria-pressed={selected.includes(card.id)}
                aria-label={t("selectCheatCard", {
                  card: cardText(card),
                  index: index + 1,
                  count: me.hand.length,
                })}
                onClick={() => toggle(card.id)}
              >
                <CardFace card={card} />
              </button>
            </SortableHandCard>
          ))}
        </div>
      </section>
      <section className="actions panel" aria-labelledby="cheat-actions-title">
        <h2 id="cheat-actions-title">{t("actions")}</h2>
        {game.phase === "playing" ? (
          <div className="button-row">
            <button
              className="primary"
              disabled={!canPlay || selected.length === 0}
              onClick={() =>
                sendAction({ type: "cheat:play", cardIds: selected })
              }
            >
              {t("cheatPlayClaim", {
                count: selected.length,
                rank: t(`rank_${game.currentRank}`),
              })}
            </button>
            <button
              className="danger"
              disabled={!canChallenge}
              onClick={() => sendAction({ type: "cheat:challenge" })}
            >
              {t("cheatChallenge")}
            </button>
            <button
              disabled={!canAccept}
              onClick={() => sendAction({ type: "cheat:accept" })}
            >
              {t(game.pendingWinnerId ? "cheatAcceptFinal" : "cheatAccept")}
            </button>
          </div>
        ) : (
          <p className="result-banner" role="status">
            {t("cheatWinner", { player: playerName(game.result?.winnerId) })}
          </p>
        )}
      </section>
    </section>
  );
}
