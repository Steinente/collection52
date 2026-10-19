import { describe, expect, it } from 'vitest';
import { applyKnackAction, createDeck, createKnackGame, scoreKnackHand, withdrawKnackPlayer, type Card } from './index.js';

const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: `${suit}-${rank}`, suit, rank });
const people = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Chris' }];
const fixedRandom = () => 0;

describe('knack engine', () => {
  it('uses a 32-card deck and deals three cards plus a center', () => {
    expect(createDeck(32)).toHaveLength(32);
    const game = createKnackGame('g', people, fixedRandom);
    expect(game.players.every((player) => player.hand.length === 3)).toBe(true);
    expect(game.center).toHaveLength(3); expect(game.deck).toHaveLength(20);
  });
  it('scores suit totals, triples, 31, and fire', () => {
    expect(scoreKnackHand([card('hearts', 'ace'), card('hearts', 'king'), card('clubs', '9')])).toBe(21);
    expect(scoreKnackHand([card('clubs', '7'), card('hearts', '7'), card('spades', '7')])).toBe(30.5);
    expect(scoreKnackHand([card('hearts', 'ace'), card('hearts', 'king'), card('hearts', 'queen')])).toBe(31);
    expect(scoreKnackHand([card('clubs', 'ace'), card('hearts', 'ace'), card('spades', 'ace')])).toBe(32);
  });
  it('swaps one selected hand and center card without mutating the source', () => {
    const game = createKnackGame('g', people, fixedRandom); const player = game.players.find((candidate) => candidate.id === game.currentPlayerId)!;
    const handCard = player.hand[0]!; const centerCard = game.center[0]!;
    const next = applyKnackAction(game, player.id, { type: 'schwimmen:swap-one', handCardId: handCard.id, centerCardId: centerCard.id }, fixedRandom);
    expect(player.hand[0]).toEqual(handCard); expect(next.players.find((candidate) => candidate.id === player.id)?.hand).toContainEqual(centerCard); expect(next.center).toContainEqual(handCard);
  });
  it('allows a complete three-card exchange and advances the turn', () => {
    const game = createKnackGame('g', people, fixedRandom); const playerId = game.currentPlayerId; const oldCenter = [...game.center];
    const next = applyKnackAction(game, playerId, { type: 'schwimmen:swap-all' }, fixedRandom);
    expect(next.players.find((player) => player.id === playerId)?.hand).toEqual(oldCenter); expect(next.currentPlayerId).not.toBe(playerId);
  });
  it('gives every opponent one final turn after knocking', () => {
    let game = createKnackGame('g', people, fixedRandom); const knocker = game.currentPlayerId;
    game = applyKnackAction(game, knocker, { type: 'schwimmen:knock' }, fixedRandom);
    expect(game.finalTurnsLeft).toBe(2);
    game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:pass' }, fixedRandom);
    game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:pass' }, fixedRandom);
    expect(game.phase).toBe('round-ended'); expect(game.roundResult?.reason).toBe('knock');
  });
  it('refreshes the center after everybody passes', () => {
    let game = createKnackGame('g', people, fixedRandom); const oldCenter = game.center.map((entry) => entry.id);
    for (let index = 0; index < people.length; index += 1) game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:pass' }, fixedRandom);
    expect(game.center.map((entry) => entry.id)).not.toEqual(oldCenter); expect(game.discard).toHaveLength(3);
  });
  it('does not eliminate everybody when all active hands tie', () => {
    let game = createKnackGame('g', people.slice(0, 2), fixedRandom);
    for (const player of game.players) { player.lives = 0; player.swimming = true; player.hand = [card('clubs', '7'), card('diamonds', '8'), card('hearts', '9')]; }
    game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:knock' }, fixedRandom);
    game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:pass' }, fixedRandom);
    expect(game.players.every((player) => !player.eliminated)).toBe(true); expect(game.roundResult?.loserIds).toEqual([]);
  });
  it('ends the round immediately when an exchange makes 31', () => {
    const game = createKnackGame('g', people.slice(0, 2), fixedRandom); const player = game.players.find((candidate) => candidate.id === game.currentPlayerId)!;
    player.hand = [card('hearts', 'ace'), card('hearts', 'king'), card('clubs', '7')]; game.center = [card('hearts', 'queen'), card('diamonds', '8'), card('spades', '9')];
    const next = applyKnackAction(game, player.id, { type: 'schwimmen:swap-one', handCardId: 'clubs-7', centerCardId: 'hearts-queen' }, fixedRandom);
    expect(next.phase).toBe('round-ended'); expect(next.roundResult?.reason).toBe('thirty-one');
  });
  it('moves from three lives through swimming to elimination and a winner', () => {
    let game = createKnackGame('g', people.slice(0, 2), fixedRandom); const loserId = 'b';
    for (let loss = 0; loss < 4; loss += 1) {
      game.players.find((player) => player.id === 'a')!.hand = [card('hearts', 'ace'), card('hearts', 'king'), card('hearts', '9')];
      game.players.find((player) => player.id === loserId)!.hand = [card('clubs', '7'), card('diamonds', '8'), card('spades', '9')];
      game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:knock' }, fixedRandom);
      game = applyKnackAction(game, game.currentPlayerId, { type: 'schwimmen:pass' }, fixedRandom);
      if (loss < 3) game = applyKnackAction(game, 'a', { type: 'schwimmen:next-round' }, fixedRandom);
    }
    const loser = game.players.find((player) => player.id === loserId)!;
    expect(loser.eliminated).toBe(true); expect(game.phase).toBe('finished'); expect(game.result?.winnerId).toBe('a');
  });
  it('treats a withdrawing player as eliminated and advances their turn', () => {
    const game = createKnackGame('g', people, fixedRandom); const leavingId = game.currentPlayerId; const next = withdrawKnackPlayer(game, leavingId); expect(next.players.map((player) => player.id)).not.toContain(leavingId); expect(next.players).toHaveLength(2); expect(next.currentPlayerId).not.toBe(leavingId); expect(next.phase).toBe('playing');
  });
});
