import type { RommeGameView } from "../models";
import { ClassicRommeBoard } from "./classic-romme-board";
import { GinRommeBoard } from "./gin-romme-board";

export type RommeBoardProps = {
  game: RommeGameView;
  playerId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
  sendAction: (action: object) => void;
};

export function RommeBoard(props: RommeBoardProps) {
  return props.game.rules.variant === "gin" ? (
    <GinRommeBoard {...props} />
  ) : (
    <ClassicRommeBoard {...props} />
  );
}
