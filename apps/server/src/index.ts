import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { actionSchema, lobbyCodeSchema, lobbySettingsSchema, lobbyUpdateSchema, usernameSchema, type ClientToServerEvents, type ServerToClientEvents } from '@collection52/shared';
import { LobbyManager, type Lobby, type LobbyPlayer } from './lobby-manager.js';
import { SlidingRateLimit } from './rate-limit.js';

const app = express();
const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((x) => x.trim());
app.use(helmet({ contentSecurityPolicy: false })); app.use(cors({ origin: origins })); app.use(express.json({ limit: '16kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
const clientDist = fileURLToPath(new URL('../public', import.meta.url));
if (existsSync(clientDist)) { app.use(express.static(clientDist)); app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: clientDist })); }
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, { cors: { origin: origins }, maxHttpBufferSize: 32_000 });
const rateLimitsEnabled = process.env.NODE_ENV === 'production' && process.env.DISABLE_RATE_LIMITS !== 'true';
const createLimit = new SlidingRateLimit(10, 60 * 60_000); const joinLimit = new SlidingRateLimit(30, 10 * 60_000);
const sessions = new Map<string, { lobby: Lobby; player: LobbyPlayer }>();

const broadcastList = () => io.emit('lobby:list', manager.list());
const broadcastLobby = (lobby: Lobby) => { for (const p of lobby.players) if (p.socketId) io.to(p.socketId).emit('lobby:state', manager.view(lobby, p.id)); };
const manager = new LobbyManager({ changed: broadcastLobby, event: (lobby, event) => io.to(lobby.code).emit('game:event', event), listChanged: broadcastList, closed: (lobby, reason) => io.to(lobby.code).emit('lobby:closed', { reason }), warning: (lobby, closesAt) => io.to(lobby.code).emit('lobby:warning', { closesAt }) }, Number(process.env.LOBBY_IDLE_MINUTES ?? 30) * 60_000, Number(process.env.LOBBY_WARNING_MINUTES ?? 5) * 60_000);
const fail = (error: unknown) => ({ ok: false, error: error instanceof z.ZodError ? 'invalid_input' : error instanceof Error ? error.message : 'unknown_error' });
const session = (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => { const s = sessions.get(socket.id); if (!s) throw new Error('not_in_lobby'); if (s.player.socketId !== socket.id) throw new Error('stale_connection'); return s; };
const attach = (socket: Socket<ClientToServerEvents, ServerToClientEvents>, lobby: Lobby, player: LobbyPlayer) => { sessions.set(socket.id, { lobby, player }); socket.join(lobby.code); };

io.on('connection', (socket) => {
  socket.on('lobby:list', (ack) => ack(manager.list()));
  socket.on('lobby:inspect', (raw, ack) => { try { const data = z.object({ code: lobbyCodeSchema }).parse(raw); const lobby = manager.find(data.code); if (!lobby) throw new Error('lobby_not_found'); ack({ ok: true, passwordProtected: Boolean(lobby.passwordHash), joinable: lobby.status === 'waiting' && lobby.players.length < lobby.maxPlayers }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:create', async (raw, ack) => { try {
    if (rateLimitsEnabled && !createLimit.allow(socket.handshake.address)) throw new Error('rate_limited');
    const data = z.object({ name: usernameSchema, settings: lobbySettingsSchema }).parse(raw); const settings = { gameId: data.settings.gameId, maxPlayers: data.settings.maxPlayers, deckSize: data.settings.deckSize, visibility: data.settings.visibility, ...(data.settings.mauMauRules ? { mauMauRules: data.settings.mauMauRules } : {}), ...(data.settings.password ? { password: data.settings.password } : {}) }; const made = await manager.create(data.name, settings, socket.id); attach(socket, made.lobby, made.player); socket.emit('lobby:state', manager.view(made.lobby, made.player.id)); ack({ ok: true, code: made.lobby.code, token: made.token, playerId: made.player.id });
  } catch (e) { ack(fail(e)); } });
  socket.on('lobby:join', async (raw, ack) => { try {
    if (rateLimitsEnabled && !joinLimit.allow(socket.handshake.address)) throw new Error('rate_limited');
    const data = z.object({ code: lobbyCodeSchema, name: usernameSchema, password: z.string().max(72).optional() }).parse(raw); const lobby = manager.find(data.code); if (!lobby) throw new Error('lobby_not_found'); const joined = await manager.join(lobby, data.name, data.password, socket.id); attach(socket, lobby, joined.player); socket.emit('lobby:state', manager.view(lobby, joined.player.id)); ack({ ok: true, code: lobby.code, token: joined.token, playerId: joined.player.id });
  } catch (e) { ack(fail(e)); } });
  socket.on('lobby:resume', (raw, ack) => { try { const data = z.object({ code: lobbyCodeSchema, token: z.string().min(20) }).parse(raw); const lobby = manager.find(data.code); if (!lobby) throw new Error('lobby_not_found'); const player = manager.resume(lobby, data.token, socket.id); attach(socket, lobby, player); socket.emit('lobby:state', manager.view(lobby, player.id)); ack({ ok: true, playerId: player.id }); } catch (e) { ack(fail(e)); } });
  socket.on('game:start', (ack) => { try { const s = session(socket); manager.start(s.lobby, s.player.id); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('game:restart', (ack) => { try { const s = session(socket); manager.restart(s.lobby, s.player.id); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('game:action', (raw, ack) => { try { const data = z.object({ action: actionSchema, expectedVersion: z.number().int().optional() }).parse(raw); const s = session(socket); manager.action(s.lobby, s.player.id, data.action, data.expectedVersion); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:detach', (ack) => { try { const s = session(socket); manager.detach(s.lobby, s.player.id); sessions.delete(socket.id); socket.leave(s.lobby.code); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:leave', (raw, ack) => { try { const data = z.object({ code: lobbyCodeSchema, token: z.string().min(20) }).parse(raw); const lobby = manager.find(data.code); if (!lobby) throw new Error('lobby_not_found'); const player = manager.playerForToken(lobby, data.token); if (!player) throw new Error('invalid_session'); manager.leave(lobby, player.id); if (player.socketId) { sessions.delete(player.socketId); io.sockets.sockets.get(player.socketId)?.leave(lobby.code); } ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:update', async (raw, ack) => { try { const data = lobbyUpdateSchema.parse(raw); const s = session(socket); await manager.update(s.lobby, s.player.id, data); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:close', (ack) => { try { const s = session(socket); if (!s.player.isHost) throw new Error('host_only'); manager.close(s.lobby, 'host_closed'); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('lobby:keepalive', (ack) => { try { const s = session(socket); manager.keepAlive(s.lobby, s.player.id); ack({ ok: true }); } catch (e) { ack(fail(e)); } });
  socket.on('disconnect', () => { manager.disconnect(socket.id); sessions.delete(socket.id); });
});

const port = Number(process.env.PORT ?? 3001); server.listen(port, () => console.log(`Collection52 server listening on ${port}`));
const shutdown = () => { manager.stop(); io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000).unref(); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
