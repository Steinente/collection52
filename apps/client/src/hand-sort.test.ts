import { describe, expect, it } from 'vitest';
import type { RommeCard } from '@collection52/shared';
import { defaultHandSortSettings, reconcileHandOrder, sortHand } from './hand-sort.js';

const card = (id: string, suit: RommeCard['suit'], rank: RommeCard['rank']): RommeCard => ({ id, suit, rank } as RommeCard);
const hand = [card('heart-king', 'hearts', 'king'), card('club-ace', 'clubs', 'ace'), card('club-2', 'clubs', '2'), card('joker', 'joker', 'joker'), card('diamond-2', 'diamonds', '2'), card('spade-7', 'spades', '7')];

describe('hand sorting', () => {
  it('alternates red and black suit groups and sorts ranks ascending by default', () => {
    expect(sortHand(hand, defaultHandSortSettings).map(({ id }) => id)).toEqual(['diamond-2', 'club-2', 'club-ace', 'heart-king', 'spade-7', 'joker']);
  });

  it('can sort by rank in descending order', () => {
    expect(sortHand(hand, { mode:'rank', direction:'desc' }).map(({ id }) => id)).toEqual(['joker', 'club-ace', 'heart-king', 'spade-7', 'club-2', 'diamond-2']);
  });

  it('keeps the visible order when sorting is disabled and only appends new cards', () => {
    const visibleOrder = ['club-2', 'club-ace', 'diamond-2', 'heart-king', 'joker'];
    const changedHand = [card('heart-king', 'hearts', 'king'), card('new-card', 'spades', '7'), card('club-2', 'clubs', '2'), card('diamond-2', 'diamonds', '2'), card('joker', 'joker', 'joker')];
    expect(reconcileHandOrder(visibleOrder, changedHand, { mode:'none', direction:'asc' })).toEqual(['club-2', 'diamond-2', 'heart-king', 'joker', 'new-card']);
  });
});
