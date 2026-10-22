import { createDeck, ranks52, shuffle, type Card, type Rank } from "./cards.js";
import { RuleError } from "./durak.js";

export type CheatRules = {
  deckCount: 1 | 2;
  direction: "ascending" | "descending";
  maxCardsPerTurn: number;
};
export const defaultCheatRules: CheatRules = {
  deckCount: 1,
  direction: "ascending",
  maxCardsPerTurn: 4,
};
export type CheatPlayer = {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
};
export type CheatPlay = {
  playerId: string;
  claimedRank: Rank;
  cardIds: string[];
};
export type CheatChallenge = {
  challengerId: string;
  challengedId: string;
  truthful: boolean;
  loserId: string;
  cards: Card[];
};
export type CheatState = {
  id: string;
  version: number;
  phase: "playing" | "finished";
  players: CheatPlayer[];
  currentPlayerId: string;
  currentRank: Rank;
  pile: Card[];
  lastPlay?: CheatPlay;
  pendingWinnerId?: string;
  lastChallenge?: CheatChallenge;
  rules: CheatRules;
  result?: { winnerId: string };
};
export type CheatAction =
  | { type: "cheat:play"; cardIds: string[] }
  | { type: "cheat:challenge" }
  | { type: "cheat:accept" };

const nextPlayer = (state: CheatState, id: string) => {
  const index = state.players.findIndex((player) => player.id === id);
  if (index < 0) throw new RuleError("player_not_found");
  return state.players[(index + 1) % state.players.length]!;
};
const nextRank = (rank: Rank, direction: CheatRules["direction"]) => {
  const index = ranks52.indexOf(rank);
  const offset = direction === "ascending" ? 1 : -1;
  return ranks52[(index + offset + ranks52.length) % ranks52.length]!;
};

export function createCheatDeck(deckCount: 1 | 2) {
  return Array.from({ length: deckCount }, (_, deckIndex) =>
    createDeck(52).map((card) => ({
      ...card,
      id: `d${deckIndex + 1}-${card.id}`,
    })),
  ).flat();
}

export function createCheatGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: CheatRules = defaultCheatRules,
): CheatState {
  if (people.length < 2 || people.length > 10)
    throw new RuleError("cheat_requires_two_to_ten_players");
  const players: CheatPlayer[] = people.map((person) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
  }));
  const deck = shuffle(createCheatDeck(rules.deckCount), randomInt);
  for (let index = 0; deck.length; index += 1)
    players[index % players.length]!.hand.push(deck.shift()!);
  return {
    id,
    version: 1,
    phase: "playing",
    players,
    currentPlayerId: players[0]!.id,
    currentRank: "ace",
    pile: [],
    rules: { ...rules },
  };
}

export function applyCheatAction(
  state: CheatState,
  playerId: string,
  action: CheatAction,
): CheatState {
  const next = structuredClone(state);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RuleError("not_active");
  if (!player.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");

  if (action.type === "cheat:challenge") {
    const play = next.lastPlay;
    if (!play) throw new RuleError("nothing_to_challenge");
    if (play.playerId === playerId)
      throw new RuleError("cannot_challenge_self");
    const playedCards = play.cardIds.map((id) =>
      next.pile.find((card) => card.id === id),
    );
    if (playedCards.some((card) => !card))
      throw new RuleError("invalid_action");
    const cards = playedCards as Card[];
    const truthful = cards.every((card) => card.rank === play.claimedRank);
    const loserId = truthful ? playerId : play.playerId;
    next.players
      .find((candidate) => candidate.id === loserId)!
      .hand.push(...next.pile);
    next.lastChallenge = {
      challengerId: playerId,
      challengedId: play.playerId,
      truthful,
      loserId,
      cards,
    };
    next.pile = [];
    delete next.lastPlay;
    if (truthful && next.pendingWinnerId === play.playerId) {
      next.phase = "finished";
      next.result = { winnerId: play.playerId };
    }
    delete next.pendingWinnerId;
    next.version += 1;
    return next;
  }

  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");
  if (action.type === "cheat:accept") {
    if (!next.lastPlay) throw new RuleError("nothing_to_accept");
    if (next.pendingWinnerId) {
      next.phase = "finished";
      next.result = { winnerId: next.pendingWinnerId };
    }
    delete next.lastPlay;
    delete next.pendingWinnerId;
    next.version += 1;
    return next;
  }

  if (next.pendingWinnerId) throw new RuleError("last_play_must_be_resolved");
  if (
    action.cardIds.length < 1 ||
    action.cardIds.length > next.rules.maxCardsPerTurn ||
    new Set(action.cardIds).size !== action.cardIds.length
  )
    throw new RuleError("invalid_card_count");
  const cards = action.cardIds.map((id) =>
    player.hand.find((card) => card.id === id),
  );
  if (cards.some((card) => !card)) throw new RuleError("card_not_in_hand");
  delete next.lastPlay;
  delete next.lastChallenge;
  for (const card of cards as Card[]) {
    player.hand.splice(
      player.hand.findIndex((item) => item.id === card.id),
      1,
    );
    next.pile.push(card);
  }
  next.lastPlay = {
    playerId,
    claimedRank: next.currentRank,
    cardIds: action.cardIds,
  };
  if (player.hand.length === 0) next.pendingWinnerId = playerId;
  next.currentRank = nextRank(next.currentRank, next.rules.direction);
  next.currentPlayerId = nextPlayer(next, playerId).id;
  next.version += 1;
  return next;
}

export function cheatPlayerView(state: CheatState, playerId: string) {
  return {
    ...state,
    pile: [],
    pileCount: state.pile.length,
    lastPlay: state.lastPlay
      ? {
          playerId: state.lastPlay.playerId,
          claimedRank: state.lastPlay.claimedRank,
          count: state.lastPlay.cardIds.length,
        }
      : undefined,
    players: state.players.map((player) =>
      player.id === playerId
        ? player
        : { ...player, hand: [], handCount: player.hand.length },
    ),
  };
}
