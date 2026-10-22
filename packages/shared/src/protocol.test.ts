import { describe, expect, it } from "vitest";
import {
  actionSchema,
  lobbySettingsSchema,
  usernameSchema,
} from "./protocol.js";

describe("usernameSchema", () => {
  it.each(["Anna", "Ann1", "Spieler_12", "Max-Müller", "éowyn"])(
    "accepts the valid username %s",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(true);
    },
  );

  it.each([
    "",
    "A1",
    "Ab_12",
    "123_--",
    "Anna Maria",
    "Anna!",
    "12345678901234567",
  ])("rejects the invalid username %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });
});

describe("Skat protocol", () => {
  it("accepts Skat settings with a 32-card deck", () => {
    expect(
      lobbySettingsSchema.safeParse({
        gameId: "skat",
        maxPlayers: 4,
        deckSize: 32,
        visibility: "public",
        skatRules: { roundsPerPlayer: 12, tournamentScoring: true },
      }).success,
    ).toBe(true);
    expect(
      lobbySettingsSchema.safeParse({
        gameId: "skat",
        maxPlayers: 4,
        deckSize: 52,
        visibility: "public",
      }).success,
    ).toBe(false);
  });

  it("validates Skat declarations and two-card discards", () => {
    expect(
      actionSchema.safeParse({
        type: "skat:declare",
        contract: "grand",
        announcement: "schwarz",
      }).success,
    ).toBe(true);
    expect(
      actionSchema.safeParse({
        type: "skat:discard",
        cardIds: ["clubs-7"],
      }).success,
    ).toBe(false);
  });
});
