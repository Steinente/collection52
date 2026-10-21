import { ranks52, suits, type Card, type Rank, shuffle } from "./cards.js";
import { RuleError } from "./durak.js";

export type RommeCard = Card | { id: string; suit: "joker"; rank: "joker" };
export type RommeVariant = "classic" | "gin";
export type RommeRules = {
  variant: RommeVariant;
  openingPoints: 30 | 40;
  requireDiscardUse: boolean;
  ginTargetScore: number;
};
export const defaultRommeRules: RommeRules = {
  variant: "classic",
  openingPoints: 40,
  requireDiscardUse: false,
  ginTargetScore: 100,
};
export type RommeMeld = {
  id: string;
  ownerId: string;
  kind: "set" | "run";
  cards: RommeCard[];
  points: number;
};
export type RommePlayer = {
  id: string;
  name: string;
  connected: boolean;
  hand: RommeCard[];
  opened: boolean;
};
export type GinHandAnalysis = {
  melds: Array<{ kind: "set" | "run"; cards: RommeCard[] }>;
  deadwood: RommeCard[];
  deadwoodPoints: number;
};
export type GinRoundResult = {
  reason: "knock" | "gin" | "undercut" | "stock";
  winnerId?: string;
  knockerId?: string;
  pointsAwarded: number;
  hands: Record<string, RommeCard[]>;
  analyses: Record<string, GinHandAnalysis>;
  scores: Record<string, number>;
};
export type RommeState = {
  id: string;
  players: RommePlayer[];
  deck: RommeCard[];
  discard: RommeCard[];
  melds: RommeMeld[];
  currentPlayerId: string;
  hasDrawn: boolean;
  drawnDiscardId?: string;
  rules: RommeRules;
  phase: "playing" | "round-ended" | "finished";
  version: number;
  result?: { winnerId: string; handPoints: Record<string, number> };
  roundNumber?: number;
  dealerId?: string;
  scores?: Record<string, number>;
  ginOpeningPasses?: number;
  ginStockEnding?: boolean;
  roundResult?: GinRoundResult;
};
export type RommeAction =
  | { type: "romme:draw"; source: "stock" | "discard" }
  | { type: "romme:meld"; groups: Array<{ cardIds: string[] }> }
  | { type: "romme:lay-off"; meldId: string; cardIds: string[] }
  | {
      type: "romme:replace-joker";
      meldId: string;
      jokerId: string;
      cardIds: string[];
    }
  | { type: "romme:discard"; cardId: string }
  | { type: "romme:knock"; cardId: string }
  | { type: "romme:pass-opening" }
  | { type: "romme:next-round" };

const rankNumber = (rank: Rank) => ranks52.indexOf(rank) + 2;
const cardPoint = (card: RommeCard) =>
  card.rank === "joker"
    ? 20
    : card.rank === "ace"
      ? 11
      : ["jack", "queen", "king"].includes(card.rank)
        ? 10
        : Number(card.rank);
export const rommeHandPoints = (cards: RommeCard[]) =>
  cards.reduce((sum, card) => sum + cardPoint(card), 0);

export function createRommeDeck(): RommeCard[] {
  const cards: RommeCard[] = [];
  for (let copy = 1; copy <= 2; copy += 1)
    for (const suit of suits)
      for (const rank of ranks52)
        cards.push({ id: `${suit}-${rank}-${copy}`, suit, rank });
  for (let index = 1; index <= 6; index += 1)
    cards.push({ id: `joker-${index}`, suit: "joker", rank: "joker" });
  return cards;
}

export function createGinDeck(): RommeCard[] {
  return suits.flatMap((suit) =>
    ranks52.map((rank) => ({ id: `${suit}-${rank}-1`, suit, rank })),
  );
}

const ginRankValue = (card: RommeCard) =>
  card.rank === "ace"
    ? 1
    : ["jack", "queen", "king"].includes(card.rank)
      ? 10
      : card.rank === "joker"
        ? 0
        : Number(card.rank);
