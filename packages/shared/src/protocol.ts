import { z } from 'zod';

export const usernameSchema = z.string().min(1).max(16).regex(/^[\p{L}\p{N}_-]+$/u, 'invalid_characters').refine((name) => (name.match(/\p{L}/gu)?.length ?? 0) >= 3, 'not_enough_letters');
export const lobbyCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/);
export const gameIdSchema = z.enum(['durak', 'schwimmen']);
export const lobbySettingsSchema = z.object({
  gameId: gameIdSchema.default('durak'), maxPlayers: z.number().int().min(2).max(6), deckSize: z.union([z.literal(32), z.literal(36), z.literal(52)]),
  visibility: z.enum(['public', 'private']), password: z.string().max(72).optional()
}).superRefine((settings, context) => {
  if (settings.gameId === 'schwimmen' && settings.deckSize !== 32) context.addIssue({ code: 'custom', path: ['deckSize'], message: 'invalid_schwimmen_deck' });
  if (settings.gameId === 'durak' && settings.deckSize === 32) context.addIssue({ code: 'custom', path: ['deckSize'], message: 'invalid_durak_deck' });
});
export const lobbyUpdateSchema = z.object({
  maxPlayers: z.number().int().min(2).max(6).optional(), deckSize: z.union([z.literal(36), z.literal(52)]).optional(),
  visibility: z.enum(['public', 'private']).optional(), password: z.string().max(72).optional()
});
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attack'), cardIds: z.array(z.string().min(1)).min(1).max(6) }),
  z.object({ type: z.literal('defend'), cardId: z.string().min(1), attackCardId: z.string().min(1) }),
  z.object({ type: z.literal('take') }), z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('schwimmen:swap-one'), handCardId: z.string().min(1), centerCardId: z.string().min(1) }),
  z.object({ type: z.literal('schwimmen:swap-all') }), z.object({ type: z.literal('schwimmen:pass') }),
  z.object({ type: z.literal('schwimmen:knock') }), z.object({ type: z.literal('schwimmen:next-round') })
]);

export type GameId = z.infer<typeof gameIdSchema>;
export type GameAction = z.infer<typeof actionSchema>;
export type LobbySummary = { code: string; gameId: GameId; status: 'waiting' | 'playing'; playerCount: number; maxPlayers: number; visibility: 'public' | 'private'; passwordProtected: boolean; joinable: boolean; hostName: string };
export type PublicPlayer = { id: string; name: string; connected: boolean; isHost: boolean };
export type PublicLobby = LobbySummary & { players: PublicPlayer[]; deckSize: 32 | 36 | 52; hostId: string; inactivityDeadline: number; game?: unknown; events: StructuredEvent[] };

export type StructuredEvent = { id: string; sequence: number; timestamp: number; type: string; actorId?: string; data: Record<string, string | number | boolean | string[]>; visibility: 'public' | 'private' };

export interface ClientToServerEvents {
  'lobby:list': (ack: (data: LobbySummary[]) => void) => void;
  'lobby:inspect': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:create': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:join': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:resume': (data: unknown, ack: (result: unknown) => void) => void;
  'lobby:leave': (ack: (result: unknown) => void) => void;
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
