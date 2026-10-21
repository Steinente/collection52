import { type Card, type Suit, createDeck, shuffle } from "./cards.js";
import { RuleError } from "./durak.js";

export type MauMauPlayer = {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
};
export type MauMauPhase = "playing" | "finished";
export type MauMauRules = {
  stackSevens: boolean;
  forbidJackOnJack: boolean;
  forbidJackAsFinal: boolean;
  aceReverses: boolean;
};
export const defaultMauMauRules: MauMauRules = {
  stackSevens: false,
  forbidJackOnJack: false,
  forbidJackAsFinal: false,
  aceReverses: false,
};
export type MauMauState = {
  id: string;
  players: MauMauPlayer[];
  deck: Card[];
  discard: Card[];
  currentPlayerId: string;
  activeSuit: Suit;
  rules: MauMauRules;
  direction: 1 | -1;
  pendingDraw: number;
  phase: MauMauPhase;
  version: number;
  drawnCardId?: string;
  result?: { winnerId: string };
};
export type MauMauAction =
  | { type: "mau-mau:play"; cardId: string; chosenSuit?: Suit }
  | { type: "mau-mau:draw" }
  | { type: "mau-mau:pass" };

const nextPlayer = (state: MauMauState, fromId: string, steps = 1) => {
  const start = state.players.findIndex((player) => player.id === fromId);
  if (start < 0) throw new RuleError("player_not_found");
  return state.players[
    (start + steps * state.direction + state.players.length * steps) %
      state.players.length
  ]!;
};

export function canPlayMauMauCard(
  card: Card,
  topCard: Card,
  activeSuit: Suit,
): boolean {
  return (
    card.rank === "jack" ||
    card.suit === activeSuit ||
    card.rank === topCard.rank
  );
}

function replenishAndDraw(
  state: MauMauState,
  count: number,
  randomInt: (max: number) => number,
): Card[] {
  const drawn: Card[] = [];
  while (drawn.length < count) {
    if (!state.deck.length) {
      if (state.discard.length <= 1) break;
      const top = state.discard.pop()!;
      state.deck = shuffle(state.discard, randomInt);
      state.discard = [top];
    }
    const card = state.deck.shift();
    if (card) drawn.push(card);
  }
  return drawn;
}

export function createMauMauGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number,
  rules: MauMauRules = defaultMauMauRules,
): MauMauState {
  if (people.length < 2 || people.length > 6)
    throw new RuleError("invalid_player_count");
  const deck = shuffle(createDeck(32), randomInt);
  const players: MauMauPlayer[] = people.map((person) => ({
    ...person,
    connected: person.connected ?? true,
    hand: [],
  }));
  for (let round = 0; round < 5; round += 1)
    for (const player of players) player.hand.push(deck.shift()!);
  const normalIndex = deck.findIndex(
    (card) => !["7", "8", "jack"].includes(card.rank),
  );
  const [openingCard] = deck.splice(normalIndex < 0 ? 0 : normalIndex, 1);
  if (!openingCard) throw new RuleError("deck_empty");
  const firstPlayer = players[randomInt(players.length)]!;
  return {
    id,
    players,
    deck,
    discard: [openingCard],
    currentPlayerId: firstPlayer.id,
    activeSuit: openingCard.suit,
    rules: { ...rules },
    direction: 1,
    pendingDraw: 0,
    phase: "playing",
    version: 1,
  };
}

export function applyMauMauAction(
  state: MauMauState,
  playerId: string,
  action: MauMauAction,
  randomInt: (max: number) => number,
): MauMauState {
  const next = structuredClone(state);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RuleError("not_active");
  if (!player.connected) throw new RuleError("player_offline");
  if (next.phase === "finished") throw new RuleError("game_finished");
  if (next.currentPlayerId !== playerId) throw new RuleError("not_your_turn");
  const topCard = next.discard.at(-1)!;

  if (action.type === "mau-mau:draw") {
    if (next.drawnCardId) throw new RuleError("already_drew");
    if (next.pendingDraw > 0) {
      player.hand.push(...replenishAndDraw(next, next.pendingDraw, randomInt));
      next.pendingDraw = 0;
      next.currentPlayerId = nextPlayer(next, playerId).id;
      next.version += 1;
      return next;
    }
    const [card] = replenishAndDraw(next, 1, randomInt);
    if (!card) throw new RuleError("deck_empty");
    player.hand.push(card);
    if (canPlayMauMauCard(card, topCard, next.activeSuit))
      next.drawnCardId = card.id;
    else next.currentPlayerId = nextPlayer(next, playerId).id;
    next.version += 1;
    return next;
  }

  if (action.type === "mau-mau:pass") {
    if (!next.drawnCardId) throw new RuleError("must_draw_first");
    delete next.drawnCardId;
    next.currentPlayerId = nextPlayer(next, playerId).id;
    next.version += 1;
    return next;
  }

  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId);
  if (cardIndex < 0) throw new RuleError("card_not_in_hand");
  const card = player.hand[cardIndex]!;
  if (next.drawnCardId && card.id !== next.drawnCardId)
    throw new RuleError("only_drawn_card");
  if (next.pendingDraw > 0 && card.rank !== "7")
    throw new RuleError("seven_required");
  if (!canPlayMauMauCard(card, topCard, next.activeSuit))
    throw new RuleError("card_not_playable");
  if (
    card.rank === "jack" &&
    topCard.rank === "jack" &&
    next.rules.forbidJackOnJack
  )
    throw new RuleError("jack_on_jack_forbidden");
  if (
    card.rank === "jack" &&
    player.hand.length === 1 &&
    next.rules.forbidJackAsFinal
  )
    throw new RuleError("jack_as_final_forbidden");
  if (card.rank === "jack" && !action.chosenSuit)
    throw new RuleError("suit_required");

  player.hand.splice(cardIndex, 1);
  next.discard.push(card);
  next.activeSuit = card.rank === "jack" ? action.chosenSuit! : card.suit;
  delete next.drawnCardId;

  if (player.hand.length === 0) {
    next.phase = "finished";
    next.result = { winnerId: playerId };
  } else {
    if (card.rank === "ace" && next.rules.aceReverses)
      next.direction = next.direction === 1 ? -1 : 1;
    const skippedPlayer = nextPlayer(next, playerId);
    if (card.rank === "7" && next.rules.stackSevens) {
      next.pendingDraw += 2;
      next.currentPlayerId = skippedPlayer.id;
    } else if (card.rank === "7") {
      skippedPlayer.hand.push(...replenishAndDraw(next, 2, randomInt));
      next.currentPlayerId = nextPlayer(next, playerId, 2).id;
    } else if (card.rank === "8")
      next.currentPlayerId = nextPlayer(next, playerId, 2).id;
    else next.currentPlayerId = skippedPlayer.id;
  }
  next.version += 1;
  return next;
}

export function mauMauPlayerView(state: MauMauState, playerId: string) {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? player
        : { ...player, hand: [], handCount: player.hand.length },
    ),
    deck: [],
    deckCount: state.deck.length,
    discard: state.discard.slice(-1),
    discardCount: state.discard.length,
    ...(state.drawnCardId &&
    state.players
      .find((player) => player.id === playerId)
      ?.hand.some((card) => card.id === state.drawnCardId)
      ? { drawnCardId: state.drawnCardId }
      : { drawnCardId: undefined }),
  };
}