const ginSequenceValue = (card: RommeCard) =>
  card.rank === "ace" ? 1 : card.rank === "joker" ? 0 : rankNumber(card.rank);

const GIN_BONUS = 25;
const UNDERCUT_BONUS = 20;
const ROUND_WIN_BONUS = 10;

export function ginRoundScore(
  knockerDeadwood: number,
  opponentDeadwood: number,
): { winner: "knocker" | "opponent"; points: number; gin: boolean } {
  const gin = knockerDeadwood === 0;
  const undercut = !gin && opponentDeadwood <= knockerDeadwood;
  return undercut
    ? {
        winner: "opponent",
        points:
          knockerDeadwood - opponentDeadwood + UNDERCUT_BONUS + ROUND_WIN_BONUS,
        gin,
      }
    : {
        winner: "knocker",
        points:
          opponentDeadwood -
          knockerDeadwood +
          (gin ? GIN_BONUS : 0) +
          ROUND_WIN_BONUS,
        gin,
      };
}

function ginMeldKind(cards: RommeCard[]): "set" | "run" | undefined {
  if (cards.length < 3 || cards.some((card) => card.rank === "joker"))
    return undefined;
  if (
    cards.length <= 4 &&
    new Set(cards.map((card) => card.rank)).size === 1 &&
    new Set(cards.map((card) => card.suit)).size === cards.length
  )
    return "set";
  if (new Set(cards.map((card) => card.suit)).size !== 1) return undefined;
  const values = cards.map(ginSequenceValue).sort((a, b) => a - b);
  return values.every(
    (value, index) => index === 0 || value === values[index - 1]! + 1,
  )
    ? "run"
    : undefined;
}

export function analyzeGinHand(cards: RommeCard[]): GinHandAnalysis {
  const naturalCards = cards.filter((card) => card.rank !== "joker");
  const meldOptions = ginMeldOptions(naturalCards);
  const memo = new Map<
    number,
    { coveredPoints: number; melds: typeof meldOptions }
  >();
  const solve = (
    used: number,
  ): { coveredPoints: number; melds: typeof meldOptions } => {
    const cached = memo.get(used);
    if (cached) return cached;
    let best = { coveredPoints: 0, melds: [] as typeof meldOptions };
    for (const meld of meldOptions)
      if ((meld.mask & used) === 0) {
        const tail = solve(used | meld.mask);
        const points =
          meld.cards.reduce((sum, card) => sum + ginRankValue(card), 0) +
          tail.coveredPoints;
        if (points > best.coveredPoints)
          best = { coveredPoints: points, melds: [meld, ...tail.melds] };
      }
    memo.set(used, best);
    return best;
  };
  const best = solve(0);
  const meldIds = new Set(
    best.melds.flatMap((meld) => meld.cards.map((card) => card.id)),
  );
  const deadwood = cards.filter((card) => !meldIds.has(card.id));
  return {
    melds: best.melds.map(({ kind, cards: meldCards }) => ({
      kind,
      cards: orderGinMeld(kind, meldCards),
    })),
    deadwood,
    deadwoodPoints: deadwood.reduce((sum, card) => sum + ginRankValue(card), 0),
  };
}

function ginMeldOptions(naturalCards: RommeCard[]) {
  const meldOptions: Array<{
    mask: number;
    kind: "set" | "run";
    cards: RommeCard[];
  }> = [];
  const limit = 1 << naturalCards.length;
  for (let mask = 1; mask < limit; mask += 1) {
    if (mask.toString(2).replaceAll("0", "").length < 3) continue;
    const subset = naturalCards.filter(
      (_, index) => (mask & (1 << index)) !== 0,
    );
    const kind = ginMeldKind(subset);
    if (kind) meldOptions.push({ mask, kind, cards: subset });
  }
  return meldOptions;
}

function orderGinMeld(kind: "set" | "run", cards: RommeCard[]) {
  return kind === "run"
    ? [...cards].sort((a, b) => ginSequenceValue(a) - ginSequenceValue(b))
    : cards;
}

