import { z } from 'zod';

export const usernameSchema = z.string().min(1).max(16).regex(/^[\p{L}\p{N}_-]+$/u, 'invalid_characters').refine((name) => (name.match(/\p{L}/gu)?.length ?? 0) >= 3, 'not_enough_letters');
export const lobbyCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/);
export const gameIdSchema = z.enum(['durak', 'schwimmen', 'mau-mau', 'romme']);
export const mauMauRulesSchema = z.object({ stackSevens: z.boolean(), forbidJackOnJack: z.boolean(), forbidJackAsFinal: z.boolean(), aceReverses: z.boolean() });
export const rommeRulesSchema = z.object({ variant: z.enum(['classic', 'gin']).default('classic'), openingPoints: z.union([z.literal(30), z.literal(40)]), requireDiscardUse: z.boolean(), ginTargetScore: z.number().int().min(10).max(500).default(100) });
export const lobbySettingsSchema = z.object({
  gameId: gameIdSchema.default('durak'), maxPlayers: z.number().int().min(2).max(6), deckSize: z.union([z.literal(32), z.literal(36), z.literal(52)]),
  visibility: z.enum(['public', 'private']), password: z.string().max(72).optional(), mauMauRules: mauMauRulesSchema.optional(), rommeRules: rommeRulesSchema.optional()
}).superRefine((settings, context) => {
  if ((settings.gameId === 'schwimmen' || settings.gameId === 'mau-mau') && settings.deckSize !== 32) context.addIssue({ code: 'custom', path: ['deckSize'], message: 'invalid_32_card_deck' });
  if (settings.gameId === 'romme' && settings.deckSize !== 52) context.addIssue({ code: 'custom', path: ['deckSize'], message: 'invalid_romme_deck' });
  if (settings.gameId === 'durak' && settings.deckSize === 32) context.addIssue({ code: 'custom', path: ['deckSize'], message: 'invalid_durak_deck' });
});
export const lobbyUpdateSchema = z.object({
  maxPlayers: z.number().int().min(2).max(6).optional(), deckSize: z.union([z.literal(36), z.literal(52)]).optional(),
  visibility: z.enum(['public', 'private']).optional(), password: z.string().max(72).optional(), mauMauRules: mauMauRulesSchema.optional(), rommeRules: rommeRulesSchema.optional()
});
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attack'), cardIds: z.array(z.string().min(1)).min(1).max(6) }),
  z.object({ type: z.literal('defend'), cardId: z.string().min(1), attackCardId: z.string().min(1) }),
  z.object({ type: z.literal('take') }), z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('schwimmen:swap-one'), handCardId: z.string().min(1), centerCardId: z.string().min(1) }),
  z.object({ type: z.literal('schwimmen:swap-all') }), z.object({ type: z.literal('schwimmen:pass') }),
  z.object({ type: z.literal('schwimmen:knock') }), z.object({ type: z.literal('schwimmen:next-round') }),
  z.object({ type: z.literal('mau-mau:play'), cardId: z.string().min(1), chosenSuit: z.enum(['clubs', 'diamonds', 'hearts', 'spades']).optional() }),
  z.object({ type: z.literal('mau-mau:draw') }), z.object({ type: z.literal('mau-mau:pass') }),
  z.object({ type: z.literal('romme:draw'), source: z.enum(['stock', 'discard']) }),
  z.object({ type: z.literal('romme:meld'), groups: z.array(z.object({ cardIds: z.array(z.string().min(1)).min(3).max(13) })).min(1).max(5) }),
  z.object({ type: z.literal('romme:lay-off'), meldId: z.string().min(1), cardIds: z.array(z.string().min(1)).min(1).max(10) }),
  z.object({ type: z.literal('romme:replace-joker'), meldId: z.string().min(1), jokerId: z.string().min(1), cardIds: z.array(z.string().min(1)).min(3).max(13) }),
  z.object({ type: z.literal('romme:discard'), cardId: z.string().min(1) }),
  z.object({ type: z.literal('romme:knock'), cardId: z.string().min(1) }),
  z.object({ type: z.literal('romme:pass-opening') }),
  z.object({ type: z.literal('romme:next-round') })
]);

export type GameId = z.infer<typeof gameIdSchema>;
export type GameAction = z.infer<typeof actionSchema>;
export type LobbySummary = { code: string; gameId: GameId; status: 'waiting' | 'playing'; playerCount: number; maxPlayers: number; visibility: 'public' | 'private'; passwordProtected: boolean; joinable: boolean; hostName: string };
export type PublicPlayer = { id: string; name: string; connected: boolean; isHost: boolean };
export type PublicLobby = LobbySummary & { players: PublicPlayer[]; deckSize: 32 | 36 | 52; hostId: string; inactivityDeadline: number; mauMauRules?: z.infer<typeof mauMauRulesSchema>; rommeRules?: z.infer<typeof rommeRulesSchema>; game?: unknown; events: StructuredEvent[] };

export type StructuredEvent = { id: string; sequence: number; timestamp: number; type: string; actorId?: string; recipientId?: string; data: Record<string, string | number | boolean | string[]>; visibility: 'public' | 'private' };

export interface ClientToServerEvents {
  'lobby:list': (ack: (data: LobbySummary[]) => void) => void;
  'lobby:inspect': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:create': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:join': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:resume': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:detach': (ack: (result: unknown) => void) => void;
  'lobby:leave': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:update': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:close': (ack: (result: unknown) => void) => void;
  'lobby:keepalive': (ack: (result: unknown) => void) => void;
  'game:start': (ack: (result: unknown) => void) => void;
  'game:restart': (ack: (result: unknown) => void) => void;
  'game:action': (data: unknown, ack: (result: unknown) => void) => void;
}
export interface ServerToClientEvents {
  'lobby:list': (data: LobbySummary[]) => void;
  'lobby:state': (data: PublicLobby) => void;
  'lobby:closed': (data: { reason: string }) => void;
  'lobby:warning': (data: { closesAt: number }) => void;
  'game:event': (data: StructuredEvent) => void;
  'error:message': (data: { code: string }) => void;
}
