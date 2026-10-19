import { ranks52, suits, type Card, type Rank, shuffle } from './cards.js';
import { RuleError } from './durak.js';

export type RommeCard = Card | { id: string; suit: 'joker'; rank: 'joker' };
export type RommeRules = { openingPoints: 30 | 40; requireDiscardUse: boolean };
export const defaultRommeRules: RommeRules = { openingPoints: 40, requireDiscardUse: false };
export type RommeMeld = { id: string; ownerId: string; kind: 'set' | 'run'; cards: RommeCard[]; points: number };
export type RommePlayer = { id: string; name: string; connected: boolean; hand: RommeCard[]; opened: boolean };
export type RommeState = {
  id: string; players: RommePlayer[]; deck: RommeCard[]; discard: RommeCard[]; melds: RommeMeld[];
  currentPlayerId: string; hasDrawn: boolean; drawnDiscardId?: string; rules: RommeRules;
  phase: 'playing' | 'finished'; version: number; result?: { winnerId: string; handPoints: Record<string, number> };
};
export type RommeAction =
  | { type: 'romme:draw'; source: 'stock' | 'discard' }
  | { type: 'romme:meld'; groups: Array<{ cardIds: string[] }> }
  | { type: 'romme:lay-off'; meldId: string; cardIds: string[] }
  | { type: 'romme:replace-joker'; meldId: string; jokerId: string; cardIds: string[] }
  | { type: 'romme:discard'; cardId: string };

const rankNumber = (rank: Rank) => ranks52.indexOf(rank) + 2;
const cardPoint = (card: RommeCard) => card.rank === 'joker' ? 20 : card.rank === 'ace' ? 11 : ['jack', 'queen', 'king'].includes(card.rank) ? 10 : Number(card.rank);
export const rommeHandPoints = (cards: RommeCard[]) => cards.reduce((sum, card) => sum + cardPoint(card), 0);

export function createRommeDeck(): RommeCard[] {
  const cards: RommeCard[] = [];
  for (let copy = 1; copy <= 2; copy += 1) for (const suit of suits) for (const rank of ranks52) cards.push({ id: `${suit}-${rank}-${copy}`, suit, rank });
  for (let index = 1; index <= 6; index += 1) cards.push({ id: `joker-${index}`, suit: 'joker', rank: 'joker' });
  return cards;
}

function setPoints(cards: RommeCard[]) {
  const natural = cards.find((card) => card.rank !== 'joker');
  return natural ? cards.length * cardPoint(natural) : 0;
}

function validateSet(cards: RommeCard[]) {
  if (cards.length < 3 || cards.length > 4) return undefined;
  const naturals = cards.filter((card): card is Card => card.rank !== 'joker');
  if (naturals.length < 2 || new Set(naturals.map((card) => card.rank)).size !== 1 || new Set(naturals.map((card) => card.suit)).size !== naturals.length) return undefined;
  return setPoints(cards);
}

function runCandidate(cards: RommeCard[], aceHigh: boolean) {
  const naturals = cards.filter((card): card is Card => card.rank !== 'joker');
  if (naturals.length < 2 || new Set(naturals.map((card) => card.suit)).size !== 1) return undefined;
  const values = naturals.map((card) => card.rank === 'ace' ? (aceHigh ? 14 : 1) : rankNumber(card.rank)).sort((a, b) => a - b);
  if (new Set(values).size !== values.length) return undefined;
  const candidates = Array.from({ length: 16 - cards.length - (aceHigh ? 2 : 1) }, (_, index) => index + (aceHigh ? 2 : 1)).map((start) => {
    const represented = Array.from({ length: cards.length }, (_, index) => start + index);
    if (values.some((value) => !represented.includes(value))) return undefined;
    const points = represented.reduce((sum, value) => sum + (value === 1 ? 1 : value === 14 ? 11 : Math.min(value, 10)), 0);
    return { points, represented, aceHigh };
  }).filter((value): value is { points: number; represented: number[]; aceHigh: boolean } => Boolean(value));
  return candidates.sort((left, right) => right.points - left.points)[0];
}