function ginOpponentAnalysis(
  cards: RommeCard[],
  knocker: GinHandAnalysis,
): GinHandAnalysis {
  let best: GinHandAnalysis = analyzeGinHand(cards);
  const targetMelds = knocker.melds.map((meld) => ({
    ...meld,
    cards: [...meld.cards],
  }));
  const layOff = (
    remaining: RommeCard[],
    melds: typeof targetMelds,
    kept: RommeCard[],
    ownMelds: GinHandAnalysis["melds"],
  ) => {
    if (!remaining.length) {
      const points = kept.reduce((sum, card) => sum + ginRankValue(card), 0);
      if (points < best.deadwoodPoints)
        best = { melds: ownMelds, deadwood: kept, deadwoodPoints: points };
      return;
    }
    const [card, ...rest] = remaining;
    layOff(rest, melds, [...kept, card!], ownMelds);
    melds.forEach((meld, index) => {
      const combined = [...meld.cards, card!];
      if (ginMeldKind(combined) !== meld.kind) return;
      const next = melds.map((item, itemIndex) =>
        itemIndex === index ? { ...item, cards: combined } : item,
      );
      layOff(rest, next, kept, ownMelds);
    });
  };
  const options = ginMeldOptions(cards);
  const chooseOwnMelds = (
    start: number,
    used: number,
    ownMelds: GinHandAnalysis["melds"],
  ) => {
    const remaining = cards.filter((_, index) => (used & (1 << index)) === 0);
    layOff(remaining, targetMelds, [], ownMelds);
    for (let index = start; index < options.length; index += 1) {
      const option = options[index]!;
      if ((option.mask & used) !== 0) continue;
      chooseOwnMelds(index + 1, used | option.mask, [
        ...ownMelds,
        { kind: option.kind, cards: orderGinMeld(option.kind, option.cards) },
      ]);
    }
  };
  chooseOwnMelds(0, 0, []);
  return best;
}

function setPoints(cards: RommeCard[]) {
  const natural = cards.find((card) => card.rank !== "joker");
  return natural ? cards.length * cardPoint(natural) : 0;
}

function validateSet(cards: RommeCard[]) {
  if (cards.length < 3 || cards.length > 4) return undefined;
  const naturals = cards.filter((card): card is Card => card.rank !== "joker");
  if (
    naturals.length < 2 ||
    new Set(naturals.map((card) => card.rank)).size !== 1 ||
    new Set(naturals.map((card) => card.suit)).size !== naturals.length
  )
    return undefined;
  return setPoints(cards);
}

function runCandidate(cards: RommeCard[], aceHigh: boolean) {
  const naturals = cards.filter((card): card is Card => card.rank !== "joker");
  if (
    naturals.length < 2 ||
    new Set(naturals.map((card) => card.suit)).size !== 1
  )
    return undefined;
  const values = naturals
    .map((card) =>
      card.rank === "ace" ? (aceHigh ? 14 : 1) : rankNumber(card.rank),
    )
    .sort((a, b) => a - b);
  if (new Set(values).size !== values.length) return undefined;
  const candidates = Array.from(
    { length: 16 - cards.length - (aceHigh ? 2 : 1) },
    (_, index) => index + (aceHigh ? 2 : 1),
  )
    .map((start) => {
      const represented = Array.from(
        { length: cards.length },
        (_, index) => start + index,
      );
      if (values.some((value) => !represented.includes(value)))
        return undefined;
      const points = represented.reduce(
        (sum, value) =>
          sum + (value === 1 ? 1 : value === 14 ? 11 : Math.min(value, 10)),
        0,
      );
      return { points, represented, aceHigh };
    })
    .filter(
      (
        value,
      ): value is { points: number; represented: number[]; aceHigh: boolean } =>
        Boolean(value),
    );
  return candidates.sort((left, right) => right.points - left.points)[0];
}

