import { randomInt } from "node:crypto";
import {
  applyDurakAction,
  applyKnackAction,
  applyMauMauAction,
  applyRommeAction,
  createDurakGame,
  createKnackGame,
  createMauMauGame,
  createRommeGame,
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
  type StructuredEvent,
} from "@collection52/shared";

export type GameState = DurakState | KnackState | MauMauState | RommeState;
export type GameParticipant = { id: string; name: string; connected?: boolean };

type CreateGameOptions = {
  gameId: GameId;
  id: string;
  players: GameParticipant[];
  deckSize: 32 | 36 | 52;
  mauMauRules: MauMauRules;
  rommeRules: RommeRules;
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
  }
}
