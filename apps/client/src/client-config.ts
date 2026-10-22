import {
  defaultMauMauRules,
  defaultRommeRules,
  defaultSpadesRules,
  defaultOhHellRules,
  defaultCheatRules,
  defaultSkatRules,
  type GameId,
  type MauMauRules,
  type RommeRules,
  type SpadesRules,
  type OhHellRules,
  type CheatRules,
  type SkatRules,
  type Suit,
} from "@collection52/shared";
import { defaultHandSortSettings, type HandSortSettings } from "./hand-sort";
import type { Preferences, RetainedLobby } from "./models";

export const defaultPreferences: Preferences = {
  theme: "system",
  accent: "collection",
  customAccent: "#c42b1c",
  fontFamily: "system",
  largeText: false,
  largeCards: false,
  cardRankScale: 1,
  cardSuitScale: 1,
  cardDesign: "classic",
  highContrast: false,
  reducedMotion: false,
  speech: false,
  turnSound: true,
  rate: 1,
  volume: 1,
};

export {
  defaultMauMauRules,
  defaultRommeRules,
  defaultSpadesRules,
  defaultOhHellRules,
  defaultCheatRules,
  defaultSkatRules,
};

export const gameDefinitions = [
  {
    id: "durak",
    gameId: "durak",
    nameKey: "durak",
    descriptionKey: "durakDescription",
    aliasesKey: "durakAliases",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "schwimmen",
    gameId: "schwimmen",
    nameKey: "schwimmen",
    descriptionKey: "knackDescription",
    aliasesKey: "knackAliases",
    searchAliasesKey: "knackSearchAliases",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "mau-mau",
    gameId: "mau-mau",
    nameKey: "mau-mau",
    descriptionKey: "mauMauDescription",
    aliasesKey: "mauMauAliases",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "romme",
    gameId: "romme",
    rommeVariant: "classic",
    nameKey: "rommeVariantClassic",
    descriptionKey: "rommeDescription",
    aliasesKey: "rommeAliases",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "gin-romme",
    gameId: "romme",
    rommeVariant: "gin",
    nameKey: "rommeVariantGin",
    descriptionKey: "ginRommeDescription",
    aliasesKey: "ginRommeAliases",
    searchAliasesKey: "ginRommeSearchAliases",
    minPlayers: 2,
    maxPlayers: 2,
  },
  {
    id: "canasta",
    gameId: "romme",
    rommeVariant: "canasta",
    nameKey: "rommeVariantCanasta",
    descriptionKey: "canastaDescription",
    aliasesKey: "canastaAliases",
    minPlayers: 4,
    maxPlayers: 4,
  },
  {
    id: "spades",
    gameId: "spades",
    nameKey: "spades",
    descriptionKey: "spadesDescription",
    aliasesKey: "spadesAliases",
    minPlayers: 4,
    maxPlayers: 4,
  },
  {
    id: "oh-hell",
    gameId: "oh-hell",
    nameKey: "oh-hell",
    descriptionKey: "ohHellDescription",
    aliasesKey: "ohHellAliases",
    minPlayers: 3,
    maxPlayers: 7,
  },
  {
    id: "cheat",
    gameId: "cheat",
    nameKey: "cheat",
    descriptionKey: "cheatDescription",
    aliasesKey: "cheatAliases",
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: "skat",
    gameId: "skat",
    nameKey: "skat",
    descriptionKey: "skatDescription",
    aliasesKey: "skatAliases",
    minPlayers: 3,
    maxPlayers: 4,
  },
] as const;

export type GameSelectionId = (typeof gameDefinitions)[number]["id"];

