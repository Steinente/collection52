import { describe, expect, it } from "vitest";
import {
  analyzeGinHand,
  applyRommeAction,
  createCanastaDeck,
  createGinDeck,
  createRommeDeck,
  createRommeGame,
  defaultRommeRules,
  detectRommeMeld,
  ginRoundScore,
  isPotentialCanastaMeld,
  isValidCanastaMeld,
  isPotentialRommeMeld,
  isValidRommeMeld,
  rommeMeldPoints,
  type RommeCard,
  type RommeState,
} from "./romme.js";

const zero = () => 0;
const people = [
  { id: "a", name: "Anna" },
  { id: "b", name: "Ben" },
];
const card = (
  suit: "clubs" | "diamonds" | "hearts" | "spades",
  rank: Exclude<RommeCard["rank"], "joker">,
  copy = 1,
): RommeCard => ({ id: `${suit}-${rank}-${copy}`, suit, rank });
const joker = (index = 1): RommeCard => ({
  id: `joker-${index}`,
  suit: "joker",
  rank: "joker",
});

describe("Canasta engine", () => {
  const canastaPeople = [
    { id: "a", name: "Anna" },
    { id: "b", name: "Ben" },
    { id: "c", name: "Cara" },
    { id: "d", name: "Dino" },
  ];
  const canastaRules = {
    ...defaultRommeRules,
    variant: "canasta" as const,
  };

  it("uses 108 unique cards, fixed partnerships, and eleven-card hands", () => {
    expect(createCanastaDeck()).toHaveLength(108);
    expect(new Set(createCanastaDeck().map((item) => item.id)).size).toBe(108);
    const game = createRommeGame(
      "canasta",
      canastaPeople,
      zero,
      canastaRules,
    );
    expect(game.players.map((player) => player.teamId)).toEqual([
      "team-1",
      "team-2",
      "team-1",
      "team-2",
    ]);
    expect(game.players.every((player) => player.hand.length === 11)).toBe(
      true,
    );
    expect(() =>
      createRommeGame("canasta", people, zero, canastaRules),
    ).toThrow("canasta_requires_four_players");
  });

  it("validates same-rank melds with Canasta wild-card limits", () => {
    expect(
      isValidCanastaMeld([
        card("clubs", "8"),
        card("hearts", "8"),
        joker(),
      ]),
    ).toBe(true);
    expect(
      isValidCanastaMeld([
        card("clubs", "8"),
        card("hearts", "8"),
        joker(),
        joker(2),
        joker(3),
        card("spades", "2"),
      ]),
    ).toBe(false);
    expect(
      isPotentialCanastaMeld([
        card("clubs", "queen"),
        card("hearts", "queen"),
      ]),
    ).toBe(true);
    expect(
      isPotentialCanastaMeld([
        card("clubs", "queen"),
        card("hearts", "king"),
      ]),
    ).toBe(false);
  });

  it("takes a frozen discard pile only with a natural pair", () => {
    const game = createRommeGame(
      "canasta",
      canastaPeople,
      zero,
      canastaRules,
    );
    const player = game.players.find(
      (candidate) => candidate.id === game.currentPlayerId,
    )!;
    player.hand = [
      card("clubs", "8"),
      card("hearts", "8"),
      card("clubs", "4"),
    ];
    game.discard = [card("diamonds", "5"), card("spades", "8")];
    game.canastaDiscardFrozen = true;

    const next = applyRommeAction(
      game,
      player.id,
      { type: "romme:draw", source: "discard" },
      zero,
    );
    expect(next.discard).toHaveLength(0);
    expect(next.players.find((item) => item.id === player.id)?.hand).toHaveLength(
      5,
    );
    expect(next.drawnDiscardId).toBe("spades-8-1");
  });

  it("opens melds for both partners using the score-based minimum", () => {
    const game = createRommeGame(
      "canasta",
      canastaPeople,
      zero,
      canastaRules,
    );
    const player = game.players.find(
      (candidate) => candidate.id === game.currentPlayerId,
    )!;
    player.hand = [
      card("clubs", "ace"),
      card("hearts", "ace"),
      card("spades", "ace"),
      card("clubs", "4"),
    ];
    game.hasDrawn = true;
    const next = applyRommeAction(
      game,
      player.id,
      {
        type: "romme:meld",
        groups: [
          {
            cardIds: ["clubs-ace-1", "hearts-ace-1", "spades-ace-1"],
          },
        ],
      },
      zero,
    );
    expect(
      next.players
        .filter((candidate) => candidate.teamId === player.teamId)
        .every((candidate) => candidate.opened),
    ).toBe(true);
    expect(next.melds[0]).toMatchObject({
      ownerId: player.teamId,
      points: 60,
    });
  });
});
const state = (hand: RommeCard[]): RommeState => ({
  id: "game",
  players: [
    { ...people[0]!, connected: true, hand, opened: false },
    {
      ...people[1]!,
      connected: true,
      hand: [card("clubs", "2")],
      opened: false,
    },
  ],
  deck: [card("spades", "2")],
  discard: [card("hearts", "3")],
  melds: [],
  currentPlayerId: "a",
  hasDrawn: true,
  rules: {
    variant: "classic",
    openingPoints: 40,
    requireDiscardUse: false,
    ginTargetScore: 100,
    canastaTargetScore: 5000,
    canastaRequireCanastaToGoOut: true,
  },
  phase: "playing",
  version: 1,
});

