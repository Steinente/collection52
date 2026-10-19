import { type Card, type DeckSize, type Suit, beats, createDeck, rankValue, shuffle } from './cards.js';

export type PlayerSeat = { id: string; name: string; hand: Card[]; connected: boolean; eliminated: boolean };
export type TablePair = { attack: Card; defense?: Card };
export type DurakPhase = 'attack' | 'defense' | 'throw-in' | 'finished';
export type DurakResult = { draw: boolean; durakId?: string; winners: string[] };
export type DurakState = {
  id: string; deckSize: Exclude<DeckSize, 32>; players: PlayerSeat[]; deck: Card[]; trumpSuit: Suit; trumpCard?: Card;
  attackerId: string; defenderId: string; phase: DurakPhase; table: TablePair[]; roundAttackLimit: number;
  passedPlayerIds: string[]; throwOrder: string[]; roundAttackerId: string; version: number; result?: DurakResult;
};
export type DurakAction =
  | { type: 'attack'; cardIds: string[] }
  | { type: 'defend'; cardId: string; attackCardId: string }
  | { type: 'take' }
  | { type: 'pass' };

export class RuleError extends Error { constructor(public code: string) { super(code); } }

const nextActive = (state: DurakState, fromId: string, exclude = new Set<string>()): PlayerSeat => {
  const start = state.players.findIndex((p) => p.id === fromId);
  for (let n = 1; n <= state.players.length; n += 1) {
    const player = state.players[(start + n) % state.players.length]!;
    if (!player.eliminated && !exclude.has(player.id)) return player;
  }
  throw new RuleError('no_active_player');
};

const removeCard = (player: PlayerSeat, cardId: string): Card => {
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new RuleError('card_not_in_hand');
  return player.hand.splice(index, 1)[0]!;
};

export function createDurakGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  deckSize: Exclude<DeckSize, 32>,
  randomInt: (max: number) => number
): DurakState {
  if (people.length < 2 || people.length > 6) throw new RuleError('invalid_player_count');
  const cards = shuffle(createDeck(deckSize), randomInt);
  const players: PlayerSeat[] = people.map((p) => ({ ...p, connected: p.connected ?? true, eliminated: false, hand: [] }));
  for (let n = 0; n < 6; n += 1) for (const player of players) { const card = cards.shift(); if (card) player.hand.push(card); }
  const trumpCard = cards.length ? cards[cards.length - 1] : players.at(-1)?.hand.at(-1);
  if (!trumpCard) throw new RuleError('missing_trump');
  let candidates = players.flatMap((p) => p.hand.filter((c) => c.suit === trumpCard.suit).map((card) => ({ player: p, card })));
  candidates = candidates.sort((a, b) => rankValue(a.card) - rankValue(b.card));
  const attacker = candidates[0]?.player ?? players[randomInt(players.length)]!;
  const defender = players[(players.indexOf(attacker) + 1) % players.length]!;
  return {
    id, deckSize, players, deck: cards, trumpSuit: trumpCard.suit, ...(cards.length ? { trumpCard } : {}),
    attackerId: attacker.id, defenderId: defender.id, roundAttackerId: attacker.id, phase: 'attack', table: [],
    roundAttackLimit: Math.min(6, defender.hand.length), passedPlayerIds: [], throwOrder: [], version: 1
  };
}

function eligibleAttackers(state: DurakState): PlayerSeat[] {
  const defenderIndex = state.players.findIndex((p) => p.id === state.defenderId);
  const ordered = [...state.players.slice(defenderIndex + 1), ...state.players.slice(0, defenderIndex)];
  const original = state.players.find((p) => p.id === state.roundAttackerId)!;
  return [original, ...ordered.filter((p) => p.id !== original.id)].filter((p) => !p.eliminated && p.id !== state.defenderId);
}

function refillAndFinishRound(state: DurakState, pickedUp: boolean): void {
  const defender = state.players.find((p) => p.id === state.defenderId)!;
  if (pickedUp) defender.hand.push(...state.table.flatMap((pair) => pair.defense ? [pair.attack, pair.defense] : [pair.attack]));
  const original = state.players.find((p) => p.id === state.roundAttackerId)!;
  const originalIndex = state.players.indexOf(original);
  const clockwise = [...state.players.slice(originalIndex + 1), ...state.players.slice(0, originalIndex)].filter((p) => !p.eliminated && p.id !== defender.id);
  const contributors = state.throwOrder.map((id) => state.players.find((p) => p.id === id)).filter((p): p is PlayerSeat => Boolean(p && p.id !== original.id && !p.eliminated));
  const drawOrder = [original, ...contributors, ...clockwise, defender].filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i);
  for (const player of drawOrder) while (player.hand.length < 6 && state.deck.length) player.hand.push(state.deck.shift()!);
  if (!state.deck.length) for (const player of state.players) if (!player.hand.length) player.eliminated = true;
  const remaining = state.players.filter((p) => !p.eliminated);
  state.table = []; state.passedPlayerIds = []; state.throwOrder = [];
  if (remaining.length <= 1) {
    state.phase = 'finished';
    state.result = remaining.length === 0
      ? { draw: true, winners: state.players.map((p) => p.id) }
      : { draw: false, durakId: remaining[0]!.id, winners: state.players.filter((p) => p.id !== remaining[0]!.id).map((p) => p.id) };
    return;
  }
  const next = pickedUp ? nextActive(state, defender.id) : (defender.eliminated ? nextActive(state, defender.id) : defender);
  state.attackerId = next.id;
  state.roundAttackerId = next.id;
  state.defenderId = nextActive(state, next.id).id;
  state.roundAttackLimit = Math.min(6, state.players.find((p) => p.id === state.defenderId)!.hand.length);
  state.phase = 'attack';
}

