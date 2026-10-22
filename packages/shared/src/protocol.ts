import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(1)
  .max(16)
  .regex(/^[\p{L}\p{N}_-]+$/u, "invalid_characters")
  .refine(
    (name) => (name.match(/\p{L}/gu)?.length ?? 0) >= 3,
    "not_enough_letters",
  );
export const lobbyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{8}$/);
export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .transform((color) => color.toLowerCase());
export const gameIdSchema = z.enum([
  "durak",
  "schwimmen",
  "mau-mau",
  "romme",
  "spades",
  "oh-hell",
  "cheat",
]);
export const mauMauRulesSchema = z.object({
  stackSevens: z.boolean(),
  forbidJackOnJack: z.boolean(),
  forbidJackAsFinal: z.boolean(),
  aceReverses: z.boolean(),
});
export const rommeRulesSchema = z.object({
  variant: z.enum(["classic", "gin", "canasta"]).default("classic"),
  openingPoints: z.union([z.literal(30), z.literal(40)]),
  requireDiscardUse: z.boolean(),
  ginTargetScore: z.number().int().min(10).max(500).default(100),
  canastaTargetScore: z.number().int().min(1000).max(20000).default(5000),
  canastaRequireCanastaToGoOut: z.boolean().default(true),
});
export const spadesRulesSchema = z.object({
  targetScore: z.number().int().min(100).max(1000).default(500),
  nilBonus: z.number().int().min(50).max(200).default(100),
  bagPenalty: z.boolean().default(true),
});
export const ohHellRulesSchema = z.object({
  exactBonus: z.number().int().min(0).max(50).default(10),
  scoreMissedTricks: z.boolean().default(true),
  forbidExactBidTotal: z.boolean().default(true),
});
export const cheatRulesSchema = z.object({
  deckCount: z.union([z.literal(1), z.literal(2)]).default(1),
  direction: z.enum(["ascending", "descending"]).default("ascending"),
  maxCardsPerTurn: z.number().int().min(1).max(8).default(4),
});
export const lobbySettingsSchema = z
  .object({
    gameId: gameIdSchema.default("durak"),
    maxPlayers: z.number().int().min(2).max(10),
    deckSize: z.union([z.literal(32), z.literal(36), z.literal(52)]),
    visibility: z.enum(["public", "private"]),
    password: z.string().max(72).optional(),
    mauMauRules: mauMauRulesSchema.optional(),
    rommeRules: rommeRulesSchema.optional(),
    spadesRules: spadesRulesSchema.optional(),
    ohHellRules: ohHellRulesSchema.optional(),
    cheatRules: cheatRulesSchema.optional(),
  })
  .superRefine((settings, context) => {
    if (
      (settings.gameId === "schwimmen" || settings.gameId === "mau-mau") &&
      settings.deckSize !== 32
    )
      context.addIssue({
        code: "custom",
        path: ["deckSize"],
        message: "invalid_32_card_deck",
      });
    if (settings.gameId === "romme" && settings.deckSize !== 52)
      context.addIssue({
        code: "custom",
        path: ["deckSize"],
        message: "invalid_romme_deck",
      });
    if (settings.gameId === "durak" && settings.deckSize === 32)
      context.addIssue({
        code: "custom",
        path: ["deckSize"],
        message: "invalid_durak_deck",
      });
    if (
      ["spades", "oh-hell", "cheat"].includes(settings.gameId) &&
      settings.deckSize !== 52
    )
      context.addIssue({
        code: "custom",
        path: ["deckSize"],
        message: "invalid_52_card_deck",
      });
  });
