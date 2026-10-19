import { describe, expect, it } from 'vitest';
import { applyRommeAction, createRommeDeck, createRommeGame, detectRommeMeld, isPotentialRommeMeld, isValidRommeMeld, rommeMeldPoints, type RommeCard, type RommeState } from './romme.js';

const zero = () => 0;
const people = [{ id:'a',name:'Anna' },{ id:'b',name:'Ben' }];
const card = (suit:'clubs'|'diamonds'|'hearts'|'spades', rank:Exclude<RommeCard['rank'],'joker'>, copy=1):RommeCard => ({ id:`${suit}-${rank}-${copy}`,suit,rank });
const joker = (index=1):RommeCard => ({ id:`joker-${index}`,suit:'joker',rank:'joker' });
const state = (hand:RommeCard[]):RommeState => ({ id:'game',players:[{...people[0]!,connected:true,hand,opened:false},{...people[1]!,connected:true,hand:[card('clubs','2')],opened:false}],deck:[card('spades','2')],discard:[card('hearts','3')],melds:[],currentPlayerId:'a',hasDrawn:true,rules:{openingPoints:40,requireDiscardUse:false},phase:'playing',version:1 });

describe('Rommé engine', () => {
  it('uses 110 unique cards and deals thirteen cards', () => {
    expect(createRommeDeck()).toHaveLength(110); expect(new Set(createRommeDeck().map((item) => item.id)).size).toBe(110);
    const game = createRommeGame('game',people,zero); expect(game.players.every((player) => player.hand.length === 13)).toBe(true); expect(game.deck).toHaveLength(83);
  });
  it('validates sets and low/high ace runs without wrapping', () => {
    expect(isValidRommeMeld('set',[card('clubs','king'),card('hearts','king'),joker()])).toBe(true);
    expect(rommeMeldPoints('run',[card('hearts','ace'),card('hearts','2'),card('hearts','3')])).toBe(6);
    expect(rommeMeldPoints('run',[card('hearts','queen'),card('hearts','king'),card('hearts','ace')])).toBe(31);
    expect(isValidRommeMeld('run',[card('hearts','king'),card('hearts','ace'),card('hearts','2')])).toBe(false);
    expect(isValidRommeMeld('set',[card('clubs','king'),joker(),joker(2)])).toBe(false);
  });
  it('recognizes the meld type and rejects selections that cannot become a meld', () => {
    expect(detectRommeMeld([card('clubs','5'),card('diamonds','5'),card('hearts','5')])?.kind).toBe('set');
    expect(detectRommeMeld([card('spades','5'),card('spades','6'),card('spades','7')])?.kind).toBe('run');
    expect(isPotentialRommeMeld([card('clubs','5'),card('clubs','5',2)])).toBe(false);
    expect(isPotentialRommeMeld([card('clubs','5'),card('diamonds','5')])).toBe(true);
    expect(isPotentialRommeMeld([card('clubs','5'),card('clubs','6')])).toBe(true);
    expect(isPotentialRommeMeld([card('clubs','5'),card('diamonds','6')])).toBe(false);
  });
  it('allows several groups to jointly reach the 40-point opening', () => {
    const hand = [card('clubs','king'),card('hearts','king'),card('spades','king'),card('hearts','7'),card('hearts','8'),card('hearts','9'),card('clubs','2')];
    const next = applyRommeAction(state(hand),'a',{type:'romme:meld',groups:[{cardIds:hand.slice(0,3).map((item) => item.id)},{cardIds:hand.slice(3,6).map((item) => item.id)}]},zero);
    expect(next.players[0]?.opened).toBe(true); expect(next.melds.map((meld) => meld.kind)).toEqual(['set','run']); expect(new Set(next.melds.map((meld) => meld.id)).size).toBe(2); expect(next.players[0]?.hand).toHaveLength(1);
  });
  it('places cards laid off on a run in their actual sequence', () => {
    const game = state([card('spades','10'),card('spades','6')]); game.players[0]!.opened = true;
    game.melds = [{ id:'run',ownerId:'b',kind:'run',cards:[card('spades','7'),card('spades','8'),card('spades','9')],points:24 }];
    const next = applyRommeAction(game,'a',{type:'romme:lay-off',meldId:'run',cardIds:['spades-10-1','spades-6-1']},zero);
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual(['6','7','8','9','10']);
  });
  it('allows a seven before an eight-nine-joker run', () => {
    const game = state([card('diamonds','7'),card('clubs','6')]); game.players[0]!.opened = true;
    game.melds = [{ id:'diamond-run',ownerId:'b',kind:'run',cards:[card('diamonds','8'),card('diamonds','9'),joker()],points:27 }];
    const next = applyRommeAction(game,'a',{type:'romme:lay-off',meldId:'diamond-run',cardIds:['diamonds-7-1']},zero);
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual(['7','8','9','joker']);
  });
  it('lays off onto the compatible meld when a legacy game contains duplicate meld ids', () => {
    const game = state([card('diamonds','7'),card('clubs','6')]); game.players[0]!.opened = true;
    game.melds = [
      { id:'legacy-duplicate',ownerId:'b',kind:'run',cards:[card('spades','9'),card('spades','10'),card('spades','jack')],points:29 },
      { id:'legacy-duplicate',ownerId:'b',kind:'run',cards:[card('diamonds','8'),card('diamonds','9'),joker()],points:27 }
    ];
    const next = applyRommeAction(game,'a',{type:'romme:lay-off',meldId:'legacy-duplicate',cardIds:['diamonds-7-1']},zero);
    expect(next.melds[1]?.cards.map((item) => item.rank)).toEqual(['7','8','9','joker']);
    expect(new Set(next.melds.map((meld) => meld.id)).size).toBe(2);
  });
  it('places a joker at the represented position in an ordered run', () => {
    const hand = [joker(),card('spades','9'),card('spades','7'),card('spades','8'),card('clubs','2')]; const game = state(hand); game.rules.openingPoints = 30;
    const next = applyRommeAction(game,'a',{type:'romme:meld',groups:[{cardIds:hand.slice(0,4).map((item) => item.id)}]},zero);
    expect(next.melds[0]?.cards.map((item) => item.rank)).toEqual(['7','8','9','joker']);
  });
  it('infers the new meld type when exchanging a joker', () => {
    const game = state([card('diamonds','5'),card('clubs','7'),card('clubs','8')]); game.players[0]!.opened = true;
    game.melds = [{ id:'set',ownerId:'b',kind:'set',cards:[card('clubs','5'),card('hearts','5'),card('spades','5'),joker()],points:20 }];
    const next = applyRommeAction(game,'a',{type:'romme:replace-joker',meldId:'set',jokerId:'joker-1',cardIds:game.players[0]!.hand.map((item) => item.id)},zero);
    expect(next.melds[0]?.cards.some((item) => item.rank === 'joker')).toBe(false); expect(next.melds[1]?.kind).toBe('run');
    expect(next.melds[1]?.cards.map((item) => item.rank)).toEqual(['7','8','joker']);
  });
  it('rejects an opening below the configured minimum', () => {
    const hand = [card('clubs','2'),card('hearts','2'),card('spades','2'),card('clubs','ace')];
    expect(() => applyRommeAction(state(hand),'a',{type:'romme:meld',groups:[{cardIds:hand.slice(0,3).map((item) => item.id)}]},zero)).toThrow('opening_points_required');
  });
  it('requires draw first and optionally requires use of a picked-up discard', () => {
    const game = state([card('clubs','3'),card('diamonds','3'),card('spades','3'),card('clubs','ace')]); game.hasDrawn=false; game.rules.requireDiscardUse=true;
    expect(() => applyRommeAction(game,'a',{type:'romme:discard',cardId:'clubs-ace-1'},zero)).toThrow('must_draw_first');
    const drawn = applyRommeAction(game,'a',{type:'romme:draw',source:'discard'},zero);
    expect(() => applyRommeAction(drawn,'a',{type:'romme:discard',cardId:'clubs-ace-1'},zero)).toThrow('discard_must_be_used');
  });
});
