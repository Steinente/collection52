import { describe, expect, it, vi } from 'vitest';
import { LobbyManager } from './lobby-manager.js';

const hooks = () => ({ changed: vi.fn(), event: vi.fn(), closed: vi.fn(), warning: vi.fn(), listChanged: vi.fn() });
describe('LobbyManager', () => {
  it('creates secure sessions, hides private lobbies, and rejects duplicate names', async () => { const h = hooks(); const manager = new LobbyManager(h); const made = await manager.create('Anna', { maxPlayers: 4, deckSize: 36, visibility: 'private' }, 's1'); expect(made.token.length).toBeGreaterThan(30); expect(manager.list()).toHaveLength(0); await expect(manager.join(made.lobby, 'anna', undefined, 's2')).rejects.toThrow('duplicate_name'); manager.stop(); });
  it('checks passwords without storing plaintext', async () => { const manager = new LobbyManager(hooks()); const made = await manager.create('Anna', { maxPlayers: 4, deckSize: 36, visibility: 'public', password: 'secret' }, 's1'); expect(made.lobby.passwordHash).not.toBe('secret'); expect(manager.list()[0]?.hostName).toBe('Anna'); await expect(manager.join(made.lobby, 'Ben', 'bad', 's2')).rejects.toThrow('wrong_password'); expect((await manager.join(made.lobby, 'Ben', 'secret', 's2')).player.name).toBe('Ben'); manager.stop(); });
  it('never transfers host and closes inactive lobbies', async () => { const h = hooks(); const manager = new LobbyManager(h, 100, 20); const made = await manager.create('Anna', { maxPlayers: 4, deckSize: 36, visibility: 'public' }, 's1'); const joined = await manager.join(made.lobby, 'Ben', undefined, 's2'); manager.leave(made.lobby, joined.player.id); expect(made.lobby.hostId).toBe(made.player.id); manager.cleanup(made.lobby.activityAt + 101); expect(manager.find(made.lobby.code)).toBeUndefined(); expect(h.closed).toHaveBeenCalled(); manager.stop(); });
  it('allows only the host to update waiting-lobby settings', async () => { const manager = new LobbyManager(hooks()); const made = await manager.create('Anna', { maxPlayers: 4, deckSize: 36, visibility: 'public' }, 's1'); const joined = await manager.join(made.lobby, 'Ben', undefined, 's2'); await expect(manager.update(made.lobby, joined.player.id, { deckSize: 52 })).rejects.toThrow('host_only'); await manager.update(made.lobby, made.player.id, { deckSize: 52, visibility: 'private' }); expect(made.lobby.deckSize).toBe(52); expect(manager.list()).toHaveLength(0); manager.stop(); });
  it('does not emit another reconnect event for the already active socket', async () => {
    const h = hooks();
    const manager = new LobbyManager(h);
    const made = await manager.create('Anna', { maxPlayers: 4, deckSize: 36, visibility: 'public' }, 's1');
    const changedCalls = h.changed.mock.calls.length;
    const eventCalls = h.event.mock.calls.length;

    manager.resume(made.lobby, made.token, 's1');

    expect(h.changed).toHaveBeenCalledTimes(changedCalls);
    expect(h.event).toHaveBeenCalledTimes(eventCalls);
    manager.stop();
  });
  it('creates, starts, and privately projects a Knack game', async () => {
    const manager = new LobbyManager(hooks());
    const made = await manager.create('Anna', { gameId: 'schwimmen', maxPlayers: 4, deckSize: 32, visibility: 'public' }, 's1');
    const joined = await manager.join(made.lobby, 'Ben', undefined, 's2');
    manager.start(made.lobby, made.player.id);
    expect(made.lobby.gameId).toBe('schwimmen'); expect(made.lobby.deckSize).toBe(32); expect(manager.summary(made.lobby).gameId).toBe('schwimmen');
    const hostView = manager.view(made.lobby, made.player.id).game as { players: Array<{ id: string; hand: unknown[]; handCount?: number }>; center: unknown[] };
    expect(hostView.center).toHaveLength(3); expect(hostView.players.find((player) => player.id === made.player.id)?.hand).toHaveLength(3);
    expect(hostView.players.find((player) => player.id === joined.player.id)?.hand).toHaveLength(0); expect(hostView.players.find((player) => player.id === joined.player.id)?.handCount).toBe(3);
    manager.close(made.lobby, 'test_finished'); manager.stop();
  });
});