export const suitSymbols: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};
export const technicalEventTypes = new Set([
  "player.disconnected",
  "player.reconnected",
  "lobby.kept_alive",
]);
export const storageKeys = {
  preferences: "c52:prefs",
  theme: "c52:theme",
  language: "c52:language",
  playerName: "c52:name",
  selectedGame: "c52:game",
  mauMauRules: "c52:mau-mau-rules",
  rommeRules: "c52:romme-rules",
  spadesRules: "c52:spades-rules",
  ohHellRules: "c52:oh-hell-rules",
  cheatRules: "c52:cheat-rules",
  skatRules: "c52:skat-rules",
  retainedLobby: "c52:retained-lobby",
  handSort: "c52:hand-sort",
} as const;
export const sessionKey = (code: string) => `c52:session:${code}`;
export const retainedLobbyStorageKey = storageKeys.retainedLobby;
export const handSortStorageKey = storageKeys.handSort;

const accentChoices: Preferences["accent"][] = [
  "collection",
  "ocean",
  "violet",
  "amber",
  "rose",
  "custom",
];
const cardDesignChoices: Preferences["cardDesign"][] = [
  "classic",
  "four-color",
  "outline",
  "midnight",
];
const fontFamilyChoices: Preferences["fontFamily"][] = [
  "system",
  "rounded",
  "playful",
  "serif",
  "mono",
];

function preferenceScale(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1.4, Math.max(0.8, value))
    : fallback;
}

export function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.preferences) ?? "{}",
    ) as Partial<Preferences> & { accent?: string };
    const accent = accentChoices.includes(
      stored.accent as Preferences["accent"],
    )
      ? (stored.accent as Preferences["accent"])
      : defaultPreferences.accent;
    const cardDesign = cardDesignChoices.includes(
      stored.cardDesign as Preferences["cardDesign"],
    )
      ? (stored.cardDesign as Preferences["cardDesign"])
      : defaultPreferences.cardDesign;
    const fontFamily = fontFamilyChoices.includes(
      stored.fontFamily as Preferences["fontFamily"],
    )
      ? (stored.fontFamily as Preferences["fontFamily"])
      : defaultPreferences.fontFamily;
    return {
      ...defaultPreferences,
      ...stored,
      accent,
      cardDesign,
      fontFamily,
      cardRankScale: preferenceScale(
        stored.cardRankScale,
        defaultPreferences.cardRankScale,
      ),
      cardSuitScale: preferenceScale(
        stored.cardSuitScale,
        defaultPreferences.cardSuitScale,
      ),
    };
  } catch {
    return { ...defaultPreferences };
  }
}

export function loadMauMauRules(): MauMauRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.mauMauRules) ?? "{}",
    ) as Partial<MauMauRules>;
    return Object.fromEntries(
      (Object.keys(defaultMauMauRules) as Array<keyof MauMauRules>).map(
        (key) => [
          key,
          typeof stored[key] === "boolean"
            ? stored[key]
            : defaultMauMauRules[key],
        ],
      ),
    ) as MauMauRules;
  } catch {
    return { ...defaultMauMauRules };
  }
}

export function loadRommeRules(): RommeRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.rommeRules) ?? "{}",
    ) as Partial<RommeRules>;
    return {
      variant:
        stored.variant === "gin" || stored.variant === "canasta"
          ? stored.variant
          : "classic",
      openingPoints: stored.openingPoints === 30 ? 30 : 40,
      requireDiscardUse: stored.requireDiscardUse === true,
      ginTargetScore:
        typeof stored.ginTargetScore === "number" &&
        stored.ginTargetScore >= 10 &&
        stored.ginTargetScore <= 500
          ? Math.round(stored.ginTargetScore)
          : 100,
      canastaTargetScore:
        typeof stored.canastaTargetScore === "number" &&
        stored.canastaTargetScore >= 1000 &&
        stored.canastaTargetScore <= 20000
          ? Math.round(stored.canastaTargetScore)
          : 5000,
      canastaRequireCanastaToGoOut:
        stored.canastaRequireCanastaToGoOut !== false,
    };
  } catch {
    return { ...defaultRommeRules };
  }
}

