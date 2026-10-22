import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  skatBidValues,
  type Card,
  type SkatAnnouncement,
  type SkatContract,
} from "@collection52/shared";
import type { SkatGameView } from "../models";
import { suitSymbols } from "../client-config";
import { ResponsiveSelect } from "./ui";
import {
  CardFace,
  HandSortControls,
  SortableHandCard,
  useHandSorting,
} from "./cards";

export function SkatBoard({
  game,
  playerId,
  selected,
  setSelected,
  sendAction,
}: {
  game: SkatGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
}) {
  const { t } = useTranslation();
  const me = game.players.find((candidate) => candidate.id === playerId)!;
  const current = game.players.find(
    (candidate) => candidate.id === game.currentPlayerId,
  );
  const declarer = game.players.find(
    (candidate) => candidate.id === game.declarerId,
  );
  const handSorting = useHandSorting(me.hand);
  const selectedCard = me.hand.find((card) => card.id === selected[0]);
  const availableBids = skatBidValues.filter(
    (value) => value > game.highestBid,
  );
  const [bid, setBid] = useState(availableBids[0] ?? 18);
  const [contract, setContract] = useState<SkatContract>("diamonds");
  const [announcement, setAnnouncement] = useState<SkatAnnouncement>("none");
  const minimumGameValue = Math.max(18, game.highestBid);
  const nullAnnouncementOptions = (["none", "ouvert"] as const).filter(
    (value) =>
      (value === "ouvert"
        ? game.handGame
          ? 59
          : 46
        : game.handGame
          ? 35
          : 23) >= minimumGameValue,
  );
  useEffect(() => {
    setBid(availableBids[0] ?? 18);
  }, [game.highestBid]);
  useEffect(() => {
    if (contract === "null") {
      if (nullAnnouncementOptions.length === 0) {
        setContract("diamonds");
        setAnnouncement("none");
      } else if (
        !nullAnnouncementOptions.some((value) => value === announcement)
      )
        setAnnouncement(nullAnnouncementOptions[0]!);
    } else if (!game.handGame && announcement !== "none")
      setAnnouncement("none");
  }, [announcement, contract, game.handGame, game.highestBid]);

  const playerName = (id: string | undefined) =>
    game.players.find((candidate) => candidate.id === id)?.name ?? "–";
  const cardText = (card: Card) =>
    t("card", {
      suit: t(`suit_${card.suit}`),
      rank: t(`rank_${card.rank}`, { defaultValue: card.rank }),
    });
  const category = (card: Card) =>
    game.contract !== "null" &&
    (card.rank === "jack" || card.suit === game.contract)
      ? "trump"
      : card.suit;
  const canPlay = (card: Card) => {
    if (
      game.phase !== "playing" ||
      game.currentPlayerId !== playerId ||
      !me.active ||
      !me.connected
    )
      return false;
    const lead = game.trick[0]?.card;
    return (
      !lead ||
      category(card) === category(lead) ||
      !me.hand.some((candidate) => category(candidate) === category(lead))
    );
  };
  const cardSelectable = (card: Card) =>
    game.phase === "discarding" ? game.declarerId === playerId : canPlay(card);
  const toggleCard = (card: Card) => {
    if (!cardSelectable(card)) return;
    if (selected.includes(card.id)) {
      setSelected(selected.filter((id) => id !== card.id));
      return;
    }
    const limit = game.phase === "discarding" ? 2 : 1;
    setSelected([...selected, card.id].slice(-limit));
  };
  const contractLabel = (value: SkatContract | undefined) => {
    if (!value) return "–";
    if (value === "grand" || value === "null")
      return t(`skatContract_${value}`);
    return `${suitSymbols[value]} ${t(`suit_${value}`)}`;
  };
  const phaseTitle = t(`skatPhase_${game.phase}`);
  const result = game.roundResult;
  const announcementOptions: SkatAnnouncement[] =
    contract === "null"
      ? nullAnnouncementOptions
      : game.handGame
        ? ["none", "schneider", "schwarz", "ouvert"]
        : ["none"];
  const revealedDeclarer =
    game.announcement === "ouvert" && declarer?.id !== playerId
      ? declarer
      : undefined;

  return (
    <section
      className="game-board skat-game-board"
      aria-labelledby="skat-game-title"
    >
      <div className="status-card" aria-live="polite">
        <p className="eyebrow">{t("phase")}</p>
        <h2 id="skat-game-title">{phaseTitle}</h2>
        <dl>
          <div>
            <dt>{t("skatDeal")}</dt>
            <dd>
              {game.dealNumber} / {game.totalDeals}
            </dd>
          </div>
          <div>
            <dt>{t("turn")}</dt>
            <dd>
              {game.phase === "round-ended" || game.phase === "finished"
                ? "–"
                : current?.name}
            </dd>
          </div>
          <div>
            <dt>{t("skatHighestBid")}</dt>
            <dd>{game.highestBid || "–"}</dd>
          </div>
          <div>
            <dt>{t("skatDeclarer")}</dt>
            <dd>{declarer?.name ?? "–"}</dd>
          </div>
          <div>
            <dt>{t("skatGameType")}</dt>
            <dd>{contractLabel(game.contract)}</dd>
          </div>
        </dl>
      </div>

      <section
        className="panel skat-scoreboard"
        aria-labelledby="skat-scores-title"
      >
        <h2 id="skat-scores-title">{t("skatScoresAndRoles")}</h2>
        <div className="trick-player-grid">
          {game.players.map((candidate) => {
            const role =
              candidate.id === game.dealerId && !candidate.active
                ? t("skatSittingOut")
                : candidate.id === game.forehandId
                  ? t("skatForehand")
                  : candidate.id === game.middlehandId
                    ? t("skatMiddlehand")
                    : t("skatRearhand");
            return (
              <article
                key={candidate.id}
                className={
                  candidate.id === game.currentPlayerId ? "current" : ""
                }
              >
                <h3>
                  {candidate.name}
                  {candidate.id === playerId ? ` (${t("you")})` : ""}
                </h3>
                <p>{role}</p>
                <dl>
                  <div>
                    <dt>{t("score")}</dt>
                    <dd>{candidate.score}</dd>
                  </div>
                  <div>
                    <dt>{t("tricks")}</dt>
                    <dd>{candidate.active ? candidate.tricks : "–"}</dd>
                  </div>
                  <div>
                    <dt>{t("cards")}</dt>
                    <dd>{candidate.handCount ?? candidate.hand.length}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel trick-table" aria-labelledby="skat-table-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("table")}</p>
            <h2 id="skat-table-title">{t("currentTrick")}</h2>
          </div>
          <div
            className="skat-stack"
            aria-label={t("skatCardsCount", { count: game.skatCount })}
          >
            <span className="card-back compact-card" aria-hidden="true" />
            <strong>{t("skatName")}</strong>
          </div>
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

      {revealedDeclarer && revealedDeclarer.hand.length > 0 && (
        <section
          className="panel skat-open-hand"
          aria-labelledby="skat-open-hand-title"
        >
          <h2 id="skat-open-hand-title">
            {t("skatOpenHand", { name: revealedDeclarer.name })}
          </h2>
          <div
            className="hand-cards"
            role="group"
            aria-label={t("skatOpenHand", { name: revealedDeclarer.name })}
          >
            {revealedDeclarer.hand.map((card) => (
              <div
                className="playing-card"
                role="img"
                aria-label={cardText(card)}
                key={card.id}
              >
                <CardFace card={card} />
              </div>
            ))}
          </div>
        </section>
      )}

      {me.active && (
        <section className="hand panel" aria-labelledby="skat-hand-title">
          <div className="section-heading hand-heading">
            <h2 id="skat-hand-title">
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
              const playable = cardSelectable(card);
              return (
                <SortableHandCard
                  key={card.id}
                  cardId={card.id}
                  moveCard={handSorting.moveCard}
                  moveCardBy={handSorting.moveCardBy}
                >
                  <button
                    className={`playing-card ${selected.includes(card.id) ? "selected" : ""}`}
                    disabled={!playable}
                    aria-pressed={selected.includes(card.id)}
                    aria-label={t("handCard", {
                      card: cardText(card),
                      index: index + 1,
                      count: me.hand.length,
                      state: playable ? t("playable") : t("notPlayable"),
                    })}
                    onClick={() => toggleCard(card)}
                  >
                    <CardFace card={card} />
                  </button>
                </SortableHandCard>
              );
            })}
          </div>
        </section>
      )}

      <section
        className="actions panel skat-actions"
        aria-labelledby="skat-actions-title"
      >
        <h2 id="skat-actions-title">{t("actions")}</h2>
        {game.phase === "bidding" &&
          game.currentPlayerId === playerId &&
          (game.auctionStage === "forehand" ? (
            <div className="action-row">
              <button
                className="primary"
                onClick={() => sendAction({ type: "skat:bid", bid: 18 })}
              >
                {t("skatPlayAt18")}
              </button>
              <button onClick={() => sendAction({ type: "skat:pass" })}>
                {t("pass")}
              </button>
            </div>
          ) : game.listenerId === playerId && game.pendingBid !== undefined ? (
            <div className="skat-bid-response">
              <p>{t("skatBidPrompt", { count: game.pendingBid })}</p>
              <div className="action-row">
                <button
                  className="primary"
                  onClick={() => sendAction({ type: "skat:hold" })}
                >
                  {t("skatHold")}
                </button>
                <button onClick={() => sendAction({ type: "skat:pass" })}>
                  {t("pass")}
                </button>
              </div>
            </div>
          ) : game.bidderId === playerId ? (
            <div className="bid-controls">
              {availableBids.length > 0 && (
                <>
                  <ResponsiveSelect
                    label={t("yourBid")}
                    value={String(bid)}
                    onChange={(value) => setBid(Number(value))}
                    options={availableBids.map((value) => ({
                      value: String(value),
                      label: String(value),
                    }))}
                  />
                  <button
                    className="primary"
                    onClick={() => sendAction({ type: "skat:bid", bid })}
                  >
                    {t("skatBid")}
                  </button>
                </>
              )}
              <button onClick={() => sendAction({ type: "skat:pass" })}>
                {t("pass")}
              </button>
            </div>
          ) : null)}
        {game.phase === "skat-choice" && game.declarerId === playerId && (
          <div className="action-row">
            <button
              className="primary"
              onClick={() => sendAction({ type: "skat:pick-up" })}
            >
              {t("skatPickUp")}
            </button>
            <button onClick={() => sendAction({ type: "skat:choose-hand" })}>
              {t("skatPlayHand")}
            </button>
          </div>
        )}
        {game.phase === "discarding" && game.declarerId === playerId && (
          <div>
            <p className="action-hint">{t("skatDiscardHint")}</p>
            <button
              className="primary"
              disabled={selected.length !== 2}
              onClick={() =>
                sendAction({ type: "skat:discard", cardIds: selected })
              }
            >
              {t("skatDiscardSelected", { count: selected.length })}
            </button>
          </div>
        )}
        {game.phase === "declaring" && game.declarerId === playerId && (
          <div className="skat-declaration-controls">
            <label>
              {t("skatGameType")}
              <ResponsiveSelect
                label={t("skatGameType")}
                value={contract}
                onChange={(value) => setContract(value as SkatContract)}
                options={(
                  [
                    "diamonds",
                    "hearts",
                    "spades",
                    "clubs",
                    "grand",
                    "null",
                  ] as const
                )
                  .map((value) => ({
                    value,
                    label: contractLabel(value),
                  }))
                  .filter(
                    (option) =>
                      option.value !== "null" ||
                      nullAnnouncementOptions.length > 0,
                  )}
              />
            </label>
            <label>
              {t("skatAnnouncement")}
              <ResponsiveSelect
                label={t("skatAnnouncement")}
                value={announcement}
                onChange={(value) => setAnnouncement(value as SkatAnnouncement)}
                options={announcementOptions.map((value) => ({
                  value,
                  label: t(`skatAnnouncement_${value}`),
                }))}
              />
            </label>
            <button
              className="primary"
              onClick={() =>
                sendAction({ type: "skat:declare", contract, announcement })
              }
            >
              {t("skatDeclare")}
            </button>
          </div>
        )}
        {game.phase === "playing" && me.active && (
          <button
            className="primary"
            disabled={!selectedCard || !canPlay(selectedCard)}
            onClick={() =>
              selectedCard &&
              sendAction({ type: "skat:play", cardId: selectedCard.id })
            }
          >
            {t("playCard")}
          </button>
        )}
        {game.phase === "playing" && !me.active && (
          <p className="action-hint">{t("skatDealerWait")}</p>
        )}
        {(game.phase === "round-ended" || game.phase === "finished") &&
          result && (
            <div className="skat-round-result" role="status">
              <h3>
                {result.passed
                  ? t("skatPassedDeal")
                  : t(result.won ? "skatDeclarerWon" : "skatDeclarerLost", {
                      name: playerName(result.declarerId),
                    })}
              </h3>
              {!result.passed && (
                <dl>
                  <div>
                    <dt>{t("skatGameType")}</dt>
                    <dd>{contractLabel(result.contract)}</dd>
                  </div>
                  <div>
                    <dt>{t("skatHighestBid")}</dt>
                    <dd>{result.bidValue}</dd>
                  </div>
                  {result.contract !== "null" && (
                    <div>
                      <dt>{t("skatCardPoints")}</dt>
                      <dd>{result.cardPoints}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t("skatGameValue")}</dt>
                    <dd>{result.gameValue}</dd>
                  </div>
                  <div>
                    <dt>{t("score")}</dt>
                    <dd>
                      {result.deltas[result.declarerId!]! > 0 ? "+" : ""}
                      {result.deltas[result.declarerId!]}
                    </dd>
                  </div>
                </dl>
              )}
              {result.overbid && (
                <p className="action-hint">{t("skatOverbidResult")}</p>
              )}
              {game.phase === "round-ended" && (
                <button
                  className="primary"
                  onClick={() => sendAction({ type: "skat:next-round" })}
                >
                  {t("nextRound")}
                </button>
              )}
            </div>
          )}
        {game.phase === "finished" && (
          <p className="result-banner" role="status">
            {t("skatWinner", {
              names: game.result?.winnerIds.map(playerName).join(", "),
            })}
          </p>
        )}
      </section>
    </section>
  );
}
