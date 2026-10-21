import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  defaultMauMauRules,
  defaultRommeRules,
  knackPlayerView,
  mauMauPlayerView,
  rommePlayerView,
  playerView as durakPlayerView,
  type DurakState,
  type GameAction,
  type GameId,
  type KnackState,
  type LobbySummary,
  type MauMauRules,
  type MauMauState,
  type PublicLobby,
  type RommeRules,
  type RommeState,
  type StructuredEvent,
} from "@collection52/shared";
import {
  applyGameAction,
  createGame,
  gameActionEventData,
  recordsPrivateDraws,
  withdrawPlayer,
  type GameState,
} from "./game-service.js";

const scrypt = promisify(scryptCallback);
export type LobbyPlayer = {
  id: string;
  name: string;
  tokenHash: string;
  connected: boolean;
  socketIds: Set<string>;
  joinedAt: number;
  isHost: boolean;
};
export type Lobby = {
  id: string;
  code: string;
  gameId: GameId;
  status: "waiting" | "playing";
  visibility: "public" | "private";
  maxPlayers: number;
  deckSize: 32 | 36 | 52;
  mauMauRules: MauMauRules;
  rommeRules: RommeRules;
  passwordHash?: string;
  passwordSalt?: string;
  hostId: string;
  players: LobbyPlayer[];
  game?: GameState;
  gameNumber: number;
  activityAt: number;
  warningSent: boolean;
  sequence: number;
  events: StructuredEvent[];
  closed: boolean;
};

export type ManagerHooks = {
  changed: (lobby: Lobby) => void;
  event: (lobby: Lobby, event: StructuredEvent) => void;
  closed: (lobby: Lobby, reason: string) => void;
  warning: (lobby: Lobby, closesAt: number) => void;
  listChanged: () => void;
};
export type CreateLobbySettings = {
  gameId?: GameId | undefined;
  maxPlayers: number;
  deckSize: 32 | 36 | 52;
  visibility: "public" | "private";
  password?: string | undefined;
  mauMauRules?: MauMauRules | undefined;
  rommeRules?: RommeRules | undefined;
};
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const safeCode = () =>
  randomBytes(8)
    .toString("base64url")
    .toUpperCase()
    .replace(/[01ILO_-]/g, "X")
    .slice(0, 8);
const transferAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const transferCode = () =>
  [...randomBytes(8)]
    .map((value) => transferAlphabet[value % transferAlphabet.length])
    .join("");
const formatTransferCode = (code: string) =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

type DeviceTransfer = {
  code: string;
  lobby: Lobby;
  player: LobbyPlayer;
  expiresAt: number;
};

