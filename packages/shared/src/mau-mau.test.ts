import { describe, expect, it } from 'vitest';
import { applyMauMauAction, canPlayMauMauCard, createMauMauGame, type MauMauState } from './mau-mau.js';
import type { Card } from './cards.js';

const zero = () => 0;
const people = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Clara' }];
const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: `${suit}-${rank}`, suit, rank });
const state = (hand: Card[], top = card('hearts', '9')): MauMauState => ({
  id: 'game', players: [{ ...people[0]!, connected: true, hand }, { ...people[1]!, connected: true, hand: [card('clubs', 'ace')] }, { ...people[2]!, connected: true, hand: [card('diamonds', 'ace')] }],
  deck: [card('clubs', '7'), card('diamonds', '8'), card('spades', '9'), card('clubs', '10')], discard: [top], currentPlayerId: 'a', activeSuit: top.suit, rules: { stackSevens: false, forbidJackOnJack: false, forbidJackAsFinal: false, aceReverses: false }, direction: 1, pendingDraw: 0, phase: 'playing', version: 1
});

describe('Mau-Mau engine', () => {
  it('deals five cards and starts with a normal face-up card', () => {
    const game = createMauMauGame('game', people, zero);
    expect(game.players.every((player) => player.hand.length === 5)).toBe(true);
    expect(['7', '8', 'jack']).not.toContain(game.discard[0]?.rank);
  });
  it('allows matching suit, matching rank, and any jack', () => {
    const top = card('hearts', '9');
    expect(canPlayMauMauCard(card('hearts', 'ace'), top, 'hearts')).toBe(true);
    expect(canPlayMauMauCard(card('clubs', '9'), top, 'hearts')).toBe(true);
    expect(canPlayMauMauCard(card('clubs', 'jack'), top, 'hearts')).toBe(true);
    expect(canPlayMauMauCard(card('clubs', 'ace'), top, 'hearts')).toBe(false);
  });
  it('makes seven draw two and skip, while eight skips', () => {
    const seven = applyMauMauAction(state([card('hearts', '7'), card('clubs', 'queen'), card('spades', 'king')]), 'a', { type: 'mau-mau:play', cardId: 'hearts-7' }, zero);
    expect(seven.players[1]?.hand).toHaveLength(3); expect(seven.currentPlayerId).toBe('c');
    const eight = applyMauMauAction(state([card('hearts', '8'), card('clubs', 'queen'), card('spades', 'king')]), 'a', { type: 'mau-mau:play', cardId: 'hearts-8' }, zero);
    expect(eight.currentPlayerId).toBe('c');
  });
  it('requires a suit for a jack and applies that suit', () => {
    expect(() => applyMauMauAction(state([card('clubs', 'jack'), card('clubs', 'queen'), card('spades', 'king')]), 'a', { type: 'mau-mau:play', cardId: 'clubs-jack' }, zero)).toThrow('suit_required');
    const next = applyMauMauAction(state([card('clubs', 'jack'), card('clubs', 'queen'), card('spades', 'king')]), 'a', { type: 'mau-mau:play', cardId: 'clubs-jack', chosenSuit: 'spades' }, zero);
    expect(next.activeSuit).toBe('spades');
  });
  it('lets a playable drawn card be played but no other card', () => {
    const game = state([card('clubs', 'queen'), card('spades', 'king')]);
    game.deck = [card('hearts', 'ace')];
    const drawn = applyMauMauAction(game, 'a', { type: 'mau-mau:draw' }, zero);
    expect(drawn.currentPlayerId).toBe('a'); expect(drawn.drawnCardId).toBe('hearts-ace');
    expect(() => applyMauMauAction(drawn, 'a', { type: 'mau-mau:play', cardId: 'clubs-queen' }, zero)).toThrow('only_drawn_card');
  });
  it('wins immediately after legally playing the final card', () => {
    const won = applyMauMauAction(state([card('hearts', 'ace')]), 'a', { type: 'mau-mau:play', cardId: 'hearts-ace' }, zero);
    expect(won.phase).toBe('finished'); expect(won.result?.winnerId).toBe('a');
  });
  it('supports stacking sevens and drawing the accumulated penalty', () => {
    const game = state([card('hearts', '7'), card('clubs', 'queen'), card('spades', 'king')]); game.rules.stackSevens = true;
    let next = applyMauMauAction(game, 'a', { type: 'mau-mau:play', cardId: 'hearts-7' }, zero);
    expect(next.pendingDraw).toBe(2); expect(next.currentPlayerId).toBe('b');
    next.players[1]!.hand.push(card('spades', '7'));
    next = applyMauMauAction(next, 'b', { type: 'mau-mau:play', cardId: 'spades-7' }, zero);
    expect(next.pendingDraw).toBe(4); expect(next.currentPlayerId).toBe('c');
    next = applyMauMauAction(next, 'c', { type: 'mau-mau:draw' }, zero);
    expect(next.pendingDraw).toBe(0); expect(next.currentPlayerId).toBe('a');
  });
  it('supports the optional jack and ace house rules', () => {
    const jackGame = state([card('clubs', 'jack'), card('clubs', 'queen')], card('hearts', 'jack')); jackGame.rules.forbidJackOnJack = true;
    expect(() => applyMauMauAction(jackGame, 'a', { type: 'mau-mau:play', cardId: 'clubs-jack', chosenSuit: 'clubs' }, zero)).toThrow('jack_on_jack_forbidden');
    const aceGame = state([card('hearts', 'ace'), card('clubs', 'queen'), card('spades', 'king')]); aceGame.rules.aceReverses = true;
    const reversed = applyMauMauAction(aceGame, 'a', { type: 'mau-mau:play', cardId: 'hearts-ace' }, zero);
    expect(reversed.direction).toBe(-1); expect(reversed.currentPlayerId).toBe('c');
  });
});
