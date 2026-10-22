import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  detectRommeMeld,
  isPotentialRommeMeld,
  isValidRommeMeld,
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

export function ClassicRommeBoard({
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
  const [groups, setGroups] = useState<
    Array<{ kind: "set" | "run"; cardIds: string[] }>
  >([]);
  const me = game.players.find((player) => player.id === playerId);
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  );
  const canAct = game.phase === "playing" && game.currentPlayerId === playerId;
  const top = game.discard.at(-1);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  useEffect(() => {
    setSelected([]);
    setGroups([]);
  }, [game.version]);
  const name = (id: string) =>
    game.players.find((player) => player.id === id)?.name ?? "–";
  const cardText = (card: RommeCard) =>
    card.rank === "joker"
      ? t("rommeJoker")
      : t("card", {
          suit: t(`suit_${card.suit}`),
          rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
        });
  const stagedIds = new Set(groups.flatMap((group) => group.cardIds));
  const selectedCards = selected
    .map((id) => me?.hand.find((card) => card.id === id))
    .filter((card): card is RommeCard => Boolean(card));
  const selectedMeld =
    selectedCards.length === selected.length
      ? detectRommeMeld(selectedCards)
      : undefined;
  const replacementFits = (
    meld: RommeGameView["melds"][number],
    jokerId: string,
    replacement: RommeCard,
  ) => {
    if (replacement.rank === "joker") return false;
    const replaced = meld.cards.map((card) =>
      card.id === jokerId ? replacement : card,
    );
    return (
      isValidRommeMeld(meld.kind, replaced) &&
      (meld.kind !== "set" || replaced.length === 4)
    );
  };
  const canLayOff = (meld: RommeGameView["melds"][number]) =>
    selectedCards.length === selected.length &&
    selectedCards.length > 0 &&
    isValidRommeMeld(meld.kind, [...meld.cards, ...selectedCards]);
  const isPotentialJokerExchange = (cards: RommeCard[]) =>
    Boolean(me?.opened) &&
    game.melds.some((meld) => {
      const tableJoker = meld.cards.find((card) => card.rank === "joker");
      if (!tableJoker) return false;
      const selectedReplacementWorks = cards.some(
        (replacement) =>
          replacementFits(meld, tableJoker.id, replacement) &&
          isPotentialRommeMeld([
            tableJoker,
            ...cards.filter((card) => card.id !== replacement.id),
          ]),
      );
      if (selectedReplacementWorks) return true;
      return (
        (me?.hand ?? []).some(
          (replacement) =>
            !stagedIds.has(replacement.id) &&
            !cards.some((card) => card.id === replacement.id) &&
            replacementFits(meld, tableJoker.id, replacement),
        ) && isPotentialRommeMeld([tableJoker, ...cards])
      );
    });
  const canExchangeJoker = (
    meld: RommeGameView["melds"][number],
    tableJoker: RommeCard,
  ) =>
    selectedCards.some(
      (replacement) =>
        replacementFits(meld, tableJoker.id, replacement) &&
        Boolean(
          detectRommeMeld([
            tableJoker,
            ...selectedCards.filter((card) => card.id !== replacement.id),
          ]),
        ),
    );
  const canAddToSelection = (card: RommeCard) =>
    !selected.length ||
    isPotentialRommeMeld([...selectedCards, card]) ||
    isPotentialJokerExchange([...selectedCards, card]);
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  const stage = () => {
    if (!selectedMeld) return;
    setGroups([...groups, { kind: selectedMeld.kind, cardIds: [...selected] }]);
    setSelected([]);
  };
  return (
    <section className="game-board romme-board" aria-labelledby="romme-title">
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="romme-title">{t(`rommePhase_${game.phase}`)}</h2>
        <dl>
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
            <dt>{t("rommeOpening")}</dt>
            <dd>
              {t("rommeOpeningPoints", { count: game.rules.openingPoints })}
            </dd>
          </div>
          <div>
            <dt>{t("rommeYourStatus")}</dt>
            <dd>{t(me?.opened ? "rommeOpened" : "rommeNotOpened")}</dd>
          </div>
        </dl>
      </div>
      <div className="table panel romme-table">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("rommeTable")}</p>
            <h2>{t("rommeMelds")}</h2>
          </div>
          <span className="knack-stock">🂠 × {game.deckCount}</span>
        </div>
        <div className="romme-melds">
          {game.melds.length ? (
            game.melds.map((meld) => {
              const tableJoker = meld.cards.find(
                (card) => card.rank === "joker",
              );
              return (
                <article key={meld.id} className="romme-meld">
                  <header>
                    <strong>
                      {t(meld.kind === "set" ? "rommeSet" : "rommeRun")}
                    </strong>
                    <small>{name(meld.ownerId)}</small>
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
                    <>
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
                      {tableJoker && (
                        <div className="romme-joker-actions">
                          <button
                            disabled={!canExchangeJoker(meld, tableJoker)}
                            onClick={() =>
                              sendAction({
                                type: "romme:replace-joker",
                                meldId: meld.id,
                                jokerId: tableJoker.id,
                                cardIds: selected,
                              })
                            }
                          >
                            {t("rommeExchangeJoker")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <p className="empty-table">{t("rommeNoMelds")}</p>
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
        </div>
        <div className="button-row">
          <button
            className="primary"
            disabled={!canAct || game.hasDrawn || !game.deckCount}
            onClick={() => sendAction({ type: "romme:draw", source: "stock" })}
          >
            {t("rommeDrawStock")}
          </button>
          <button
            disabled={!canAct || game.hasDrawn || !top}
            onClick={() =>
              sendAction({ type: "romme:draw", source: "discard" })
            }
          >
            {t("rommeTakeDiscard")}
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
            const selectedCard = selected.includes(card.id);
            const selectable = selectedCard || canAddToSelection(card);
            return (
              <SortableHandCard
                key={card.id}
                cardId={card.id}
                moveCard={handSorting.moveCard}
                moveCardBy={handSorting.moveCardBy}
              >
                <button
                  data-card-id={card.id}
                  className={`playing-card ${selectedCard ? "selected" : ""} ${stagedIds.has(card.id) ? "staged" : ""} ${newCardIds.has(card.id) ? "newly-drawn" : ""}`}
                  disabled={
                    !canAct ||
                    !game.hasDrawn ||
                    stagedIds.has(card.id) ||
                    !selectable
                  }
                  aria-pressed={selectedCard}
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
                <li key={`${group.kind}-${index}`}>
                  <span>
                    {t(group.kind === "set" ? "rommeSet" : "rommeRun")} ·{" "}
                    {group.cardIds.length}
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
                sendAction({
                  type: "romme:meld",
                  groups: groups.map((group) => ({ cardIds: group.cardIds })),
                })
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
      {game.phase === "finished" && (
        <div className="result panel">
          <h2>{t("result")}</h2>
          <p>{t("rommeWinner", { name: name(game.result?.winnerId ?? "") })}</p>
          {game.result && (
            <ul>
              {Object.entries(game.result.handPoints).map(([id, points]) => (
                <li key={id}>
                  {name(id)}: {t("rommePoints", { count: points })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
