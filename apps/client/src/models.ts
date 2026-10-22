import type {
  AckResult,
  Card,
  DurakPhase,
  GameId,
  GinRoundResult,
  CanastaRoundResult,
  KnackPhase,
  KnackRoundResult,
  MauMauPhase,
  MauMauRules,
  RommeCard,
  RommeRules,
  Suit,
  TablePair,
  SpadesRules,
  SpadesRoundResult,
  OhHellRules,
  OhHellRoundResult,
  CheatRules,
  Rank,
  SkatRules,
  SkatRoundResult,
  SkatContract,
  SkatAnnouncement,
  SkatPhase,
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
    teamId?: string;
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
  result?: {
    winnerId: string;
    winnerTeamId?: string;
    handPoints: Record<string, number>;
  };
  roundNumber?: number;
  dealerId?: string;
  scores?: Record<string, number>;
  ginOpeningPasses?: number;
  roundResult?: GinRoundResult;
  canastaRedThrees?: Record<string, RommeCard[]>;
  canastaDiscardFrozen?: boolean;
  canastaRoundResult?: CanastaRoundResult;
};

export type SpadesGameView = {
  id: string;
  version: number;
  phase: "bidding" | "playing" | "round-ended" | "finished";
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
    teamId: "team-1" | "team-2";
    bid?: number;
    tricks: number;
  }>;
  dealerId: string;
  currentPlayerId: string;
  trick: Array<{ playerId: string; card: Card }>;
  spadesBroken: boolean;
  scores: Record<"team-1" | "team-2", number>;
  bags: Record<"team-1" | "team-2", number>;
  roundNumber: number;
  rules: SpadesRules;
  roundResult?: SpadesRoundResult;
  result?: { winnerTeamId: "team-1" | "team-2" };
};

export type OhHellGameView = {
  id: string;
  version: number;
  phase: "bidding" | "playing" | "round-ended" | "finished";
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
    bid?: number;
    tricks: number;
    score: number;
  }>;
  dealerId: string;
  currentPlayerId: string;
  trick: Array<{ playerId: string; card: Card }>;
  trumpSuit: Suit;
  trumpCard: Card;
  roundNumber: number;
  handSize: number;
  schedule: number[];
  rules: OhHellRules;
  roundResult?: OhHellRoundResult;
  result?: { winnerIds: string[] };
};

export type CheatGameView = {
  id: string;
  version: number;
  phase: "playing" | "finished";
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    handCount?: number;
    connected: boolean;
  }>;
  currentPlayerId: string;
  currentRank: Rank;
  pileCount: number;
  lastPlay?: { playerId: string; claimedRank: Rank; count: number };
  pendingWinnerId?: string;
  lastChallenge?: {
    challengerId: string;
    challengedId: string;
    truthful: boolean;
    loserId: string;
    cards: Card[];
  };
  rules: CheatRules;
  result?: { winnerId: string };
};

export type SkatGameView = {
  id: string;
  version: number;
  phase: SkatPhase;
  players: Array<{
    id: string;
    name: string;
    connected: boolean;
    hand: Card[];
    handCount?: number;
    active: boolean;
    tricks: number;
    wonCards: Card[];
    score: number;
    wonGames: number;
    lostGames: number;
  }>;
  dealerId: string;
  activePlayerIds: string[];
  forehandId: string;
  middlehandId: string;
  rearhandId: string;
  currentPlayerId: string;
  bidderId?: string;
  listenerId?: string;
  auctionStage: 1 | 2 | "forehand";
  highestBid: number;
  pendingBid?: number;
  skat: Card[];
  skatCount: number;
  skatPickedUp: boolean;
  declarerId?: string;
  handGame: boolean;
  contract?: SkatContract;
  announcement: SkatAnnouncement;
  trick: Array<{ playerId: string; card: Card }>;
  dealNumber: number;
  totalDeals: number;
  rules: SkatRules;
  roundResult?: SkatRoundResult;
  result?: { winnerIds: string[] };
};

export type AnyGameView =
  | DurakGameView
  | SchwimmenGameView
  | MauMauGameView
  | RommeGameView
  | SpadesGameView
  | OhHellGameView
  | CheatGameView
  | SkatGameView;
export type ProtocolEntry = {
  id: string;
  timestamp: number;
  text: string;
  private?: boolean;
};
export type RetainedLobby = {
  code: string;
  gameId: GameId;
  rommeVariant?: RommeRules["variant"];
  status: "waiting" | "playing";
};

export type CardDesign = "classic" | "four-color" | "outline" | "midnight";
export type FontFamily = "system" | "rounded" | "playful" | "serif" | "mono";

export type Preferences = {
  theme: "system" | "light" | "dark";
  accent: "collection" | "ocean" | "violet" | "amber" | "rose" | "custom";
  customAccent: string;
  fontFamily: FontFamily;
  largeText: boolean;
  largeCards: boolean;
  cardRankScale: number;
  cardSuitScale: number;
  cardDesign: CardDesign;
  highContrast: boolean;
  reducedMotion: boolean;
  speech: boolean;
  turnSound: boolean;
  rate: number;
  volume: number;
};
