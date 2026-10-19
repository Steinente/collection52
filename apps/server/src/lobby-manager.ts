import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { applyDurakAction, applyKnackAction, applyMauMauAction, applyRommeAction, createDurakGame, createKnackGame, createMauMauGame, createRommeGame, defaultMauMauRules, defaultRommeRules, knackPlayerView, mauMauPlayerView, rommePlayerView, playerView as durakPlayerView, withdrawDurakPlayer, withdrawKnackPlayer, withdrawRommePlayer, type DurakState, type GameAction, type GameId, type KnackState, type LobbySummary, type MauMauRules, type MauMauState, type PublicLobby, type RommeRules, type RommeState, type StructuredEvent } from '@collection52/shared';

const scrypt = promisify(scryptCallback);
export type LobbyPlayer = { id: string; name: string; tokenHash: string; connected: boolean; socketId?: string; joinedAt: number; isHost: boolean };
export type Lobby = {
  id: string; code: string; gameId: GameId; status: 'waiting' | 'playing'; visibility: 'public' | 'private'; maxPlayers: number; deckSize: 32 | 36 | 52;
  mauMauRules: MauMauRules; rommeRules: RommeRules;
  passwordHash?: string; passwordSalt?: string; hostId: string; players: LobbyPlayer[]; game?: DurakState | KnackState | MauMauState | RommeState; gameNumber: number;
  activityAt: number; warningSent: boolean; sequence: number; events: StructuredEvent[]; closed: boolean;
};

export type ManagerHooks = { changed: (lobby: Lobby) => void; event: (lobby: Lobby, event: StructuredEvent) => void; closed: (lobby: Lobby, reason: string) => void; warning: (lobby: Lobby, closesAt: number) => void; listChanged: () => void };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const safeCode = () => randomBytes(8).toString('base64url').toUpperCase().replace(/[01ILO_-]/g, 'X').slice(0, 8);

