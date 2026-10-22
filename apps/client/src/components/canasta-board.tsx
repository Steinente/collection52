import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  canastaCardPoints,
  isPotentialCanastaMeld,
  isValidCanastaMeld,
  type RommeCard,
} from "@collection52/shared";
import type { RommeGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
  useNewHandCards,
} from "./cards";

export function CanastaBoard({
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
  const [groups, setGroups] = useState<Array<{ cardIds: string[] }>>([]);
  const me = game.players.find((player) => player.id === playerId);
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const canAct = game.phase === "playing" && game.currentPlayerId === playerId;
  const top = game.discard.at(-1);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const stagedIds = new Set(groups.flatMap((group) => group.cardIds));
  const selectedCards = selected
    .map((id) => me?.hand.find((card) => card.id === id))
    .filter((card): card is RommeCard => Boolean(card));
  const selectedMeld =
    selectedCards.length === selected.length &&
    isValidCanastaMeld(selectedCards);
  const teamIds = [
    ...new Set(
      game.players.map((player) => player.teamId).filter(Boolean),
    ),
  ] as string[];
  const teamName = (teamId?: string) =>
    game.players
      .filter((player) => player.teamId === teamId)
      .map((player) => player.name)
      .join(" & ") || "–";
  const myScore = me?.teamId ? (game.scores?.[me.teamId] ?? 0) : 0;
  const openingRequirement =
    myScore < 0 ? 15 : myScore < 1500 ? 50 : myScore < 3000 ? 90 : 120;
  const cardText = (card: RommeCard) =>
    card.rank === "joker"
      ? t("rommeJoker")
      : t("card", {
          suit: t(`suit_${card.suit}`),
          rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
        });

  useEffect(() => {
    setSelected([]);
    setGroups([]);
  }, [game.version]);

  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  const stage = () => {
    if (!selectedMeld) return;
    setGroups([...groups, { cardIds: [...selected] }]);
    setSelected([]);
  };
  const canLayOff = (meld: RommeGameView["melds"][number]) =>
    meld.ownerId === me?.teamId &&
    selectedCards.length > 0 &&
    selectedCards.length === selected.length &&
    isValidCanastaMeld([...meld.cards, ...selectedCards]);

  return (
    <section
      className="game-board romme-board canasta-board"
      aria-labelledby="canasta-title"
    >
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="canasta-title">{t(`canastaPhase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("canastaRound")}</dt>
            <dd>{game.roundNumber}</dd>
          </div>
          <div>
            <dt>{t("turn")}</dt>
            <dd>{game.phase === "playing" ? current?.name : "–"}</dd>
          </div>
          <div>
            <dt>{t("rommeStock")}</dt>
            <dd>{game.deckCount}</dd>
          </div>
          <div>
            <dt>{t("rommeOpening")}</dt>
            <dd>
              {me?.opened
                ? t("rommeOpened")
                : t("rommeOpeningPoints", { count: openingRequirement })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="table panel romme-table canasta-scoreboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("canastaScore")}</p>
            <h2>{t("canastaTarget", { count: game.rules.canastaTargetScore })}</h2>
          </div>
          <span className="knack-stock">🂠 × {game.deckCount}</span>
        </div>
        <div className="gin-scores">
          {teamIds.map((teamId, index) => (
            <div key={teamId}>
              <strong>{t("canastaTeam", { count: index + 1 })}</strong>
              <span>{teamName(teamId)}</span>
              <span>
                {t("canastaPoints", { count: game.scores?.[teamId] ?? 0 })}
              </span>
              <small>
                {t("canastaRedThrees", {
                  count: game.canastaRedThrees?.[teamId]?.length ?? 0,
                })}
              </small>
            </div>
          ))}
        </div>
      </div>

      <div className="table panel romme-table">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("rommeTable")}</p>
            <h2>{t("canastaTeamMelds")}</h2>
          </div>
        </div>
        <div className="romme-melds">
          {game.melds.length ? (
            game.melds.map((meld) => {
              const complete = meld.cards.length >= 7;
              const natural = !meld.cards.some(
                (card) => card.rank === "joker" || card.rank === "2",
              );
              return (
                <article className="romme-meld" key={meld.id}>
                  <header>
                    <strong>
                      {complete
                        ? t(natural ? "canastaNatural" : "canastaMixed")
                        : t("canastaMeld")}
                    </strong>
                    <small>{teamName(meld.ownerId)}</small>
                  </header>
                  <div>
                    {meld.cards.map((card) => (
                      <span
                        className="romme-table-card"
                        key={card.id}
                        role="img"
                        aria-label={cardText(card)}
                      >
                        <CardFace card={card} />
                      </span>
                    ))}
                  </div>
                  {canAct && me?.opened && game.hasDrawn && (
                    <button
                      disabled={!canLayOff(meld)}
                      onClick={() =>
                        sendAction({
                          type: "romme:lay-off",
                          meldId: meld.id,
                          cardIds: selected,
                        })
                      }
                    >
                      {t("rommeLayOff")}
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <p className="empty-table">{t("canastaNoMelds")}</p>
          )}
        </div>
      </div>

      <div className="panel romme-discard">
        <div>
          <p className="eyebrow">{t("rommeDiscard")}</p>
          {top && (
            <span
              className={`romme-table-card ${game.discardCount > 1 ? "stacked" : ""}`}
              role="img"
              aria-label={cardText(top)}
            >
              <CardFace card={top} />
            </span>
          )}
          {game.canastaDiscardFrozen && (
            <small className="action-hint">{t("canastaDiscardFrozen")}</small>
          )}
        </div>
        <div className="button-row">
          <button
            className="primary"
            disabled={!canAct || game.hasDrawn}
            onClick={() => sendAction({ type: "romme:draw", source: "stock" })}
          >
            {game.deckCount ? t("rommeDrawStock") : t("canastaEndStock")}
          </button>
          <button
            disabled={!canAct || game.hasDrawn || !top}
            onClick={() =>
              sendAction({ type: "romme:draw", source: "discard" })
            }
          >
            {t("canastaTakeDiscardPile", { count: game.discardCount })}
          </button>
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
          {handSorting.cards.map((card, index) => {
            const isSelected = selected.includes(card.id);
            const selectable =
              isSelected ||
              !selected.length ||
              isPotentialCanastaMeld([...selectedCards, card]);
            return (
              <SortableHandCard
                key={card.id}
                cardId={card.id}
                moveCard={handSorting.moveCard}
                moveCardBy={handSorting.moveCardBy}
              >
                <button
                  data-card-id={card.id}
                  className={`playing-card ${isSelected ? "selected" : ""} ${stagedIds.has(card.id) ? "staged" : ""} ${newCardIds.has(card.id) ? "newly-drawn" : ""}`}
                  disabled={
                    !canAct ||
                    !game.hasDrawn ||
                    stagedIds.has(card.id) ||
                    !selectable
                  }
                  aria-pressed={isSelected}
                  aria-label={t("handCard", {
                    card: cardText(card),
                    index: index + 1,
                    count: me?.hand.length ?? 0,
                    state: selectable ? "" : t("notPlayable"),
                  })}
                  onClick={() => toggle(card.id)}
                >
                  <CardFace card={card} />
                </button>
              </SortableHandCard>
            );
          })}
        </div>
      </div>

      {game.phase === "playing" && (
        <div className="actions panel romme-actions">
          <h2>{t("actions")}</h2>
          {groups.length > 0 && (
            <ol className="romme-staged">
              {groups.map((group, index) => (
                <li key={`${group.cardIds.join("-")}-${index}`}>
                  <span>
                    {t("canastaMeld")} · {group.cardIds.length} ·{" "}
                    {t("canastaPoints", {
                      count: group.cardIds.reduce(
                        (sum, id) =>
                          sum +
                          canastaCardPoints(
                            me!.hand.find((card) => card.id === id)!,
                          ),
                        0,
                      ),
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setGroups(
                        groups.filter((_, groupIndex) => groupIndex !== index),
                      )
                    }
                  >
                    {t("remove")}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="button-row">
            <button
              disabled={!canAct || !game.hasDrawn || !selectedMeld}
              onClick={stage}
            >
              {t("rommeStageMeld")}
            </button>
            <button
              className="primary"
              disabled={!canAct || !game.hasDrawn || !groups.length}
              onClick={() =>
                sendAction({ type: "romme:meld", groups })
              }
            >
              {t(me?.opened ? "rommeMeld" : "rommeOpen")}
            </button>
            <button
              disabled={!canAct || !game.hasDrawn || selected.length !== 1}
              onClick={() =>
                sendAction({ type: "romme:discard", cardId: selected[0] })
              }
            >
              {t("rommeDiscardCard")}
            </button>
          </div>
          {!canAct && current && (
            <p className="action-hint">
              {t("rommeWaitingFor", { name: current.name })}
            </p>
          )}
        </div>
      )}

      {game.phase !== "playing" && game.canastaRoundResult && (
        <div className="result panel" aria-live="polite">
          <h2>
            {t(
              game.phase === "finished"
                ? "canastaGameFinished"
                : "canastaRoundFinished",
            )}
          </h2>
          <ul>
            {teamIds.map((teamId, index) => (
              <li key={teamId}>
                {t("canastaTeam", { count: index + 1 })} ({teamName(teamId)}):{" "}
                {t("canastaRoundScore", {
                  round: game.canastaRoundResult?.roundScores[teamId] ?? 0,
                  total: game.canastaRoundResult?.scores[teamId] ?? 0,
                })}
              </li>
            ))}
          </ul>
          {game.phase === "round-ended" && (
            <button
              className="primary"
              onClick={() => sendAction({ type: "romme:next-round" })}
            >
              {t("canastaNextRound")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