export const lobbyUpdateSchema = z.object({
  maxPlayers: z.number().int().min(2).max(10).optional(),
  deckSize: z.union([z.literal(36), z.literal(52)]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  password: z.string().max(72).optional(),
  mauMauRules: mauMauRulesSchema.optional(),
  rommeRules: rommeRulesSchema.optional(),
  spadesRules: spadesRulesSchema.optional(),
  ohHellRules: ohHellRulesSchema.optional(),
  cheatRules: cheatRulesSchema.optional(),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("attack"),
    cardIds: z.array(z.string().min(1)).min(1).max(6),
  }),
  z.object({
    type: z.literal("defend"),
    cardId: z.string().min(1),
    attackCardId: z.string().min(1),
  }),
  z.object({ type: z.literal("take") }),
  z.object({ type: z.literal("pass") }),
  z.object({
    type: z.literal("schwimmen:swap-one"),
    handCardId: z.string().min(1),
    centerCardId: z.string().min(1),
  }),
  z.object({ type: z.literal("schwimmen:swap-all") }),
  z.object({ type: z.literal("schwimmen:pass") }),
  z.object({ type: z.literal("schwimmen:knock") }),
  z.object({ type: z.literal("schwimmen:next-round") }),
  z.object({
    type: z.literal("mau-mau:play"),
    cardId: z.string().min(1),
    chosenSuit: z.enum(["clubs", "diamonds", "hearts", "spades"]).optional(),
  }),
  z.object({ type: z.literal("mau-mau:draw") }),
  z.object({ type: z.literal("mau-mau:pass") }),
  z.object({
    type: z.literal("romme:draw"),
    source: z.enum(["stock", "discard"]),
  }),
  z.object({
    type: z.literal("romme:meld"),
    groups: z
      .array(z.object({ cardIds: z.array(z.string().min(1)).min(3).max(13) }))
      .min(1)
      .max(5),
  }),
  z.object({
    type: z.literal("romme:lay-off"),
    meldId: z.string().min(1),
    cardIds: z.array(z.string().min(1)).min(1).max(10),
  }),
  z.object({
    type: z.literal("romme:replace-joker"),
    meldId: z.string().min(1),
    jokerId: z.string().min(1),
    cardIds: z.array(z.string().min(1)).min(3).max(13),
  }),
  z.object({ type: z.literal("romme:discard"), cardId: z.string().min(1) }),
  z.object({ type: z.literal("romme:knock"), cardId: z.string().min(1) }),
  z.object({ type: z.literal("romme:pass-opening") }),
  z.object({ type: z.literal("romme:next-round") }),
  z.object({
    type: z.literal("spades:bid"),
    bid: z.number().int().min(0).max(13),
  }),
  z.object({ type: z.literal("spades:play"), cardId: z.string().min(1) }),
  z.object({ type: z.literal("spades:next-round") }),
  z.object({
    type: z.literal("oh-hell:bid"),
    bid: z.number().int().min(0).max(17),
  }),
  z.object({ type: z.literal("oh-hell:play"), cardId: z.string().min(1) }),
  z.object({ type: z.literal("oh-hell:next-round") }),
  z.object({
    type: z.literal("cheat:play"),
    cardIds: z.array(z.string().min(1)).min(1).max(8),
  }),
  z.object({ type: z.literal("cheat:challenge") }),
  z.object({ type: z.literal("cheat:accept") }),
]);

export type GameId = z.infer<typeof gameIdSchema>;
export type GameAction = z.infer<typeof actionSchema>;
export type LobbySummary = {
  code: string;
  gameId: GameId;
  rommeVariant?: z.infer<typeof rommeRulesSchema>["variant"];
  status: "waiting" | "playing";
  playerCount: number;
  maxPlayers: number;
  visibility: "public" | "private";
  passwordProtected: boolean;
  joinable: boolean;
  hostName: string;
};
export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  detached: boolean;
  accentColor: string;
  isHost: boolean;
};
export type PublicLobby = LobbySummary & {
  players: PublicPlayer[];
  deckSize: 32 | 36 | 52;
  hostId: string;
  inactivityDeadline: number;
  mauMauRules?: z.infer<typeof mauMauRulesSchema>;
  rommeRules?: z.infer<typeof rommeRulesSchema>;
  spadesRules?: z.infer<typeof spadesRulesSchema>;
  ohHellRules?: z.infer<typeof ohHellRulesSchema>;
  cheatRules?: z.infer<typeof cheatRulesSchema>;
  game?: unknown;
  events: StructuredEvent[];
};

export type StructuredEvent = {
  id: string;
  sequence: number;
  timestamp: number;
  type: string;
  actorId?: string;
  recipientId?: string;
  data: Record<string, string | number | boolean | string[]>;
  visibility: "public" | "private";
};
export type AckResult = {
  ok: boolean;
  error?: string;
  code?: string;
  token?: string;
  playerId?: string;
  playerName?: string;
  passwordProtected?: boolean;
  joinable?: boolean;
  transferCode?: string;
  expiresAt?: number;
  serverTime?: number;
};

export const deviceTransferCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ""))
  .refine((value) => /^[A-HJ-NP-Z2-9]{8}$/.test(value), {
    message: "invalid_transfer_code",
  });

export interface ClientToServerEvents {
  "lobby:list": (ack: (data: LobbySummary[]) => void) => void;
  "lobby:inspect": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:create": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:join": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:resume": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:detach": (ack: (result: AckResult) => void) => void;
  "lobby:leave": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:kick": (data: unknown, ack: (result: AckResult) => void) => void;
  "player:update": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:update": (data: unknown, ack: (result: AckResult) => void) => void;
  "lobby:close": (ack: (result: AckResult) => void) => void;
  "lobby:keepalive": (ack: (result: AckResult) => void) => void;
  "presence:active": (ack: (result: AckResult) => void) => void;
  "session:transfer:create": (ack: (result: AckResult) => void) => void;
  "session:transfer:cancel": (ack: (result: AckResult) => void) => void;
  "session:transfer:claim": (
    data: unknown,
    ack: (result: AckResult) => void,
  ) => void;
  "game:start": (ack: (result: AckResult) => void) => void;
  "game:restart": (ack: (result: AckResult) => void) => void;
  "game:action": (data: unknown, ack: (result: AckResult) => void) => void;
}
export interface ServerToClientEvents {
  "lobby:list": (data: LobbySummary[]) => void;
  "lobby:state": (data: PublicLobby) => void;
  "lobby:closed": (data: { reason: string }) => void;
  "lobby:warning": (data: { closesAt: number }) => void;
  "game:event": (data: StructuredEvent) => void;
  "error:message": (data: { code: string }) => void;
  "session:transferred": () => void;
}