export class LobbyManager {
  readonly lobbies = new Map<string, Lobby>();
  private cleanupTimer?: NodeJS.Timeout;
  constructor(private hooks: ManagerHooks, private idleMs = 30 * 60_000, private warningMs = 5 * 60_000) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000); this.cleanupTimer.unref();
  }
  stop() { if (this.cleanupTimer) clearInterval(this.cleanupTimer); }
  private token() { return randomBytes(32).toString('base64url'); }
  private event(lobby: Lobby, type: string, actorId?: string, data: StructuredEvent['data'] = {}, visibility: StructuredEvent['visibility'] = 'public', recipientId?: string): StructuredEvent {
    const event: StructuredEvent = { id: randomUUID(), sequence: ++lobby.sequence, timestamp: Date.now(), type, ...(actorId ? { actorId } : {}), ...(recipientId ? { recipientId } : {}), data, visibility };
    lobby.events.push(event); if (lobby.events.length > 200) lobby.events.shift(); this.hooks.event(lobby, event); return event;
  }
  private touch(lobby: Lobby) { lobby.activityAt = Date.now(); lobby.warningSent = false; }
  list(): LobbySummary[] { return [...this.lobbies.values()].filter((l) => !l.closed && l.visibility === 'public').map((l) => this.summary(l)); }
  summary(l: Lobby): LobbySummary { return { code: l.code, gameId: l.gameId, status: l.status, playerCount: l.players.length, maxPlayers: l.maxPlayers, visibility: l.visibility, passwordProtected: Boolean(l.passwordHash), joinable: l.status === 'waiting' && l.players.length < l.maxPlayers, hostName: l.players.find((player) => player.id === l.hostId)?.name ?? '' }; }
  view(lobby: Lobby, playerId: string): PublicLobby {
    const game = lobby.game ? (lobby.gameId === 'schwimmen' ? knackPlayerView(lobby.game as KnackState, playerId) : lobby.gameId === 'mau-mau' ? mauMauPlayerView(lobby.game as MauMauState, playerId) : lobby.gameId === 'romme' ? rommePlayerView(lobby.game as RommeState, playerId) : durakPlayerView(lobby.game as DurakState, playerId)) : undefined;
    return { ...this.summary(lobby), players: lobby.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, isHost: p.isHost })), deckSize: lobby.deckSize, hostId: lobby.hostId, inactivityDeadline: lobby.activityAt + this.idleMs, ...(lobby.gameId === 'mau-mau' ? { mauMauRules: lobby.mauMauRules } : {}), ...(lobby.gameId === 'romme' ? { rommeRules: lobby.rommeRules } : {}), events: lobby.events.filter((event) => event.visibility === 'public' || event.recipientId === playerId), ...(game ? { game } : {}) };
  }
  find(code: string) { return this.lobbies.get(code.toUpperCase()); }
  playerForToken(lobby: Lobby, token: string) { return lobby.players.find((player) => player.tokenHash === hashToken(token)); }
  async hashPassword(password: string, salt = randomBytes(16).toString('hex')) { return { salt, hash: (await scrypt(password, salt, 64) as Buffer).toString('hex') }; }
  async passwordMatches(lobby: Lobby, password?: string) {
    if (!lobby.passwordHash || !lobby.passwordSalt) return true;
    if (!password) return false;
    const candidate = (await this.hashPassword(password, lobby.passwordSalt)).hash;
    return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(lobby.passwordHash, 'hex'));
  }
  async create(name: string, settings: { gameId?: GameId; maxPlayers: number; deckSize: 32 | 36 | 52; visibility: 'public' | 'private'; password?: string; mauMauRules?: MauMauRules; rommeRules?: RommeRules }, socketId: string) {
    let code = safeCode(); while (this.lobbies.has(code)) code = safeCode();
    const token = this.token(); const id = randomUUID(); const now = Date.now();
    const player: LobbyPlayer = { id: randomUUID(), name, tokenHash: hashToken(token), connected: true, socketId, joinedAt: now, isHost: true };
    const gameId = settings.gameId ?? 'durak'; const deckSize = gameId === 'durak' ? settings.deckSize : gameId === 'romme' ? 52 : 32;
    const lobby: Lobby = { id, code, gameId, status: 'waiting', visibility: settings.visibility, maxPlayers: settings.maxPlayers, deckSize, mauMauRules: { ...defaultMauMauRules, ...settings.mauMauRules }, rommeRules: { ...defaultRommeRules, ...settings.rommeRules }, hostId: player.id, players: [player], gameNumber: 0, activityAt: now, warningSent: false, sequence: 0, events: [], closed: false };
    if (settings.password) { const result = await this.hashPassword(settings.password); lobby.passwordHash = result.hash; lobby.passwordSalt = result.salt; }
    this.event(lobby, 'lobby.created', player.id); this.lobbies.set(code, lobby); this.hooks.listChanged();
    return { lobby, player, token };
  }
  async join(lobby: Lobby, name: string, password: string | undefined, socketId: string) {
    if (lobby.closed) throw new Error('lobby_closed');
    if (!await this.passwordMatches(lobby, password)) throw new Error('wrong_password');
    if (lobby.closed) throw new Error('lobby_closed');
    if (lobby.status !== 'waiting') throw new Error('game_already_started');
    if (lobby.players.length >= lobby.maxPlayers) throw new Error('lobby_full');
    if (lobby.players.some((p) => p.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('duplicate_name');
    const token = this.token(); const player: LobbyPlayer = { id: randomUUID(), name, tokenHash: hashToken(token), connected: true, socketId, joinedAt: Date.now(), isHost: false };
    lobby.players.push(player); this.touch(lobby); this.event(lobby, 'player.joined', player.id, { name: player.name }); this.hooks.changed(lobby); this.hooks.listChanged();
    return { player, token };
  }
  resume(lobby: Lobby, token: string, socketId: string) {
    const player = lobby.players.find((p) => p.tokenHash === hashToken(token)); if (!player) throw new Error('invalid_session');
    if (player.connected && player.socketId === socketId) return player;
    player.connected = true; player.socketId = socketId;
    if (lobby.game) lobby.game.players.find((p) => p.id === player.id)!.connected = true;
    this.event(lobby, 'player.reconnected', player.id, { name: player.name }); this.hooks.changed(lobby); return player;
  }
  disconnect(socketId: string) {
    for (const lobby of this.lobbies.values()) { const p = lobby.players.find((x) => x.socketId === socketId); if (!p) continue; p.connected = false; delete p.socketId; if (lobby.game) lobby.game.players.find((x) => x.id === p.id)!.connected = false; this.event(lobby, 'player.disconnected', p.id, { name: p.name }); this.hooks.changed(lobby); }
  }
  start(lobby: Lobby, playerId: string) {
    if (lobby.hostId !== playerId) throw new Error('host_only'); if (lobby.status !== 'waiting') throw new Error('game_already_started');
    if (lobby.players.filter((p) => p.connected).length < 2) throw new Error('not_enough_players'); if (lobby.players.some((p) => !p.connected)) throw new Error('player_offline');
    lobby.gameNumber += 1; lobby.game = lobby.gameId === 'schwimmen'
      ? createKnackGame(`${lobby.id}:${lobby.gameNumber}`, lobby.players, randomInt)
      : lobby.gameId === 'mau-mau'
        ? createMauMauGame(`${lobby.id}:${lobby.gameNumber}`, lobby.players, randomInt, lobby.mauMauRules)
        : lobby.gameId === 'romme'
          ? createRommeGame(`${lobby.id}:${lobby.gameNumber}`, lobby.players, randomInt, lobby.rommeRules)
        : createDurakGame(`${lobby.id}:${lobby.gameNumber}`, lobby.players, lobby.deckSize as 36 | 52, randomInt); lobby.status = 'playing';
    this.touch(lobby); this.event(lobby, 'game.started', playerId, { gameNumber: lobby.gameNumber }); this.hooks.changed(lobby); this.hooks.listChanged();
  }
  async update(lobby: Lobby, playerId: string, settings: { maxPlayers?: number | undefined; deckSize?: 36 | 52 | undefined; visibility?: 'public' | 'private' | undefined; password?: string | undefined; mauMauRules?: MauMauRules | undefined; rommeRules?: RommeRules | undefined }) {
    if (lobby.hostId !== playerId) throw new Error('host_only'); if (lobby.status !== 'waiting') throw new Error('game_already_started');
    if (settings.maxPlayers !== undefined) { if (settings.maxPlayers < lobby.players.length) throw new Error('player_limit_too_low'); lobby.maxPlayers = settings.maxPlayers; }
    if (settings.deckSize !== undefined && lobby.gameId === 'durak') lobby.deckSize = settings.deckSize; if (settings.visibility !== undefined) lobby.visibility = settings.visibility;
    if (settings.mauMauRules !== undefined && lobby.gameId === 'mau-mau') lobby.mauMauRules = { ...settings.mauMauRules };
    if (settings.rommeRules !== undefined && lobby.gameId === 'romme') lobby.rommeRules = { ...settings.rommeRules };
    if (settings.password !== undefined) {
      if (settings.password) { const result = await this.hashPassword(settings.password); lobby.passwordHash = result.hash; lobby.passwordSalt = result.salt; }
      else { delete lobby.passwordHash; delete lobby.passwordSalt; }
    }
    this.touch(lobby); this.event(lobby, 'lobby.settings_changed', playerId); this.hooks.changed(lobby); this.hooks.listChanged();
  }
  restart(lobby: Lobby, playerId: string) {
    if (lobby.hostId !== playerId) throw new Error('host_only');
    lobby.status = 'waiting'; delete lobby.game; this.start(lobby, playerId); this.event(lobby, 'game.restarted', playerId);
  }
  action(lobby: Lobby, playerId: string, action: GameAction, expectedVersion?: number) {
    if (!lobby.game) throw new Error('game_not_started'); if (expectedVersion !== undefined && expectedVersion !== lobby.game.version) throw new Error('stale_action');
    const handsBefore = new Map(lobby.game.players.map((player) => [player.id, new Set(player.hand.map((card) => card.id))]));
    const tableCardsBefore = lobby.gameId === 'durak' ? new Set((lobby.game as DurakState).table.flatMap((pair) => pair.defense ? [pair.attack.id, pair.defense.id] : [pair.attack.id])) : new Set<string>();
    if (lobby.gameId === 'schwimmen') {
      if (!action.type.startsWith('schwimmen:')) throw new Error('invalid_action');
      lobby.game = applyKnackAction(lobby.game as KnackState, playerId, action as import('@collection52/shared').KnackAction, randomInt);
    } else if (lobby.gameId === 'mau-mau') {
      if (!action.type.startsWith('mau-mau:')) throw new Error('invalid_action');
      lobby.game = applyMauMauAction(lobby.game as MauMauState, playerId, action as import('@collection52/shared').MauMauAction, randomInt);
    } else if (lobby.gameId === 'romme') {
      if (!action.type.startsWith('romme:')) throw new Error('invalid_action');
      lobby.game = applyRommeAction(lobby.game as RommeState, playerId, action as import('@collection52/shared').RommeAction, randomInt);
    } else {
      if (action.type.includes(':')) throw new Error('invalid_action');
      lobby.game = applyDurakAction(lobby.game as DurakState, playerId, action as import('@collection52/shared').DurakAction);
    }
    this.touch(lobby);
    const data = action.type === 'attack' ? { cardIds: action.cardIds }
      : action.type === 'defend' ? { cardId: action.cardId, attackCardId: action.attackCardId }
      : action.type === 'schwimmen:swap-one' ? { handCardId: action.handCardId, centerCardId: action.centerCardId }
      : action.type === 'mau-mau:play' ? { cardId: action.cardId, ...(action.chosenSuit ? { chosenSuit: action.chosenSuit } : {}) }
      : action.type === 'romme:draw' ? { source: action.source }
      : action.type === 'romme:meld' ? { groupCount: action.groups.length, cardIds: action.groups.flatMap((group) => group.cardIds) }
      : action.type === 'romme:lay-off' ? { meldId: action.meldId, cardIds: action.cardIds }
      : action.type === 'romme:replace-joker' ? { meldId: action.meldId, jokerId: action.jokerId, cardIds: action.cardIds }
      : action.type === 'romme:discard' ? { cardId: action.cardId }
      : {};
    this.event(lobby, `game.${action.type.replace(':', '.')}`, playerId, data);
    const recordsPrivateDraws = lobby.gameId === 'durak' || action.type === 'mau-mau:draw' || action.type === 'romme:draw' || action.type === 'schwimmen:next-round';
    if (recordsPrivateDraws) for (const player of lobby.game.players) {
      const cardIds = action.type === 'schwimmen:next-round'
        ? player.hand.map((card) => card.id)
        : player.hand.filter((card) => !handsBefore.get(player.id)?.has(card.id) && !tableCardsBefore.has(card.id)).map((card) => card.id);
      if (cardIds.length) this.event(lobby, 'game.cards.drawn', player.id, { cardIds }, 'private', player.id);
    }
    this.hooks.changed(lobby);
  }
  detach(lobby: Lobby, playerId: string) {
    if (lobby.hostId === playerId) throw new Error('host_must_close');
    const player = lobby.players.find((candidate) => candidate.id === playerId); if (!player) throw new Error('not_in_lobby');
    player.connected = false; delete player.socketId;
    if (lobby.game) lobby.game.players.find((candidate) => candidate.id === player.id)!.connected = false;
    this.event(lobby, 'player.disconnected', player.id, { name: player.name }); this.hooks.changed(lobby);
  }
  leave(lobby: Lobby, playerId: string) {
    if (lobby.hostId === playerId) throw new Error('host_must_close');
    const playerName = lobby.players.find((player) => player.id === playerId)?.name ?? '';
    if (!playerName) throw new Error('not_in_lobby');
    let gameEffect = 'none';
    if (lobby.game) {
      const remainingPlayerCount = lobby.players.length - 1;
      if (lobby.status === 'playing' && remainingPlayerCount >= 2 && lobby.gameId === 'durak') { lobby.game = withdrawDurakPlayer(lobby.game as DurakState, playerId); gameEffect = lobby.game.phase === 'finished' ? 'game_ended' : 'continued'; }
      else if (lobby.status === 'playing' && remainingPlayerCount >= 2 && lobby.gameId === 'schwimmen') { lobby.game = withdrawKnackPlayer(lobby.game as KnackState, playerId); gameEffect = lobby.game.phase === 'finished' ? 'game_ended' : 'continued'; }
      else if (lobby.status === 'playing' && remainingPlayerCount >= 2 && lobby.gameId === 'romme') { lobby.game = withdrawRommePlayer(lobby.game as RommeState, playerId); gameEffect = lobby.game.phase === 'finished' ? 'game_ended' : 'continued'; }
      else { delete lobby.game; lobby.status = 'waiting'; gameEffect = 'round_cancelled'; }
    }
    lobby.players = lobby.players.filter((p) => p.id !== playerId);
    this.touch(lobby);
    this.event(lobby, 'player.left', playerId, { name: playerName, gameEffect });
    this.hooks.changed(lobby);
    this.hooks.listChanged();
  }
  keepAlive(lobby: Lobby, playerId: string) { this.touch(lobby); this.event(lobby, 'lobby.kept_alive', playerId); this.hooks.changed(lobby); }
  close(lobby: Lobby, reason: string) { if (lobby.closed) return; lobby.closed = true; this.event(lobby, 'lobby.closed', undefined, { reason }); this.hooks.closed(lobby, reason); this.lobbies.delete(lobby.code); this.hooks.listChanged(); }
  cleanup(now = Date.now()) { for (const lobby of this.lobbies.values()) { const remaining = lobby.activityAt + this.idleMs - now; if (remaining <= 0) this.close(lobby, 'inactive'); else if (remaining <= this.warningMs && !lobby.warningSent) { lobby.warningSent = true; this.hooks.warning(lobby, lobby.activityAt + this.idleMs); } } }
}
