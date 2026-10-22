import { describe, expect, it } from "vitest";
import {
  applyCheatAction,
  applyOhHellAction,
  applySpadesAction,
  cheatPlayerView,
  createCheatDeck,
  createCheatGame,
  createOhHellGame,
  createSpadesGame,
  type Card,
} from "./index.js";

const people = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player${index + 1}`,
  }));
const noShuffle = () => 0;
const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
});

describe("Spades", () => {
  it("deals 13 cards and assigns opposite players to teams", () => {
    const game = createSpadesGame("s", people(4), noShuffle);
    expect(game.players.every((player) => player.hand.length === 13)).toBe(
      true,
    );
    expect(game.players.map((player) => player.teamId)).toEqual([
      "team-1",
      "team-2",
      "team-1",
      "team-2",
    ]);
  });

  it("enforces following suit and prevents leading unbroken spades", () => {
    const game = createSpadesGame("s", people(4), noShuffle);
    game.phase = "playing";
    game.currentPlayerId = "p1";
    game.players[0]!.hand = [card("clubs", "2"), card("spades", "ace")];
    game.trick = [{ playerId: "p4", card: card("clubs", "king") }];
    expect(() =>
      applySpadesAction(
        game,
        "p1",
        { type: "spades:play", cardId: "spades-ace" },
        noShuffle,
      ),
    ).toThrow("must_follow_suit");
    game.trick = [];
    expect(() =>
      applySpadesAction(
        game,
        "p1",
        { type: "spades:play", cardId: "spades-ace" },
        noShuffle,
      ),
    ).toThrow("spades_not_broken");
  });

  it("keeps Nil separate while scoring team contracts and bags", () => {
    const game = createSpadesGame("s", people(4), noShuffle, {
      targetScore: 1000,
      nilBonus: 100,
      bagPenalty: true,
    });
    game.phase = "playing";
    game.currentPlayerId = "p1";
    game.players.forEach((player, index) => {
      player.hand = [
        card("clubs", ["2", "3", "4", "5"][index] as Card["rank"]),
      ];
      player.bid = [1, 0, 1, 1][index]!;
    });
    let next = game;
    for (const id of ["p1", "p2", "p3", "p4"])
      next = applySpadesAction(
        next,
        id,
        {
          type: "spades:play",
          cardId: next.players.find((player) => player.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.phase).toBe("round-ended");
    expect(next.roundResult).toBeDefined();
    expect(next.scores["team-2"]).toBeGreaterThan(next.scores["team-1"]);
  });

  it("applies the 100 point penalty whenever ten bags accumulate", () => {
    const game = createSpadesGame("s", people(4), noShuffle, {
      targetScore: 1000,
      nilBonus: 100,
      bagPenalty: true,
    });
    game.phase = "playing";
    game.currentPlayerId = "p1";
    game.bags["team-1"] = 1;
    const cards = [
      card("clubs", "ace"),
      card("clubs", "king"),
      card("clubs", "queen"),
      card("clubs", "jack"),
    ];
    game.players.forEach((player, index) => {
      player.hand = [cards[index]!];
      player.bid = 1;
      player.tricks = index === 0 || index === 2 ? 5 : 1;
    });
    let next = game;
    for (const id of ["p1", "p2", "p3", "p4"])
      next = applySpadesAction(
        next,
        id,
        {
          type: "spades:play",
          cardId: next.players.find((player) => player.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.bags["team-1"]).toBe(0);
    expect(next.roundResult?.teamDeltas["team-1"]).toBe(-71);
  });
});

describe("Oh Hell", () => {
  it("creates the descending and ascending schedule for every supported player count", () => {
    for (const count of [3, 4, 5, 6, 7]) {
      const game = createOhHellGame(`o${count}`, people(count), noShuffle);
      expect(game.schedule.at(-1)).toBe(game.schedule[0]);
      expect(Math.min(...game.schedule)).toBe(1);
      expect(
        game.players.every((player) => player.hand.length === game.handSize),
      ).toBe(true);
    }
  });

  it("prevents the dealer from making all bids equal the trick count", () => {
    let game = createOhHellGame("o", people(3), noShuffle);
    game = applyOhHellAction(
      game,
      "p1",
      { type: "oh-hell:bid", bid: 0 },
      noShuffle,
    );
    game = applyOhHellAction(
      game,
      "p2",
      { type: "oh-hell:bid", bid: 0 },
      noShuffle,
    );
    expect(() =>
      applyOhHellAction(
        game,
        "p3",
        { type: "oh-hell:bid", bid: game.handSize },
        noShuffle,
      ),
    ).toThrow("dealer_bid_forbidden");
  });

  it("requires players to follow the led suit", () => {
    const game = createOhHellGame("o", people(3), noShuffle);
    game.phase = "playing";
    game.currentPlayerId = "p1";
    game.players[0]!.hand = [card("hearts", "2"), card("spades", "ace")];
    game.trick = [{ playerId: "p3", card: card("hearts", "king") }];
    expect(() =>
      applyOhHellAction(
        game,
        "p1",
        { type: "oh-hell:play", cardId: "spades-ace" },
        noShuffle,
      ),
    ).toThrow("must_follow_suit");
  });

  it("scores exact bids with a bonus and preserves shared winners", () => {
    const game = createOhHellGame("o", people(3), noShuffle);
    game.phase = "playing";
    game.currentPlayerId = "p1";
    game.handSize = 1;
    game.roundNumber = game.schedule.length;
    game.trumpSuit = "spades";
    const cards = [
      card("clubs", "ace"),
      card("clubs", "king"),
      card("clubs", "queen"),
    ];
    game.players.forEach((player, index) => {
      player.hand = [cards[index]!];
      player.bid = index === 0 ? 1 : 0;
    });
    let next = game;
    for (const id of ["p1", "p2", "p3"])
      next = applyOhHellAction(
        next,
        id,
        {
          type: "oh-hell:play",
          cardId: next.players.find((player) => player.id === id)!.hand[0]!.id,
        },
        noShuffle,
      );
    expect(next.phase).toBe("finished");
    expect(next.players.map((player) => player.score)).toEqual([11, 10, 10]);
    expect(next.result?.winnerIds).toEqual(["p1"]);
  });
});

describe("Cheat", () => {
  it("creates unique one- and two-deck packs and hides private cards", () => {
    expect(new Set(createCheatDeck(2).map((item) => item.id)).size).toBe(104);
    const game = createCheatGame("c", people(4), noShuffle);
    const view = cheatPlayerView(game, "p1");
    expect(view.players[0]!.hand.length).toBeGreaterThan(0);
    expect(
      view.players.slice(1).every((player) => player.hand.length === 0),
    ).toBe(true);
  });

  it("makes the challenger take the pile after a truthful claim", () => {
    const game = createCheatGame("c", people(2), noShuffle);
    game.currentRank = "ace";
    game.players[0]!.hand = [card("clubs", "ace"), card("clubs", "2")];
    game.players[1]!.hand = [card("hearts", "3")];
    const played = applyCheatAction(game, "p1", {
      type: "cheat:play",
      cardIds: ["clubs-ace"],
    });
    const challenged = applyCheatAction(played, "p2", {
      type: "cheat:challenge",
    });
    expect(challenged.lastChallenge?.truthful).toBe(true);
    expect(challenged.players[1]!.hand).toHaveLength(2);
    expect(challenged.pile).toHaveLength(0);
  });

  it("returns the entire pile to a caught liar", () => {
    const game = createCheatGame("c", people(2), noShuffle);
    game.currentRank = "ace";
    game.players[0]!.hand = [card("clubs", "2"), card("clubs", "3")];
    game.players[1]!.hand = [card("hearts", "4")];
    const played = applyCheatAction(game, "p1", {
      type: "cheat:play",
      cardIds: ["clubs-2"],
    });
    const challenged = applyCheatAction(played, "p2", {
      type: "cheat:challenge",
    });
    expect(challenged.lastChallenge?.truthful).toBe(false);
    expect(challenged.players[0]!.hand.map((item) => item.rank)).toEqual([
      "3",
      "2",
    ]);
  });

  it("continues when a player's final claim is exposed as a lie", () => {
    const game = createCheatGame("c", people(2), noShuffle);
    game.currentRank = "ace";
    game.players[0]!.hand = [card("clubs", "2")];
    game.players[1]!.hand = [card("hearts", "4")];
    const played = applyCheatAction(game, "p1", {
      type: "cheat:play",
      cardIds: ["clubs-2"],
    });
    const challenged = applyCheatAction(played, "p2", {
      type: "cheat:challenge",
    });
    expect(challenged.phase).toBe("playing");
    expect(challenged.result).toBeUndefined();
    expect(challenged.players[0]!.hand).toHaveLength(1);
  });

  it("does not award the win until the final claim survives", () => {
    const game = createCheatGame("c", people(2), noShuffle);
    game.currentRank = "ace";
    game.players[0]!.hand = [card("clubs", "ace")];
    game.players[1]!.hand = [card("hearts", "4")];
    const played = applyCheatAction(game, "p1", {
      type: "cheat:play",
      cardIds: ["clubs-ace"],
    });
    expect(played.phase).toBe("playing");
    expect(played.pendingWinnerId).toBe("p1");
    const accepted = applyCheatAction(played, "p2", { type: "cheat:accept" });
    expect(accepted.phase).toBe("finished");
    expect(accepted.result?.winnerId).toBe("p1");
  });

  it("uses ace, king, queen as the beginning of the descending sequence", () => {
    const game = createCheatGame("c", people(2), noShuffle, {
      deckCount: 1,
      direction: "descending",
      maxCardsPerTurn: 4,
    });
    game.players[0]!.hand = [card("clubs", "ace"), card("clubs", "2")];
    const played = applyCheatAction(game, "p1", {
      type: "cheat:play",
      cardIds: ["clubs-ace"],
    });
    expect(played.currentRank).toBe("king");
  });
});