const runCandidates = (cards: RommeCard[]) =>
  [runCandidate(cards, false), runCandidate(cards, true)]
    .filter(
      (
        value,
      ): value is { points: number; represented: number[]; aceHigh: boolean } =>
        Boolean(value),
    )
    .sort((a, b) => b.points - a.points);

function validateRun(cards: RommeCard[]) {
  if (cards.length < 3 || cards.length > 13) return undefined;
  return runCandidates(cards)[0]?.points;
}

function orderMeldCards(kind: RommeMeld["kind"], cards: RommeCard[]) {
  if (kind === "set") return cards;
  const candidate = runCandidates(cards)[0];
  if (!candidate) return cards;
  const naturals = cards.filter((card): card is Card => card.rank !== "joker");
  const jokers = cards.filter((card) => card.rank === "joker");
  const byValue = new Map(
    naturals.map((card) => [
      card.rank === "ace"
        ? candidate.aceHigh
          ? 14
          : 1
        : rankNumber(card.rank),
      card,
    ]),
  );
  return candidate.represented
    .map((value) => byValue.get(value) ?? jokers.shift()!)
    .filter(Boolean);
}

function ensureUniqueMeldIds(state: RommeState) {
  const occurrences = new Map<string, number>();
  for (const meld of state.melds) {
    const occurrence = occurrences.get(meld.id) ?? 0;
    occurrences.set(meld.id, occurrence + 1);
    if (occurrence > 0) meld.id = `${meld.id}:${occurrence}`;
  }
}

export function rommeMeldPoints(kind: "set" | "run", cards: RommeCard[]) {
  return kind === "set" ? validateSet(cards) : validateRun(cards);
}
export function isValidRommeMeld(kind: "set" | "run", cards: RommeCard[]) {
  return rommeMeldPoints(kind, cards) !== undefined;
}

export function detectRommeMeld(
  cards: RommeCard[],
): Pick<RommeMeld, "kind" | "points"> | undefined {
  const set = validateSet(cards);
  if (set !== undefined) return { kind: "set", points: set };
  const run = validateRun(cards);
  return run === undefined ? undefined : { kind: "run", points: run };
}

export function isPotentialRommeMeld(cards: RommeCard[]) {
  if (cards.length <= 1) return true;
  const naturals = cards.filter((card): card is Card => card.rank !== "joker");
  const potentialSet =
    cards.length <= 4 &&
    new Set(naturals.map((card) => card.rank)).size <= 1 &&
    new Set(naturals.map((card) => card.suit)).size === naturals.length;
  const naturalSuits = new Set(naturals.map((card) => card.suit));
  const potentialRun =
    cards.length <= 13 &&
    naturalSuits.size <= 1 &&
    [false, true].some((aceHigh) => {
      const values = naturals.map((card) =>
        card.rank === "ace" ? (aceHigh ? 14 : 1) : rankNumber(card.rank),
      );
      return (
        new Set(values).size === values.length &&
        (!values.length || Math.max(...values) - Math.min(...values) < 13)
      );
    });
  return potentialSet || potentialRun;
}

function drawStock(state: RommeState, randomInt: (max: number) => number) {
  if (!state.deck.length && state.discard.length > 1) {
    const top = state.discard.pop()!;
    state.deck = shuffle(state.discard, randomInt);
    state.discard = [top];
  }
  return state.deck.shift();
}

export function createRommeGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: RommeRules = defaultRommeRules,
): RommeState {
  rules = { ...defaultRommeRules, ...rules };
  if (rules.variant === "gin") {
    if (people.length !== 2) throw new RuleError("gin_requires_two_players");
    const players: RommePlayer[] = people.map((person) => ({
      ...person,
      connected: person.connected ?? true,
      hand: [],
      opened: false,
    }));
    const dealerId = players[randomInt(players.length)]!.id;
    return dealGinRound(
      {
        id,
        players,
        deck: [],
        discard: [],
        melds: [],
        currentPlayerId: "",
        hasDrawn: false,
        rules,
        phase: "playing",
        version: 0,
        roundNumber: 0,
        dealerId,
        scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      },
      randomInt,
      false,
    );
  }
  if (people.length < 2 || people.length > 6)
    throw new RuleError("invalid_player_count");
  const deck = shuffle(createRommeDeck(), randomInt);
  const players: RommePlayer[] = people.map((person) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
    opened: false,
  }));
  for (let round = 0; round < 13; round += 1)
    for (const player of players) player.hand.push(deck.shift()!);
  const opening = deck.shift();
  if (!opening) throw new RuleError("deck_empty");
  return {
    id,
    players,
    deck,
    discard: [opening],
    melds: [],
    currentPlayerId: players[randomInt(players.length)]!.id,
    hasDrawn: false,
    rules: { ...rules },
    phase: "playing",
    version: 1,
  };
}

