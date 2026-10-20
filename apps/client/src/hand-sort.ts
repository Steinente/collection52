import type { RommeCard } from '@collection52/shared';

export type HandSortMode = 'suit' | 'rank' | 'none';
export type HandSortDirection = 'asc' | 'desc';
export type HandSortSettings = { mode: HandSortMode; direction: HandSortDirection };

export const defaultHandSortSettings: HandSortSettings = { mode: 'suit', direction: 'asc' };

// Alternate red and black suits so neighboring groups stay visually distinct.
const suits = ['diamonds', 'clubs', 'hearts', 'spades', 'joker'] as const;
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace', 'joker'] as const;

const compareCard = (left: RommeCard, right: RommeCard, mode: Exclude<HandSortMode, 'none'>) => {
  const suitDifference = suits.indexOf(left.suit) - suits.indexOf(right.suit);
  const rankDifference = ranks.indexOf(left.rank) - ranks.indexOf(right.rank);
  return mode === 'suit' ? suitDifference || rankDifference : rankDifference || suitDifference;
};

export function sortHand<T extends RommeCard>(cards: readonly T[], settings: HandSortSettings): T[] {
  if (settings.mode === 'none') return [...cards];
  const factor = settings.direction === 'asc' ? 1 : -1;
  return cards.map((card, index) => ({ card, index })).sort((left, right) => factor * compareCard(left.card, right.card, settings.mode as Exclude<HandSortMode, 'none'>) || left.index - right.index).map(({ card }) => card);
}

export function reconcileHandOrder<T extends RommeCard>(previousOrder: readonly string[], cards: readonly T[], settings: HandSortSettings): string[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const retained = previousOrder.filter((id) => byId.has(id));
  const retainedSet = new Set(retained);
  const currentOrder = [...retained, ...cards.filter((card) => !retainedSet.has(card.id)).map((card) => card.id)];
  if (settings.mode === 'none') return currentOrder;
  return sortHand(currentOrder.map((id) => byId.get(id)!), settings).map((card) => card.id);
}

export function moveHandCard(order: readonly string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return [...order];
  const next = [...order]; const sourceIndex = next.indexOf(sourceId); const targetIndex = next.indexOf(targetId); if (sourceIndex < 0 || targetIndex < 0) return next;
  const [moved] = next.splice(sourceIndex, 1); const adjacentIndex = next.indexOf(targetId); next.splice(sourceIndex < targetIndex ? adjacentIndex + 1 : adjacentIndex, 0, moved!); return next;
}
