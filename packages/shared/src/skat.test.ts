import { describe, expect, it } from "vitest";
import {
  applySkatAction,
  createDeck,
  createSkatGame,
  skatPlayerView,
  type Card,
  type SkatState,
} from "./index.js";

const people = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
const noShuffle = (max: number) => max - 1;
const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
});

function makeDeclarer(game: SkatState) {
  let next = applySkatAction(
    game,
    "p2",
    { type: "skat:bid", bid: 18 },
    noShuffle,
  );
  next = applySkatAction(next, "p1", { type: "skat:pass" }, noShuffle);
  return applySkatAction(next, "p3", { type: "skat:pass" }, noShuffle);
}

function prepareLastTrick(
  game: SkatState,
  contract: "clubs" | "diamonds" | "hearts" | "spades" | "grand" | "null",
  hands: Record<string, Card>,
) {
  game.phase = "playing";
  game.contract = contract;
  game.currentPlayerId = game.forehandId;
  game.trick = [];
  for (const candidate of game.players) {
    candidate.hand = [hands[candidate.id]!];
    candidate.wonCards = [];
    candidate.tricks = 0;
  }
  return game;
}

describe("Skat", () => {
  it("supports three and four players with exactly three active seats", () => {
    expect(() => createSkatGame("bad", people(2), noShuffle)).toThrow(
      "skat_requires_three_or_four_players",
    );
    for (const count of [3, 4]) {
      const game = createSkatGame(`s${count}`, people(count), noShuffle);
      expect(game.activePlayerIds).toEqual(["p1", "p2", "p3"]);
      expect(game.players.filter((candidate) => candidate.active)).toHaveLength(
        3,
      );
      expect(
        game.players
          .filter((candidate) => candidate.active)
          .every((candidate) => candidate.hand.length === 10),
      ).toBe(true);
      expect(game.skat).toHaveLength(2);
      if (count === 4) expect(game.players[3]!.active).toBe(false);
    }
  });

  it("runs both bidding contests and offers forehand 18 when everyone passes", () => {
    let game = createSkatGame("s", people(3), noShuffle);
    game = applySkatAction(game, "p2", { type: "skat:pass" }, noShuffle);
    expect(game.auctionStage).toBe(2);
    expect(game.currentPlayerId).toBe("p3");
    game = applySkatAction(game, "p3", { type: "skat:pass" }, noShuffle);
    expect(game.auctionStage).toBe("forehand");
    expect(game.currentPlayerId).toBe("p1");
    game = applySkatAction(game, "p1", { type: "skat:pass" }, noShuffle);
    expect(game.phase).toBe("round-ended");
    expect(game.roundResult?.passed).toBe(true);
  });

  it("lets the auction winner pick up, discard exactly two, and declare", () => {
    let game = makeDeclarer(createSkatGame("s", people(3), noShuffle));
    expect(game.declarerId).toBe("p2");
    expect(game.highestBid).toBe(18);
    game = applySkatAction(game, "p2", { type: "skat:pick-up" }, noShuffle);
    expect(game.players[1]!.hand).toHaveLength(12);
    expect(() =>
      applySkatAction(
        game,
        "p2",
        { type: "skat:discard", cardIds: [game.players[1]!.hand[0]!.id] },
        noShuffle,
      ),
    ).toThrow("skat_must_discard_two");
    const discarded = game.players[1]!.hand.slice(0, 2).map((item) => item.id);
    game = applySkatAction(
      game,
      "p2",
      { type: "skat:discard", cardIds: discarded },
      noShuffle,
    );
    game = applySkatAction(
      game,
      "p2",
      { type: "skat:declare", contract: "grand", announcement: "none" },
      noShuffle,
    );
    expect(game.phase).toBe("playing");
    expect(game.currentPlayerId).toBe("p1");
    expect(game.declarerCards).toHaveLength(12);
  });

  it("rejects a Null declaration whose fixed value is below the bid", () => {
    let game = makeDeclarer(createSkatGame("s", people(3), noShuffle));
    game.highestBid = 30;
    game = applySkatAction(game, "p2", { type: "skat:pick-up" }, noShuffle);
    game = applySkatAction(
      game,
      "p2",
      {
        type: "skat:discard",
        cardIds: game.players[1]!.hand.slice(0, 2).map((item) => item.id),
      },
      noShuffle,
    );
    expect(() =>
      applySkatAction(
        game,
        "p2",
        { type: "skat:declare", contract: "null", announcement: "none" },
        noShuffle,
      ),
    ).toThrow("skat_null_below_bid");
    const ouvert = applySkatAction(
      game,
      "p2",
      { type: "skat:declare", contract: "null", announcement: "ouvert" },
      noShuffle,
    );
    expect(ouvert.phase).toBe("playing");
  });

  it("requires players to follow the effective trump category", () => {
    const game = prepareLastTrick(
      makeDeclarer(createSkatGame("s", people(3), noShuffle)),
      "hearts",
      {
        p1: card("spades", "jack"),
        p2: card("clubs", "ace"),
        p3: card("diamonds", "7"),
      },
    );
    game.players[1]!.hand.push(card("hearts", "7"));
    const led = applySkatAction(
      game,
      "p1",
      { type: "skat:play", cardId: "spades-jack" },
      noShuffle,
    );
    expect(() =>
      applySkatAction(
        led,
        "p2",
        { type: "skat:play", cardId: "clubs-ace" },
        noShuffle,
      ),
    ).toThrow("must_follow_suit");
  });

  it("uses the special Null ranking where a king beats a jack and ten", () => {
    const game = prepareLastTrick(
      makeDeclarer(createSkatGame("s", people(3), noShuffle)),
      "null",
      {
        p1: card("hearts", "10"),
        p2: card("hearts", "jack"),
        p3: card("hearts", "king"),
      },
    );
    for (const candidate of game.players)
      candidate.hand.push(
        card(
          "clubs",
          candidate.id === "p1" ? "7" : candidate.id === "p2" ? "8" : "9",
        ),
      );
    let next = game;
    for (const id of ["p1", "p2", "p3"])
      next = applySkatAction(
        next,
        id,
        {
          type: "skat:play",
          cardId: next.players.find((item) => item.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.currentPlayerId).toBe("p3");
    expect(next.players[2]!.tricks).toBe(1);
  });

  it("scores matadors, Schneider, Schwarz, and overbidding correctly", () => {
    let game = makeDeclarer(createSkatGame("s", people(3), noShuffle));
    game = applySkatAction(game, "p2", { type: "skat:pick-up" }, noShuffle);
    game = applySkatAction(
      game,
      "p2",
      {
        type: "skat:discard",
        cardIds: game.players[1]!.hand.slice(0, 2).map((item) => item.id),
      },
      noShuffle,
    );
    game = applySkatAction(
      game,
      "p2",
      { type: "skat:declare", contract: "hearts", announcement: "none" },
      noShuffle,
    );
    game.highestBid = 50;
    game.declarerCards = [card("clubs", "jack")];
    game.skat = [card("diamonds", "7"), card("diamonds", "8")];
    const lastCards = [
      card("clubs", "7"),
      card("hearts", "ace"),
      card("diamonds", "9"),
    ];
    const excluded = new Set([
      ...lastCards.map((item) => item.id),
      ...game.skat.map((item) => item.id),
    ]);
    game.players[1]!.wonCards = createDeck(32).filter(
      (item) => !excluded.has(item.id),
    );
    game.players[1]!.tricks = 9;
    game.players.forEach((candidate, index) => {
      candidate.hand = [lastCards[index]!];
    });
    game.currentPlayerId = "p1";
    let next = game;
    for (const id of ["p1", "p2", "p3"])
      next = applySkatAction(
        next,
        id,
        {
          type: "skat:play",
          cardId: next.players.find((item) => item.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.roundResult).toMatchObject({
      won: false,
      overbid: true,
      gameValue: 50,
    });
    expect(next.players[1]!.score).toBe(-100);
  });

  it("applies Seeger–Fabian bonuses and protects private hands", () => {
    let game = makeDeclarer(
      createSkatGame("s", people(3), noShuffle, {
        roundsPerPlayer: 3,
        tournamentScoring: true,
      }),
    );
    game = applySkatAction(game, "p2", { type: "skat:choose-hand" }, noShuffle);
    game = applySkatAction(
      game,
      "p2",
      { type: "skat:declare", contract: "null", announcement: "none" },
      noShuffle,
    );
    const hidden = skatPlayerView(game, "p1");
    expect(hidden.players[1]!.hand).toHaveLength(0);
    game.players.forEach((candidate, index) => {
      candidate.hand = [
        [card("hearts", "7"), card("hearts", "ace"), card("hearts", "8")][
          index
        ]!,
      ];
    });
    game.currentPlayerId = "p1";
    let next = game;
    for (const id of ["p1", "p2", "p3"])
      next = applySkatAction(
        next,
        id,
        {
          type: "skat:play",
          cardId: next.players.find((item) => item.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.players.map((candidate) => candidate.score)).toEqual([
      40, -120, 40,
    ]);
  });
});
