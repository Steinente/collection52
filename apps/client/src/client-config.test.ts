import { describe, expect, it } from "vitest";
import { gameDefinitions } from "./client-config";
import de from "./locales/de.json";
import en from "./locales/en.json";

describe("gameDefinitions", () => {
  it("lists Rommé variants separately while keeping one lobby game id", () => {
    const classic = gameDefinitions.find((game) => game.id === "romme");
    const gin = gameDefinitions.find((game) => game.id === "gin-romme");
    const canasta = gameDefinitions.find((game) => game.id === "canasta");

    expect(classic).toMatchObject({
      gameId: "romme",
      rommeVariant: "classic",
      nameKey: "rommeVariantClassic",
    });
    expect(gin).toMatchObject({
      gameId: "romme",
      rommeVariant: "gin",
      nameKey: "rommeVariantGin",
    });
    expect(canasta).toMatchObject({
      gameId: "romme",
      rommeVariant: "canasta",
      nameKey: "rommeVariantCanasta",
    });
  });
  it("lists Spades, Oh Hell and Cheat as independent games", () => {
    expect(gameDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "spades", gameId: "spades" }),
        expect.objectContaining({ id: "oh-hell", gameId: "oh-hell" }),
        expect.objectContaining({ id: "cheat", gameId: "cheat" }),
      ]),
    );
  });
  it("uses researched, language-specific aliases", () => {
    expect(de.spadesAliases).toEqual([]);
    expect(en.spadesAliases).toEqual([]);
    expect(de.ohHellAliases).toEqual(
      expect.arrayContaining(["Oh Hell!", "Stichschätzen", "Fahrstuhl"]),
    );
    expect(en.ohHellAliases).toEqual(
      expect.arrayContaining(["Blackout", "Nomination Whist", "Elevator"]),
    );
    expect(de.cheatAliases).toEqual(
      expect.arrayContaining(["Schummeln", "Lügen", "Schwindeln"]),
    );
    expect(en.cheatAliases).toEqual(
      expect.arrayContaining(["Bullshit", "I Doubt It"]),
    );
  });
});