function dealGinRound(
  state: RommeState,
  randomInt: (max: number) => number,
  alternateDealer = true,
) {
  if (alternateDealer)
    state.dealerId = state.players.find(
      (player) => player.id !== state.dealerId,
    )!.id;
  const deck = shuffle(createGinDeck(), randomInt);
  state.players.forEach((player) => {
    player.hand = [];
    player.opened = false;
  });
  for (let count = 0; count < 10; count += 1)
    for (const player of state.players) player.hand.push(deck.shift()!);
  state.deck = deck;
  state.discard = [state.deck.shift()!];
  state.melds = [];
  state.currentPlayerId = state.players.find(
    (player) => player.id !== state.dealerId,
  )!.id;
  state.hasDrawn = false;
  state.ginOpeningPasses = 0;
  delete state.ginStockEnding;
  delete state.roundResult;
  delete state.drawnDiscardId;
  state.phase = "playing";
  state.roundNumber = (state.roundNumber ?? 0) + 1;
  state.version += 1;
  return state;
}

function finishGinRound(
  state: RommeState,
  result: Omit<GinRoundResult, "hands" | "scores">,
) {
  const hands = Object.fromEntries(
    state.players.map((player) => [player.id, [...player.hand]]),
  );
  const scores =
    state.scores ??
    Object.fromEntries(state.players.map((player) => [player.id, 0]));
  if (result.winnerId)
    scores[result.winnerId] =
      (scores[result.winnerId] ?? 0) + result.pointsAwarded;
  state.scores = scores;
  state.roundResult = { ...result, hands, scores: { ...scores } };
  state.hasDrawn = false;
  delete state.ginStockEnding;
  delete state.ginOpeningPasses;
  const gameWinner = state.players.find(
    (player) => (scores[player.id] ?? 0) >= state.rules.ginTargetScore,
  );
  if (gameWinner) {
    state.phase = "finished";
    state.result = { winnerId: gameWinner.id, handPoints: { ...scores } };
  } else state.phase = "round-ended";
  state.version += 1;
  return state;
}