const runCandidates = (cards: RommeCard[]) => [runCandidate(cards, false), runCandidate(cards, true)].filter((value): value is { points: number; represented: number[]; aceHigh: boolean } => Boolean(value)).sort((a, b) => b.points - a.points);

function validateRun(cards: RommeCard[]) {
  if (cards.length < 3 || cards.length > 13) return undefined;
  return runCandidates(cards)[0]?.points;
}

function orderMeldCards(kind: RommeMeld['kind'], cards: RommeCard[]) {
  if (kind === 'set') return cards;
  const candidate = runCandidates(cards)[0]; if (!candidate) return cards;
  const naturals = cards.filter((card): card is Card => card.rank !== 'joker'); const jokers = cards.filter((card) => card.rank === 'joker');
  const byValue = new Map(naturals.map((card) => [card.rank === 'ace' ? (candidate.aceHigh ? 14 : 1) : rankNumber(card.rank), card]));
  return candidate.represented.map((value) => byValue.get(value) ?? jokers.shift()!).filter(Boolean);
}

function ensureUniqueMeldIds(state: RommeState) {
  const occurrences = new Map<string, number>();
  for (const meld of state.melds) {
    const occurrence = occurrences.get(meld.id) ?? 0;
    occurrences.set(meld.id, occurrence + 1);
    if (occurrence > 0) meld.id = `${meld.id}:${occurrence}`;
  }
}

export function rommeMeldPoints(kind: 'set' | 'run', cards: RommeCard[]) { return kind === 'set' ? validateSet(cards) : validateRun(cards); }
export function isValidRommeMeld(kind: 'set' | 'run', cards: RommeCard[]) { return rommeMeldPoints(kind, cards) !== undefined; }

export function detectRommeMeld(cards: RommeCard[]): Pick<RommeMeld, 'kind' | 'points'> | undefined {
  const set = validateSet(cards);
  if (set !== undefined) return { kind: 'set', points: set };
  const run = validateRun(cards);
  return run === undefined ? undefined : { kind: 'run', points: run };
}