export class LobbyManager {
  readonly lobbies = new Map<string, Lobby>();
  private cleanupTimer?: NodeJS.Timeout;
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();
  private readonly deviceTransfers = new Map<string, DeviceTransfer>();
  private readonly transferCodesByPlayer = new Map<string, string>();
  constructor(
    private hooks: ManagerHooks,
    private idleMs = 30 * 60_000,
    private warningMs = 5 * 60_000,
    private disconnectGraceMs = 5_000,
    private deviceTransferTtlMs = 60_000,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
    this.cleanupTimer.unref();
  }
  stop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const timer of this.offlineTimers.values()) clearTimeout(timer);
    this.offlineTimers.clear();
    this.deviceTransfers.clear();
    this.transferCodesByPlayer.clear();
  }
  private token() {
    return randomBytes(32).toString("base64url");
  }
  private event(
    lobby: Lobby,
    type: string,
    actorId?: string,
    data: StructuredEvent["data"] = {},
    visibility: StructuredEvent["visibility"] = "public",
    recipientId?: string,
  ): StructuredEvent {
    const event: StructuredEvent = {
      id: randomUUID(),
      sequence: ++lobby.sequence,
      timestamp: Date.now(),
      type,
      ...(actorId ? { actorId } : {}),
      ...(recipientId ? { recipientId } : {}),
      data,
      visibility,
    };
    lobby.events.push(event);
    if (lobby.events.length > 200) lobby.events.shift();
    this.hooks.event(lobby, event);
    return event;
  }
  private touch(lobby: Lobby) {
    lobby.activityAt = Date.now();
    lobby.warningSent = false;
  }
  list(): LobbySummary[] {
    return [...this.lobbies.values()]
      .filter((l) => !l.closed && l.visibility === "public")
      .map((l) => this.summary(l));
  }
  summary(l: Lobby): LobbySummary {
    return {
      code: l.code,
      gameId: l.gameId,
      status: l.status,
      playerCount: l.players.length,
      maxPlayers: l.maxPlayers,
      visibility: l.visibility,
      passwordProtected: Boolean(l.passwordHash),
      joinable: l.status === "waiting" && l.players.length < l.maxPlayers,
      hostName: l.players.find((player) => player.id === l.hostId)?.name ?? "",
    };
  }
  view(lobby: Lobby, playerId: string): PublicLobby {
    const game = lobby.game
      ? lobby.gameId === "schwimmen"
        ? knackPlayerView(lobby.game as KnackState, playerId)
        : lobby.gameId === "mau-mau"
          ? mauMauPlayerView(lobby.game as MauMauState, playerId)
          : lobby.gameId === "romme"
            ? rommePlayerView(lobby.game as RommeState, playerId)
            : durakPlayerView(lobby.game as DurakState, playerId)
      : undefined;
    return {
      ...this.summary(lobby),
      players: lobby.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.isHost,
      })),
      deckSize: lobby.deckSize,
      hostId: lobby.hostId,
      inactivityDeadline: lobby.activityAt + this.idleMs,
      ...(lobby.gameId === "mau-mau" ? { mauMauRules: lobby.mauMauRules } : {}),
      ...(lobby.gameId === "romme" ? { rommeRules: lobby.rommeRules } : {}),
      events: lobby.events.filter(
        (event) =>
          event.visibility === "public" || event.recipientId === playerId,
      ),
      ...(game ? { game } : {}),
    };
  }
  find(code: string) {
    return this.lobbies.get(code.toUpperCase());
  }
  playerForToken(lobby: Lobby, token: string) {
    return lobby.players.find(
      (player) => player.tokenHash === hashToken(token),
    );
  }
  private removeDeviceTransfer(code: string) {
    const transfer = this.deviceTransfers.get(code);
    if (!transfer) return;
    this.deviceTransfers.delete(code);
    if (this.transferCodesByPlayer.get(transfer.player.id) === code)
      this.transferCodesByPlayer.delete(transfer.player.id);
  }
  private removeExpiredDeviceTransfers(now = Date.now()) {
    for (const transfer of this.deviceTransfers.values())
      if (transfer.expiresAt <= now) this.removeDeviceTransfer(transfer.code);
  }
  cancelDeviceTransfer(playerId: string) {
    const code = this.transferCodesByPlayer.get(playerId);
    if (code) this.removeDeviceTransfer(code);
  }
  createDeviceTransfer(lobby: Lobby, player: LobbyPlayer) {
    if (lobby.closed || !lobby.players.includes(player))
      throw new Error("not_in_lobby");
    if (lobby.status !== "playing") throw new Error("game_not_started");
    const now = Date.now();
    this.removeExpiredDeviceTransfers(now);
    const activeCode = this.transferCodesByPlayer.get(player.id);
    const activeTransfer = activeCode
      ? this.deviceTransfers.get(activeCode)
      : undefined;
    if (activeTransfer) {
      return {
        transferCode: formatTransferCode(activeTransfer.code),
        expiresAt: activeTransfer.expiresAt,
        serverTime: now,
      };
    }
    let code = transferCode();
    while (this.deviceTransfers.has(code)) code = transferCode();
    const transfer: DeviceTransfer = {
      code,
      lobby,
      player,
      expiresAt: now + this.deviceTransferTtlMs,
    };
    this.deviceTransfers.set(code, transfer);
    this.transferCodesByPlayer.set(player.id, code);
    this.touch(lobby);
    return {
      transferCode: formatTransferCode(code),
      expiresAt: transfer.expiresAt,
      serverTime: now,
    };
  }
  claimDeviceTransfer(code: string, socketId: string) {
    const now = Date.now();
    const transfer = this.deviceTransfers.get(code);
    if (!transfer) throw new Error("invalid_transfer_code");
    if (transfer.expiresAt <= now) {
      this.removeDeviceTransfer(code);
      throw new Error("transfer_code_expired");
    }
    this.removeDeviceTransfer(code);
    const { lobby, player } = transfer;
    if (lobby.closed || !lobby.players.includes(player))
      throw new Error("invalid_transfer_code");

    const previousSocketIds = [...player.socketIds].filter(
      (id) => id !== socketId,
    );
    const wasConnected = player.connected;
    const offlineTimer = this.offlineTimers.get(player.id);
    if (offlineTimer) clearTimeout(offlineTimer);
    this.offlineTimers.delete(player.id);
    player.socketIds.clear();
    player.socketIds.add(socketId);
    player.connected = true;
    const gamePlayer = lobby.game?.players.find(
      (candidate) => candidate.id === player.id,
    );
    if (gamePlayer) gamePlayer.connected = true;
    const token = this.token();
    player.tokenHash = hashToken(token);
    this.touch(lobby);
    if (!wasConnected) this.hooks.changed(lobby);
    return { lobby, player, token, previousSocketIds };
  }
  async hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
    return {
      salt,
      hash: ((await scrypt(password, salt, 64)) as Buffer).toString("hex"),
    };
  }
  async passwordMatches(lobby: Lobby, password?: string) {
    if (!lobby.passwordHash || !lobby.passwordSalt) return true;
    if (!password) return false;
    const candidate = (await this.hashPassword(password, lobby.passwordSalt))
      .hash;
    return timingSafeEqual(
      Buffer.from(candidate, "hex"),
      Buffer.from(lobby.passwordHash, "hex"),
    );
  }
  async create(name: string, settings: CreateLobbySettings, socketId: string) {
    let code = safeCode();
    while (this.lobbies.has(code)) code = safeCode();
    const token = this.token();
    const id = randomUUID();
    const now = Date.now();
    const player: LobbyPlayer = {
      id: randomUUID(),
      name,
      tokenHash: hashToken(token),
      connected: true,
      socketIds: new Set([socketId]),
      joinedAt: now,
      isHost: true,
    };
    const gameId = settings.gameId ?? "durak";
    const deckSize =
      gameId === "durak" ? settings.deckSize : gameId === "romme" ? 52 : 32;
    const rommeRules = { ...defaultRommeRules, ...settings.rommeRules };
    const lobby: Lobby = {
      id,
      code,
      gameId,
      status: "waiting",
      visibility: settings.visibility,
      maxPlayers:
        gameId === "romme" && rommeRules.variant === "gin"
          ? 2
          : settings.maxPlayers,
      deckSize,
      mauMauRules: { ...defaultMauMauRules, ...settings.mauMauRules },
      rommeRules,
      hostId: player.id,
      players: [player],
      gameNumber: 0,
      activityAt: now,
      warningSent: false,
      sequence: 0,
      events: [],
      closed: false,
    };
    if (settings.password) {
      const result = await this.hashPassword(settings.password);
      lobby.passwordHash = result.hash;
      lobby.passwordSalt = result.salt;
    }
    this.event(lobby, "lobby.created", player.id);
    this.lobbies.set(code, lobby);
    this.hooks.listChanged();
    return { lobby, player, token };
  }
  async join(
    lobby: Lobby,
    name: string,
    password: string | undefined,
    socketId: string,
  ) {
    if (lobby.closed) throw new Error("lobby_closed");
    if (!(await this.passwordMatches(lobby, password)))
      throw new Error("wrong_password");
    // The lobby may have been closed while the asynchronous password hash was calculated.
    if (lobby.closed) throw new Error("lobby_closed");
    if (lobby.status !== "waiting") throw new Error("game_already_started");
    if (lobby.players.length >= lobby.maxPlayers) throw new Error("lobby_full");
    if (
      lobby.players.some(
        (p) =>
          p.name.localeCompare(name, undefined, { sensitivity: "accent" }) ===
          0,
      )
    )
      throw new Error("duplicate_name");
    const token = this.token();
    const player: LobbyPlayer = {
      id: randomUUID(),
      name,
      tokenHash: hashToken(token),
      connected: true,
      socketIds: new Set([socketId]),
      joinedAt: Date.now(),
      isHost: false,
    };
    lobby.players.push(player);
    this.touch(lobby);
    this.event(lobby, "player.joined", player.id, { name: player.name });
    this.hooks.changed(lobby);
    this.hooks.listChanged();
    return { player, token };
  }
  resume(lobby: Lobby, token: string, socketId: string) {
    const player = lobby.players.find((p) => p.tokenHash === hashToken(token));
    if (!player) throw new Error("invalid_session");
    this.activate(lobby, player, socketId);
    return player;
  }
  activate(lobby: Lobby, player: LobbyPlayer, socketId: string) {
    const timer = this.offlineTimers.get(player.id);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(player.id);
    }
    player.socketIds.add(socketId);
    if (player.connected) return;
    player.connected = true;
    const gamePlayer = lobby.game?.players.find(
      (candidate) => candidate.id === player.id,
    );
    if (gamePlayer) gamePlayer.connected = true;
    this.event(lobby, "player.reconnected", player.id, { name: player.name });
    this.hooks.changed(lobby);
  }
  private markDisconnected(lobby: Lobby, player: LobbyPlayer) {
    const timer = this.offlineTimers.get(player.id);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(player.id);
    }
    if (!player.connected || player.socketIds.size > 0) return;
    player.connected = false;
    const gamePlayer = lobby.game?.players.find(
      (candidate) => candidate.id === player.id,
    );
    if (gamePlayer) gamePlayer.connected = false;
    this.event(lobby, "player.disconnected", player.id, { name: player.name });
    this.hooks.changed(lobby);
  }
  disconnect(socketId: string) {
    for (const lobby of this.lobbies.values()) {
      const player = lobby.players.find((candidate) =>
        candidate.socketIds.has(socketId),
      );
      if (!player) continue;
      player.socketIds.delete(socketId);
      if (player.socketIds.size > 0 || !player.connected) continue;
      if (this.disconnectGraceMs <= 0) {
        this.markDisconnected(lobby, player);
        continue;
      }
      const existingTimer = this.offlineTimers.get(player.id);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        this.offlineTimers.delete(player.id);
        if (
          !lobby.closed &&
          lobby.players.includes(player) &&
          player.socketIds.size === 0
        ) {
          this.markDisconnected(lobby, player);
        }
      }, this.disconnectGraceMs);
      timer.unref();
      this.offlineTimers.set(player.id, timer);
    }
  }
  start(lobby: Lobby, playerId: string) {
    if (lobby.hostId !== playerId) throw new Error("host_only");
    if (lobby.status !== "waiting") throw new Error("game_already_started");
    if (lobby.players.filter((p) => p.connected).length < 2)
      throw new Error("not_enough_players");
    if (lobby.players.some((p) => !p.connected))
      throw new Error("player_offline");
    if (
      lobby.gameId === "romme" &&
      lobby.rommeRules.variant === "gin" &&
      lobby.players.length !== 2
    )
      throw new Error("gin_requires_two_players");
    lobby.gameNumber += 1;
    lobby.game = createGame({
      gameId: lobby.gameId,
      id: `${lobby.id}:${lobby.gameNumber}`,
      players: lobby.players,
      deckSize: lobby.deckSize,
      mauMauRules: lobby.mauMauRules,
      rommeRules: lobby.rommeRules,
    });
    lobby.status = "playing";
    this.touch(lobby);
    this.event(lobby, "game.started", playerId, {
      gameNumber: lobby.gameNumber,
    });
    this.hooks.changed(lobby);
    this.hooks.listChanged();
  }
  async update(
    lobby: Lobby,
    playerId: string,
    settings: {
      maxPlayers?: number | undefined;
      deckSize?: 36 | 52 | undefined;
      visibility?: "public" | "private" | undefined;
      password?: string | undefined;
      mauMauRules?: MauMauRules | undefined;
      rommeRules?: RommeRules | undefined;
    },
  ) {
    if (lobby.hostId !== playerId) throw new Error("host_only");
    if (lobby.status !== "waiting") throw new Error("game_already_started");
    if (
      settings.rommeRules?.variant === "gin" &&
      lobby.gameId === "romme" &&
      lobby.players.length > 2
    )
      throw new Error("gin_requires_two_players");
    if (settings.maxPlayers !== undefined) {
      if (settings.maxPlayers < lobby.players.length)
        throw new Error("player_limit_too_low");
      lobby.maxPlayers = settings.maxPlayers;
    }
    if (settings.deckSize !== undefined && lobby.gameId === "durak")
      lobby.deckSize = settings.deckSize;
    if (settings.visibility !== undefined)
      lobby.visibility = settings.visibility;
    if (settings.mauMauRules !== undefined && lobby.gameId === "mau-mau")
      lobby.mauMauRules = { ...settings.mauMauRules };
    if (settings.rommeRules !== undefined && lobby.gameId === "romme") {
      lobby.rommeRules = { ...defaultRommeRules, ...settings.rommeRules };
      if (lobby.rommeRules.variant === "gin") lobby.maxPlayers = 2;
    }
    if (settings.password !== undefined) {
      if (settings.password) {
        const result = await this.hashPassword(settings.password);
        lobby.passwordHash = result.hash;
        lobby.passwordSalt = result.salt;
      } else {
        delete lobby.passwordHash;
        delete lobby.passwordSalt;
      }
    }
    this.touch(lobby);
    this.event(lobby, "lobby.settings_changed", playerId);
    this.hooks.changed(lobby);
    this.hooks.listChanged();
  }
  restart(lobby: Lobby, playerId: string) {
    if (lobby.hostId !== playerId) throw new Error("host_only");
    lobby.status = "waiting";
    delete lobby.game;
    this.start(lobby, playerId);
    this.event(lobby, "game.restarted", playerId);
  }
  action(
    lobby: Lobby,
    playerId: string,
    action: GameAction,
    expectedVersion?: number,
  ) {
    if (!lobby.game) throw new Error("game_not_started");
    if (expectedVersion !== undefined && expectedVersion !== lobby.game.version)
      throw new Error("stale_action");
    const handsBefore = new Map(
      lobby.game.players.map((player) => [
        player.id,
        new Set(player.hand.map((card) => card.id)),
      ]),
    );
    const knackCenterBefore =
      lobby.gameId === "schwimmen"
        ? (lobby.game as KnackState).center.map((card) => card.id)
        : [];
    const tableCardsBefore =
      lobby.gameId === "durak"
        ? new Set(
            (lobby.game as DurakState).table.flatMap((pair) =>
              pair.defense
                ? [pair.attack.id, pair.defense.id]
                : [pair.attack.id],
            ),
          )
        : new Set<string>();
    lobby.game = applyGameAction(lobby.gameId, lobby.game, playerId, action);
    this.touch(lobby);
    const data = gameActionEventData(
      action,
      handsBefore.get(playerId) ?? new Set(),
      knackCenterBefore,
    );
    this.event(lobby, `game.${action.type.replace(":", ".")}`, playerId, data);
    if (recordsPrivateDraws(lobby.gameId, action))
      for (const player of lobby.game.players) {
        const cardIds =
          action.type === "schwimmen:next-round" ||
          action.type === "romme:next-round"
            ? player.hand.map((card) => card.id)
            : player.hand
                .filter(
                  (card) =>
                    !handsBefore.get(player.id)?.has(card.id) &&
                    !tableCardsBefore.has(card.id),
                )
                .map((card) => card.id);
        if (cardIds.length)
          this.event(
            lobby,
            "game.cards.drawn",
            player.id,
            { cardIds },
            "private",
            player.id,
          );
      }
    this.hooks.changed(lobby);
  }
  detach(lobby: Lobby, playerId: string, socketId?: string) {
    if (lobby.hostId === playerId) throw new Error("host_must_close");
    const player = lobby.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error("not_in_lobby");
    if (socketId) player.socketIds.delete(socketId);
    else player.socketIds.clear();
    if (player.socketIds.size === 0) this.markDisconnected(lobby, player);
  }
  leave(lobby: Lobby, playerId: string) {
    if (lobby.hostId === playerId) throw new Error("host_must_close");
    const playerName =
      lobby.players.find((player) => player.id === playerId)?.name ?? "";
    if (!playerName) throw new Error("not_in_lobby");
    this.cancelDeviceTransfer(playerId);
    const offlineTimer = this.offlineTimers.get(playerId);
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      this.offlineTimers.delete(playerId);
    }
    let gameEffect = "none";
    if (lobby.game) {
      const remainingPlayerCount = lobby.players.length - 1;
      const continuedGame =
        lobby.status === "playing" && remainingPlayerCount >= 2
          ? withdrawPlayer(lobby.gameId, lobby.game, playerId)
          : undefined;
      if (continuedGame) {
        lobby.game = continuedGame;
        gameEffect =
          lobby.game.phase === "finished" ? "game_ended" : "continued";
      } else {
        delete lobby.game;
        lobby.status = "waiting";
        gameEffect = "round_cancelled";
      }
    }
    lobby.players = lobby.players.filter((p) => p.id !== playerId);
    this.touch(lobby);
    this.event(lobby, "player.left", playerId, {
      name: playerName,
      gameEffect,
    });
    this.hooks.changed(lobby);
    this.hooks.listChanged();
  }
  keepAlive(lobby: Lobby, playerId: string) {
    this.touch(lobby);
    this.event(lobby, "lobby.kept_alive", playerId);
    this.hooks.changed(lobby);
  }
  close(lobby: Lobby, reason: string) {
    if (lobby.closed) return;
    lobby.closed = true;
    for (const player of lobby.players) {
      this.cancelDeviceTransfer(player.id);
      const timer = this.offlineTimers.get(player.id);
      if (timer) clearTimeout(timer);
      this.offlineTimers.delete(player.id);
    }
    this.event(lobby, "lobby.closed", undefined, { reason });
    this.hooks.closed(lobby, reason);
    this.lobbies.delete(lobby.code);
    this.hooks.listChanged();
  }
  cleanup(now = Date.now()) {
    this.removeExpiredDeviceTransfers(now);
    for (const lobby of this.lobbies.values()) {
      const remaining = lobby.activityAt + this.idleMs - now;
      if (remaining <= 0) this.close(lobby, "inactive");
      else if (remaining <= this.warningMs && !lobby.warningSent) {
        lobby.warningSent = true;
        this.hooks.warning(lobby, lobby.activityAt + this.idleMs);
      }
    }
  }
}
