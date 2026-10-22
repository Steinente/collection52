import { createDeck, rankValue, shuffle, type Card } from "./cards.js";
import { RuleError } from "./durak.js";

export type SpadesRules = {
  targetScore: number;
  nilBonus: number;
  bagPenalty: boolean;
};

export const defaultSpadesRules: SpadesRules = {
  targetScore: 500,
  nilBonus: 100,
  bagPenalty: true,
};

export type SpadesPlayer = {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
  teamId: "team-1" | "team-2";
  bid?: number;
  tricks: number;
};

export type SpadesRoundResult = {
  teamScores: Record<"team-1" | "team-2", number>;
  teamDeltas: Record<"team-1" | "team-2", number>;
  bags: Record<"team-1" | "team-2", number>;
};

export type SpadesState = {
  id: string;
  version: number;
  phase: "bidding" | "playing" | "round-ended" | "finished";
  players: SpadesPlayer[];
  dealerId: string;
  currentPlayerId: string;
  trick: Array<{ playerId: string; card: Card }>;
  spadesBroken: boolean;
  scores: Record<"team-1" | "team-2", number>;
  bags: Record<"team-1" | "team-2", number>;
  roundNumber: number;
  rules: SpadesRules;
  roundResult?: SpadesRoundResult;
  result?: { winnerTeamId: "team-1" | "team-2" };
};

export type SpadesAction =
  | { type: "spades:bid"; bid: number }
  | { type: "spades:play"; cardId: string }
  | { type: "spades:next-round" };

const nextPlayer = (state: SpadesState, playerId: string) => {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new RuleError("player_not_found");
  return state.players[(index + 1) % state.players.length]!;
};

function dealRound(
  state: SpadesState,
  randomInt: (max: number) => number,
  dealerId: string,
) {
  const deck = shuffle(createDeck(52), randomInt);
  for (const player of state.players) {
    player.hand = [];
    delete player.bid;
    player.tricks = 0;
  }
  let receiver = nextPlayer(state, dealerId);
  while (deck.length) {
    receiver.hand.push(deck.shift()!);
    receiver = nextPlayer(state, receiver.id);
  }
  state.dealerId = dealerId;
  state.currentPlayerId = nextPlayer(state, dealerId).id;
  state.trick = [];
  state.spadesBroken = false;
  state.phase = "bidding";
  delete state.roundResult;
}

export function createSpadesGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: SpadesRules = defaultSpadesRules,
): SpadesState {
  if (people.length !== 4) throw new RuleError("spades_requires_four_players");
  const players: SpadesPlayer[] = people.map((person, index) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
    teamId: index % 2 === 0 ? "team-1" : "team-2",
    tricks: 0,
  }));
  const state: SpadesState = {
    id,
    version: 1,
    phase: "bidding",
    players,
    dealerId: players.at(-1)!.id,
    currentPlayerId: players[0]!.id,
    trick: [],
    spadesBroken: false,
    scores: { "team-1": 0, "team-2": 0 },
    bags: { "team-1": 0, "team-2": 0 },
    roundNumber: 1,
    rules: { ...rules },
  };
  dealRound(state, randomInt, state.dealerId);
  return state;
}

function winningPlay(trick: SpadesState["trick"]) {
  return trick.reduce((winner, play) => {
    if (play.card.suit === "spades" && winner.card.suit !== "spades")
      return play;
    if (play.card.suit !== winner.card.suit) return winner;
    return rankValue(play.card) > rankValue(winner.card) ? play : winner;
  });
}

function scoreRound(state: SpadesState) {
  const deltas = { "team-1": 0, "team-2": 0 };
  for (const teamId of ["team-1", "team-2"] as const) {
    const team = state.players.filter((player) => player.teamId === teamId);
    const contract = team.reduce((sum, player) => sum + (player.bid ?? 0), 0);
    const tricks = team.reduce((sum, player) => sum + player.tricks, 0);
    const overtricks = Math.max(0, tricks - contract);
    deltas[teamId] +=
      tricks >= contract ? contract * 10 + overtricks : -contract * 10;
    for (const player of team)
      if (player.bid === 0)
        deltas[teamId] +=
          player.tricks === 0 ? state.rules.nilBonus : -state.rules.nilBonus;
    if (tricks >= contract) {
      state.bags[teamId] += overtricks;
      if (state.rules.bagPenalty)
        while (state.bags[teamId] >= 10) {
          state.bags[teamId] -= 10;
          deltas[teamId] -= 100;
        }
    }
    state.scores[teamId] += deltas[teamId];
  }
  state.roundResult = {
    teamScores: { ...state.scores },
    teamDeltas: deltas,
    bags: { ...state.bags },
  };
  const reached = (["team-1", "team-2"] as const).filter(
    (teamId) => state.scores[teamId] >= state.rules.targetScore,
  );
  if (reached.length && state.scores["team-1"] !== state.scores["team-2"]) {
    state.phase = "finished";
    state.result = {
      winnerTeamId:
        state.scores["team-1"] > state.scores["team-2"] ? "team-1" : "team-2",
    };
  } else state.phase = "round-ended";
}

export function applySpadesAction(
  state: SpadesState,
  playerId: string,
  action: SpadesAction,
  randomInt: (max: number) => number,
): SpadesState {
  const next = structuredClone(state);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RuleError("not_active");
  if (!player.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");

  if (action.type === "spades:next-round") {
    if (next.phase !== "round-ended") throw new RuleError("round_not_finished");
    const dealerId = nextPlayer(next, next.dealerId).id;
    next.roundNumber += 1;
    dealRound(next, randomInt, dealerId);
    next.version += 1;
    return next;
  }

  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");
  if (action.type === "spades:bid") {
    if (next.phase !== "bidding") throw new RuleError("not_bidding");
    if (!Number.isInteger(action.bid) || action.bid < 0 || action.bid > 13)
      throw new RuleError("invalid_bid");
    player.bid = action.bid;
    const unbid = next.players.find((candidate) => candidate.bid === undefined);
    if (unbid) next.currentPlayerId = nextPlayer(next, playerId).id;
    else {
      next.phase = "playing";
      next.currentPlayerId = nextPlayer(next, next.dealerId).id;
    }
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
  if (
    !leadSuit &&
    card.suit === "spades" &&
    !next.spadesBroken &&
    player.hand.some((item) => item.suit !== "spades")
  )
    throw new RuleError("spades_not_broken");
  player.hand.splice(cardIndex, 1);
  next.trick.push({ playerId, card });
  if (card.suit === "spades") next.spadesBroken = true;
  if (next.trick.length < 4)
    next.currentPlayerId = nextPlayer(next, playerId).id;
  else {
    const winner = winningPlay(next.trick);
    next.players.find(
      (candidate) => candidate.id === winner.playerId,
    )!.tricks += 1;
    next.currentPlayerId = winner.playerId;
    next.trick = [];
    if (next.players.every((candidate) => candidate.hand.length === 0))
      scoreRound(next);
  }
  next.version += 1;
  return next;
}

export function spadesPlayerView(state: SpadesState, playerId: string) {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? player
        : { ...player, hand: [], handCount: player.hand.length },
    ),
  };
}
