import { type Card, type Rank, type Suit, createDeck, shuffle } from './cards.js';
import { RuleError } from './durak.js';

export type KnackPlayer = {
  id: string; name: string; hand: Card[]; connected: boolean; eliminated: boolean; lives: number; swimming: boolean;
};
export type KnackPhase = 'playing' | 'round-ended' | 'finished';
export type KnackScore = { playerId: string; score: number; label: 'points' | 'thirty-one' | 'fire' };
export type KnackRoundResult = {
  reason: 'knock' | 'thirty-one' | 'fire' | 'stock-empty'; scores: KnackScore[]; loserIds: string[];
};
export type KnackResult = { winnerId: string };
export type KnackState = {
  id: string; players: KnackPlayer[]; center: Card[]; deck: Card[]; discard: Card[];
  dealerId: string; currentPlayerId: string; closingPlayerId?: string; finalTurnsLeft: number;
  consecutivePasses: number; roundNumber: number; phase: KnackPhase; version: number;
  roundResult?: KnackRoundResult; result?: KnackResult;
};
export type KnackAction =
  | { type: 'knack:swap-one'; handCardId: string; centerCardId: string }
  | { type: 'knack:swap-all' }
  | { type: 'knack:pass' }
  | { type: 'knack:knock' }
  | { type: 'knack:next-round' };

const cardPoints: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, jack: 10, queen: 10, king: 10, ace: 11
};

export function scoreKnackHand(hand: readonly Card[]): KnackScore['score'] {
  if (hand.length !== 3) throw new RuleError('invalid_hand');
  if (hand.every((card) => card.rank === 'ace')) return 32;
  if (hand.every((card) => card.rank === hand[0]!.rank)) return 30.5;
  return Math.max(...(['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).map((suit) =>
    hand.filter((card) => card.suit === suit).reduce((sum, card) => sum + cardPoints[card.rank], 0)
  ));
}

const activePlayers = (state: KnackState) => state.players.filter((player) => !player.eliminated);
const nextActive = (state: KnackState, fromId: string) => {
  const start = state.players.findIndex((player) => player.id === fromId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(start + offset) % state.players.length]!;
    if (!player.eliminated) return player;
  }
  throw new RuleError('no_active_player');
};

function scoreEntry(player: KnackPlayer): KnackScore {
  const score = scoreKnackHand(player.hand);
  return { playerId: player.id, score, label: score === 32 ? 'fire' : score === 31 ? 'thirty-one' : 'points' };
}

function finishRound(state: KnackState, reason: KnackRoundResult['reason'], specialPlayerId?: string): void {
  const active = activePlayers(state);
  const scores = active.map(scoreEntry);
  const special = specialPlayerId ? scores.find((entry) => entry.playerId === specialPlayerId) : undefined;
  const candidateLosers = special?.label === 'fire'
    ? active.filter((player) => player.id !== specialPlayerId).map((player) => player.id)
    : scores.filter((entry) => entry.score === Math.min(...scores.map((candidate) => candidate.score))).map((entry) => entry.playerId);
  const loserIds = candidateLosers.length === active.length ? [] : candidateLosers;
  for (const loserId of loserIds) {
    const player = state.players.find((candidate) => candidate.id === loserId)!;
    if (player.swimming) player.eliminated = true;
    else if (player.lives > 1) player.lives -= 1;
    else { player.lives = 0; player.swimming = true; }
  }
  state.roundResult = { reason, scores, loserIds };
  delete state.closingPlayerId; state.finalTurnsLeft = 0; state.consecutivePasses = 0;
  const remaining = activePlayers(state);
  if (remaining.length === 1) { state.phase = 'finished'; state.result = { winnerId: remaining[0]!.id }; }
  else state.phase = 'round-ended';
}

