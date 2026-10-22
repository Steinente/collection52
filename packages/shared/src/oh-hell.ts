import {
  createDeck,
  rankValue,
  shuffle,
  type Card,
  type Suit,
} from "./cards.js";
import { RuleError } from "./durak.js";

export type OhHellRules = {
  exactBonus: number;
  scoreMissedTricks: boolean;
  forbidExactBidTotal: boolean;
};
export const defaultOhHellRules: OhHellRules = {
  exactBonus: 10,
  scoreMissedTricks: true,
  forbidExactBidTotal: true,
};
export type OhHellPlayer = {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
  bid?: number;
  tricks: number;
  score: number;
};
export type OhHellRoundResult = {
  bids: Record<string, number>;
  tricks: Record<string, number>;
  deltas: Record<string, number>;
  scores: Record<string, number>;
};
export type OhHellState = {
  id: string;
  version: number;
  phase: "bidding" | "playing" | "round-ended" | "finished";
  players: OhHellPlayer[];
  dealerId: string;
  currentPlayerId: string;
  trick: Array<{ playerId: string; card: Card }>;
  trumpSuit: Suit;
  trumpCard: Card;
  roundNumber: number;
  handSize: number;
  schedule: number[];
  rules: OhHellRules;
  roundResult?: OhHellRoundResult;
  result?: { winnerIds: string[] };
};
export type OhHellAction =
  | { type: "oh-hell:bid"; bid: number }
  | { type: "oh-hell:play"; cardId: string }
  | { type: "oh-hell:next-round" };

const nextPlayer = (state: OhHellState, id: string) => {
  const index = state.players.findIndex((player) => player.id === id);
  if (index < 0) throw new RuleError("player_not_found");
  return state.players[(index + 1) % state.players.length]!;
};

function createSchedule(playerCount: number) {
  const maximum = Math.min(10, Math.floor(51 / playerCount));
  const down = Array.from({ length: maximum }, (_, index) => maximum - index);
  return [...down, ...down.slice(0, -1).reverse()];
}

function dealRound(
  state: OhHellState,
  randomInt: (max: number) => number,
  dealerId: string,
) {
  const deck = shuffle(createDeck(52), randomInt);
  state.handSize = state.schedule[state.roundNumber - 1]!;
  for (const player of state.players) {
    player.hand = [];
    delete player.bid;
    player.tricks = 0;
  }
  let receiver = nextPlayer(state, dealerId);
  for (let round = 0; round < state.handSize; round += 1)
    for (let count = 0; count < state.players.length; count += 1) {
      receiver.hand.push(deck.shift()!);
      receiver = nextPlayer(state, receiver.id);
    }
  state.trumpCard = deck.shift()!;
  state.trumpSuit = state.trumpCard.suit;
  state.dealerId = dealerId;
  state.currentPlayerId = nextPlayer(state, dealerId).id;
  state.trick = [];
  state.phase = "bidding";
  delete state.roundResult;
}

export function createOhHellGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: OhHellRules = defaultOhHellRules,
): OhHellState {
  if (people.length < 3 || people.length > 7)
    throw new RuleError("oh_hell_requires_three_to_seven_players");
  const players: OhHellPlayer[] = people.map((person) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
    tricks: 0,
    score: 0,
  }));
  const state = {
    id,
    version: 1,
    phase: "bidding" as const,
    players,
    dealerId: players.at(-1)!.id,
    currentPlayerId: players[0]!.id,
    trick: [],
    trumpSuit: "clubs" as Suit,
    trumpCard: createDeck(52)[0]!,
    roundNumber: 1,
    handSize: 1,
    schedule: createSchedule(players.length),
    rules: { ...rules },
  };
  dealRound(state, randomInt, state.dealerId);
  return state;
}

