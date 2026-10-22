import { createDeck, shuffle, type Card, type Suit } from "./cards.js";
import { RuleError } from "./durak.js";

export type SkatRules = {
  roundsPerPlayer: 3 | 6 | 9 | 12;
  tournamentScoring: boolean;
};

export const defaultSkatRules: SkatRules = {
  roundsPerPlayer: 3,
  tournamentScoring: false,
};

export type SkatContract = Suit | "grand" | "null";
export type SkatAnnouncement = "none" | "schneider" | "schwarz" | "ouvert";
export type SkatPhase =
  | "bidding"
  | "skat-choice"
  | "discarding"
  | "declaring"
  | "playing"
  | "round-ended"
  | "finished";

export type SkatPlayer = {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  active: boolean;
  tricks: number;
  wonCards: Card[];
  score: number;
  wonGames: number;
  lostGames: number;
};

export type SkatRoundResult = {
  passed: boolean;
  declarerId?: string;
  contract?: SkatContract;
  announcement?: SkatAnnouncement;
  handGame?: boolean;
  bidValue?: number;
  won?: boolean;
  overbid?: boolean;
  cardPoints?: number;
  gameValue?: number;
  multiplier?: number;
  matadors?: number;
  withMatadors?: boolean;
  schneider?: boolean;
  schwarz?: boolean;
  deltas: Record<string, number>;
  scores: Record<string, number>;
};

export type SkatState = {
  id: string;
  version: number;
  phase: SkatPhase;
  players: SkatPlayer[];
  dealerId: string;
  activePlayerIds: string[];
  forehandId: string;
  middlehandId: string;
  rearhandId: string;
  currentPlayerId: string;
  bidderId?: string;
  listenerId?: string;
  auctionStage: 1 | 2 | "forehand";
  highestBid: number;
  pendingBid?: number;
  skat: Card[];
  skatPickedUp: boolean;
  declarerId?: string;
  declarerCards: Card[];
  handGame: boolean;
  contract?: SkatContract;
  announcement: SkatAnnouncement;
  trick: Array<{ playerId: string; card: Card }>;
  dealNumber: number;
  totalDeals: number;
  rules: SkatRules;
  roundResult?: SkatRoundResult;
  result?: { winnerIds: string[] };
};

export type SkatAction =
  | { type: "skat:bid"; bid: number }
  | { type: "skat:hold" }
  | { type: "skat:pass" }
  | { type: "skat:pick-up" }
  | { type: "skat:choose-hand" }
  | { type: "skat:discard"; cardIds: string[] }
  | {
      type: "skat:declare";
      contract: SkatContract;
      announcement: SkatAnnouncement;
    }
  | { type: "skat:play"; cardId: string }
  | { type: "skat:next-round" };

const suitBaseValues: Record<Suit, number> = {
  diamonds: 9,
  hearts: 10,
  spades: 11,
  clubs: 12,
};
const suitOrder: Suit[] = ["clubs", "spades", "hearts", "diamonds"];
const standardRankOrder: Card["rank"][] = [
  "ace",
  "10",
  "king",
  "queen",
  "jack",
  "9",
  "8",
  "7",
];
const nullRankOrder: Card["rank"][] = [
  "ace",
  "king",
  "queen",
  "jack",
  "10",
  "9",
  "8",
  "7",
];
const cardPoints: Record<Card["rank"], number> = {
  "2": 0,
  "3": 0,
  "4": 0,
  "5": 0,
  "6": 0,
  "7": 0,
  "8": 0,
  "9": 0,
  "10": 10,
  jack: 2,
  queen: 3,
  king: 4,
  ace: 11,
};

export const skatBidValues = [
  ...new Set([
    23,
    35,
    46,
    59,
    ...Object.values(suitBaseValues).flatMap((base) =>
      Array.from({ length: 17 }, (_, index) => base * (index + 2)),
    ),
    ...Array.from({ length: 10 }, (_, index) => 24 * (index + 2)),
  ]),
].sort((left, right) => left - right);

const nextPlayer = (state: SkatState, playerId: string) => {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new RuleError("player_not_found");
  return state.players[(index + 1) % state.players.length]!;
};

