import { describe, expect, it } from 'vitest';
import { applyDurakAction, beats, createDeck, createDurakGame, RuleError, withdrawDurakPlayer } from './index.js';

const players = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }];
const fixedRandom = () => 0;

describe('cards', () => {
  it('creates the requested deck variants', () => { expect(createDeck(36)).toHaveLength(36); expect(createDeck(52)).toHaveLength(52); expect(createDeck(36).some((c) => c.rank === '2')).toBe(false); });
  it('applies trump and same-suit rank rules', () => {
    expect(beats({ id:'h9', suit:'hearts', rank:'9' }, { id:'h8', suit:'hearts', rank:'8' }, 'spades')).toBe(true);
    expect(beats({ id:'s2', suit:'spades', rank:'2' }, { id:'ha', suit:'hearts', rank:'ace' }, 'spades')).toBe(true);
    expect(beats({ id:'c2', suit:'clubs', rank:'2' }, { id:'ha', suit:'hearts', rank:'ace' }, 'spades')).toBe(false);
  });
});

describe('durak engine', () => {
  it('deals six cards and retains the bottom trump in the draw pile', () => { const game = createDurakGame('g', players, 36, fixedRandom); expect(game.players.every((p) => p.hand.length === 6)).toBe(true); expect(game.deck).toHaveLength(24); expect(game.trumpCard).toEqual(game.deck.at(-1)); });
  it('uses all cards when six players use the 36-card deck', () => { const six = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: String(i) })); const game = createDurakGame('g', six, 36, fixedRandom); expect(game.deck).toHaveLength(0); expect(game.trumpCard).toBeUndefined(); });
  it('rejects an attack from the wrong player', () => { const game = createDurakGame('g', players, 36, fixedRandom); const defender = game.players.find((p) => p.id === game.defenderId)!; expect(() => applyDurakAction(game, defender.id, { type: 'attack', cardIds: [defender.hand[0]!.id] })).toThrowError(RuleError); });
  it('does not mutate state when applying an action', () => { const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!; const next = applyDurakAction(game, attacker.id, { type: 'attack', cardIds: [attacker.hand[0]!.id] }); expect(game.table).toHaveLength(0); expect(next.table).toHaveLength(1); expect(next.version).toBe(game.version + 1); });
  it('allows an opening attack with multiple cards of the same rank', () => {
    const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!;
    attacker.hand = [{ id: 'hearts-6', suit: 'hearts', rank: '6' }, { id: 'clubs-6', suit: 'clubs', rank: '6' }, { id: 'spades-7', suit: 'spades', rank: '7' }]; game.roundAttackLimit = 3;
    const next = applyDurakAction(game, attacker.id, { type: 'attack', cardIds: ['hearts-6', 'clubs-6'] });
    expect(next.table.map((pair) => pair.attack.id)).toEqual(['hearts-6', 'clubs-6']); expect(next.phase).toBe('defense'); expect(next.players.find((player) => player.id === attacker.id)?.hand.map((card) => card.id)).toEqual(['spades-7']);
  });
  it('rejects opening cards with different ranks', () => {
    const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!;
    attacker.hand = [{ id: 'hearts-6', suit: 'hearts', rank: '6' }, { id: 'clubs-7', suit: 'clubs', rank: '7' }];
    expect(() => applyDurakAction(game, attacker.id, { type: 'attack', cardIds: ['hearts-6', 'clubs-7'] })).toThrow('opening_rank_mismatch');
  });
  it('rejects duplicate cards and opening attacks above the round limit', () => {
    const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!; const cardId = attacker.hand[0]!.id;
    expect(() => applyDurakAction(game, attacker.id, { type: 'attack', cardIds: [cardId, cardId] })).toThrow('duplicate_attack_card');
    game.roundAttackLimit = 0; expect(() => applyDurakAction(game, attacker.id, { type: 'attack', cardIds: [cardId] })).toThrow('attack_limit');
  });
  it('finishes with a draw when the last defense empties every hand', () => {
    const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!; const defender = game.players.find((p) => p.id === game.defenderId)!;
    game.deck = []; attacker.hand = []; defender.hand = [{ id: 'hearts-7', suit: 'hearts', rank: '7' }]; game.trumpSuit = 'spades'; game.table = [{ attack: { id: 'hearts-6', suit: 'hearts', rank: '6' } }]; game.phase = 'defense';
    const next = applyDurakAction(game, defender.id, { type: 'defend', cardId: 'hearts-7', attackCardId: 'hearts-6' }); expect(next.phase).toBe('finished'); expect(next.result?.draw).toBe(true);
  });
  it('gives the table to a defender who takes and skips them for the next attack', () => {
    const game = createDurakGame('g', players, 52, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!; const defender = game.players.find((p) => p.id === game.defenderId)!;
    game.deck = []; attacker.hand = []; defender.hand = [{ id: 'clubs-2', suit: 'clubs', rank: '2' }]; game.table = [{ attack: { id: 'hearts-6', suit: 'hearts', rank: '6' } }]; game.phase = 'defense'; game.roundAttackLimit = 1;
    const next = applyDurakAction(game, defender.id, { type: 'take' }); expect(next.phase).toBe('finished'); expect(next.result?.durakId).toBe(defender.id); expect(next.players.find((p) => p.id === defender.id)?.hand.map((c) => c.id)).toContain('hearts-6');
  });
  it('ends the round immediately when the defender takes', () => {
    const game = createDurakGame('g', players, 36, fixedRandom); const attacker = game.players.find((p) => p.id === game.attackerId)!; const defender = game.players.find((p) => p.id === game.defenderId)!;
    const attack = attacker.hand[0]!; attacker.hand = attacker.hand.slice(1); game.table = [{ attack }]; game.phase = 'defense';
    const next = applyDurakAction(game, defender.id, { type: 'take' });
    expect(next.table).toHaveLength(0); expect(next.phase).toBe('attack'); expect(next.players.find((p) => p.id === defender.id)?.hand.some((card) => card.id === attack.id)).toBe(true);
  });
  it('removes a withdrawing player and starts a valid new bout for the remaining players', () => {
    const game = createDurakGame('g', [...players, { id: 'c', name: 'Clara' }], 36, fixedRandom); const leaving = game.players.find((player) => player.id !== game.defenderId && player.id !== game.attackerId) ?? game.players.find((player) => player.id === game.attackerId)!;
    const next = withdrawDurakPlayer(game, leaving.id); expect(next.players.map((player) => player.id)).not.toContain(leaving.id); expect(next.players).toHaveLength(2); expect(next.phase).toBe('attack'); expect(next.attackerId).not.toBe(leaving.id); expect(next.defenderId).not.toBe(leaving.id);
  });
});