function winningPlay(state: OhHellState) {
  return state.trick.reduce((winner, play) => {
    if (
      play.card.suit === state.trumpSuit &&
      winner.card.suit !== state.trumpSuit
    )
      return play;
    if (play.card.suit !== winner.card.suit) return winner;
    return rankValue(play.card) > rankValue(winner.card) ? play : winner;
  });
}

function finishRound(state: OhHellState) {
  const bids: Record<string, number> = {};
  const tricks: Record<string, number> = {};
  const deltas: Record<string, number> = {};
  const scores: Record<string, number> = {};
  for (const player of state.players) {
    const bid = player.bid ?? 0;
    const exact = bid === player.tricks;
    const delta = exact
      ? state.rules.exactBonus + player.tricks
      : state.rules.scoreMissedTricks
        ? player.tricks
        : 0;
    player.score += delta;
    bids[player.id] = bid;
    tricks[player.id] = player.tricks;
    deltas[player.id] = delta;
    scores[player.id] = player.score;
  }
  state.roundResult = { bids, tricks, deltas, scores };
  if (state.roundNumber === state.schedule.length) {
    const highScore = Math.max(...state.players.map((player) => player.score));
    state.phase = "finished";
    state.result = {
      winnerIds: state.players
        .filter((player) => player.score === highScore)
        .map((player) => player.id),
    };
  } else state.phase = "round-ended";
}

export function applyOhHellAction(
  state: OhHellState,
  playerId: string,
  action: OhHellAction,
  randomInt: (max: number) => number,
): OhHellState {
  const next = structuredClone(state);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RuleError("not_active");
  if (!player.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");
  if (action.type === "oh-hell:next-round") {
    if (next.phase !== "round-ended") throw new RuleError("round_not_finished");
    next.roundNumber += 1;
    dealRound(next, randomInt, nextPlayer(next, next.dealerId).id);
    next.version += 1;
    return next;
  }
  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");
  if (action.type === "oh-hell:bid") {
    if (next.phase !== "bidding") throw new RuleError("not_bidding");
    if (
      !Number.isInteger(action.bid) ||
      action.bid < 0 ||
      action.bid > next.handSize
    )
      throw new RuleError("invalid_bid");
    const isDealer = playerId === next.dealerId;
    const bidTotal = next.players.reduce(
      (sum, candidate) => sum + (candidate.bid ?? 0),
      action.bid,
    );
    if (
      isDealer &&
      next.rules.forbidExactBidTotal &&
      bidTotal === next.handSize
    )
      throw new RuleError("dealer_bid_forbidden");
    player.bid = action.bid;
    if (next.players.every((candidate) => candidate.bid !== undefined)) {
      next.phase = "playing";
      next.currentPlayerId = nextPlayer(next, next.dealerId).id;
    } else next.currentPlayerId = nextPlayer(next, playerId).id;
    next.version += 1;
    return next;
  }
  if (next.phase !== "playing") throw new RuleError("not_playing");
  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId);
  if (cardIndex < 0) throw new RuleError("card_not_in_hand");
  const card = player.hand[cardIndex]!;
  const leadSuit = next.trick[0]?.card.suit;
  if (
    leadSuit &&
    card.suit !== leadSuit &&
    player.hand.some((item) => item.suit === leadSuit)
  )
    throw new RuleError("must_follow_suit");
  player.hand.splice(cardIndex, 1);
  next.trick.push({ playerId, card });
  if (next.trick.length < next.players.length)
    next.currentPlayerId = nextPlayer(next, playerId).id;
  else {
    const winner = winningPlay(next);
    next.players.find(
      (candidate) => candidate.id === winner.playerId,
    )!.tricks += 1;
    next.currentPlayerId = winner.playerId;
    next.trick = [];
    if (next.players.every((candidate) => candidate.hand.length === 0))
      finishRound(next);
  }
  next.version += 1;
  return next;
}

export function ohHellPlayerView(state: OhHellState, playerId: string) {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? player
        : { ...player, hand: [], handCount: player.hand.length },
    ),
  };
}