const player = (state: SkatState, id: string) => {
  const found = state.players.find((candidate) => candidate.id === id);
  if (!found) throw new RuleError("player_not_found");
  return found;
};

function finishSeriesOrRound(state: SkatState) {
  if (state.dealNumber < state.totalDeals) {
    state.phase = "round-ended";
    return;
  }
  state.phase = "finished";
  const best = Math.max(...state.players.map((candidate) => candidate.score));
  state.result = {
    winnerIds: state.players
      .filter((candidate) => candidate.score === best)
      .map((candidate) => candidate.id),
  };
}

function deal(state: SkatState, randomInt: (max: number) => number) {
  const deck = shuffle(createDeck(32), randomInt);
  for (const candidate of state.players) {
    candidate.hand = [];
    candidate.active = false;
    candidate.tricks = 0;
    candidate.wonCards = [];
  }
  const active: SkatPlayer[] = [];
  let seat = nextPlayer(state, state.dealerId);
  while (active.length < 3) {
    active.push(seat);
    seat = nextPlayer(state, seat.id);
  }
  for (const candidate of active) candidate.active = true;
  for (const packet of [3, 4, 3]) {
    for (const candidate of active)
      candidate.hand.push(...deck.splice(0, packet));
    if (packet === 3 && deck.length === 23) state.skat = deck.splice(0, 2);
  }
  state.activePlayerIds = active.map((candidate) => candidate.id);
  [state.forehandId, state.middlehandId, state.rearhandId] =
    state.activePlayerIds as [string, string, string];
  state.currentPlayerId = state.middlehandId;
  state.bidderId = state.middlehandId;
  state.listenerId = state.forehandId;
  state.auctionStage = 1;
  state.highestBid = 0;
  delete state.pendingBid;
  delete state.declarerId;
  state.declarerCards = [];
  state.skatPickedUp = false;
  state.handGame = false;
  delete state.contract;
  state.announcement = "none";
  state.trick = [];
  state.phase = "bidding";
  delete state.roundResult;
}

export function createSkatGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: SkatRules = defaultSkatRules,
): SkatState {
  if (people.length < 3 || people.length > 4)
    throw new RuleError("skat_requires_three_or_four_players");
  const players: SkatPlayer[] = people.map((person) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
    active: false,
    tricks: 0,
    wonCards: [],
    score: 0,
    wonGames: 0,
    lostGames: 0,
  }));
  const state: SkatState = {
    id,
    version: 1,
    phase: "bidding",
    players,
    dealerId: players.at(-1)!.id,
    activePlayerIds: [],
    forehandId: "",
    middlehandId: "",
    rearhandId: "",
    currentPlayerId: "",
    auctionStage: 1,
    highestBid: 0,
    skat: [],
    skatPickedUp: false,
    declarerCards: [],
    handGame: false,
    announcement: "none",
    trick: [],
    dealNumber: 1,
    totalDeals: people.length * rules.roundsPerPlayer,
    rules: { ...rules },
  };
  deal(state, randomInt);
  return state;
}

function beginSecondAuction(state: SkatState, firstWinnerId: string) {
  state.auctionStage = 2;
  state.bidderId = state.rearhandId;
  state.listenerId = firstWinnerId;
  state.currentPlayerId = state.rearhandId;
  delete state.pendingBid;
}

function finalizeAuction(state: SkatState, winnerId: string) {
  if (state.highestBid === 0) {
    state.auctionStage = "forehand";
    state.bidderId = state.forehandId;
    delete state.listenerId;
    state.currentPlayerId = state.forehandId;
    return;
  }
  state.declarerId = winnerId;
  state.phase = "skat-choice";
  state.currentPlayerId = winnerId;
  delete state.bidderId;
  delete state.listenerId;
  delete state.pendingBid;
}

function finishAuctionDuel(state: SkatState, winnerId: string) {
  if (state.auctionStage === 1) beginSecondAuction(state, winnerId);
  else finalizeAuction(state, winnerId);
}

function passDeal(state: SkatState) {
  const deltas: Record<string, number> = Object.fromEntries(
    state.players.map((candidate) => [candidate.id, 0]),
  );
  state.roundResult = {
    passed: true,
    deltas,
    scores: Object.fromEntries(
      state.players.map((candidate) => [candidate.id, candidate.score]),
    ),
  };
  finishSeriesOrRound(state);
}