export function isPotentialRommeMeld(cards: RommeCard[]) {
  if (cards.length <= 1) return true;
  const naturals = cards.filter((card): card is Card => card.rank !== 'joker');
  const potentialSet = cards.length <= 4
    && new Set(naturals.map((card) => card.rank)).size <= 1
    && new Set(naturals.map((card) => card.suit)).size === naturals.length;
  const naturalSuits = new Set(naturals.map((card) => card.suit));
  const potentialRun = cards.length <= 13 && naturalSuits.size <= 1 && [false, true].some((aceHigh) => {
    const values = naturals.map((card) => card.rank === 'ace' ? (aceHigh ? 14 : 1) : rankNumber(card.rank));
    return new Set(values).size === values.length && (!values.length || Math.max(...values) - Math.min(...values) < 13);
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

export function createRommeGame(id: string, people: Array<{ id: string; name: string; connected?: boolean }>, randomInt: (max: number) => number, rules: RommeRules = defaultRommeRules): RommeState {
  if (people.length < 2 || people.length > 6) throw new RuleError('invalid_player_count');
  const deck = shuffle(createRommeDeck(), randomInt);
  const players: RommePlayer[] = people.map((person) => ({ ...person, connected: person.connected ?? true, hand: [], opened: false }));
  for (let round = 0; round < 13; round += 1) for (const player of players) player.hand.push(deck.shift()!);
  const opening = deck.shift(); if (!opening) throw new RuleError('deck_empty');
  return { id, players, deck, discard: [opening], melds: [], currentPlayerId: players[randomInt(players.length)]!.id, hasDrawn: false, rules: { ...rules }, phase: 'playing', version: 1 };
}

export function applyRommeAction(state: RommeState, playerId: string, action: RommeAction, randomInt: (max: number) => number): RommeState {
  const next = structuredClone(state); const player = next.players.find((item) => item.id === playerId);
  if (!player) throw new RuleError('not_active'); if (!player.connected) throw new RuleError('player_offline');
  if (next.phase === 'finished') throw new RuleError('game_finished'); if (next.currentPlayerId !== playerId) throw new RuleError('not_your_turn');
  if (action.type === 'romme:draw') {
    if (next.hasDrawn) throw new RuleError('already_drew');
    const card = action.source === 'discard' ? next.discard.pop() : drawStock(next, randomInt); if (!card) throw new RuleError('deck_empty');
    player.hand.push(card); next.hasDrawn = true; if (action.source === 'discard') next.drawnDiscardId = card.id; next.version += 1; return next;
  }
  if (!next.hasDrawn) throw new RuleError('must_draw_first');
  const takeCards = (ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new RuleError('duplicate_card');
    const cards = ids.map((id) => player.hand.find((card) => card.id === id)); if (cards.some((card) => !card)) throw new RuleError('card_not_in_hand');
    return cards as RommeCard[];
  };
  if (action.type === 'romme:meld') {
    if (!action.groups.length) throw new RuleError('invalid_meld');
    const allIds = action.groups.flatMap((group) => group.cardIds); const cards = takeCards(allIds);
    if (new Set(allIds).size !== allIds.length) throw new RuleError('duplicate_card');
    const melds = action.groups.map((group, groupIndex) => { const groupCards = group.cardIds.map((id) => cards.find((card) => card.id === id)!); const detected = detectRommeMeld(groupCards); if (!detected) throw new RuleError('invalid_meld'); return { id: `${next.id}:meld:${next.version}:${next.melds.length + groupIndex}`, ownerId: playerId, kind: detected.kind, cards: orderMeldCards(detected.kind, groupCards), points: detected.points } satisfies RommeMeld; });
    const points = melds.reduce((sum, meld) => sum + meld.points, 0); if (!player.opened && points < next.rules.openingPoints) throw new RuleError('opening_points_required');
    if (next.rules.requireDiscardUse && next.drawnDiscardId && !allIds.includes(next.drawnDiscardId)) throw new RuleError('discard_must_be_used');
    player.opened = true; player.hand = player.hand.filter((card) => !allIds.includes(card.id)); next.melds.push(...melds); delete next.drawnDiscardId;
    if (!player.hand.length) { next.phase = 'finished'; next.result = { winnerId: playerId, handPoints: Object.fromEntries(next.players.map((item) => [item.id, rommeHandPoints(item.hand)])) }; }
    ensureUniqueMeldIds(next); next.version += 1; return next;
  }
  if (action.type === 'romme:lay-off') {
    if (!player.opened) throw new RuleError('must_open_first'); const cards = takeCards(action.cardIds); const matchingMelds = next.melds.filter((item) => item.id === action.meldId); if (!matchingMelds.length) throw new RuleError('meld_not_found');
    const meld = matchingMelds.find((candidate) => rommeMeldPoints(candidate.kind, [...candidate.cards, ...cards]) !== undefined) ?? matchingMelds[0]!;
    const combined = [...meld.cards, ...cards]; const points = rommeMeldPoints(meld.kind, combined); if (points === undefined) throw new RuleError('invalid_meld');
    if (next.rules.requireDiscardUse && next.drawnDiscardId && !action.cardIds.includes(next.drawnDiscardId)) throw new RuleError('discard_must_be_used');
    meld.cards = orderMeldCards(meld.kind, combined); meld.points = points; player.hand = player.hand.filter((card) => !action.cardIds.includes(card.id)); delete next.drawnDiscardId;
    if (!player.hand.length) { next.phase = 'finished'; next.result = { winnerId: playerId, handPoints: Object.fromEntries(next.players.map((item) => [item.id, rommeHandPoints(item.hand)])) }; }
    ensureUniqueMeldIds(next); next.version += 1; return next;
  }
  if (action.type === 'romme:replace-joker') {
    if (!player.opened) throw new RuleError('must_open_first'); const matchingMelds = next.melds.filter((item) => item.id === action.meldId); if (!matchingMelds.length) throw new RuleError('meld_not_found');
    const meld = matchingMelds.find((item) => item.cards.some((card) => card.id === action.jokerId && card.rank === 'joker')) ?? matchingMelds[0]!;
    const jokerIndex = meld.cards.findIndex((card) => card.id === action.jokerId && card.rank === 'joker'); if (jokerIndex < 0) throw new RuleError('joker_not_found');
    const selectedCards = takeCards(action.cardIds); if (selectedCards.length < 3) throw new RuleError('joker_must_be_reused'); const recoveredJoker = meld.cards[jokerIndex]!;
    const candidate = selectedCards.flatMap((replacement) => {
      if (replacement.rank === 'joker') return []; const replaced = [...meld.cards]; replaced[jokerIndex] = replacement;
      if (!isValidRommeMeld(meld.kind, replaced) || (meld.kind === 'set' && replaced.length !== 4)) return [];
      const companions = selectedCards.filter((card) => card.id !== replacement.id); const newMeld = detectRommeMeld([recoveredJoker, ...companions]);
      return newMeld ? [{ replacement, companions, newMeld }] : [];
    })[0];
    if (!candidate) throw new RuleError('invalid_joker_exchange');
    if (next.rules.requireDiscardUse && next.drawnDiscardId && !action.cardIds.includes(next.drawnDiscardId)) throw new RuleError('discard_must_be_used');
    meld.cards[jokerIndex] = candidate.replacement; meld.cards = orderMeldCards(meld.kind, meld.cards); meld.points = rommeMeldPoints(meld.kind, meld.cards)!;
    const newCards = [recoveredJoker, ...candidate.companions]; next.melds.push({ id:`${next.id}:meld:${next.version}:${next.melds.length}`, ownerId:playerId, kind:candidate.newMeld.kind, cards:orderMeldCards(candidate.newMeld.kind,newCards), points:candidate.newMeld.points });
    player.hand = player.hand.filter((card) => !action.cardIds.includes(card.id)); delete next.drawnDiscardId;
    if (!player.hand.length) { next.phase = 'finished'; next.result = { winnerId: playerId, handPoints: Object.fromEntries(next.players.map((item) => [item.id, rommeHandPoints(item.hand)])) }; }
    ensureUniqueMeldIds(next); next.version += 1; return next;
  }
  if (next.rules.requireDiscardUse && next.drawnDiscardId) throw new RuleError('discard_must_be_used');
  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId); if (cardIndex < 0) throw new RuleError('card_not_in_hand');
  const [card] = player.hand.splice(cardIndex, 1); next.discard.push(card!); delete next.drawnDiscardId; next.hasDrawn = false;
  if (!player.hand.length) { next.phase = 'finished'; next.result = { winnerId: playerId, handPoints: Object.fromEntries(next.players.map((item) => [item.id, rommeHandPoints(item.hand)])) }; }
  else { const index = next.players.findIndex((item) => item.id === playerId); next.currentPlayerId = next.players[(index + 1) % next.players.length]!.id; }
  next.version += 1; return next;
}

export function rommePlayerView(state: RommeState, playerId: string) {
  return { ...state, players: state.players.map((player) => player.id === playerId ? player : { ...player, hand: [], handCount: player.hand.length }), deck: [], deckCount: state.deck.length, discard: state.discard.slice(-1), discardCount: state.discard.length };
}

export function withdrawRommePlayer(state: RommeState, playerId: string): RommeState {
  const next = structuredClone(state); const index = next.players.findIndex((player) => player.id === playerId); if (index < 0) throw new RuleError('not_active');
  const wasCurrent = next.currentPlayerId === playerId; next.players.splice(index,1); if (next.players.length < 2) { next.phase = 'finished'; next.result = { winnerId:next.players[0]?.id ?? '', handPoints:{} }; }
  else if (wasCurrent) { next.currentPlayerId = next.players[index % next.players.length]!.id; next.hasDrawn = false; delete next.drawnDiscardId; }
  next.version += 1; return next;
}