export function applyDurakAction(state: DurakState, playerId: string, action: DurakAction): DurakState {
  const next = structuredClone(state);
  if (next.phase === 'finished') throw new RuleError('game_finished');
  const player = next.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) throw new RuleError('not_active');
  if (!player.connected) throw new RuleError('player_offline');
  if (action.type === 'attack') {
    if (playerId === next.defenderId || !['attack', 'throw-in'].includes(next.phase)) throw new RuleError('cannot_attack');
    if (next.phase === 'attack' && playerId !== next.attackerId) throw new RuleError('not_your_turn');
    if (next.phase !== 'attack') {
      const expected = eligibleAttackers(next).find((p) => p.hand.length > 0 && !next.passedPlayerIds.includes(p.id));
      if (expected?.id !== playerId) throw new RuleError('not_your_turn');
    }
    if (!action.cardIds.length) throw new RuleError('no_attack_cards');
    if (new Set(action.cardIds).size !== action.cardIds.length) throw new RuleError('duplicate_attack_card');
    if (next.phase !== 'attack' && action.cardIds.length !== 1) throw new RuleError('single_throw_in_only');
    if (next.table.length + action.cardIds.length > next.roundAttackLimit) throw new RuleError('attack_limit');
    const candidates = action.cardIds.map((cardId) => player.hand.find((card) => card.id === cardId));
    if (candidates.some((card) => !card)) throw new RuleError('card_not_in_hand');
    const cards = candidates as Card[];
    if (next.phase === 'attack' && new Set(cards.map((card) => card.rank)).size !== 1) throw new RuleError('opening_rank_mismatch');
    if (next.table.length) {
      const ranks = new Set(next.table.flatMap((p) => p.defense ? [p.attack.rank, p.defense.rank] : [p.attack.rank]));
      if (cards.some((card) => !ranks.has(card.rank))) throw new RuleError('rank_not_on_table');
    }
    for (const card of cards) next.table.push({ attack: removeCard(player, card.id) });
    if (!next.throwOrder.includes(playerId)) next.throwOrder.push(playerId);
    next.phase = 'defense';
  } else if (action.type === 'defend') {
    if (playerId !== next.defenderId || next.phase !== 'defense') throw new RuleError('cannot_defend');
    const pair = next.table.find((p) => p.attack.id === action.attackCardId);
    if (!pair || pair.defense) throw new RuleError('invalid_attack_target');
    const card = player.hand.find((c) => c.id === action.cardId);
    if (!card) throw new RuleError('card_not_in_hand');
    if (!beats(card, pair.attack, next.trumpSuit)) throw new RuleError('card_does_not_beat');
    pair.defense = removeCard(player, action.cardId);
    if (next.table.every((p) => p.defense)) { next.phase = 'throw-in'; next.passedPlayerIds = []; }
  } else if (action.type === 'take') {
    if (playerId !== next.defenderId || !['defense', 'throw-in'].includes(next.phase)) throw new RuleError('cannot_take');
    refillAndFinishRound(next, true);
  } else {
    if (playerId === next.defenderId || next.phase !== 'throw-in') throw new RuleError('cannot_pass');
    const expected = eligibleAttackers(next).find((p) => p.hand.length > 0 && !next.passedPlayerIds.includes(p.id));
    if (expected?.id !== playerId) throw new RuleError('not_your_turn');
    next.passedPlayerIds.push(playerId);
  }

  if (next.phase === 'throw-in') {
    const eligible = eligibleAttackers(next).filter((p) => p.hand.length > 0);
    const allPassed = eligible.every((p) => next.passedPlayerIds.includes(p.id));
    const limitReached = next.table.length >= next.roundAttackLimit;
    if (allPassed || limitReached || eligible.length === 0) refillAndFinishRound(next, false);
  }
  next.version += 1;
  return next;
}

export function withdrawDurakPlayer(state: DurakState, playerId: string): DurakState {
  const next = structuredClone(state); const leavingIndex = next.players.findIndex((player) => player.id === playerId);
  if (leavingIndex < 0) throw new RuleError('player_not_found');
  const leavingWasDefender = next.defenderId === playerId; const defenderId = next.defenderId;
  next.players.splice(leavingIndex, 1); next.passedPlayerIds = next.passedPlayerIds.filter((id) => id !== playerId); next.throwOrder = next.throwOrder.filter((id) => id !== playerId);
  if (next.players.length < 2) throw new RuleError('invalid_player_count');
  next.table = [];
  for (const player of next.players) while (player.hand.length < 6 && next.deck.length) player.hand.push(next.deck.shift()!);
  if (!next.deck.length) for (const player of next.players) if (!player.hand.length) player.eliminated = true;
  const active = next.players.filter((player) => !player.eliminated);
  if (active.length <= 1) {
    next.phase = 'finished'; next.result = active.length ? { draw: false, winners: [active[0]!.id] } : { draw: true, winners: [] }; next.version += 1; return next;
  }
  const playerAfterLeaving = next.players[leavingIndex % next.players.length]!;
  const nextAttacker = leavingWasDefender ? playerAfterLeaving : next.players.find((player) => player.id === defenderId && !player.eliminated) ?? playerAfterLeaving;
  next.attackerId = nextAttacker.id; next.roundAttackerId = nextAttacker.id; next.defenderId = nextActive(next, nextAttacker.id).id;
  next.roundAttackLimit = Math.min(6, next.players.find((player) => player.id === next.defenderId)!.hand.length); next.phase = 'attack'; delete next.result; next.version += 1;
  return next;
}

export function playerView(state: DurakState, playerId: string) {
  return { ...state, players: state.players.map((p) => p.id === playerId ? p : { ...p, hand: [], handCount: p.hand.length }), deck: [], deckCount: state.deck.length };
}