export function loadSpadesRules(): SpadesRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.spadesRules) ?? "{}",
    ) as Partial<SpadesRules>;
    return {
      targetScore: [250, 500, 750, 1000].includes(stored.targetScore ?? 0)
        ? stored.targetScore!
        : defaultSpadesRules.targetScore,
      nilBonus: [50, 100, 200].includes(stored.nilBonus ?? 0)
        ? stored.nilBonus!
        : defaultSpadesRules.nilBonus,
      bagPenalty: stored.bagPenalty !== false,
    };
  } catch {
    return { ...defaultSpadesRules };
  }
}

export function loadOhHellRules(): OhHellRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.ohHellRules) ?? "{}",
    ) as Partial<OhHellRules>;
    return {
      exactBonus: [5, 10, 20].includes(stored.exactBonus ?? -1)
        ? stored.exactBonus!
        : defaultOhHellRules.exactBonus,
      scoreMissedTricks: stored.scoreMissedTricks !== false,
      forbidExactBidTotal: stored.forbidExactBidTotal !== false,
    };
  } catch {
    return { ...defaultOhHellRules };
  }
}

export function loadCheatRules(): CheatRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.cheatRules) ?? "{}",
    ) as Partial<CheatRules>;
    return {
      deckCount: stored.deckCount === 2 ? 2 : 1,
      direction: stored.direction === "descending" ? "descending" : "ascending",
      maxCardsPerTurn: [1, 4, 8].includes(stored.maxCardsPerTurn ?? 0)
        ? stored.maxCardsPerTurn!
        : defaultCheatRules.maxCardsPerTurn,
    };
  } catch {
    return { ...defaultCheatRules };
  }
}

export function loadSkatRules(): SkatRules {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.skatRules) ?? "{}",
    ) as Partial<SkatRules>;
    return {
      roundsPerPlayer: [3, 6, 9, 12].includes(stored.roundsPerPlayer ?? 0)
        ? stored.roundsPerPlayer!
        : defaultSkatRules.roundsPerPlayer,
      tournamentScoring: stored.tournamentScoring === true,
    };
  } catch {
    return { ...defaultSkatRules };
  }
}

export function loadRetainedLobby(): RetainedLobby | undefined {
  try {
    const saved = JSON.parse(
      localStorage.getItem(retainedLobbyStorageKey) ?? "null",
    ) as RetainedLobby | null;
    return saved &&
      /^[A-Z2-9]{8}$/.test(saved.code) &&
      gameDefinitions.some((game) => game.id === saved.gameId)
      ? saved
      : undefined;
  } catch {
    return undefined;
  }
}

export function loadHandSortSettings(): HandSortSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(handSortStorageKey) ?? "null",
    ) as Partial<HandSortSettings> | null;
    return {
      mode:
        saved?.mode === "rank" || saved?.mode === "none"
          ? saved.mode
          : defaultHandSortSettings.mode,
      direction:
        saved?.direction === "desc"
          ? "desc"
          : defaultHandSortSettings.direction,
    };
  } catch {
    return { ...defaultHandSortSettings };
  }
}

export const invitationCode = () =>
  new URLSearchParams(location.search).get("lobby")?.toUpperCase() ?? "";
export const validHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
export const hexColorParts = (value: string): [number, number, number] =>
  [1, 3, 5].map((start) =>
    Number.parseInt(value.slice(start, start + 2), 16),
  ) as [number, number, number];
export const usernamePattern = /^[\p{L}\p{N}_-]{1,16}$/u;
export const hasMinimumUsernameLetters = (name: string) =>
  (name.match(/\p{L}/gu)?.length ?? 0) >= 3;
export const isValidUsername = (name: string) =>
  usernamePattern.test(name) && hasMinimumUsernameLetters(name);
export const eventTranslationKey = (type: string) =>
  `event_${type.replaceAll(".", "_")}`;
export const isGameId = (value: string): value is GameId =>
  gameDefinitions.some((game) => game.gameId === value);