function applyGinAction(
  next: RommeState,
  player: RommePlayer,
  action: RommeAction,
  randomInt: (max: number) => number,
) {
  if (action.type === "romme:next-round") {
    if (next.phase !== "round-ended") throw new RuleError("round_not_finished");
    const keepDealer = next.roundResult?.reason === "stock";
    return dealGinRound(next, randomInt, !keepDealer);
  }
  if (next.phase !== "playing") throw new RuleError("round_finished");
  if (next.currentPlayerId !== player.id) throw new RuleError("not_your_turn");
  if (action.type === "romme:pass-opening") {
    if (
      next.hasDrawn ||
      next.ginOpeningPasses === undefined ||
      next.ginOpeningPasses >= 2
    )
      throw new RuleError("cannot_pass");
    next.ginOpeningPasses += 1;
    next.currentPlayerId =
      next.ginOpeningPasses === 1
        ? next.dealerId!
        : next.players.find((item) => item.id !== next.dealerId)!.id;
    next.version += 1;
    return next;
  }
  if (action.type === "romme:draw") {
    if (next.hasDrawn) throw new RuleError("already_drew");
    if (
      next.ginOpeningPasses !== undefined &&
      next.ginOpeningPasses < 2 &&
      action.source !== "discard"
    )
      throw new RuleError("opening_discard_or_pass");
    if (next.ginOpeningPasses === 2 && action.source !== "stock")
      throw new RuleError("opening_stock_required");
    if (action.source === "stock" && next.deck.length <= 2)
      throw new RuleError("deck_empty");
    const card =
      action.source === "discard" ? next.discard.pop() : next.deck.shift();
    if (!card) throw new RuleError("deck_empty");
    player.hand.push(card);
    next.hasDrawn = true;
    if (action.source === "discard") next.drawnDiscardId = card.id;
    if (action.source === "stock" && next.deck.length === 2)
      next.ginStockEnding = true;
    delete next.ginOpeningPasses;
    next.version += 1;
    return next;
  }
  if (!next.hasDrawn) throw new RuleError("must_draw_first");
  if (action.type !== "romme:discard" && action.type !== "romme:knock")
    throw new RuleError("invalid_action");
  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId);
  if (cardIndex < 0) throw new RuleError("card_not_in_hand");
  if (next.drawnDiscardId === action.cardId)
    throw new RuleError("gin_cannot_rediscard");
  const candidateHand = player.hand.filter((card) => card.id !== action.cardId);
  const analysis = analyzeGinHand(candidateHand);
  if (action.type === "romme:knock" && analysis.deadwoodPoints > 10)
    throw new RuleError("gin_knock_too_high");
  const [discarded] = player.hand.splice(cardIndex, 1);
  next.discard.push(discarded!);
  delete next.drawnDiscardId;
  next.hasDrawn = false;
  if (action.type === "romme:knock") {
    const opponent = next.players.find((item) => item.id !== player.id)!;
    const gin = analysis.deadwoodPoints === 0;
    const opponentAnalysis = gin
      ? analyzeGinHand(opponent.hand)
      : ginOpponentAnalysis(opponent.hand, analysis);
    const score = ginRoundScore(
      analysis.deadwoodPoints,
      opponentAnalysis.deadwoodPoints,
    );
    const undercut = score.winner === "opponent";
    const winnerId = undercut ? opponent.id : player.id;
    const analyses = { [player.id]: analysis, [opponent.id]: opponentAnalysis };
    return finishGinRound(next, {
      reason: gin ? "gin" : undercut ? "undercut" : "knock",
      winnerId,
      knockerId: player.id,
      pointsAwarded: score.points,
      analyses,
    });
  }
  if (next.ginStockEnding) {
    const analyses = Object.fromEntries(
      next.players.map((item) => [item.id, analyzeGinHand(item.hand)]),
    );
    return finishGinRound(next, {
      reason: "stock",
      pointsAwarded: 0,
      analyses,
    });
  }
  next.currentPlayerId = next.players.find((item) => item.id !== player.id)!.id;
  next.version += 1;
  return next;
}