function trumpOrder(contract: SkatContract) {
  const jacks = suitOrder.map((suit) => `${suit}-jack`);
  if (contract === "grand") return jacks;
  if (contract === "null") return [];
  return [
    ...jacks,
    `${contract}-ace`,
    `${contract}-10`,
    `${contract}-king`,
    `${contract}-queen`,
    `${contract}-9`,
    `${contract}-8`,
    `${contract}-7`,
  ];
}

function cardCategory(card: Card, contract: SkatContract): Suit | "trump" {
  if (contract !== "null" && (card.rank === "jack" || card.suit === contract))
    return "trump";
  return card.suit;
}

function winningPlay(trick: SkatState["trick"], contract: SkatContract) {
  const lead = cardCategory(trick[0]!.card, contract);
  const trumpIds = trumpOrder(contract);
  const ranks = contract === "null" ? nullRankOrder : standardRankOrder;
  return trick.reduce((winner, play) => {
    const winnerCategory = cardCategory(winner.card, contract);
    const playCategory = cardCategory(play.card, contract);
    if (playCategory === "trump" && winnerCategory !== "trump") return play;
    if (winnerCategory === "trump" && playCategory !== "trump") return winner;
    if (playCategory === "trump")
      return trumpIds.indexOf(play.card.id) < trumpIds.indexOf(winner.card.id)
        ? play
        : winner;
    if (playCategory !== lead) return winner;
    return ranks.indexOf(play.card.rank) < ranks.indexOf(winner.card.rank)
      ? play
      : winner;
  });
}

function matadorCount(cards: Card[], contract: SkatContract) {
  const order = trumpOrder(contract);
  const held = new Set(cards.map((card) => card.id));
  const withMatadors = held.has(order[0]!);
  let count = 0;
  for (const id of order) {
    if (held.has(id) !== withMatadors) break;
    count += 1;
  }
  return { count, withMatadors };
}

function nullValue(handGame: boolean, announcement: SkatAnnouncement) {
  if (announcement === "ouvert") return handGame ? 59 : 46;
  return handGame ? 35 : 23;
}

function scoreDeal(state: SkatState) {
  const declarer = player(state, state.declarerId!);
  const contract = state.contract!;
  const bidValue = Math.max(18, state.highestBid);
  const declarerPoints =
    declarer.wonCards.reduce((sum, card) => sum + cardPoints[card.rank], 0) +
    state.skat.reduce((sum, card) => sum + cardPoints[card.rank], 0);
  const opponentTricks = state.players
    .filter((candidate) => candidate.active && candidate.id !== declarer.id)
    .reduce((sum, candidate) => sum + candidate.tricks, 0);
  let won = false;
  let overbid = false;
  let gameValue = 0;
  let multiplier: number | undefined;
  let matadors: number | undefined;
  let withMatadors: boolean | undefined;
  let schneider = false;
  let schwarz = false;

  if (contract === "null") {
    gameValue = nullValue(state.handGame, state.announcement);
    won = declarer.tricks === 0;
    overbid = gameValue < bidValue;
  } else {
    const matadorResult = matadorCount(state.declarerCards, contract);
    matadors = matadorResult.count;
    withMatadors = matadorResult.withMatadors;
    const pointsWin = declarerPoints >= 61;
    schneider = pointsWin ? 120 - declarerPoints <= 30 : declarerPoints <= 30;
    schwarz = pointsWin ? opponentTricks === 0 : declarer.tricks === 0;
    const announcedSchneider = state.announcement !== "none";
    const announcedSchwarz =
      state.announcement === "schwarz" || state.announcement === "ouvert";
    multiplier = matadors + 1 + (state.handGame ? 1 : 0);
    if (schneider || announcedSchneider) multiplier += 1;
    if (announcedSchneider) multiplier += 1;
    if (schwarz || announcedSchwarz) multiplier += 1;
    if (announcedSchwarz) multiplier += 1;
    if (state.announcement === "ouvert") multiplier += 1;
    const base = contract === "grand" ? 24 : suitBaseValues[contract];
    gameValue = base * multiplier;
    won =
      pointsWin &&
      (state.announcement === "none" ||
        (state.announcement === "schneider" && declarerPoints >= 90) ||
        ((state.announcement === "schwarz" ||
          state.announcement === "ouvert") &&
          declarer.tricks === 10));
    overbid = gameValue < bidValue;
    if (overbid) gameValue = base * Math.ceil(bidValue / base);
  }
  won = won && !overbid;
  const deltas: Record<string, number> = Object.fromEntries(
    state.players.map((candidate) => [candidate.id, 0]),
  );
  deltas[declarer.id] = won ? gameValue : -2 * gameValue;
  if (state.rules.tournamentScoring) {
    deltas[declarer.id] = (deltas[declarer.id] ?? 0) + (won ? 50 : -50);
    if (!won) {
      const defenderBonus = state.players.length === 3 ? 40 : 30;
      for (const candidate of state.players)
        if (candidate.id !== declarer.id)
          deltas[candidate.id] = (deltas[candidate.id] ?? 0) + defenderBonus;
    }
  }
  for (const candidate of state.players)
    candidate.score += deltas[candidate.id]!;
  if (won) declarer.wonGames += 1;
  else declarer.lostGames += 1;
  state.roundResult = {
    passed: false,
    declarerId: declarer.id,
    contract,
    announcement: state.announcement,
    handGame: state.handGame,
    bidValue,
    won,
    overbid,
    cardPoints: declarerPoints,
    gameValue,
    ...(multiplier !== undefined ? { multiplier } : {}),
    ...(matadors !== undefined ? { matadors } : {}),
    ...(withMatadors !== undefined ? { withMatadors } : {}),
    schneider,
    schwarz,
    deltas,
    scores: Object.fromEntries(
      state.players.map((candidate) => [candidate.id, candidate.score]),
    ),
  };
  finishSeriesOrRound(state);
}

