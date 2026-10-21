import type {
  AckResult,
  Card,
  DurakPhase,
  GameId,
  GinRoundResult,
  KnackPhase,
  KnackRoundResult,
  MauMauPhase,
  MauMauRules,
  RommeCard,
  RommeRules,
  Suit,
  TablePair,
} from "@collection52/shared";

export type Ack = AckResult;

export type DurakGameView = {
  id: string;
  version: number;
  phase: DurakPhase;
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
    eliminated: boolean;
  }>;
  attackerId: string;
  defenderId: string;
  roundAttackerId: string;
  passedPlayerIds: string[];
  trumpSuit: Suit;
  trumpCard?: Card;
  table: TablePair[];
  roundAttackLimit: number;
  deckCount: number;
  result?: { draw: boolean; durakId?: string; winners: string[] };
};

export type SchwimmenGameView = {
  id: string;
  version: number;
  phase: KnackPhase;
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
    eliminated: boolean;
    lives: number;
    swimming: boolean;
  }>;
  center: Card[];
  currentPlayerId: string;
  dealerId: string;
  closingPlayerId?: string;
  finalTurnsLeft: number;
  consecutivePasses: number;
  roundNumber: number;
  deckCount: number;
  roundResult?: KnackRoundResult;
  lastRoundResult?: KnackRoundResult;
  result?: { winnerId: string };
};

export type MauMauGameView = {
  id: string;
  version: number;
  phase: MauMauPhase;
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
  }>;
  discard: Card[];
  discardCount: number;
  currentPlayerId: string;
  activeSuit: Suit;
  drawnCardId?: string;
  deckCount: number;
  rules: MauMauRules;
  direction: 1 | -1;
  pendingDraw: number;
  result?: { winnerId: string };
};

export type RommeGameView = {
  id: string;
  version: number;
  phase: "playing" | "round-ended" | "finished";
  players: Array<{
    id: string;
    name: string;
    hand: RommeCard[];
    handCount?: number;
    connected: boolean;
    opened: boolean;
  }>;
  discard: RommeCard[];
  discardCount: number;
  deckCount: number;
  melds: Array<{
    id: string;
    ownerId: string;
    kind: "set" | "run";
    cards: RommeCard[];
    points: number;
  }>;
  currentPlayerId: string;
  hasDrawn: boolean;
  rules: RommeRules;
  result?: { winnerId: string; handPoints: Record<string, number> };
  roundNumber?: number;
  dealerId?: string;
  scores?: Record<string, number>;
  ginOpeningPasses?: number;
  roundResult?: GinRoundResult;
};

export type AnyGameView =
  | DurakGameView
  | SchwimmenGameView
  | MauMauGameView
  | RommeGameView;
export type ProtocolEntry = {
  id: string;
  timestamp: number;
  text: string;
  private?: boolean;
};
export type RetainedLobby = {
  code: string;
  gameId: GameId;
  status: "waiting" | "playing";
};

export type Preferences = {
  theme: "system" | "light" | "dark";
  accent: "collection" | "ocean" | "violet" | "amber" | "rose" | "custom";
  customAccent: string;
  largeText: boolean;
  largeCards: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  speech: boolean;
  turnSound: boolean;
  rate: number;
  volume: number;
};