export function applyRommeAction(
  state: RommeState,
  playerId: string,
  action: RommeAction,
  randomInt: (max: number) => number,
): RommeState {
  const next = structuredClone(state);
  const player = next.players.find((item) => item.id === playerId);
  if (!player) throw new RuleError("not_active");
  if (!player.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");
  if (next.rules.variant === "gin")
    return applyGinAction(next, player, action, randomInt);
  if (next.phase !== "playing") throw new RuleError("game_finished");
  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");
  if (action.type === "romme:draw") {
    if (next.hasDrawn) throw new RuleError("already_drew");
    const card =
      action.source === "discard"
        ? next.discard.pop()
        : drawStock(next, randomInt);
    if (!card) throw new RuleError("deck_empty");
    player.hand.push(card);
    next.hasDrawn = true;
    if (action.source === "discard") next.drawnDiscardId = card.id;
    next.version += 1;
    return next;
  }
  if (!next.hasDrawn) throw new RuleError("must_draw_first");
  const takeCards = (ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new RuleError("duplicate_card");
    const cards = ids.map((id) => player.hand.find((card) => card.id === id));
    if (cards.some((card) => !card)) throw new RuleError("card_not_in_hand");
    return cards as RommeCard[];
  };
  if (action.type === "romme:meld") {
    if (!action.groups.length) throw new RuleError("invalid_meld");
    const allIds = action.groups.flatMap((group) => group.cardIds);
    const cards = takeCards(allIds);
    if (new Set(allIds).size !== allIds.length)
      throw new RuleError("duplicate_card");
    const melds = action.groups.map((group, groupIndex) => {
      const groupCards = group.cardIds.map(
        (id) => cards.find((card) => card.id === id)!,
      );
      const detected = detectRommeMeld(groupCards);
      if (!detected) throw new RuleError("invalid_meld");
      return {
        id: `${next.id}:meld:${next.version}:${next.melds.length + groupIndex}`,
        ownerId: playerId,
        kind: detected.kind,
        cards: orderMeldCards(detected.kind, groupCards),
        points: detected.points,
      } satisfies RommeMeld;
    });
    const points = melds.reduce((sum, meld) => sum + meld.points, 0);
    if (!player.opened && points < next.rules.openingPoints)
      throw new RuleError("opening_points_required");
    if (
      next.rules.requireDiscardUse &&
      next.drawnDiscardId &&
      !allIds.includes(next.drawnDiscardId)
    )
      throw new RuleError("discard_must_be_used");
    player.opened = true;
    player.hand = player.hand.filter((card) => !allIds.includes(card.id));
    next.melds.push(...melds);
    delete next.drawnDiscardId;
    if (!player.hand.length) {
      next.phase = "finished";
      next.result = {
        winnerId: playerId,
        handPoints: Object.fromEntries(
          next.players.map((item) => [item.id, rommeHandPoints(item.hand)]),
        ),
      };
    }
    ensureUniqueMeldIds(next);
    next.version += 1;
    return next;
  }
  if (action.type === "romme:lay-off") {
    if (!player.opened) throw new RuleError("must_open_first");
    const cards = takeCards(action.cardIds);
    const matchingMelds = next.melds.filter(
      (item) => item.id === action.meldId,
    );
    if (!matchingMelds.length) throw new RuleError("meld_not_found");
    const meld =
      matchingMelds.find(
        (candidate) =>
          rommeMeldPoints(candidate.kind, [...candidate.cards, ...cards]) !==
          undefined,
      ) ?? matchingMelds[0]!;
    const combined = [...meld.cards, ...cards];
    const points = rommeMeldPoints(meld.kind, combined);
    if (points === undefined) throw new RuleError("invalid_meld");
    if (
      next.rules.requireDiscardUse &&
      next.drawnDiscardId &&
      !action.cardIds.includes(next.drawnDiscardId)
    )
      throw new RuleError("discard_must_be_used");
    meld.cards = orderMeldCards(meld.kind, combined);
    meld.points = points;
    player.hand = player.hand.filter(
      (card) => !action.cardIds.includes(card.id),
    );
    delete next.drawnDiscardId;
    if (!player.hand.length) {
      next.phase = "finished";
      next.result = {
        winnerId: playerId,
        handPoints: Object.fromEntries(
          next.players.map((item) => [item.id, rommeHandPoints(item.hand)]),
        ),
      };
    }
    ensureUniqueMeldIds(next);
    next.version += 1;
    return next;
  }
  if (action.type === "romme:replace-joker") {
    if (!player.opened) throw new RuleError("must_open_first");
    const matchingMelds = next.melds.filter(
      (item) => item.id === action.meldId,
    );
    if (!matchingMelds.length) throw new RuleError("meld_not_found");
    const meld =
      matchingMelds.find((item) =>
        item.cards.some(
          (card) => card.id === action.jokerId && card.rank === "joker",
        ),
      ) ?? matchingMelds[0]!;
    const jokerIndex = meld.cards.findIndex(
      (card) => card.id === action.jokerId && card.rank === "joker",
    );
    if (jokerIndex < 0) throw new RuleError("joker_not_found");
    const selectedCards = takeCards(action.cardIds);
    if (selectedCards.length < 3) throw new RuleError("joker_must_be_reused");
    const recoveredJoker = meld.cards[jokerIndex]!;
    const candidate = selectedCards.flatMap((replacement) => {
      if (replacement.rank === "joker") return [];
      const replaced = [...meld.cards];
      replaced[jokerIndex] = replacement;
      if (
        !isValidRommeMeld(meld.kind, replaced) ||
        (meld.kind === "set" && replaced.length !== 4)
      )
        return [];
      const companions = selectedCards.filter(
        (card) => card.id !== replacement.id,
      );
      const newMeld = detectRommeMeld([recoveredJoker, ...companions]);
      return newMeld ? [{ replacement, companions, newMeld }] : [];
    })[0];
    if (!candidate) throw new RuleError("invalid_joker_exchange");
    if (
      next.rules.requireDiscardUse &&
      next.drawnDiscardId &&
      !action.cardIds.includes(next.drawnDiscardId)
    )
      throw new RuleError("discard_must_be_used");
    meld.cards[jokerIndex] = candidate.replacement;
    meld.cards = orderMeldCards(meld.kind, meld.cards);
    meld.points = rommeMeldPoints(meld.kind, meld.cards)!;
    const newCards = [recoveredJoker, ...candidate.companions];
    next.melds.push({
      id: `${next.id}:meld:${next.version}:${next.melds.length}`,
      ownerId: playerId,
      kind: candidate.newMeld.kind,
      cards: orderMeldCards(candidate.newMeld.kind, newCards),
      points: candidate.newMeld.points,
    });
    player.hand = player.hand.filter(
      (card) => !action.cardIds.includes(card.id),
    );
    delete next.drawnDiscardId;
    if (!player.hand.length) {
      next.phase = "finished";
      next.result = {
        winnerId: playerId,
        handPoints: Object.fromEntries(
          next.players.map((item) => [item.id, rommeHandPoints(item.hand)]),
        ),
      };
    }
    ensureUniqueMeldIds(next);
    next.version += 1;
    return next;
  }
  if (action.type !== "romme:discard") throw new RuleError("invalid_action");
  if (next.rules.requireDiscardUse && next.drawnDiscardId)
    throw new RuleError("discard_must_be_used");
  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId);
  if (cardIndex < 0) throw new RuleError("card_not_in_hand");
  const [card] = player.hand.splice(cardIndex, 1);
  next.discard.push(card!);
  delete next.drawnDiscardId;
  next.hasDrawn = false;
  if (!player.hand.length) {
    next.phase = "finished";
    next.result = {
      winnerId: playerId,
      handPoints: Object.fromEntries(
        next.players.map((item) => [item.id, rommeHandPoints(item.hand)]),
      ),
    };
  } else {
    const index = next.players.findIndex((item) => item.id === playerId);
    next.currentPlayerId = next.players[(index + 1) % next.players.length]!.id;
  }
  next.version += 1;
  return next;
}

export function rommePlayerView(state: RommeState, playerId: string) {
  const revealGinHands =
    state.rules.variant === "gin" && state.phase !== "playing";
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId || revealGinHands
        ? player
        : { ...player, hand: [], handCount: player.hand.length },
    ),
    deck: [],
    deckCount: state.deck.length,
    discard: state.discard.slice(-1),
    discardCount: state.discard.length,
  };
}

export function withdrawRommePlayer(
  state: RommeState,
  playerId: string,
): RommeState {
  const next = structuredClone(state);
  const index = next.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new RuleError("not_active");
  const wasCurrent = next.currentPlayerId === playerId;
  next.players.splice(index, 1);
  if (next.players.length < 2) {
    next.phase = "finished";
    next.result = { winnerId: next.players[0]?.id ?? "", handPoints: {} };
  } else if (wasCurrent) {
    next.currentPlayerId = next.players[index % next.players.length]!.id;
    next.hasDrawn = false;
    delete next.drawnDiscardId;
  }
  next.version += 1;
  return next;
}
