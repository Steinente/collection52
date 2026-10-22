import { randomInt } from "node:crypto";
import {
  applyDurakAction,
  applyKnackAction,
  applyMauMauAction,
  applyRommeAction,
  applySpadesAction,
  applyOhHellAction,
  applyCheatAction,
  applySkatAction,
  createDurakGame,
  createKnackGame,
  createMauMauGame,
  createRommeGame,
  createSpadesGame,
  createOhHellGame,
  createCheatGame,
  createSkatGame,
  withdrawDurakPlayer,
  withdrawKnackPlayer,
  withdrawRommePlayer,
  type DurakAction,
  type DurakState,
  type GameAction,
  type GameId,
  type KnackAction,
  type KnackState,
  type MauMauAction,
  type MauMauRules,
  type MauMauState,
  type RommeAction,
  type RommeRules,
  type RommeState,
  type SpadesAction,
  type SpadesRules,
  type SpadesState,
  type OhHellAction,
  type OhHellRules,
  type OhHellState,
  type CheatAction,
  type CheatRules,
  type CheatState,
  type SkatAction,
  type SkatRules,
  type SkatState,
  type StructuredEvent,
} from "@collection52/shared";

export type GameState =
  | DurakState
  | KnackState
  | MauMauState
  | RommeState
  | SpadesState
  | OhHellState
  | CheatState
  | SkatState;
export type GameParticipant = { id: string; name: string; connected?: boolean };

type CreateGameOptions = {
  gameId: GameId;
  id: string;
  players: GameParticipant[];
  deckSize: 32 | 36 | 52;
  mauMauRules: MauMauRules;
  rommeRules: RommeRules;
  spadesRules: SpadesRules;
  ohHellRules: OhHellRules;
  cheatRules: CheatRules;
  skatRules: SkatRules;
};

export function createGame(options: CreateGameOptions): GameState {
  const { gameId, id, players } = options;
  switch (gameId) {
    case "schwimmen":
      return createKnackGame(id, players, randomInt);
    case "mau-mau":
      return createMauMauGame(id, players, randomInt, options.mauMauRules);
    case "romme":
      return createRommeGame(id, players, randomInt, options.rommeRules);
    case "spades":
      return createSpadesGame(id, players, randomInt, options.spadesRules);
    case "oh-hell":
      return createOhHellGame(id, players, randomInt, options.ohHellRules);
    case "cheat":
      return createCheatGame(id, players, randomInt, options.cheatRules);
    case "skat":
      return createSkatGame(id, players, randomInt, options.skatRules);
    case "durak":
      return createDurakGame(
        id,
        players,
        options.deckSize as 36 | 52,
        randomInt,
      );
  }
}

export function applyGameAction(
  gameId: GameId,
  game: GameState,
  playerId: string,
  action: GameAction,
): GameState {
  switch (gameId) {
    case "schwimmen":
      if (!action.type.startsWith("schwimmen:"))
        throw new Error("invalid_action");
      return applyKnackAction(
        game as KnackState,
        playerId,
        action as KnackAction,
        randomInt,
      );
    case "mau-mau":
      if (!action.type.startsWith("mau-mau:"))
        throw new Error("invalid_action");
      return applyMauMauAction(
        game as MauMauState,
        playerId,
        action as MauMauAction,
        randomInt,
      );
    case "romme":
      if (!action.type.startsWith("romme:")) throw new Error("invalid_action");
      return applyRommeAction(
        game as RommeState,
        playerId,
        action as RommeAction,
        randomInt,
      );
    case "spades":
      if (!action.type.startsWith("spades:")) throw new Error("invalid_action");
      return applySpadesAction(
        game as SpadesState,
        playerId,
        action as SpadesAction,
        randomInt,
      );
    case "oh-hell":
      if (!action.type.startsWith("oh-hell:"))
        throw new Error("invalid_action");
      return applyOhHellAction(
        game as OhHellState,
        playerId,
        action as OhHellAction,
        randomInt,
      );
    case "cheat":
      if (!action.type.startsWith("cheat:")) throw new Error("invalid_action");
      return applyCheatAction(
        game as CheatState,
        playerId,
        action as CheatAction,
      );
    case "skat":
      if (!action.type.startsWith("skat:")) throw new Error("invalid_action");
      return applySkatAction(
        game as SkatState,
        playerId,
        action as SkatAction,
        randomInt,
      );
    case "durak":
      if (action.type.includes(":")) throw new Error("invalid_action");
      return applyDurakAction(
        game as DurakState,
        playerId,
        action as DurakAction,
      );
  }
}

export function gameActionEventData(
  action: GameAction,
  handBefore: ReadonlySet<string>,
  schwimmenCenterBefore: string[],
): StructuredEvent["data"] {
  switch (action.type) {
    case "attack":
      return { cardIds: action.cardIds };
    case "defend":
      return { cardId: action.cardId, attackCardId: action.attackCardId };
    case "schwimmen:swap-one":
      return {
        handCardId: action.handCardId,
        centerCardId: action.centerCardId,
      };
    case "schwimmen:swap-all":
      return {
        handCardIds: [...handBefore],
        centerCardIds: schwimmenCenterBefore,
      };
    case "mau-mau:play":
      return {
        cardId: action.cardId,
        ...(action.chosenSuit ? { chosenSuit: action.chosenSuit } : {}),
      };
    case "romme:draw":
      return { source: action.source };
    case "romme:meld":
      return {
        groupCount: action.groups.length,
        cardIds: action.groups.flatMap((group) => group.cardIds),
      };
    case "romme:lay-off":
      return { meldId: action.meldId, cardIds: action.cardIds };
    case "romme:replace-joker":
      return {
        meldId: action.meldId,
        jokerId: action.jokerId,
        cardIds: action.cardIds,
      };
    case "romme:discard":
    case "romme:knock":
      return { cardId: action.cardId };
    case "spades:bid":
    case "oh-hell:bid":
      return { bid: action.bid };
    case "spades:play":
    case "oh-hell:play":
      return { cardId: action.cardId };
    case "cheat:play":
      return { count: action.cardIds.length };
    case "skat:bid":
      return { bid: action.bid };
    case "skat:discard":
      return { count: action.cardIds.length };
    case "skat:declare":
      return {
        contract: action.contract,
        announcement: action.announcement,
      };
    case "skat:play":
      return { cardId: action.cardId };
    default:
      return {};
  }
}

export function recordsPrivateDraws(
  gameId: GameId,
  action: GameAction,
): boolean {
  return (
    gameId === "durak" ||
    action.type === "mau-mau:draw" ||
    action.type === "romme:draw" ||
    action.type === "romme:next-round" ||
    action.type === "spades:next-round" ||
    action.type === "oh-hell:next-round" ||
    action.type === "cheat:challenge" ||
    action.type === "skat:pick-up" ||
    action.type === "skat:next-round" ||
    action.type === "schwimmen:next-round"
  );
}

export function withdrawPlayer(
  gameId: GameId,
  game: GameState,
  playerId: string,
): GameState | undefined {
  switch (gameId) {
    case "durak":
      return withdrawDurakPlayer(game as DurakState, playerId);
    case "schwimmen":
      return withdrawKnackPlayer(game as KnackState, playerId);
    case "romme":
      return withdrawRommePlayer(game as RommeState, playerId);
    case "mau-mau":
      return undefined;
    case "spades":
    case "oh-hell":
    case "cheat":
    case "skat":
      return undefined;
  }
}