describe("Rommé engine", () => {
  it("uses 110 unique cards and deals thirteen cards", () => {
    expect(createRommeDeck()).toHaveLength(110);
    expect(new Set(createRommeDeck().map((item) => item.id)).size).toBe(110);
    const game = createRommeGame("game", people, zero);
    expect(game.players.every((player) => player.hand.length === 13)).toBe(
      true,
    );
    expect(game.deck).toHaveLength(83);
  });
  it("validates sets and low/high ace runs without wrapping", () => {
    expect(
      isValidRommeMeld("set", [
        card("clubs", "king"),
        card("hearts", "king"),
        joker(),
      ]),
    ).toBe(true);
    expect(
      rommeMeldPoints("run", [
        card("hearts", "ace"),
        card("hearts", "2"),
        card("hearts", "3"),
      ]),
    ).toBe(6);
    expect(
      rommeMeldPoints("run", [
        card("hearts", "queen"),
        card("hearts", "king"),
        card("hearts", "ace"),
      ]),
    ).toBe(31);
    expect(
      isValidRommeMeld("run", [
        card("hearts", "king"),
        card("hearts", "ace"),
        card("hearts", "2"),
      ]),
    ).toBe(false);
    expect(
      isValidRommeMeld("set", [card("clubs", "king"), joker(), joker(2)]),
    ).toBe(false);
  });
  it("recognizes the meld type and rejects selections that cannot become a meld", () => {
    expect(
      detectRommeMeld([
        card("clubs", "5"),
        card("diamonds", "5"),
        card("hearts", "5"),
      ])?.kind,
    ).toBe("set");
    expect(
      detectRommeMeld([
        card("spades", "5"),
        card("spades", "6"),
        card("spades", "7"),
      ])?.kind,
    ).toBe("run");
    expect(
      isPotentialRommeMeld([card("clubs", "5"), card("clubs", "5", 2)]),
    ).toBe(false);
    expect(
      isPotentialRommeMeld([card("clubs", "5"), card("diamonds", "5")]),
    ).toBe(true);
    expect(isPotentialRommeMeld([card("clubs", "5"), card("clubs", "6")])).toBe(
      true,
    );
    expect(
      isPotentialRommeMeld([card("clubs", "5"), card("diamonds", "6")]),
    ).toBe(false);
  });
  it("allows several groups to jointly reach the 40-point opening", () => {
    const hand = [
      card("clubs", "king"),
      card("hearts", "king"),
      card("spades", "king"),
      card("hearts", "7"),
      card("hearts", "8"),
      card("hearts", "9"),
      card("clubs", "2"),
    ];
    const next = applyRommeAction(
      state(hand),
      "a",
      {
        type: "romme:meld",
        groups: [
          { cardIds: hand.slice(0, 3).map((item) => item.id) },
          { cardIds: hand.slice(3, 6).map((item) => item.id) },
        ],
      },
      zero,
    );
    expect(next.players[0]?.opened).toBe(true);
    expect(next.melds.map((meld) => meld.kind)).toEqual(["set", "run"]);
    expect(new Set(next.melds.map((meld) => meld.id)).size).toBe(2);
    expect(next.players[0]?.hand).toHaveLength(1);
  });
  it("places cards laid off on a run in their actual sequence", () => {
    const game = state([card("spades", "10"), card("spades", "6")]);
    game.players[0]!.opened = true;
    game.melds = [
      {
        id: "run",
        ownerId: "b",
        kind: "run",
        cards: [card("spades", "7"), card("spades", "8"), card("spades", "9")],
        points: 24,
      },
    ];
    const next = applyRommeAction(
      game,
      "a",
      {
        type: "romme:lay-off",
        meldId: "run",
        cardIds: ["spades-10-1", "spades-6-1"],
      },
      zero,
    );
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual([
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
  });
  it("allows a seven before an eight-nine-joker run", () => {
    const game = state([card("diamonds", "7"), card("clubs", "6")]);
    game.players[0]!.opened = true;
    game.melds = [
      {
        id: "diamond-run",
        ownerId: "b",
        kind: "run",
        cards: [card("diamonds", "8"), card("diamonds", "9"), joker()],
        points: 27,
      },
    ];
    const next = applyRommeAction(
      game,
      "a",
      {
        type: "romme:lay-off",
        meldId: "diamond-run",
        cardIds: ["diamonds-7-1"],
      },
      zero,
    );
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual([
      "7",
      "8",
      "9",
      "joker",
    ]);
  });
  it("lays off onto the compatible meld when a legacy game contains duplicate meld ids", () => {
    const game = state([card("diamonds", "7"), card("clubs", "6")]);
    game.players[0]!.opened = true;
    game.melds = [
      {
        id: "legacy-duplicate",
        ownerId: "b",
        kind: "run",
        cards: [
          card("spades", "9"),
          card("spades", "10"),
          card("spades", "jack"),
        ],
        points: 29,
      },
      {
        id: "legacy-duplicate",
        ownerId: "b",
        kind: "run",
        cards: [card("diamonds", "8"), card("diamonds", "9"), joker()],
        points: 27,
      },
    ];
    const next = applyRommeAction(
      game,
      "a",
      {
        type: "romme:lay-off",
        meldId: "legacy-duplicate",
        cardIds: ["diamonds-7-1"],
      },
      zero,
    );
    expect(next.melds[1]?.cards.map((item) => item.rank)).toEqual([
      "7",
      "8",
      "9",
      "joker",
    ]);
    expect(new Set(next.melds.map((meld) => meld.id)).size).toBe(2);
  });
  it("places a joker at the represented position in an ordered run", () => {
    const hand = [
      joker(),
      card("spades", "9"),
      card("spades", "7"),
      card("spades", "8"),
      card("clubs", "2"),
    ];
    const game = state(hand);
    game.rules.openingPoints = 30;
    const next = applyRommeAction(
      game,
      "a",
      {
        type: "romme:meld",
        groups: [{ cardIds: hand.slice(0, 4).map((item) => item.id) }],
      },
      zero,
    );
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual([
      "7",
      "8",
      "9",
      "joker",
    ]);
  });
  it("infers the new meld type when exchanging a joker", () => {
    const game = state([
      card("diamonds", "5"),
      card("clubs", "7"),
      card("clubs", "8"),
    ]);
    game.players[0]!.opened = true;
    game.melds = [
      {
        id: "set",
        ownerId: "b",
        kind: "set",
        cards: [
          card("clubs", "5"),
          card("hearts", "5"),
          card("spades", "5"),
          joker(),
        ],
        points: 20,
      },
    ];
    const next = applyRommeAction(
      game,
      "a",
      {
        type: "romme:replace-joker",
        meldId: "set",
        jokerId: "joker-1",
        cardIds: game.players[0]!.hand.map((item) => item.id),
      },
      zero,
    );
    expect(next.melds[0]?.cards.some((item) => item.rank === "joker")).toBe(
      false,
    );
    expect(next.melds[1]?.kind).toBe("run");
    expect(next.melds[1]?.cards.map((item) => item.rank)).toEqual([
      "7",
      "8",
      "joker",
    ]);
  });
  it("rejects an opening below the configured minimum", () => {
    const hand = [
      card("clubs", "2"),
      card("hearts", "2"),
      card("spades", "2"),
      card("clubs", "ace"),
    ];
    expect(() =>
      applyRommeAction(
        state(hand),
        "a",
        {
          type: "romme:meld",
          groups: [{ cardIds: hand.slice(0, 3).map((item) => item.id) }],
        },
        zero,
      ),
    ).toThrow("opening_points_required");
  });
  it("requires draw first and optionally requires use of a picked-up discard", () => {
    const game = state([
      card("clubs", "3"),
      card("diamonds", "3"),
      card("spades", "3"),
      card("clubs", "ace"),
    ]);
    game.hasDrawn = false;
    game.rules.requireDiscardUse = true;
    expect(() =>
      applyRommeAction(
        game,
        "a",
        { type: "romme:discard", cardId: "clubs-ace-1" },
        zero,
      ),
    ).toThrow("must_draw_first");
    const drawn = applyRommeAction(
      game,
      "a",
      { type: "romme:draw", source: "discard" },
      zero,
    );
    expect(() =>
      applyRommeAction(
        drawn,
        "a",
        { type: "romme:discard", cardId: "clubs-ace-1" },
        zero,
      ),
    ).toThrow("discard_must_be_used");
  });
});

describe("Gin-Rommé engine", () => {
  const ginRules = {
    variant: "gin",
    openingPoints: 40,
    requireDiscardUse: false,
    ginTargetScore: 100,
    canastaTargetScore: 5000,
    canastaRequireCanastaToGoOut: true,
  } as const;

  it("calculates knock, gin, and undercut scores explicitly", () => {
    expect(ginRoundScore(7, 19)).toEqual({
      winner: "knocker",
      points: 22,
      gin: false,
    });
    expect(ginRoundScore(0, 23)).toEqual({
      winner: "knocker",
      points: 58,
      gin: true,
    });
    expect(ginRoundScore(8, 7)).toEqual({
      winner: "opponent",
      points: 31,
      gin: false,
    });
  });

  it("uses one deck without jokers and deals ten cards to exactly two players", () => {
    expect(createGinDeck()).toHaveLength(52);
    expect(createGinDeck().some((item) => item.rank === "joker")).toBe(false);
    const game = createRommeGame("gin", people, zero, ginRules);
    expect(game.players.map((player) => player.hand.length)).toEqual([10, 10]);
    expect(game.deck).toHaveLength(31);
    expect(() =>
      createRommeGame(
        "gin",
        [...people, { id: "c", name: "Cara" }],
        zero,
        ginRules,
      ),
    ).toThrow("gin_requires_two_players");
  });

  it("finds the lowest deadwood while keeping aces low", () => {
    const hand = [
      card("hearts", "ace"),
      card("hearts", "2"),
      card("hearts", "3"),
      card("clubs", "7"),
      card("diamonds", "7"),
      card("spades", "7"),
      card("clubs", "king"),
    ];
    const analysis = analyzeGinHand(hand);
    expect(analysis.melds).toHaveLength(2);
    expect(analysis.deadwood.map((item) => item.id)).toEqual(["clubs-king-1"]);
    expect(analysis.deadwoodPoints).toBe(10);
  });

  it("offers the upcard in order and makes the non-dealer draw after two passes", () => {
    let game = createRommeGame("gin", people, zero, ginRules);
    const nonDealer = game.currentPlayerId;
    const dealer = game.dealerId!;
    game = applyRommeAction(
      game,
      nonDealer,
      { type: "romme:pass-opening" },
      zero,
    );
    expect(game.currentPlayerId).toBe(dealer);
    game = applyRommeAction(game, dealer, { type: "romme:pass-opening" }, zero);
    expect(game.currentPlayerId).toBe(nonDealer);
    expect(() =>
      applyRommeAction(
        game,
        nonDealer,
        { type: "romme:draw", source: "discard" },
        zero,
      ),
    ).toThrow("opening_stock_required");
    expect(
      applyRommeAction(
        game,
        nonDealer,
        { type: "romme:draw", source: "stock" },
        zero,
      ).hasDrawn,
    ).toBe(true);
  });

  it("scores Gin and ends the round", () => {
    const game = createRommeGame("gin", people, zero, ginRules);
    const player = game.players.find(
      (item) => item.id === game.currentPlayerId,
    )!;
    player.hand = [
      card("hearts", "ace"),
      card("hearts", "2"),
      card("hearts", "3"),
      card("clubs", "7"),
      card("diamonds", "7"),
      card("spades", "7"),
      card("hearts", "7"),
      card("spades", "9"),
      card("spades", "10"),
      card("spades", "jack"),
      card("diamonds", "king"),
    ];
    game.hasDrawn = true;
    delete game.ginOpeningPasses;
    const result = applyRommeAction(
      game,
      player.id,
      { type: "romme:knock", cardId: "diamonds-king-1" },
      zero,
    );
    expect(result.phase).toBe("round-ended");
    expect(result.roundResult?.reason).toBe("gin");
    expect(result.roundResult?.winnerId).toBe(player.id);
    expect(result.roundResult?.pointsAwarded).toBeGreaterThanOrEqual(35);
  });
});
