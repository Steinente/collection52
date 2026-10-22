import { describe, expect, it } from "vitest";
import { gameDefinitions } from "./client-config";

describe("gameDefinitions", () => {
  it("lists Rommé variants separately while keeping one lobby game id", () => {
    const classic = gameDefinitions.find((game) => game.id === "romme");
    const gin = gameDefinitions.find((game) => game.id === "gin-romme");

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
  });
});
