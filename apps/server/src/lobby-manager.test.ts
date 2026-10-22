import { describe, expect, it, vi } from "vitest";
import { LobbyManager } from "./lobby-manager.js";

const hooks = () => ({
  changed: vi.fn(),
  event: vi.fn(),
  closed: vi.fn(),
  warning: vi.fn(),
  listChanged: vi.fn(),
});
describe("LobbyManager", () => {
  it("creates secure sessions, hides private lobbies, and rejects duplicate names", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "private" },
      "s1",
    );
    expect(made.token.length).toBeGreaterThan(30);
    expect(manager.list()).toHaveLength(0);
    await expect(
      manager.join(made.lobby, "anna", undefined, "s2"),
    ).rejects.toThrow("duplicate_name");
    manager.stop();
  });
  it("checks passwords without storing plaintext", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public", password: "secret" },
      "s1",
    );
    expect(made.lobby.passwordHash).not.toBe("secret");
    expect(manager.list()[0]?.hostName).toBe("Anna");
    await expect(manager.join(made.lobby, "Ben", "bad", "s2")).rejects.toThrow(
      "wrong_password",
    );
    expect(
      (await manager.join(made.lobby, "Ben", "secret", "s2")).player.name,
    ).toBe("Ben");
    manager.stop();
  });
  it("never transfers host and closes inactive lobbies", async () => {
    const h = hooks();
    const manager = new LobbyManager(h, 100, 20);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.leave(made.lobby, joined.player.id);
    expect(made.lobby.hostId).toBe(made.player.id);
    manager.cleanup(made.lobby.activityAt + 101);
    expect(manager.find(made.lobby.code)).toBeUndefined();
    expect(h.closed).toHaveBeenCalled();
    manager.stop();
  });
  it("allows only the host to update waiting-lobby settings", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    await expect(
      manager.update(made.lobby, joined.player.id, { deckSize: 52 }),
    ).rejects.toThrow("host_only");
    await manager.update(made.lobby, made.player.id, {
      deckSize: 52,
      visibility: "private",
    });
    expect(made.lobby.deckSize).toBe(52);
    expect(manager.list()).toHaveLength(0);
    manager.stop();
  });
  it("randomizes the shared player order when a game starts", async () => {
    const manager = new LobbyManager(
      hooks(),
      30 * 60_000,
      5 * 60_000,
      5_000,
      60_000,
      () => 0,
    );
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const ben = await manager.join(made.lobby, "Ben", undefined, "s2");
    const cara = await manager.join(made.lobby, "Cara", undefined, "s3");

    manager.start(made.lobby, made.player.id);

    const expectedOrder = [ben.player.id, cara.player.id, made.player.id];
    expect(made.lobby.players.map((player) => player.id)).toEqual(
      expectedOrder,
    );
    expect(made.lobby.game?.players.map((player) => player.id)).toEqual(
      expectedOrder,
    );
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("does not emit another reconnect event for the already active socket", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const changedCalls = h.changed.mock.calls.length;
    const eventCalls = h.event.mock.calls.length;

    manager.resume(made.lobby, made.token, "s1");

    expect(h.changed).toHaveBeenCalledTimes(changedCalls);
    expect(h.event).toHaveBeenCalledTimes(eventCalls);
    manager.stop();
  });
  it("keeps a player online through a short mobile-style connection interruption", async () => {
    vi.useFakeTimers();
    const h = hooks();
    const manager = new LobbyManager(h, 30 * 60_000, 5 * 60_000, 1_000);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );

    manager.disconnect("s1");
    expect(made.player.connected).toBe(true);
    manager.resume(made.lobby, made.token, "s2");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(made.player.connected).toBe(true);
    expect(
      made.lobby.events.filter((event) =>
        ["player.disconnected", "player.reconnected"].includes(event.type),
      ),
    ).toHaveLength(0);
    manager.stop();
    vi.useRealTimers();
  });
  it("stays online while another tab is connected and goes offline after the grace period", async () => {
    vi.useFakeTimers();
    const h = hooks();
    const manager = new LobbyManager(h, 30 * 60_000, 5 * 60_000, 1_000);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    manager.resume(made.lobby, made.token, "s2");

    manager.disconnect("s1");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(made.player.connected).toBe(true);

    manager.disconnect("s2");
    await vi.advanceTimersByTimeAsync(999);
    expect(made.player.connected).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(made.player.connected).toBe(false);
    expect(
      made.lobby.events.filter((event) => event.type === "player.disconnected"),
    ).toHaveLength(1);
    manager.stop();
    vi.useRealTimers();
  });
  it("immediately restores online state when an offline player interacts", async () => {
    const h = hooks();
    const manager = new LobbyManager(h, 30 * 60_000, 5 * 60_000, 0);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    manager.disconnect("s1");
    expect(made.player.connected).toBe(false);

    manager.activate(made.lobby, made.player, "s2");

    expect(made.player.connected).toBe(true);
    expect(made.player.socketIds.has("s2")).toBe(true);
    expect(
      made.lobby.events.filter((event) => event.type === "player.reconnected"),
    ).toHaveLength(1);
    manager.stop();
  });
  it("transfers a running session without changing the player or emitting presence events", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "old-socket",
    );
    await manager.join(made.lobby, "Ben", undefined, "ben-socket");
    manager.start(made.lobby, made.player.id);
    const eventCount = h.event.mock.calls.length;
    const changedCount = h.changed.mock.calls.length;

    const transfer = manager.createDeviceTransfer(made.lobby, made.player);
    expect(transfer.transferCode).toMatch(
      /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    const claimed = manager.claimDeviceTransfer(
      transfer.transferCode.replace("-", ""),
      "new-socket",
    );

    expect(claimed.player.id).toBe(made.player.id);
    expect(claimed.player.name).toBe("Anna");
    expect(claimed.previousSocketIds).toEqual(["old-socket"]);
    expect(claimed.player.socketIds).toEqual(new Set(["new-socket"]));
    expect(manager.playerForToken(made.lobby, claimed.token)?.id).toBe(
      made.player.id,
    );
    expect(manager.playerForToken(made.lobby, made.token)).toBeUndefined();
    expect(h.event).toHaveBeenCalledTimes(eventCount);
    expect(h.changed).toHaveBeenCalledTimes(changedCount);
    expect(() =>
      manager.claimDeviceTransfer(
        transfer.transferCode.replace("-", ""),
        "third-socket",
      ),
    ).toThrow("invalid_transfer_code");
    manager.stop();
  });
  it("expires, cancels, and regenerates device transfer codes using server time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T18:00:00Z"));
    const manager = new LobbyManager(
      hooks(),
      30 * 60_000,
      5 * 60_000,
      5_000,
      60_000,
    );
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.start(made.lobby, made.player.id);

    const first = manager.createDeviceTransfer(made.lobby, made.player);
    expect(first.expiresAt - first.serverTime).toBe(60_000);
    vi.advanceTimersByTime(10_000);
    const reopened = manager.createDeviceTransfer(made.lobby, made.player);
    expect(reopened.transferCode).toBe(first.transferCode);
    expect(reopened.expiresAt).toBe(first.expiresAt);
    expect(reopened.serverTime).toBe(first.serverTime + 10_000);

    manager.cancelDeviceTransfer(made.player.id);
    expect(() =>
      manager.claimDeviceTransfer(reopened.transferCode.replace("-", ""), "s3"),
    ).toThrow("invalid_transfer_code");

    const replacement = manager.createDeviceTransfer(made.lobby, made.player);
    expect(replacement.transferCode).not.toBe(first.transferCode);

    manager.cancelDeviceTransfer(made.player.id);
    const expiring = manager.createDeviceTransfer(made.lobby, made.player);
    vi.setSystemTime(expiring.expiresAt + 1);
    expect(() =>
      manager.claimDeviceTransfer(expiring.transferCode.replace("-", ""), "s3"),
    ).toThrow("transfer_code_expired");
    const fresh = manager.createDeviceTransfer(made.lobby, made.player);
    expect(fresh.transferCode).not.toBe(expiring.transferCode);
    manager.stop();
    vi.useRealTimers();
  });
  it("retains a detached guest and only removes them after a permanent leave", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.detach(made.lobby, joined.player.id);
    expect(made.lobby.players).toHaveLength(2);
    expect(joined.player.connected).toBe(false);
    expect(joined.player.detached).toBe(true);
    expect(
      manager
        .view(made.lobby, made.player.id)
        .players.find((player) => player.id === joined.player.id)?.detached,
    ).toBe(true);
    expect(manager.playerForToken(made.lobby, joined.token)?.id).toBe(
      joined.player.id,
    );
    manager.leave(made.lobby, joined.player.id);
    expect(made.lobby.players).toHaveLength(1);
    expect(h.event).toHaveBeenCalledWith(
      made.lobby,
      expect.objectContaining({
        type: "player.left",
        data: expect.objectContaining({ name: "Ben" }),
      }),
    );
    manager.stop();
  });
  it("allows only the host to kick another player and invalidates their seat", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");

    expect(() =>
      manager.kick(made.lobby, joined.player.id, made.player.id),
    ).toThrow("host_only");
    manager.kick(made.lobby, made.player.id, joined.player.id);

    expect(made.lobby.players).toEqual([made.player]);
    expect(manager.playerForToken(made.lobby, joined.token)).toBeUndefined();
    expect(h.event).toHaveBeenCalledWith(
      made.lobby,
      expect.objectContaining({
        type: "player.kicked",
        actorId: made.player.id,
        data: expect.objectContaining({
          name: "Ben",
          playerId: joined.player.id,
        }),
      }),
    );
    manager.stop();
  });
  it("publishes and updates each player's validated accent color", async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create(
      "Anna",
      { maxPlayers: 4, deckSize: 36, visibility: "public" },
      "s1",
      "#a93b63",
    );
    const joined = await manager.join(
      made.lobby,
      "Ben",
      undefined,
      "s2",
      "#1769aa",
    );

    expect(
      manager
        .view(made.lobby, made.player.id)
        .players.map((player) => player.accentColor),
    ).toEqual(["#a93b63", "#1769aa"]);
    manager.updatePlayerAccent(made.lobby, made.player.id, "#6849bd");

    expect(made.player.accentColor).toBe("#6849bd");
    expect(
      manager.view(made.lobby, made.player.id).players[0]?.accentColor,
    ).toBe("#6849bd");
    expect(joined.player.accentColor).toBe("#1769aa");
    expect(h.changed).toHaveBeenCalledWith(made.lobby);
    manager.stop();
  });
  it.each([
    ["durak", 36],
    ["schwimmen", 32],
  ] as const)(
    "continues a running %s game after a guest permanently leaves when two players remain",
    async (gameId, deckSize) => {
      const manager = new LobbyManager(hooks());
      const made = await manager.create(
        "Anna",
        { gameId, maxPlayers: 4, deckSize, visibility: "public" },
        "s1",
      );
      const ben = await manager.join(made.lobby, "Ben", undefined, "s2");
      await manager.join(made.lobby, "Clara", undefined, "s3");
      manager.start(made.lobby, made.player.id);
      manager.leave(made.lobby, ben.player.id);
      expect(made.lobby.status).toBe("playing");
      expect(made.lobby.game?.players.map((player) => player.id)).not.toContain(
        ben.player.id,
      );
      expect(made.lobby.players).toHaveLength(2);
      manager.stop();
    },
  );
  it("ends the current Mau-Mau round when a guest permanently leaves", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      { gameId: "mau-mau", maxPlayers: 4, deckSize: 32, visibility: "public" },
      "s1",
    );
    const ben = await manager.join(made.lobby, "Ben", undefined, "s2");
    await manager.join(made.lobby, "Clara", undefined, "s3");
    manager.start(made.lobby, made.player.id);
    manager.leave(made.lobby, ben.player.id);
    expect(made.lobby.status).toBe("waiting");
    expect(made.lobby.game).toBeUndefined();
    expect(made.lobby.events.at(-1)?.data.gameEffect).toBe("round_cancelled");
    manager.stop();
  });
  it("creates, starts, and privately projects a Knack game", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      {
        gameId: "schwimmen",
        maxPlayers: 4,
        deckSize: 32,
        visibility: "public",
      },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.start(made.lobby, made.player.id);
    expect(made.lobby.gameId).toBe("schwimmen");
    expect(made.lobby.deckSize).toBe(32);
    expect(manager.summary(made.lobby).gameId).toBe("schwimmen");
    const hostView = manager.view(made.lobby, made.player.id).game as {
      players: Array<{ id: string; hand: unknown[]; handCount?: number }>;
      center: unknown[];
    };
    expect(hostView.center).toHaveLength(3);
    expect(
      hostView.players.find((player) => player.id === made.player.id)?.hand,
    ).toHaveLength(3);
    expect(
      hostView.players.find((player) => player.id === joined.player.id)?.hand,
    ).toHaveLength(0);
    expect(
      hostView.players.find((player) => player.id === joined.player.id)
        ?.handCount,
    ).toBe(3);
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("restarts a finished Knack round as a clean first round", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      {
        gameId: "schwimmen",
        maxPlayers: 4,
        deckSize: 32,
        visibility: "public",
      },
      "s1",
    );
    await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.start(made.lobby, made.player.id);
    const previousGame = made.lobby.game!;
    Object.assign(previousGame, {
      phase: "round-ended",
      roundNumber: 4,
      roundResult: { reason: "knock", scores: [], loserIds: [] },
      lastRoundResult: { reason: "knock", scores: [], loserIds: [] },
    });
    manager.restart(made.lobby, made.player.id);
    expect(made.lobby.game).not.toBe(previousGame);
    expect(made.lobby.game).toMatchObject({ phase: "playing", roundNumber: 1 });
    expect(made.lobby.game).not.toHaveProperty("roundResult");
    expect(made.lobby.game).not.toHaveProperty("lastRoundResult");
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("creates, starts, and privately projects a Mau-Mau game", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      { gameId: "mau-mau", maxPlayers: 4, deckSize: 32, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    await manager.update(made.lobby, made.player.id, {
      mauMauRules: {
        stackSevens: true,
        forbidJackOnJack: true,
        forbidJackAsFinal: false,
        aceReverses: true,
      },
    });
    manager.start(made.lobby, made.player.id);
    expect(made.lobby.gameId).toBe("mau-mau");
    expect(made.lobby.deckSize).toBe(32);
    expect(made.lobby.mauMauRules.stackSevens).toBe(true);
    const hostView = manager.view(made.lobby, made.player.id).game as {
      players: Array<{ id: string; hand: unknown[]; handCount?: number }>;
      discard: unknown[];
      rules: { aceReverses: boolean };
    };
    expect(hostView.discard).toHaveLength(1);
    expect(
      hostView.players.find((player) => player.id === made.player.id)?.hand,
    ).toHaveLength(5);
    expect(hostView.rules.aceReverses).toBe(true);
    expect(
      hostView.players.find((player) => player.id === joined.player.id)?.hand,
    ).toHaveLength(0);
    expect(
      hostView.players.find((player) => player.id === joined.player.id)
        ?.handCount,
    ).toBe(5);
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("records drawn cards only in the drawing player private event stream", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      { gameId: "mau-mau", maxPlayers: 4, deckSize: 32, visibility: "public" },
      "s1",
    );
    const joined = await manager.join(made.lobby, "Ben", undefined, "s2");
    manager.start(made.lobby, made.player.id);
    const currentId = (made.lobby.game as { currentPlayerId: string })
      .currentPlayerId;
    const otherId =
      currentId === made.player.id ? joined.player.id : made.player.id;
    manager.action(made.lobby, currentId, { type: "mau-mau:draw" });
    const privateDraw = [...made.lobby.events]
      .reverse()
      .find((event) => event.type === "game.cards.drawn");
    expect(privateDraw).toMatchObject({
      visibility: "private",
      recipientId: currentId,
      actorId: currentId,
    });
    expect(privateDraw?.data.cardIds).toHaveLength(1);
    expect(
      manager
        .view(made.lobby, currentId)
        .events.some((event) => event.id === privateDraw?.id),
    ).toBe(true);
    expect(
      manager
        .view(made.lobby, otherId)
        .events.some((event) => event.id === privateDraw?.id),
    ).toBe(false);
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("preserves Gin-Rommé settings from lobby creation through game start", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      {
        gameId: "romme",
        maxPlayers: 2,
        deckSize: 52,
        visibility: "public",
        rommeRules: {
          variant: "gin",
          openingPoints: 40,
          requireDiscardUse: false,
          ginTargetScore: 150,
          canastaTargetScore: 5000,
          canastaRequireCanastaToGoOut: true,
        },
      },
      "s1",
    );
    await manager.join(made.lobby, "Ben", undefined, "s2");

    manager.start(made.lobby, made.player.id);

    expect(made.lobby.rommeRules).toMatchObject({
      variant: "gin",
      ginTargetScore: 150,
    });
    expect(manager.summary(made.lobby).rommeVariant).toBe("gin");
    expect(made.lobby.game).toMatchObject({
      rules: { variant: "gin", ginTargetScore: 150 },
      players: [{ hand: expect.any(Array) }, { hand: expect.any(Array) }],
    });
    expect(
      made.lobby.game?.players.map((player) => player.hand.length),
    ).toEqual([10, 10]);
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("creates Canasta as a four-player Rommé-family lobby", async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create(
      "Anna",
      {
        gameId: "romme",
        maxPlayers: 6,
        deckSize: 52,
        visibility: "public",
        rommeRules: {
          variant: "canasta",
          openingPoints: 40,
          requireDiscardUse: false,
          ginTargetScore: 100,
          canastaTargetScore: 7500,
          canastaRequireCanastaToGoOut: true,
        },
      },
      "s1",
    );
    await manager.join(made.lobby, "Ben", undefined, "s2");
    await manager.join(made.lobby, "Cara", undefined, "s3");
    await manager.join(made.lobby, "Dino", undefined, "s4");

    expect(made.lobby.maxPlayers).toBe(4);
    expect(manager.summary(made.lobby).rommeVariant).toBe("canasta");
    manager.start(made.lobby, made.player.id);
    expect(made.lobby.game).toMatchObject({
      rules: { variant: "canasta", canastaTargetScore: 7500 },
      players: expect.arrayContaining([
        expect.objectContaining({ teamId: "team-1" }),
        expect.objectContaining({ teamId: "team-2" }),
      ]),
    });
    manager.close(made.lobby, "test_finished");
    manager.stop();
  });
  it("enforces player counts and keeps rules for the new games", async () => {
    const manager = new LobbyManager(hooks());
    const spades = await manager.create(
      "Anna",
      {
        gameId: "spades",
        maxPlayers: 9,
        deckSize: 52,
        visibility: "public",
        spadesRules: { targetScore: 250, nilBonus: 50, bagPenalty: false },
      },
      "s1",
    );
    expect(spades.lobby.maxPlayers).toBe(4);
    await manager.join(spades.lobby, "Ben", undefined, "s2");
    await manager.join(spades.lobby, "Cara", undefined, "s3");
    expect(() => manager.start(spades.lobby, spades.player.id)).toThrow(
      "spades_requires_four_players",
    );
    await manager.join(spades.lobby, "Dino", undefined, "s4");
    manager.start(spades.lobby, spades.player.id);
    expect(spades.lobby.game).toMatchObject({ rules: { targetScore: 250 } });
    manager.close(spades.lobby, "test_finished");

    const ohHell = await manager.create(
      "Anna",
      { gameId: "oh-hell", maxPlayers: 10, deckSize: 52, visibility: "public" },
      "o1",
    );
    expect(ohHell.lobby.maxPlayers).toBe(7);
    await manager.join(ohHell.lobby, "Ben", undefined, "o2");
    expect(() => manager.start(ohHell.lobby, ohHell.player.id)).toThrow(
      "oh_hell_requires_three_to_seven_players",
    );
    manager.close(ohHell.lobby, "test_finished");

    const cheat = await manager.create(
      "Anna",
      {
        gameId: "cheat",
        maxPlayers: 10,
        deckSize: 52,
        visibility: "public",
        cheatRules: {
          deckCount: 2,
          direction: "descending",
          maxCardsPerTurn: 8,
        },
      },
      "c1",
    );
    await manager.join(cheat.lobby, "Ben", undefined, "c2");
    manager.start(cheat.lobby, cheat.player.id);
    expect(cheat.lobby.game).toMatchObject({
      currentRank: "ace",
      rules: { deckCount: 2, direction: "descending" },
    });
    manager.close(cheat.lobby, "test_finished");
    manager.stop();
  });
});