export function applySkatAction(
  state: SkatState,
  playerId: string,
  action: SkatAction,
  randomInt: (max: number) => number,
): SkatState {
  const next = structuredClone(state);
  const actor = next.players.find((candidate) => candidate.id === playerId);
  if (!actor) throw new RuleError("not_active");
  if (!actor.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");

  if (action.type === "skat:next-round") {
    if (next.phase !== "round-ended") throw new RuleError("round_not_finished");
    next.dealerId = nextPlayer(next, next.dealerId).id;
    next.dealNumber += 1;
    deal(next, randomInt);
    next.version += 1;
    return next;
  }

  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");

  if (next.phase === "bidding") {
    if (action.type === "skat:bid") {
      if (next.auctionStage === "forehand") {
        if (action.bid !== 18) throw new RuleError("invalid_bid");
        next.highestBid = 18;
        finalizeAuction(next, playerId);
      } else {
        if (
          next.bidderId !== playerId ||
          next.pendingBid !== undefined ||
          !skatBidValues.includes(action.bid) ||
          action.bid <= next.highestBid
        )
          throw new RuleError("invalid_bid");
        next.pendingBid = action.bid;
        next.currentPlayerId = next.listenerId!;
      }
    } else if (action.type === "skat:hold") {
      if (next.listenerId !== playerId || next.pendingBid === undefined)
        throw new RuleError("invalid_bid_response");
      next.highestBid = next.pendingBid;
      delete next.pendingBid;
      next.currentPlayerId = next.bidderId!;
    } else if (action.type === "skat:pass") {
      if (next.auctionStage === "forehand") passDeal(next);
      else if (next.pendingBid !== undefined) {
        if (next.listenerId !== playerId)
          throw new RuleError("invalid_bid_response");
        next.highestBid = next.pendingBid;
        delete next.pendingBid;
        finishAuctionDuel(next, next.bidderId!);
      } else {
        if (next.bidderId !== playerId)
          throw new RuleError("invalid_bid_response");
        finishAuctionDuel(next, next.listenerId!);
      }
    } else throw new RuleError("invalid_action");
    next.version += 1;
    return next;
  }

  if (next.phase === "skat-choice") {
    if (playerId !== next.declarerId) throw new RuleError("not_declarer");
    if (action.type === "skat:pick-up") {
      actor.hand.push(...next.skat);
      next.skat = [];
      next.skatPickedUp = true;
      next.phase = "discarding";
    } else if (action.type === "skat:choose-hand") {
      next.handGame = true;
      next.phase = "declaring";
    } else throw new RuleError("invalid_action");
    next.version += 1;
    return next;
  }

  if (next.phase === "discarding") {
    if (action.type !== "skat:discard") throw new RuleError("invalid_action");
    if (playerId !== next.declarerId) throw new RuleError("not_declarer");
    if (action.cardIds.length !== 2 || new Set(action.cardIds).size !== 2)
      throw new RuleError("skat_must_discard_two");
    const selected = action.cardIds.map((id) => {
      const card = actor.hand.find((candidate) => candidate.id === id);
      if (!card) throw new RuleError("card_not_in_hand");
      return card;
    });
    actor.hand = actor.hand.filter((card) => !action.cardIds.includes(card.id));
    next.skat = selected;
    next.phase = "declaring";
    next.version += 1;
    return next;
  }

  if (next.phase === "declaring") {
    if (action.type !== "skat:declare") throw new RuleError("invalid_action");
    if (playerId !== next.declarerId) throw new RuleError("not_declarer");
    if (
      action.contract === "null" &&
      !["none", "ouvert"].includes(action.announcement)
    )
      throw new RuleError("invalid_skat_announcement");
    if (
      action.contract === "null" &&
      nullValue(next.handGame, action.announcement) <
        Math.max(18, next.highestBid)
    )
      throw new RuleError("skat_null_below_bid");
    if (
      action.contract !== "null" &&
      !next.handGame &&
      action.announcement !== "none"
    )
      throw new RuleError("announcement_requires_hand");
    next.contract = action.contract;
    next.announcement = action.announcement;
    next.declarerCards = [...actor.hand, ...next.skat];
    next.phase = "playing";
    next.currentPlayerId = next.forehandId;
    next.version += 1;
    return next;
  }

  if (next.phase !== "playing" || action.type !== "skat:play")
    throw new RuleError("not_playing");
  if (!actor.active) throw new RuleError("not_active");
  const cardIndex = actor.hand.findIndex((card) => card.id === action.cardId);
  if (cardIndex < 0) throw new RuleError("card_not_in_hand");
  const card = actor.hand[cardIndex]!;
  const lead = next.trick[0]?.card;
  if (lead) {
    const leadCategory = cardCategory(lead, next.contract!);
    if (
      cardCategory(card, next.contract!) !== leadCategory &&
      actor.hand.some(
        (candidate) => cardCategory(candidate, next.contract!) === leadCategory,
      )
    )
      throw new RuleError("must_follow_suit");
  }
  actor.hand.splice(cardIndex, 1);
  next.trick.push({ playerId, card });
  if (next.trick.length < 3) {
    const activeIndex = next.activePlayerIds.indexOf(playerId);
    next.currentPlayerId =
      next.activePlayerIds[(activeIndex + 1) % next.activePlayerIds.length]!;
  } else {
    const winner = winningPlay(next.trick, next.contract!);
    const winnerPlayer = player(next, winner.playerId);
    winnerPlayer.tricks += 1;
    winnerPlayer.wonCards.push(...next.trick.map((play) => play.card));
    next.currentPlayerId = winner.playerId;
    next.trick = [];
    if (next.activePlayerIds.every((id) => player(next, id).hand.length === 0))
      scoreDeal(next);
  }
  next.version += 1;
  return next;
}

export function skatPlayerView(state: SkatState, playerId: string) {
  const revealDeclarer =
    state.phase === "playing" && state.announcement === "ouvert";
  const revealRound =
    state.phase === "round-ended" || state.phase === "finished";
  return {
    ...state,
    declarerCards: [],
    skat:
      revealRound || (state.skatPickedUp && state.declarerId === playerId)
        ? state.skat
        : [],
    skatCount: state.skat.length || 2,
    players: state.players.map((candidate) =>
      candidate.id === playerId ||
      (revealDeclarer && candidate.id === state.declarerId) ||
      revealRound
        ? candidate
        : {
            ...candidate,
            hand: [],
            handCount: candidate.hand.length,
            wonCards: [],
          },
    ),
  };
}