function dealRound(state: KnackState, randomInt: (max: number) => number): void {
  const active = activePlayers(state); const deck = shuffle(createDeck(32), randomInt);
  for (const player of state.players) player.hand = [];
  for (let card = 0; card < 3; card += 1) for (const player of active) player.hand.push(deck.shift()!);
  state.center = deck.splice(0, 3); state.deck = deck; state.discard = []; state.roundNumber += 1;
  state.dealerId = nextActive(state, state.dealerId).id; state.currentPlayerId = nextActive(state, state.dealerId).id;
  state.phase = 'playing'; delete state.roundResult; delete state.closingPlayerId;
  state.finalTurnsLeft = 0; state.consecutivePasses = 0;
  const immediate = active.map(scoreEntry).find((entry) => entry.label === 'fire' || entry.label === 'thirty-one');
  if (immediate?.label === 'fire' || immediate?.label === 'thirty-one') finishRound(state, immediate.label, immediate.playerId);
}

export function createKnackGame(
  id: string,
  people: Array<{ id: string; name: string; connected?: boolean }>,
  randomInt: (max: number) => number
): KnackState {
  if (people.length < 2 || people.length > 6) throw new RuleError('invalid_player_count');
  const players: KnackPlayer[] = people.map((person) => ({ ...person, connected: person.connected ?? true, hand: [], eliminated: false, lives: 3, swimming: false }));
  const initialDealer = players[randomInt(players.length)]!;
  const state: KnackState = { id, players, center: [], deck: [], discard: [], dealerId: initialDealer.id, currentPlayerId: initialDealer.id, finalTurnsLeft: 0, consecutivePasses: 0, roundNumber: 0, phase: 'playing', version: 1 };
  dealRound(state, randomInt);
  return state;
}

function completeTurn(state: KnackState, playerId: string): void {
  const special = scoreEntry(state.players.find((player) => player.id === playerId)!);
  if (special.label !== 'points') { finishRound(state, special.label, playerId); return; }
  if (state.closingPlayerId) {
    state.finalTurnsLeft -= 1;
    if (state.finalTurnsLeft <= 0) { finishRound(state, 'knock'); return; }
  }
  state.currentPlayerId = nextActive(state, playerId).id;
}

export function applyKnackAction(state: KnackState, playerId: string, action: KnackAction, randomInt: (max: number) => number): KnackState {
  const next = structuredClone(state);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player || player.eliminated) throw new RuleError('not_active');
  if (!player.connected) throw new RuleError('player_offline');
  if (action.type === 'knack:next-round') {
    if (next.phase !== 'round-ended') throw new RuleError('round_not_ended');
    dealRound(next, randomInt); next.version += 1; return next;
  }
  if (next.phase === 'finished') throw new RuleError('game_finished');
  if (next.phase !== 'playing') throw new RuleError('round_ended');
  if (next.currentPlayerId !== playerId) throw new RuleError('not_your_turn');
  if (action.type === 'knack:swap-one') {
    const handIndex = player.hand.findIndex((card) => card.id === action.handCardId);
    const centerIndex = next.center.findIndex((card) => card.id === action.centerCardId);
    if (handIndex < 0) throw new RuleError('card_not_in_hand');
    if (centerIndex < 0) throw new RuleError('card_not_in_center');
    [player.hand[handIndex], next.center[centerIndex]] = [next.center[centerIndex]!, player.hand[handIndex]!];
    next.consecutivePasses = 0; completeTurn(next, playerId);
  } else if (action.type === 'knack:swap-all') {
    const oldHand = player.hand; player.hand = next.center; next.center = oldHand;
    next.consecutivePasses = 0; completeTurn(next, playerId);
  } else if (action.type === 'knack:pass') {
    next.consecutivePasses += 1;
    if (!next.closingPlayerId && next.consecutivePasses >= activePlayers(next).length) {
      if (next.deck.length < 3) finishRound(next, 'stock-empty');
      else { next.discard.push(...next.center); next.center = next.deck.splice(0, 3); next.consecutivePasses = 0; next.currentPlayerId = nextActive(next, playerId).id; }
    } else completeTurn(next, playerId);
  } else {
    if (next.closingPlayerId) throw new RuleError('already_knocked');
    next.closingPlayerId = playerId; next.finalTurnsLeft = activePlayers(next).length - 1;
    next.consecutivePasses = 0; next.currentPlayerId = nextActive(next, playerId).id;
  }
  next.version += 1;
  return next;
}

export function knackPlayerView(state: KnackState, playerId: string) {
  return { ...state, players: state.players.map((player) => player.id === playerId ? player : { ...player, hand: [], handCount: player.hand.length }), deck: [], deckCount: state.deck.length };
}
