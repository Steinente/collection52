import { useTranslation } from "react-i18next";
import {
  beats,
  rankValue,
  type Card,
  type TablePair,
} from "@collection52/shared";
import { suitSymbols } from "../client-config";
import type { DurakGameView } from "../models";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
  useNewHandCards,
} from "./cards";

export function DurakBoard({
  game,
  me,
  playerId,
  selected,
  setSelected,
  target,
  setTarget,
  sendAction,
}: {
  game: DurakGameView;
  me: DurakGameView["players"][number] | undefined;
  playerId: string;
  selected: string[];
  setSelected: (v: string[]) => void;
  target: string;
  setTarget: (v: string) => void;
  sendAction: (a: object) => void;
}) {
  const { t } = useTranslation();
  const playerName = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? "";
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const defenderIndex = game.players.findIndex((p) => p.id === game.defenderId);
  const circular = [
    ...game.players.slice(defenderIndex + 1),
    ...game.players.slice(0, defenderIndex),
  ];
  const original = game.players.find((p) => p.id === game.roundAttackerId);
  const eligible = [
    original,
    ...circular.filter((p) => p.id !== original?.id),
  ].filter((p): p is NonNullable<typeof p> =>
    Boolean(
      p &&
        !p.eliminated &&
        p.id !== game.defenderId &&
        (p.handCount ?? p.hand.length) > 0,
    ),
  );
  const expectedThrower = eligible.find(
    (p) => !game.passedPlayerIds.includes(p.id),
  );
  const isActive = Boolean(me?.connected && !me.eliminated);
  const canAttack =
    isActive &&
    game.table.length < game.roundAttackLimit &&
    (game.phase === "attack"
      ? playerId === game.attackerId
      : game.phase === "throw-in" && expectedThrower?.id === playerId);
  const canDefend =
    isActive && playerId === game.defenderId && game.phase === "defense";
  const tableRanks = new Set(
    game.table.flatMap((pair) =>
      pair.defense ? [pair.attack.rank, pair.defense.rank] : [pair.attack.rank],
    ),
  );
  const uncoveredPairs = game.table.filter((pair) => !pair.defense);
  const targetPair = uncoveredPairs.find((pair) => pair.attack.id === target);
  const selectedCards = selected
    .map((id) => me?.hand.find((card) => card.id === id))
    .filter((card): card is Card => Boolean(card));
  const selectedCard = selectedCards[0];
  const openingRank = game.phase === "attack" ? selectedCard?.rank : undefined;
  const availableAttackSlots = game.roundAttackLimit - game.table.length;
  const isHandCardPlayable = (card: Card) => {
    if (canAttack) {
      if (game.phase === "attack")
        return (
          selected.includes(card.id) ||
          ((!openingRank || card.rank === openingRank) &&
            selectedCards.length < availableAttackSlots)
        );
      return (
        tableRanks.has(card.rank) &&
        (selected.includes(card.id) || selectedCards.length === 0)
      );
    }
    return Boolean(
      canDefend &&
        (targetPair
          ? beats(card, targetPair.attack, game.trumpSuit)
          : uncoveredPairs.some((pair) =>
              beats(card, pair.attack, game.trumpSuit),
            )),
    );
  };
  const isTargetPlayable = (pair: TablePair) =>
    canDefend &&
    !pair.defense &&
    (!selectedCard || beats(selectedCard, pair.attack, game.trumpSuit));
  const activeSelected = selectedCards
    .filter(isHandCardPlayable)
    .map((card) => card.id);
  const activeTarget =
    targetPair && isTargetPlayable(targetPair) ? targetPair.attack.id : "";
  const toggleHandCard = (card: Card) => {
    if (selected.includes(card.id)) {
      setSelected(selected.filter((id) => id !== card.id));
      if (canDefend) setTarget("");
      return;
    }
    if (canDefend) {
      const currentTarget =
        targetPair && beats(card, targetPair.attack, game.trumpSuit)
          ? targetPair
          : undefined;
      const automaticTarget =
        currentTarget ??
        uncoveredPairs
          .filter((pair) => beats(card, pair.attack, game.trumpSuit))
          .sort((left, right) => {
            const leftSameSuit = left.attack.suit === card.suit ? 1 : 0;
            const rightSameSuit = right.attack.suit === card.suit ? 1 : 0;
            return (
              rightSameSuit - leftSameSuit ||
              rankValue(right.attack) - rankValue(left.attack)
            );
          })[0];
      setSelected([card.id]);
      setTarget(automaticTarget?.attack.id ?? "");
      return;
    }
    setSelected(
      game.phase === "attack" ? [...activeSelected, card.id] : [card.id],
    );
  };
  return (
    <section className="game-board" aria-labelledby="game-title">
      <div className="status-card">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="game-title">{t(`phase_${game.phase}`)}</h2>
        <dl>
          <div>
            <dt>{t("attacker")}</dt>
            <dd>{playerName(game.attackerId)}</dd>
          </div>
          <div>
            <dt>{t("defender")}</dt>
            <dd>{playerName(game.defenderId)}</dd>
          </div>
          <div>
            <dt>{t("trump")}</dt>
            <dd>
              {t(`suit_${game.trumpSuit}`)}{" "}
              <span className="trump-symbol" aria-hidden="true">
                {suitSymbols[game.trumpSuit]}
              </span>
            </dd>
          </div>
          <div>
            <dt>{t("deck", { count: game.deckCount })}</dt>
            <dd aria-hidden="true">🂠 × {game.deckCount}</dd>
          </div>
        </dl>
      </div>
      <div className="table panel">
        <h2>{t("table")}</h2>
        {game.table.length === 0 ? (
          <p>{t("emptyTable")}</p>
        ) : (
          <ol className="table-cards">
            {game.table.map((pair, index) => {
              const playable = isTargetPlayable(pair);
              return (
                <li key={pair.attack.id}>
                  <button
                    className={`playing-card ${activeTarget === pair.attack.id ? "selected" : ""}`}
                    disabled={!playable}
                    aria-pressed={activeTarget === pair.attack.id}
                    onClick={() =>
                      setTarget(
                        activeTarget === pair.attack.id ? "" : pair.attack.id,
                      )
                    }
                  >
                    <CardFace card={pair.attack} />
                    <span className="sr-only">
                      {t("attackCard", { index: index + 1 })}:{" "}
                      {cardText(pair.attack)}.{" "}
                      {pair.defense ? cardText(pair.defense) : t("uncovered")}
                    </span>
                  </button>
                  {pair.defense && (
                    <div
                      className="playing-card defense"
                      aria-label={cardText(pair.defense)}
                    >
                      <CardFace card={pair.defense} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="hand panel">
        <div className="section-heading hand-heading">
          <h2>{t("yourHand", { count: me?.hand.length ?? 0 })}</h2>
          <HandSortControls
            settings={handSorting.settings}
            setMode={handSorting.setMode}
            setDirection={handSorting.setDirection}
          />
        </div>
        <div
          className="hand-cards"
          role="group"
          aria-label={t("yourHand", { count: me?.hand.length ?? 0 })}
        >
          {handSorting.cards.map((card, index) => {
            const playable = isHandCardPlayable(card);
            const isSelected = activeSelected.includes(card.id);
            return (
              <SortableHandCard
                key={card.id}
                cardId={card.id}
                moveCard={handSorting.moveCard}
                moveCardBy={handSorting.moveCardBy}
              >
                <button
                  data-card-id={card.id}
                  className={`playing-card ${isSelected ? "selected" : ""} ${newCardIds.has(card.id) ? "newly-drawn" : ""}`}
                  disabled={!playable}
                  aria-pressed={isSelected}
                  onClick={() => toggleHandCard(card)}
                  aria-label={t("handCard", {
                    card: cardText(card),
                    index: index + 1,
                    count: me?.hand.length ?? 0,
                    state: playable ? t("playable") : t("notPlayable"),
                  })}
                >
                  <CardFace card={card} />
                </button>
              </SortableHandCard>
            );
          })}
        </div>
      </div>
      <div className="actions panel">
        <h2>{t("actions")}</h2>
        <div className="button-row">
          {canAttack && (
            <button
              className="primary"
              disabled={!activeSelected.length}
              onClick={() =>
                sendAction({ type: "attack", cardIds: activeSelected })
              }
            >
              {t("playAttack")}
            </button>
          )}
          {canDefend && (
            <button
              className="primary"
              disabled={activeSelected.length !== 1 || !activeTarget}
              onClick={() =>
                sendAction({
                  type: "defend",
                  cardId: activeSelected[0],
                  attackCardId: activeTarget,
                })
              }
            >
              {t("defendWith")}
            </button>
          )}
          {canDefend && (
            <button onClick={() => sendAction({ type: "take" })}>
              {t("take")}
            </button>
          )}
          {expectedThrower?.id === playerId && game.phase === "throw-in" && (
            <button onClick={() => sendAction({ type: "pass" })}>
              {t("pass")}
            </button>
          )}
        </div>
      </div>
      {game.phase === "finished" && (
        <div className="result panel" role="status">
          <h2>{t("result")}</h2>
          <p>
            {game.result?.draw
              ? t("draw")
              : t("durakResult", {
                  name: playerName(game.result?.durakId ?? ""),
                })}
          </p>
        </div>
      )}
    </section>
  );
}
