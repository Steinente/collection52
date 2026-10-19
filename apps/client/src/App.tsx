import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { io, type Socket } from 'socket.io-client';
import { beats, canPlayMauMauCard, detectRommeMeld, isPotentialRommeMeld, isValidRommeMeld, rankValue, scoreKnackHand, type Card, type ClientToServerEvents, type DurakPhase, type GameId, type KnackPhase, type KnackRoundResult, type LobbySummary, type MauMauPhase, type MauMauRules, type PublicLobby, type RommeCard, type RommeRules, type ServerToClientEvents, type StructuredEvent, type Suit, type TablePair } from '@collection52/shared';
import type { LegalPageKind } from './LegalPages';
import { defaultHandSortSettings, reconcileHandOrder, type HandSortDirection, type HandSortMode, type HandSortSettings } from './hand-sort';

type Ack = { ok?: boolean; error?: string; code?: string; token?: string; playerId?: string; passwordProtected?: boolean; joinable?: boolean };
type GameView = { id: string; version: number; phase: DurakPhase; players: Array<{ id: string; name: string; hand: Card[]; handCount?: number; connected: boolean; eliminated: boolean }>; attackerId: string; defenderId: string; roundAttackerId: string; passedPlayerIds: string[]; trumpSuit: Suit; trumpCard?: Card; table: TablePair[]; roundAttackLimit: number; deckCount: number; result?: { draw: boolean; durakId?: string; winners: string[] } };
type KnackGameView = { id: string; version: number; phase: KnackPhase; players: Array<{ id: string; name: string; hand: Card[]; handCount?: number; connected: boolean; eliminated: boolean; lives: number; swimming: boolean }>; center: Card[]; currentPlayerId: string; dealerId: string; closingPlayerId?: string; finalTurnsLeft: number; consecutivePasses: number; roundNumber: number; deckCount: number; roundResult?: KnackRoundResult; lastRoundResult?: KnackRoundResult; result?: { winnerId: string } };
type MauMauGameView = { id: string; version: number; phase: MauMauPhase; players: Array<{ id: string; name: string; hand: Card[]; handCount?: number; connected: boolean }>; discard: Card[]; discardCount: number; currentPlayerId: string; activeSuit: Suit; drawnCardId?: string; deckCount: number; rules: MauMauRules; direction: 1 | -1; pendingDraw: number; result?: { winnerId: string } };
type RommeGameView = { id: string; version: number; phase: 'playing'|'finished'; players: Array<{ id: string; name: string; hand: RommeCard[]; handCount?: number; connected: boolean; opened: boolean }>; discard: RommeCard[]; discardCount: number; deckCount: number; melds: Array<{ id:string; ownerId:string; kind:'set'|'run'; cards:RommeCard[]; points:number }>; currentPlayerId:string; hasDrawn:boolean; rules:RommeRules; result?:{winnerId:string;handPoints:Record<string,number>} };
type AnyGameView = GameView | KnackGameView | MauMauGameView | RommeGameView;
type ProtocolEntry = { id: string; timestamp: number; text: string; private?: boolean };
type RetainedLobby = { code: string; gameId: GameId; status: 'waiting' | 'playing' };
type Preferences = { theme: 'system' | 'light' | 'dark'; accent: 'collection' | 'ocean' | 'violet' | 'amber' | 'rose' | 'custom'; customAccent: string; largeText: boolean; largeCards: boolean; highContrast: boolean; reducedMotion: boolean; speech: boolean; turnSound: boolean; rate: number; volume: number };
const defaultPrefs: Preferences = { theme: 'system', accent: 'collection', customAccent: '#c42b1c', largeText: false, largeCards: false, highContrast: false, reducedMotion: false, speech: false, turnSound: true, rate: 1, volume: 1 };
const defaultMauMauRules: MauMauRules = { stackSevens: false, forbidJackOnJack: false, forbidJackAsFinal: false, aceReverses: false };
const defaultRommeRules: RommeRules = { openingPoints: 40, requireDiscardUse: false };
const accentChoices: Preferences['accent'][] = ['collection', 'ocean', 'violet', 'amber', 'rose', 'custom'];
const socketUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) || (import.meta.env.DEV ? 'http://localhost:3001' : undefined);
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, { autoConnect: true, reconnection: true });

function loadPrefs(): Preferences { try { const stored = JSON.parse(localStorage.getItem('c52:prefs') ?? '{}') as Partial<Preferences> & { accent?: string }; const accent = accentChoices.includes(stored.accent as Preferences['accent']) ? stored.accent as Preferences['accent'] : defaultPrefs.accent; return { ...defaultPrefs, ...stored, accent }; } catch { return defaultPrefs; } }
function loadMauMauRules(): MauMauRules { try { const stored = JSON.parse(localStorage.getItem('c52:mau-mau-rules') ?? '{}') as Partial<MauMauRules>; return Object.fromEntries(Object.keys(defaultMauMauRules).map((key) => [key, typeof stored[key as keyof MauMauRules] === 'boolean' ? stored[key as keyof MauMauRules] : defaultMauMauRules[key as keyof MauMauRules]])) as MauMauRules; } catch { return { ...defaultMauMauRules }; } }
function loadRommeRules(): RommeRules { try { const stored = JSON.parse(localStorage.getItem('c52:romme-rules') ?? '{}') as Partial<RommeRules>; return { openingPoints: stored.openingPoints === 30 ? 30 : 40, requireDiscardUse: stored.requireDiscardUse === true }; } catch { return { ...defaultRommeRules }; } }
const invitationCode = () => new URLSearchParams(location.search).get('lobby')?.toUpperCase() ?? '';
const validHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const hexColorParts = (value: string): [number, number, number] => [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16)) as [number, number, number];
const sessionKey = (code: string) => `c52:session:${code}`;
const retainedLobbyKey = 'c52:retained-lobby';
const handSortKey = 'c52:hand-sort';
function loadRetainedLobby(): RetainedLobby | undefined { try { const saved = JSON.parse(localStorage.getItem(retainedLobbyKey) ?? 'null') as RetainedLobby | null; return saved && /^[A-Z2-9]{8}$/.test(saved.code) && gameDefinitions.some((game) => game.id === saved.gameId) ? saved : undefined; } catch { return undefined; } }
function loadHandSortSettings(): HandSortSettings { try { const saved = JSON.parse(localStorage.getItem(handSortKey) ?? 'null') as Partial<HandSortSettings> | null; const mode = saved?.mode === 'rank' || saved?.mode === 'none' ? saved.mode : defaultHandSortSettings.mode; const direction = saved?.direction === 'desc' ? 'desc' : defaultHandSortSettings.direction; return { mode, direction }; } catch { return { ...defaultHandSortSettings }; } }
const usernamePattern = /^[\p{L}\p{N}_-]{1,16}$/u;
const hasMinimumUsernameLetters = (name: string) => (name.match(/\p{L}/gu)?.length ?? 0) >= 3;
const isValidUsername = (name: string) => usernamePattern.test(name) && hasMinimumUsernameLetters(name);
const eventTranslationKey = (type: string) => `event_${type.replaceAll('.', '_')}`;
const technicalEventTypes = new Set(['player.disconnected', 'player.reconnected', 'lobby.kept_alive']);
const suitSymbols: Record<Suit, string> = { clubs:'♣', diamonds:'♦', hearts:'♥', spades:'♠' };
const gameDefinitions = [
  { id: 'durak', nameKey: 'durak', descriptionKey: 'durakDescription', aliasesKey: 'durakAliases' },
  { id: 'schwimmen', nameKey: 'schwimmen', descriptionKey: 'knackDescription', aliasesKey: 'knackAliases', searchAliasesKey: 'knackSearchAliases' },
  { id: 'mau-mau', nameKey: 'mau-mau', descriptionKey: 'mauMauDescription', aliasesKey: 'mauMauAliases' },
  { id: 'romme', nameKey: 'romme', descriptionKey: 'rommeDescription', aliasesKey: 'rommeAliases' }
] as const;
const LegalPage = lazy(() => import('./LegalPages').then((module) => ({ default: module.LegalPage })));

function actionCueKey(game: AnyGameView | undefined, playerId: string): string {
  if (!game || !playerId) return '';
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player?.connected || game.phase === 'finished') return '';
  if ('currentPlayerId' in game) return game.phase === 'playing' && game.currentPlayerId === playerId ? `${game.id}:turn` : '';
  const durakPlayer = game.players.find((candidate) => candidate.id === playerId);
  if (!durakPlayer || durakPlayer.eliminated) return '';
  if (game.phase === 'attack') return game.attackerId === playerId ? `${game.id}:attack` : '';
  if (game.phase === 'defense') return game.defenderId === playerId ? `${game.id}:defense` : '';
  if (game.phase !== 'throw-in') return '';
  const defenderIndex = game.players.findIndex((candidate) => candidate.id === game.defenderId);
  const circular = [...game.players.slice(defenderIndex + 1), ...game.players.slice(0, defenderIndex)];
  const original = game.players.find((candidate) => candidate.id === game.roundAttackerId);
  const eligible = [original, ...circular.filter((candidate) => candidate.id !== original?.id)].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && !candidate.eliminated && candidate.id !== game.defenderId && (candidate.handCount ?? candidate.hand.length) > 0));
  return eligible.find((candidate) => !game.passedPlayerIds.includes(candidate.id))?.id === playerId ? `${game.id}:throw-in` : '';
}

async function playTurnCue(contextRef: { current: AudioContext | undefined }): Promise<void> {
  try {
    const context = contextRef.current?.state === 'closed' ? new AudioContext() : contextRef.current ?? new AudioContext(); contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    const now = context.currentTime;
    for (const [index, frequency] of [659.25, 880].entries()) {
      const oscillator = context.createOscillator(); const gain = context.createGain(); const startsAt = now + index * 0.11;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt); gain.gain.exponentialRampToValueAtTime(0.12, startsAt + 0.018); gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(startsAt); oscillator.stop(startsAt + 0.19);
    }
  } catch { /* Browsers may block audio until the first user interaction. */ }
}

function TopLayerMessage({ className, role, children }: { className: string; role: 'alert' | 'status'; children: ReactNode }) {
  const [dialogLayer, setDialogLayer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const updateLayer = () => setDialogLayer(document.querySelector<HTMLElement>('dialog[open] .dialog-message-layer'));
    updateLayer(); window.addEventListener('c52:dialog-layer-change', updateLayer);
    return () => window.removeEventListener('c52:dialog-layer-change', updateLayer);
  }, []);
  const message = <div className={className} role={role}>{children}</div>;
  return dialogLayer ? createPortal(message, dialogLayer) : message;
}

export function App() {
  const { t, i18n } = useTranslation();
  const legalPage = ({ '/impressum': 'imprint', '/datenschutz': 'privacy' } as Record<string, LegalPageKind | undefined>)[location.pathname.replace(/\/$/, '') || '/'];
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]); const [lobby, setLobby] = useState<PublicLobby>();
  const [playerId, setPlayerId] = useState(''); const [connected, setConnected] = useState(socket.connected); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [info, setInfo] = useState(''); const [warning, setWarning] = useState<number>(); const [events, setEvents] = useState<StructuredEvent[]>([]); const [retainedLobby, setRetainedLobby] = useState<RetainedLobby | undefined>(loadRetainedLobby);
  const [prefs, setPrefs] = useState(loadPrefs); const [settingsOpen, setSettingsOpen] = useState(false); const [rulesOpen, setRulesOpen] = useState(false); const [historyOpen, setHistoryOpen] = useState(false); const [protocolOpen, setProtocolOpen] = useState(true); const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);
  const narratedGameId = useRef(''); const lastNarratedSequence = useRef(0); const previousGame = useRef<AnyGameView | undefined>(undefined);
  const audioContext = useRef<AudioContext | undefined>(undefined); const previousActionCue = useRef('');

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (!prefs.speech || !('speechSynthesis' in window)) return;
    const speechText = message.replace(/\b(\d{1,2})\.(?=\s|$)/g, '$1,');
    const utterance = new SpeechSynthesisUtterance(speechText); utterance.lang = i18n.language; utterance.rate = prefs.rate; utterance.volume = prefs.volume; speechSynthesis.speak(utterance);
  }, [i18n.language, prefs]);
  const lobbyRef = useRef<PublicLobby | undefined>(lobby); const announceRef = useRef(announce); const translateRef = useRef(t);
  useEffect(() => { lobbyRef.current = lobby; announceRef.current = announce; translateRef.current = t; }, [lobby, announce, t]);

  useEffect(() => {
    const root = document.documentElement; root.dataset.theme = prefs.theme; root.dataset.accent = prefs.accent; root.classList.toggle('large-text', prefs.largeText); root.classList.toggle('high-contrast', prefs.highContrast); root.classList.toggle('reduce-motion', prefs.reducedMotion); localStorage.setItem('c52:prefs', JSON.stringify(prefs)); localStorage.setItem('c52:theme', prefs.theme);
    if (prefs.accent === 'custom') { const color = validHexColor(prefs.customAccent) ? prefs.customAccent : defaultPrefs.customAccent; const [red, green, blue] = hexColorParts(color); root.style.setProperty('--accent', color); root.style.setProperty('--accent-rgb', `${red} ${green} ${blue}`); root.style.setProperty('--accent-2', `color-mix(in srgb, ${color} 20%, var(--surface))`); root.style.setProperty('--accent-contrast', (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '#000' : '#fff'); } else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-rgb'); root.style.removeProperty('--accent-2'); root.style.removeProperty('--accent-contrast'); }
    const probe = document.createElement('span'); probe.style.color = 'var(--accent)'; probe.hidden = true; document.body.append(probe); const resolvedAccent = getComputedStyle(probe).color; probe.remove(); document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', resolvedAccent);
  }, [prefs]);
  useEffect(() => { if (!prefs.speech && 'speechSynthesis' in window) speechSynthesis.cancel(); }, [prefs.speech]);
  useEffect(() => {
    const onConnect = () => { setConnected(true); const currentLobby = lobbyRef.current; const code = currentLobby?.code ?? invitationCode(); if (code) { const token = localStorage.getItem(sessionKey(code)); if (token) socket.emit('lobby:resume', { code, token }, (raw) => { const result = raw as Ack; if (!result.ok && lobbyRef.current) setError(result.error ?? 'unknown_error'); else if (result.playerId) setPlayerId(result.playerId); }); } socket.emit('lobby:list', setLobbies); };
    const onDisconnect = () => setConnected(false); const onState = (state: PublicLobby) => { const retained = { code: state.code, gameId: state.gameId, status: state.status } as const; localStorage.setItem(retainedLobbyKey, JSON.stringify(retained)); setRetainedLobby(retained); setLobby(state); setEvents(state.events); }; const onClosed = ({ reason }: { reason: string }) => { const currentLobby = lobbyRef.current; if (currentLobby) localStorage.removeItem(sessionKey(currentLobby.code)); localStorage.removeItem(retainedLobbyKey); setRetainedLobby(undefined); setLobby(undefined); setPlayerId(''); setWarning(undefined); setError(reason === 'inactive' ? 'lobby_not_found' : ''); announceRef.current(translateRef.current('closed')); history.replaceState({}, '', location.pathname); };
    const onEvent = (event: StructuredEvent) => { setEvents((old) => [...old.slice(-99), event]); if (event.type === 'player.left') { const effect = String(event.data.gameEffect ?? 'none'); const message = translateRef.current(`playerLeftNotice_${effect}`, { name: String(event.data.name ?? '') }); setInfo(message); announceRef.current(message); } };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('lobby:list', setLobbies); socket.on('lobby:state', onState); socket.on('lobby:closed', onClosed); socket.on('lobby:warning', ({ closesAt }) => setWarning(closesAt)); socket.on('game:event', onEvent);
    if (socket.connected) onConnect(); return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('lobby:list', setLobbies); socket.off('lobby:state', onState); socket.off('lobby:closed', onClosed); socket.off('lobby:warning'); socket.off('game:event', onEvent); };
  }, []);

  const forgetRetainedLobby = (code: string) => { localStorage.removeItem(sessionKey(code)); localStorage.removeItem(retainedLobbyKey); setRetainedLobby(undefined); };
  const remember = (result: Ack) => { if (result.ok && result.code && result.token) { localStorage.setItem(sessionKey(result.code), result.token); setPlayerId(result.playerId ?? ''); history.replaceState({}, '', `?lobby=${result.code}`); } else setError(result.error ?? 'unknown_error'); };
  const command = (event: 'game:start' | 'game:restart' | 'lobby:detach' | 'lobby:close' | 'lobby:keepalive') => socket.emit(event, (raw) => { const result = raw as Ack; if (!result.ok) setError(result.error ?? 'unknown_error'); else if (event === 'lobby:detach') { setLobby(undefined); setPlayerId(''); setWarning(undefined); setInfo(t('seatRetainedNotice')); history.replaceState({}, '', location.pathname); } });
  const resumeRetainedLobby = () => { if (!retainedLobby) return; const token = localStorage.getItem(sessionKey(retainedLobby.code)); if (!token) { forgetRetainedLobby(retainedLobby.code); setError('invalid_session'); return; } socket.emit('lobby:resume', { code: retainedLobby.code, token }, (raw) => { const result = raw as Ack; if (!result.ok) { if (result.error === 'lobby_not_found' || result.error === 'invalid_session') forgetRetainedLobby(retainedLobby.code); setError(result.error ?? 'unknown_error'); return; } setPlayerId(result.playerId ?? ''); history.replaceState({}, '', `?lobby=${retainedLobby.code}`); }); };
  const permanentlyLeaveRetainedLobby = () => { if (!retainedLobby || !confirm(t('confirmPermanentLeave'))) return; const token = localStorage.getItem(sessionKey(retainedLobby.code)); if (!token) { forgetRetainedLobby(retainedLobby.code); return; } socket.emit('lobby:leave', { code: retainedLobby.code, token }, (raw) => { const result = raw as Ack; if (!result.ok && result.error !== 'lobby_not_found') { setError(result.error ?? 'unknown_error'); return; } forgetRetainedLobby(retainedLobby.code); setInfo(t('permanentlyLeftNotice')); }); };
  const game = lobby?.game as AnyGameView | undefined; const me = game?.players.find((p) => p.id === playerId);
  useEffect(() => {
    if (!prefs.turnSound || audioContext.current?.state === 'running') return;
    const unlock = () => { const context = audioContext.current ?? new AudioContext(); audioContext.current = context; void context.resume(); };
    window.addEventListener('pointerdown', unlock, { once:true }); window.addEventListener('keydown', unlock, { once:true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [prefs.turnSound]);
  useEffect(() => {
    const cue = actionCueKey(game, playerId); const previous = previousActionCue.current; previousActionCue.current = cue;
    if (prefs.turnSound && cue && cue !== previous) void playTurnCue(audioContext);
  }, [game, playerId, prefs.turnSound]);
  useEffect(() => {
    if (!game || !lobby) { previousGame.current = undefined; return; }
    const playerName = (id?: string) => lobby.players.find((player) => player.id === id)?.name ?? '';
    const cardName = (id: unknown) => { const card = String(id ?? ''); if (card.startsWith('joker-')) return t('rommeJoker'); const [suit, rank] = card.split('-'); if (!suit || !rank) return card; return t('card', { suit: t(`suit_${suit}`), rank: t(`rank_${rank}`, { defaultValue: rank }) }); };
    const privateDrawText = (event: StructuredEvent) => { const cardIds = Array.isArray(event.data.cardIds) ? event.data.cardIds : []; return t(cardIds.length === 1 ? 'protocolPrivateDraw' : 'protocolPrivateDrawMultiple', { card: cardName(cardIds[0]), cards: cardIds.map(cardName).join(', '), count: cardIds.length }); };
    const additions: ProtocolEntry[] = [];
    if (lobby.gameId === 'mau-mau') {
      const mauGame = game as MauMauGameView; const mauMe = mauGame.players.find((player) => player.id === playerId); const topCard = mauGame.discard.at(-1);
      if (narratedGameId.current !== mauGame.id) {
        if (!mauMe?.hand.length) return;
        narratedGameId.current = mauGame.id; setProtocolEntries([]); setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(0, ...events.map((event) => event.sequence));
        additions.push({ id: `start-${mauGame.id}`, timestamp: Date.now(), text: t('mauMauProtocolStarted', { player: playerName(mauGame.currentPlayerId), card: topCard ? cardName(topCard.id) : '', cards: mauMe.hand.map((card) => cardName(card.id)).join(', ') }), private: true });
      } else {
        for (const event of events.filter((candidate) => candidate.sequence > lastNarratedSequence.current).sort((a, b) => a.sequence - b.sequence)) {
          const name = playerName(event.actorId) || String(event.data.name ?? ''); let text = '';
          if (event.type === 'game.cards.drawn') text = privateDrawText(event);
          else if (event.type === 'game.mau-mau.play') {
            const played = cardName(event.data.cardId); const rank = String(event.data.cardId ?? '').split('-').at(-1);
            text = t('mauMauProtocolPlay', { name, card: played });
            if (rank === '7') text += ` ${t(mauGame.rules.stackSevens ? 'mauMauProtocolSevenStack' : 'mauMauProtocolSeven', { count: mauGame.pendingDraw })}`;
            else if (rank === '8') text += ` ${t('mauMauProtocolEight')}`;
            else if (rank === 'jack') text += ` ${t('mauMauProtocolJack', { suit: t(`suit_${String(event.data.chosenSuit ?? '')}`) })}`;
            else if (rank === 'ace' && mauGame.rules.aceReverses) text += ` ${t('mauMauProtocolAce')}`;
          } else if (event.type === 'game.mau-mau.draw' && event.actorId !== playerId) text = t('mauMauProtocolDraw', { name });
          else if (event.type === 'game.mau-mau.pass') text = t('mauMauProtocolKeep', { name });
          if (text) additions.push({ id: `event-${event.id}`, timestamp: event.timestamp, text, private: event.visibility === 'private' });
          lastNarratedSequence.current = Math.max(lastNarratedSequence.current, event.sequence);
        }
        const previous = previousGame.current as MauMauGameView | undefined;
        if (previous?.phase !== 'finished' && mauGame.phase === 'finished') additions.push({ id: `result-${mauGame.version}`, timestamp: Date.now(), text: t('mauMauProtocolFinished', { name: playerName(mauGame.result?.winnerId) }) });
      }
      previousGame.current = mauGame;
      if (additions.length) { setProtocolEntries((current) => [...current, ...additions].slice(-100)); announce(additions.map((entry) => entry.text).join(' ')); }
      return;
    }
    if (lobby.gameId === 'schwimmen') {
      const knackGame = game as KnackGameView; const knackMe = knackGame.players.find((player) => player.id === playerId);
      if (narratedGameId.current !== knackGame.id) {
        if (!knackMe?.hand.length) return;
        narratedGameId.current = knackGame.id; setProtocolEntries([]); setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(0, ...events.map((event) => event.sequence));
        additions.push({ id: `start-${knackGame.id}`, timestamp: Date.now(), text: t('knackProtocolStarted', { player: playerName(knackGame.currentPlayerId), cards: knackMe.hand.map((card) => cardName(card.id)).join(', ') }), private: true });
      } else {
        for (const event of events.filter((candidate) => candidate.sequence > lastNarratedSequence.current).sort((a, b) => a.sequence - b.sequence)) {
          const name = playerName(event.actorId) || String(event.data.name ?? ''); let text = '';
          if (event.type === 'game.cards.drawn') text = privateDrawText(event);
          else if (event.type === 'game.schwimmen.swap-one') text = t('knackProtocolSwapOne', { name, hand: cardName(event.data.handCardId), center: cardName(event.data.centerCardId) });
          else if (event.type === 'game.schwimmen.swap-all') { const taken = Array.isArray(event.data.centerCardIds) ? event.data.centerCardIds.map(cardName).join(', ') : ''; const placed = Array.isArray(event.data.handCardIds) ? event.data.handCardIds.map(cardName).join(', ') : ''; text = taken && placed ? t('knackProtocolSwapAllDetailed', { name, taken, placed }) : t('knackProtocolSwapAll', { name }); }
          else if (event.type === 'game.schwimmen.pass') text = t('knackProtocolPass', { name });
          else if (event.type === 'game.schwimmen.knock') text = t('knackProtocolKnock', { name });
          else if (event.type === 'game.schwimmen.next-round') text = t('knackProtocolNextRound', { round: knackGame.roundNumber });
          if (text) additions.push({ id: `event-${event.id}`, timestamp: event.timestamp, text, private: event.visibility === 'private' });
          lastNarratedSequence.current = Math.max(lastNarratedSequence.current, event.sequence);
        }
        const previous = previousGame.current as KnackGameView | undefined;
        if (previous?.phase === 'playing' && knackGame.phase !== 'playing' && knackGame.roundResult) additions.push({ id: `round-result-${knackGame.version}`, timestamp: Date.now(), text: t('knackProtocolRoundEnded', { reason: t(`knackReason_${knackGame.roundResult.reason}`) }) });
        if (previous?.phase !== 'finished' && knackGame.phase === 'finished') additions.push({ id: `result-${knackGame.version}`, timestamp: Date.now(), text: t('knackProtocolFinished', { name: playerName(knackGame.result?.winnerId) }) });
      }
      previousGame.current = knackGame;
      if (additions.length) { setProtocolEntries((current) => [...current, ...additions].slice(-100)); announce(additions.map((entry) => entry.text).join(' ')); }
      return;
    }
    if (lobby.gameId === 'romme') {
      const rommeGame = game as RommeGameView; const rommeMe = rommeGame.players.find((player) => player.id === playerId);
      if (narratedGameId.current !== rommeGame.id) {
        if (!rommeMe?.hand.length) return;
        narratedGameId.current = rommeGame.id; setProtocolEntries([]); setProtocolOpen(true); lastNarratedSequence.current = Math.max(0, ...events.map((event) => event.sequence));
        additions.push({ id:`start-${rommeGame.id}`, timestamp:Date.now(), text:t('rommeProtocolStarted', { player:playerName(rommeGame.currentPlayerId), cards:rommeMe.hand.map((card) => cardName(card.id)).join(', ') }), private:true });
      } else {
        for (const event of events.filter((candidate) => candidate.sequence > lastNarratedSequence.current).sort((a,b) => a.sequence-b.sequence)) {
          const name = playerName(event.actorId); let text = '';
          if (event.type === 'game.cards.drawn') text = privateDrawText(event);
          else if (event.type === 'game.romme.draw' && event.actorId !== playerId) text = t(event.data.source === 'discard' ? 'rommeProtocolDrawDiscard' : 'rommeProtocolDrawStock', { name });
          else if (event.type === 'game.romme.meld') text = t('rommeProtocolMeld', { name, count:event.data.groupCount });
          else if (event.type === 'game.romme.lay-off') text = t('rommeProtocolLayOff', { name, count:Array.isArray(event.data.cardIds) ? event.data.cardIds.length : 1 });
          else if (event.type === 'game.romme.discard') text = t('rommeProtocolDiscard', { name, card:cardName(event.data.cardId) });
          if (text) additions.push({ id:`event-${event.id}`, timestamp:event.timestamp, text, private:event.visibility === 'private' }); lastNarratedSequence.current = Math.max(lastNarratedSequence.current,event.sequence);
        }
        const previous = previousGame.current as RommeGameView | undefined; if (previous?.phase !== 'finished' && rommeGame.phase === 'finished') additions.push({ id:`result-${rommeGame.version}`,timestamp:Date.now(),text:t('rommeProtocolFinished',{name:playerName(rommeGame.result?.winnerId)}) });
      }
      previousGame.current = rommeGame; if (additions.length) { setProtocolEntries((current) => [...current,...additions].slice(-100)); announce(additions.map((entry) => entry.text).join(' ')); } return;
    }
    const durakGame = game as GameView;
    if (narratedGameId.current !== durakGame.id) {
      if (!me?.hand.length) return;
      narratedGameId.current = durakGame.id; setProtocolEntries([]); setProtocolOpen(true);
      lastNarratedSequence.current = Math.max(0, ...events.map((event) => event.sequence));
      const cards = me.hand.map((card) => cardName(card.id)).join(', ');
      additions.push({ id: `start-${durakGame.id}`, timestamp: Date.now(), text: t('protocolGameStarted', { trump: t(`suit_${durakGame.trumpSuit}`), attacker: playerName(durakGame.attackerId), defender: playerName(durakGame.defenderId), cards }), private: true });
    } else {
      for (const event of events.filter((candidate) => candidate.sequence > lastNarratedSequence.current).sort((a, b) => a.sequence - b.sequence)) {
        const name = playerName(event.actorId) || String(event.data.name ?? ''); let text = '';
        if (event.type === 'game.cards.drawn') text = privateDrawText(event);
        else if (event.type === 'game.attack') {
          const cardIds = Array.isArray(event.data.cardIds) ? event.data.cardIds : [event.data.cardId];
          text = t(cardIds.length > 1 ? 'protocolAttackMultiple' : 'protocolAttack', { name, card: cardName(cardIds[0]), cards: cardIds.map(cardName).join(', ') });
        }
        else if (event.type === 'game.defend') text = t('protocolDefend', { name, attack: cardName(event.data.attackCardId), card: cardName(event.data.cardId) });
        else if (event.type === 'game.take') text = t('protocolTake', { name });
        else if (event.type === 'game.pass') text = t('protocolPass', { name });
        if (text) additions.push({ id: `event-${event.id}`, timestamp: event.timestamp, text, private: event.visibility === 'private' });
        lastNarratedSequence.current = Math.max(lastNarratedSequence.current, event.sequence);
      }
      const previous = previousGame.current;
      if (previous && 'table' in previous && previous.table.length > 0 && durakGame.table.length === 0) {
        if (durakGame.phase === 'finished') {
          const result = durakGame.result?.draw ? t('draw') : t('durakResult', { name: playerName(durakGame.result?.durakId) });
          additions.push({ id: `result-${durakGame.id}-${durakGame.version}`, timestamp: Date.now(), text: t('protocolFinished', { result }) });
        } else {
          additions.push({ id: `round-${durakGame.id}-${durakGame.version}`, timestamp: Date.now(), text: t('protocolNewRound', { attacker: playerName(durakGame.attackerId), defender: playerName(durakGame.defenderId) }) });
        }
      }
    }
    previousGame.current = durakGame;
    if (!additions.length) return;
    setProtocolEntries((current) => [...current, ...additions].slice(-100)); announce(additions.map((entry) => entry.text).join(' '));
  }, [announce, events, game, lobby, me, playerId, t]);
  const showButtonFeedback = (event: ReactMouseEvent<HTMLDivElement>) => { const target = (event.target as Element).closest<HTMLElement>('button, .paypal-button'); if (!target || target.matches(':disabled')) return; target.classList.remove('button-pressed'); void target.offsetWidth; target.classList.add('button-pressed'); window.setTimeout(() => target.classList.remove('button-pressed'), 420); };

  return <div className={`app ${prefs.largeCards ? 'large-cards' : ''}`} onClickCapture={showButtonFeedback}>
    <header className="topbar"><a className="brand" href="/" aria-label="Collection52" onClick={(e) => { if (lobby && !legalPage) e.preventDefault(); }}><span className="brand-word">Collection</span><span className="brand-card" aria-hidden="true">52</span></a><div className="header-actions"><label className="header-select"><span>{t('theme')}</span><ResponsiveSelect label={t('theme')} value={prefs.theme} onChange={(value) => setPrefs({ ...prefs, theme: value as Preferences['theme'] })} options={[{ value:'system', label:t('themeSystem') },{ value:'light', label:t('themeLight') },{ value:'dark', label:t('themeDark') }]} /></label><label className="header-select"><span>{t('language')}</span><ResponsiveSelect label={t('language')} value={i18n.language} onChange={(value) => void i18n.changeLanguage(value)} options={[{ value:'de', label:'DE' },{ value:'en', label:'EN' }]} /></label><button className="secondary" aria-label={t('settings')} onClick={() => setSettingsOpen(true)}>{t('settings')}</button></div></header>
    <div className="sr-only" aria-live="polite" aria-atomic="true">{notice}</div>
    {!connected && <div className="banner warning" role="status">{t('connectionDisconnected')}</div>}
    {error && <TopLayerMessage className="floating-error" role="alert"><span className="floating-error-icon" aria-hidden="true">!</span><span className="floating-error-message">{t('error', { message: t(`errors.${error}`, { defaultValue: error }) })}</span><button className="floating-error-close" type="button" aria-label={t('dismiss')} onClick={() => setError('')}><span aria-hidden="true" /></button></TopLayerMessage>}
    {info && <TopLayerMessage className="floating-notice" role="status"><span className="floating-notice-icon" aria-hidden="true">✓</span><span>{info}</span><button className="floating-error-close" type="button" aria-label={t('dismiss')} onClick={() => setInfo('')}><span aria-hidden="true" /></button></TopLayerMessage>}
    {warning && lobby && <div className="banner warning" role="alert"><span>{t('inactiveWarning', { time: new Date(warning).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) })}</span><button onClick={() => command('lobby:keepalive')}>{t('keepAlive')}</button></div>}
    <main id="main">{legalPage ? <Suspense fallback={<p className="legal-loading">{t('loading')}</p>}><LegalPage kind={legalPage} /></Suspense> : lobby ? <LobbyView lobby={lobby} playerId={playerId} game={game} events={events} historyOpen={historyOpen} setHistoryOpen={setHistoryOpen} protocolEntries={protocolEntries} protocolOpen={protocolOpen} setProtocolOpen={setProtocolOpen} setError={setError} command={command} announce={announce} /> : <Home lobbies={lobbies} remember={remember} retainedLobby={retainedLobby} resumeRetainedLobby={resumeRetainedLobby} permanentlyLeaveRetainedLobby={permanentlyLeaveRetainedLobby} />}</main>
    <Footer inLobby={Boolean(lobby && !legalPage)} openRules={() => setRulesOpen(true)} />
    {settingsOpen && <SettingsDialog prefs={prefs} setPrefs={setPrefs} close={() => setSettingsOpen(false)} language={i18n.language} setLanguage={(lng) => void i18n.changeLanguage(lng)} />}
    {rulesOpen && <Dialog title={t(lobby?.gameId === 'schwimmen' ? 'knackRulesTitle' : lobby?.gameId === 'mau-mau' ? 'mauMauRulesTitle' : lobby?.gameId === 'romme' ? 'rommeRulesTitle' : 'rulesTitle')} close={() => setRulesOpen(false)}><RulesContent gameId={lobby?.gameId ?? 'durak'} /></Dialog>}
  </div>;
}

function Home({ lobbies, remember, retainedLobby, resumeRetainedLobby, permanentlyLeaveRetainedLobby }: { lobbies: LobbySummary[]; remember: (result: Ack) => void; retainedLobby: RetainedLobby | undefined; resumeRetainedLobby: () => void; permanentlyLeaveRetainedLobby: () => void }) {
  const { t, i18n } = useTranslation(); const invitedCode = useMemo(invitationCode, []); const [savedInvitationName] = useState(() => invitedCode ? localStorage.getItem('c52:name') ?? '' : ''); const [name, setName] = useState(localStorage.getItem('c52:name') ?? ''); const [code, setCode] = useState(invitedCode); const [password, setPassword] = useState(''); const [passwordRequired, setPasswordRequired] = useState(false); const [createPasswordEnabled, setCreatePasswordEnabled] = useState(false); const [createPassword, setCreatePassword] = useState(''); const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'joinable' | 'missing' | 'unavailable'>('idle'); const [gamesOpen, setGamesOpen] = useState(false); const [gameSearch, setGameSearch] = useState(''); const [selectedGame, setSelectedGame] = useState<GameId>(() => { const stored = localStorage.getItem('c52:game'); return gameDefinitions.some((game) => game.id === stored) ? stored as GameId : 'durak'; }); const [nameTouched, setNameTouched] = useState(Boolean(invitedCode && !isValidUsername(savedInvitationName))); const [codeTouched, setCodeTouched] = useState(false); const [createVisibility, setCreateVisibility] = useState<'public' | 'private'>('public'); const [lobbyPasswords, setLobbyPasswords] = useState<Record<string, string>>({}); const automaticJoinAttempted = useRef(false); const rememberRef = useRef(remember);
  useEffect(() => { rememberRef.current = remember; }, [remember]);
  useEffect(() => { localStorage.setItem('c52:game', selectedGame); }, [selectedGame]);
  const validName = isValidUsername(name); const validCode = /^[A-Z2-9]{8}$/.test(code); const nameError = name && !usernamePattern.test(name) ? t('usernameInvalid') : name && !hasMinimumUsernameLetters(name) ? t('usernameTooFewLetters') : nameTouched && !name ? t('usernameRequired') : ''; const codeError = codeStatus === 'missing' ? t('lobbyCodeNotFound') : codeStatus === 'unavailable' ? t('lobbyCodeUnavailable') : codeTouched && code && !validCode ? t('lobbyCodeInvalid') : '';
  const games = gameDefinitions.map((definition) => { const translatedAliases = t(definition.aliasesKey, { returnObjects: true }) as unknown; const aliases = Array.isArray(translatedAliases) ? translatedAliases.filter((alias): alias is string => typeof alias === 'string') : []; const searchKey = 'searchAliasesKey' in definition ? definition.searchAliasesKey : undefined; const translatedSearchAliases = searchKey ? t(searchKey, { returnObjects:true }) as unknown : []; const searchAliases = Array.isArray(translatedSearchAliases) ? translatedSearchAliases.filter((alias): alias is string => typeof alias === 'string') : []; return { ...definition, name: t(definition.nameKey), description: t(definition.descriptionKey), aliases, searchAliases }; }).sort((left, right) => left.name.localeCompare(right.name, i18n.resolvedLanguage ?? i18n.language, { sensitivity:'base' })); const normalizeGameSearch = (value: string) => value.trim().toLocaleLowerCase().replace(/[-‐‑‒–—]+/g, ' ').replace(/\s+/g, ' '); const normalizedGameSearch = normalizeGameSearch(gameSearch); const filteredGames = games.filter((game) => !normalizedGameSearch || [game.name, game.description, ...game.aliases, ...game.searchAliases].some((text) => normalizeGameSearch(text).includes(normalizedGameSearch)));
  useEffect(() => {
    setPassword(''); setPasswordRequired(false);
    if (!validCode) { setCodeStatus('idle'); return; }
    setCodeStatus('checking'); let cancelled = false;
    const timer = window.setTimeout(() => socket.emit('lobby:inspect', { code }, (raw) => {
      if (cancelled) return;
      const result = raw as Ack;
      if (!result.ok) {
        if (result.error === 'lobby_not_found' && code === invitedCode) {
          history.replaceState({}, '', location.pathname); setCode(''); setCodeTouched(false); setNameTouched(false); return;
        }
        setCodeStatus(result.error === 'lobby_not_found' ? 'missing' : 'unavailable'); return;
      }
      setPasswordRequired(Boolean(result.passwordProtected)); setCodeStatus(result.joinable ? 'joinable' : 'unavailable');
      if (!retainedLobby && result.joinable && !result.passwordProtected && code === invitedCode && isValidUsername(savedInvitationName) && !automaticJoinAttempted.current) {
        automaticJoinAttempted.current = true;
        socket.emit('lobby:join', { code, name: savedInvitationName }, (joinResult) => rememberRef.current(joinResult as Ack));
      }
    }), 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [code, invitedCode, retainedLobby, savedInvitationName, validCode]);
  const joinLobby = (joinCode: string, joinPassword = '') => { setNameTouched(true); if (retainedLobby || !validName) return; localStorage.setItem('c52:name', name); socket.emit('lobby:join', { code: joinCode, name, ...(joinPassword ? { password: joinPassword } : {}) }, (raw) => remember(raw as Ack)); };
  const submitJoin = (e: FormEvent) => { e.preventDefault(); setCodeTouched(true); if (retainedLobby || !validCode || codeStatus !== 'joinable' || (passwordRequired && !password)) return; joinLobby(code, password); };
  return <>
    {retainedLobby && <section className="retained-lobby panel" aria-labelledby="retained-lobby-title"><div><p className="eyebrow">{t('activeLobbyEyebrow')}</p><h1 id="retained-lobby-title">{t('activeLobbyTitle')}</h1><p>{t('activeLobbyExplanation', { game: t(retainedLobby.gameId), code: retainedLobby.code })}</p><p className="retained-lobby-blocker">{t('activeLobbyBlocker')}</p></div><div className="retained-lobby-actions"><button className="primary" type="button" onClick={resumeRetainedLobby}>{t('returnToLobby')}</button><button className="danger" type="button" onClick={permanentlyLeaveRetainedLobby}>{t('leavePermanently')}</button></div></section>}
    <form className="panel home-actions" aria-labelledby="start-playing-title" onSubmit={submitJoin}>
      <h1 id="start-playing-title">{t('startPlaying')}</h1><TextInput label={t('name')} value={name} onChange={setName} onBlur={() => setNameTouched(true)} required maxLength={16} error={nameError} />
      <div className="game-picker"><label>{t('game')}<ResponsiveSelect label={t('game')} value={selectedGame} onChange={(value) => setSelectedGame(value as GameId)} options={games.map((game) => ({ value: game.id, label: game.name, aliases: [...game.aliases] }))} /></label><button type="button" onClick={() => setGamesOpen(true)}>{t('showAllGames')}</button></div>
      <label>{t('visibility')}<ResponsiveSelect label={t('visibility')} value={createVisibility} onChange={(value) => setCreateVisibility(value as 'public' | 'private')} options={[{ value:'public', label:t('public') },{ value:'private', label:t('private') }]} /></label>
      <label className="check"><input type="checkbox" checked={createPasswordEnabled} onChange={(event) => { setCreatePasswordEnabled(event.target.checked); if (!event.target.checked) setCreatePassword(''); }} />{t('passwordProtection')}</label>{createPasswordEnabled && <TextInput label={t('passwordRequired')} value={createPassword} onChange={setCreatePassword} type="password" maxLength={72} required />}
      <button className="primary full-button" type="button" aria-describedby={retainedLobby ? 'active-lobby-form-hint' : undefined} disabled={Boolean(retainedLobby) || !validName || (createPasswordEnabled && !createPassword)} onClick={() => { setNameTouched(true); if (retainedLobby || !validName || (createPasswordEnabled && !createPassword)) return; localStorage.setItem('c52:name', name); socket.emit('lobby:create', { name, settings: { gameId: selectedGame, maxPlayers: 4, deckSize: selectedGame === 'durak' ? 36 : selectedGame === 'romme' ? 52 : 32, visibility: createVisibility, ...(selectedGame === 'mau-mau' ? { mauMauRules: loadMauMauRules() } : {}), ...(selectedGame === 'romme' ? { rommeRules: loadRommeRules() } : {}), ...(createPasswordEnabled ? { password: createPassword } : {}) } }, (raw) => remember(raw as Ack)); }}>{t('createLobby')}</button>
      {retainedLobby && <p id="active-lobby-form-hint" className="active-lobby-form-hint" role="note">{t('activeLobbyFormHint')}</p>}
      <div className="or-divider" role="separator"><span>{t('or')}</span></div>
      <TextInput label={t('code')} value={code} onChange={(v) => setCode(v.toUpperCase())} onBlur={() => setCodeTouched(true)} maxLength={8} error={codeError} />{passwordRequired && <TextInput label={t('passwordRequired')} value={password} onChange={setPassword} type="password" maxLength={72} required />}
      <button className="primary full-button" type="submit" disabled={Boolean(retainedLobby) || !validName || !validCode || codeStatus !== 'joinable' || (passwordRequired && !password)}>{t('joinLobby')}</button>
    </form>
    <section className="lobby-list"><h2>{t('openLobbies')}</h2>{!lobbies.length ? <p className="empty">{t('noLobbies')}</p> : <ul>{lobbies.map((l) => { const rowPassword = lobbyPasswords[l.code] ?? ''; return <li key={l.code}><div className="lobby-summary"><strong>{t(l.gameId)}</strong><span>{t('lobbyHost', { name: l.hostName })}</span><span>{l.code} · {t(l.status)} · {t('playersCount', { count: l.playerCount, max: l.maxPlayers })}{l.passwordProtected ? ` · ${t('protected')}` : ''}</span></div><form className="lobby-row-join" onSubmit={(event) => { event.preventDefault(); if (!retainedLobby) joinLobby(l.code, rowPassword); }}>{l.passwordProtected && <TextInput label={t('lobbyPasswordFor', { code: l.code })} value={rowPassword} onChange={(value) => setLobbyPasswords((current) => ({ ...current, [l.code]: value }))} type="password" maxLength={72} required />}<button type="submit" disabled={Boolean(retainedLobby) || !l.joinable || !validName || (l.passwordProtected && !rowPassword)}>{t('join')}</button></form></li>; })}</ul>}</section>
    {gamesOpen && <Dialog title={t('allGames')} close={() => setGamesOpen(false)}><div className="game-catalog"><label className="game-search">{t('searchGames')}<span className="game-search-field"><span aria-hidden="true">⌕</span><input type="search" value={gameSearch} onChange={(event) => setGameSearch(event.target.value)} placeholder={t('searchGamesPlaceholder')} autoFocus /></span></label><p className="game-result-count" role="status">{t('gameSearchResults', { count: filteredGames.length })}</p><div className="game-catalog-results">{filteredGames.map((game) => <article className={`game-catalog-card ${selectedGame === game.id ? 'selected' : ''}`} key={game.id}><div className="game-catalog-copy"><h3>{game.name}</h3>{game.aliases.length > 0 && <div className="game-aliases"><span>{t('gameAliases')}</span>{game.aliases.map((alias) => <span className="game-alias-chip" key={alias}>{alias}</span>)}</div>}<p>{game.description}</p></div><button type="button" onClick={() => { setSelectedGame(game.id); setGamesOpen(false); }}>{t(selectedGame === game.id ? 'selectedGame' : 'selectGame')}</button></article>)}{!filteredGames.length && <div className="game-catalog-empty"><strong>{t('noGamesFound')}</strong><p>{t('noGamesFoundHint')}</p></div>}</div></div></Dialog>}
  </>;
}

function LobbyView({ lobby, playerId, game, events, historyOpen, setHistoryOpen, protocolEntries, protocolOpen, setProtocolOpen, setError, command, announce }: { lobby: PublicLobby; playerId: string; game: AnyGameView | undefined; events: StructuredEvent[]; historyOpen: boolean; setHistoryOpen: (v: boolean) => void; protocolEntries: ProtocolEntry[]; protocolOpen: boolean; setProtocolOpen: (v: boolean) => void; setError: (v: string) => void; command: (event: 'game:start'|'game:restart'|'lobby:detach'|'lobby:close'|'lobby:keepalive') => void; announce: (s: string) => void }) {
  const { t } = useTranslation(); const [selected, setSelected] = useState<string[]>([]); const [target, setTarget] = useState(''); const [copyFeedback, setCopyFeedback] = useState(''); const isHost = lobby.hostId === playerId; const me = game?.players.find((p) => p.id === playerId); const enoughPlayers = lobby.players.length >= 2; const everyoneConnected = lobby.players.every((player) => player.connected); const canStart = enoughPlayers && everyoneConnected;
  const protocolList = useRef<HTMLOListElement>(null); const protocolPinnedToBottom = useRef(true); const technicalEvents = events.filter((event) => technicalEventTypes.has(event.type));
  useEffect(() => { if (!protocolOpen || !protocolPinnedToBottom.current) return; const list = protocolList.current; if (list) list.scrollTop = list.scrollHeight; }, [protocolEntries, protocolOpen]);
  const sendAction = (action: object) => socket.emit('game:action', { action, expectedVersion: game?.version }, (raw) => { const result = raw as Ack; if (!result.ok) setError(result.error ?? 'unknown_error'); else { setSelected([]); setTarget(''); } });
  const copy = async (text: string, message: string) => { try { await navigator.clipboard.writeText(text); setCopyFeedback(message); announce(message); } catch { setError('clipboard_unavailable'); } };
  const link = `${location.origin}${location.pathname}?lobby=${lobby.code}`;
  return <>
    <section className={`lobby-heading ${game ? 'in-game' : 'waiting-compact'}`}>{game ? <div className="game-context" aria-label={t('lobby', { code: lobby.code })}><h1 className="game-context-name">{t(lobby.gameId)}</h1><span>{t(lobby.gameId === 'romme' ? 'rommeCards110' : lobby.deckSize === 32 ? 'cards32' : lobby.deckSize === 36 ? 'cards36' : 'cards52')}</span><span className="game-context-code">{t('lobby', { code: lobby.code })}</span></div> : <><div className="lobby-context"><h1>{t('lobby', { code: lobby.code })}</h1><span>{t(lobby.gameId)}</span><span>{t(lobby.gameId === 'romme' ? 'rommeCards110' : lobby.deckSize === 32 ? 'cards32' : lobby.deckSize === 36 ? 'cards36' : 'cards52')}</span></div><div className="share-block"><div className="share-actions"><button onClick={() => void copy(lobby.code, t('codeCopied'))}>{t('copyCode')}</button><button onClick={() => void copy(link, t('linkCopied'))}>{t('copyLink')}</button>{'share' in navigator && <button onClick={() => void navigator.share({ title: 'Collection52', url: link })}>{t('share')}</button>}</div>{copyFeedback && <p className="action-feedback" role="status">{copyFeedback}</p>}</div></>}</section>
    <section className="players panel compact" aria-labelledby="players-title"><h2 id="players-title">{t('playerList')}</h2><ul>{lobby.players.map((p) => { const gamePlayer = game?.players.find((player) => player.id === p.id); const handCount = gamePlayer ? gamePlayer.handCount ?? gamePlayer.hand.length : undefined; const knackPlayer = lobby.gameId === 'schwimmen' ? gamePlayer as KnackGameView['players'][number] | undefined : undefined; const lifeDetail = knackPlayer ? knackPlayer.eliminated ? t('knackEliminated') : knackPlayer.swimming ? t('knackSwimming') : t('knackLives', { count: knackPlayer.lives }) : ''; const detailParts = [handCount !== undefined && lobby.gameId !== 'schwimmen' ? t('handCardsCount', { count: handCount }) : '', lifeDetail, p.isHost ? t('host') : ''].filter(Boolean); const details = detailParts.join(' · '); return <li key={p.id} className={knackPlayer?.eliminated ? 'eliminated' : ''} aria-label={[p.name, ...detailParts].join(', ')}><span className="avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span><span aria-hidden="true"><strong>{p.name}</strong>{details && <small>{details}</small>}<i className={`player-presence ${p.connected ? 'online' : 'offline'}`} /></span></li>; })}</ul></section>
    {isHost && !game && <LobbySettings lobby={lobby} setError={setError} />}
    {!game ? <section className="waiting-room panel"><h2>{t('waiting')}</h2><p>{t('playersCount', { count: lobby.playerCount, max: lobby.maxPlayers })}</p>{isHost && <><button className="primary" disabled={!canStart} aria-describedby={!canStart ? 'start-game-requirement' : undefined} onClick={() => command('game:start')}>{t('startGame')}</button>{!canStart && <p id="start-game-requirement" className="action-hint" role="status">{t(!enoughPlayers ? 'startNeedsPlayers' : 'startNeedsConnections')}</p>}</>}</section> : <>{lobby.gameId === 'schwimmen' ? <KnackBoard game={game as KnackGameView} playerId={playerId} selected={selected} setSelected={setSelected} target={target} setTarget={setTarget} sendAction={sendAction} /> : lobby.gameId === 'mau-mau' ? <MauMauBoard game={game as MauMauGameView} playerId={playerId} selected={selected} setSelected={setSelected} sendAction={sendAction} /> : lobby.gameId === 'romme' ? <RommeBoard game={game as RommeGameView} playerId={playerId} selected={selected} setSelected={setSelected} sendAction={sendAction} /> : <GameBoard game={game as GameView} me={me as GameView['players'][number] | undefined} playerId={playerId} selected={selected} setSelected={setSelected} target={target} setTarget={setTarget} sendAction={sendAction} />}{lobby.gameId === 'schwimmen' && <KnackRoundResultPanel game={game as KnackGameView} sendAction={sendAction} />}<section className="narration-log panel"><div className="section-heading"><div><p className="eyebrow">{t('automaticNarration')}</p><h2>{t('gameProtocol')}</h2></div><button onClick={() => setProtocolOpen(!protocolOpen)} aria-expanded={protocolOpen}>{t(protocolOpen ? 'hideProtocol' : 'showProtocol')}</button></div>{protocolOpen && (protocolEntries.length ? <ol ref={protocolList} onScroll={(event) => { const list = event.currentTarget; protocolPinnedToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= 8; }}>{protocolEntries.map((entry) => <li key={entry.id} className={entry.private ? 'private-entry' : undefined}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><span>{entry.private && <small className="protocol-private-badge">{t('privateProtocol')}</small>}{entry.text}</span></li>)}</ol> : <p>{t('noProtocol')}</p>)}</section></>}
    <section className="utility panel"><div className="button-row"><button onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>{t(historyOpen ? 'hideTechnicalLog' : 'showTechnicalLog')}</button></div>{historyOpen && <div><h2>{t('technicalLog')}</h2>{technicalEvents.length ? <ol className="history">{technicalEvents.map((e) => <li key={e.id}>{new Date(e.timestamp).toLocaleTimeString()} · {t(eventTranslationKey(e.type), { name: lobby.players.find((p) => p.id === e.actorId)?.name ?? String(e.data.name ?? ''), defaultValue: e.type })}</li>)}</ol> : <p>{t('noTechnicalLog')}</p>}</div>}</section>
    <section className="danger-zone panel"><div className="button-row">{isHost && game && <button onClick={() => { if (confirm(t('confirmClose'))) command('game:restart'); }}>{t('restartGame')}</button>} {!isHost && <button onClick={() => { if (confirm(t('confirmTemporaryLeave'))) command('lobby:detach'); }}>{t('leaveLobby')}</button>} {isHost && <button className="danger" onClick={() => { if (confirm(t('confirmClose'))) command('lobby:close'); }}>{t('closeLobby')}</button>}</div></section>
  </>;
}

function useHandSorting<T extends RommeCard>(cards: readonly T[]) {
  const [settings, setSettings] = useState<HandSortSettings>(loadHandSortSettings);
  const [order, setOrder] = useState<string[]>(() => reconcileHandOrder([], cards, settings));
  const displayOrder = reconcileHandOrder(order, cards, settings); const byId = new Map(cards.map((card) => [card.id, card])); const sortedCards = displayOrder.map((id) => byId.get(id)).filter((card): card is T => Boolean(card));
  useEffect(() => { setOrder((current) => { const next = reconcileHandOrder(current, cards, settings); return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next; }); }, [cards, settings]);
  useEffect(() => { localStorage.setItem(handSortKey, JSON.stringify(settings)); }, [settings]);
  const setMode = (mode: HandSortMode) => { setOrder(displayOrder); setSettings((current) => ({ ...current, mode })); };
  const setDirection = (direction: HandSortDirection) => { setOrder(displayOrder); setSettings((current) => ({ ...current, direction })); };
  return { cards:sortedCards, settings, setMode, setDirection };
}

function useNewHandCards(cards: readonly { id: string }[], gameId: string) {
  const signature = cards.map((card) => card.id).join('|');
  const previous = useRef({ gameId, ids:new Set(cards.map((card) => card.id)) });
  const timer = useRef<number | undefined>(undefined);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const currentIds = new Set(cards.map((card) => card.id));
    if (previous.current.gameId !== gameId) {
      previous.current = { gameId, ids:currentIds }; setNewCardIds(new Set()); return;
    }
    const additions = cards.filter((card) => !previous.current.ids.has(card.id)).map((card) => card.id);
    previous.current = { gameId, ids:currentIds };
    if (!additions.length) return;
    window.clearTimeout(timer.current); setNewCardIds(new Set(additions));
    timer.current = window.setTimeout(() => setNewCardIds(new Set()), 1500);
  }, [cards, gameId, signature]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return newCardIds;
}

function HandSortControls({ settings, setMode, setDirection }: { settings: HandSortSettings; setMode: (mode: HandSortMode) => void; setDirection: (direction: HandSortDirection) => void }) {
  const { t } = useTranslation(); const ascending = settings.direction === 'asc';
  return <div className="hand-sort-controls"><ResponsiveSelect label={t('handSort')} value={settings.mode} onChange={(value) => setMode(value as HandSortMode)} options={[{ value:'suit', label:t('handSortSuit') },{ value:'rank', label:t('handSortRank') },{ value:'none', label:t('handSortNone') }]} /><button type="button" className="hand-sort-direction" disabled={settings.mode === 'none'} aria-label={t(ascending ? 'handSortAscending' : 'handSortDescending')} onClick={() => setDirection(ascending ? 'desc' : 'asc')}><span aria-hidden="true">{ascending ? '↑' : '↓'}</span><span className="hand-sort-direction-label">{t(ascending ? 'handSortAscending' : 'handSortDescending')}</span></button></div>;
}

function KnackRoundResultPanel({ game, sendAction }: { game: KnackGameView; sendAction: (action: object) => void }) {
  const { t } = useTranslation(); const panel = useRef<HTMLElement>(null); const scrolledResult = useRef(''); const roundResult = game.roundResult ?? game.lastRoundResult;
  useEffect(() => {
    if (!game.roundResult) return;
    const resultKey = `${game.id}:${game.roundNumber}:${game.roundResult.reason}`; if (scrolledResult.current === resultKey) return; scrolledResult.current = resultKey;
    const frame = window.requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior:document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center' }));
    return () => window.cancelAnimationFrame(frame);
  }, [game.id, game.roundNumber, game.roundResult]);
  if (!roundResult) return null;
  const playerName = (id:string) => game.players.find((player) => player.id === id)?.name ?? '';
  const scoreText = (score:KnackRoundResult['scores'][number]) => score.label === 'fire' ? t('knackFire') : score.label === 'thirty-one' ? t('knackThirtyOne') : t('knackPoints', { score:String(score.score).replace('.', ',') });
  const title = game.phase === 'finished' ? t('knackGameOver') : t(game.roundResult ? 'knackRoundResult' : 'knackLastRoundResult');
  return <section ref={panel} className="result panel knack-round-result" role="status"><div><p className="eyebrow">{t(`knackReason_${roundResult.reason}`)}</p><h2>{title}</h2></div><ol>{[...roundResult.scores].sort((left,right) => right.score-left.score).map((score) => <li key={score.playerId} className={roundResult.loserIds.includes(score.playerId) ? 'lost-life' : ''}><strong>{playerName(score.playerId)}</strong><span>{scoreText(score)}</span>{roundResult.loserIds.includes(score.playerId) && <small>{t('knackLifeLost')}</small>}</li>)}</ol>{game.phase === 'round-ended' && game.roundResult && <button className="primary" onClick={() => sendAction({ type:'schwimmen:next-round' })}>{t('knackNextRound')}</button>}{game.phase === 'finished' && <p className="knack-winner">{t('knackWinner', { name:playerName(game.result?.winnerId ?? '') })}</p>}</section>;
}

function GameBoard({ game, me, playerId, selected, setSelected, target, setTarget, sendAction }: { game: GameView; me: GameView['players'][number] | undefined; playerId: string; selected: string[]; setSelected: (v: string[]) => void; target: string; setTarget: (v: string) => void; sendAction: (a: object) => void }) {
  const { t } = useTranslation(); const playerName = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) => t('card', { suit: t(`suit_${card.suit}`), rank: t(`rank_${card.rank}`, { defaultValue: card.rank }) });
  const defenderIndex = game.players.findIndex((p) => p.id === game.defenderId); const circular = [...game.players.slice(defenderIndex + 1), ...game.players.slice(0, defenderIndex)]; const original = game.players.find((p) => p.id === game.roundAttackerId); const eligible = [original, ...circular.filter((p) => p.id !== original?.id)].filter((p): p is NonNullable<typeof p> => Boolean(p && !p.eliminated && p.id !== game.defenderId && (p.handCount ?? p.hand.length) > 0)); const expectedThrower = eligible.find((p) => !game.passedPlayerIds.includes(p.id));
  const isActive = Boolean(me?.connected && !me.eliminated); const canAttack = isActive && game.table.length < game.roundAttackLimit && (game.phase === 'attack' ? playerId === game.attackerId : game.phase === 'throw-in' && expectedThrower?.id === playerId); const canDefend = isActive && playerId === game.defenderId && game.phase === 'defense';
  const tableRanks = new Set(game.table.flatMap((pair) => pair.defense ? [pair.attack.rank, pair.defense.rank] : [pair.attack.rank])); const uncoveredPairs = game.table.filter((pair) => !pair.defense); const targetPair = uncoveredPairs.find((pair) => pair.attack.id === target); const selectedCards = selected.map((id) => me?.hand.find((card) => card.id === id)).filter((card): card is Card => Boolean(card)); const selectedCard = selectedCards[0]; const openingRank = game.phase === 'attack' ? selectedCard?.rank : undefined; const availableAttackSlots = game.roundAttackLimit - game.table.length;
  const isHandCardPlayable = (card: Card) => {
    if (canAttack) {
      if (game.phase === 'attack') return selected.includes(card.id) || ((!openingRank || card.rank === openingRank) && selectedCards.length < availableAttackSlots);
      return tableRanks.has(card.rank) && (selected.includes(card.id) || selectedCards.length === 0);
    }
    return Boolean(canDefend && (targetPair ? beats(card, targetPair.attack, game.trumpSuit) : uncoveredPairs.some((pair) => beats(card, pair.attack, game.trumpSuit))));
  };
  const isTargetPlayable = (pair: TablePair) => canDefend && !pair.defense && (!selectedCard || beats(selectedCard, pair.attack, game.trumpSuit)); const activeSelected = selectedCards.filter(isHandCardPlayable).map((card) => card.id); const activeTarget = targetPair && isTargetPlayable(targetPair) ? targetPair.attack.id : '';
  const toggleHandCard = (card: Card) => {
    if (selected.includes(card.id)) { setSelected(selected.filter((id) => id !== card.id)); if (canDefend) setTarget(''); return; }
    if (canDefend) {
      const currentTarget = targetPair && beats(card, targetPair.attack, game.trumpSuit) ? targetPair : undefined;
      const automaticTarget = currentTarget ?? uncoveredPairs.filter((pair) => beats(card, pair.attack, game.trumpSuit)).sort((left, right) => {
        const leftSameSuit = left.attack.suit === card.suit ? 1 : 0; const rightSameSuit = right.attack.suit === card.suit ? 1 : 0;
        return rightSameSuit - leftSameSuit || rankValue(right.attack) - rankValue(left.attack);
      })[0];
      setSelected([card.id]); setTarget(automaticTarget?.attack.id ?? ''); return;
    }
    setSelected(game.phase === 'attack' ? [...activeSelected, card.id] : [card.id]);
  };
  return <section className="game-board" aria-labelledby="game-title"><div className="status-card"><p className="eyebrow">{t('phase')}</p><h2 id="game-title">{t(`phase_${game.phase}`)}</h2><dl><div><dt>{t('attacker')}</dt><dd>{playerName(game.attackerId)}</dd></div><div><dt>{t('defender')}</dt><dd>{playerName(game.defenderId)}</dd></div><div><dt>{t('trump')}</dt><dd>{t(`suit_${game.trumpSuit}`)} <span className="trump-symbol" aria-hidden="true">{suitSymbols[game.trumpSuit]}</span></dd></div><div><dt>{t('deck', { count: game.deckCount })}</dt><dd aria-hidden="true">🂠 × {game.deckCount}</dd></div></dl></div>
    <div className="table panel"><h2>{t('table')}</h2>{game.table.length === 0 ? <p>{t('emptyTable')}</p> : <ol className="table-cards">{game.table.map((pair, index) => { const playable = isTargetPlayable(pair); return <li key={pair.attack.id}><button className={`playing-card ${activeTarget === pair.attack.id ? 'selected' : ''}`} disabled={!playable} aria-pressed={activeTarget === pair.attack.id} onClick={() => setTarget(activeTarget === pair.attack.id ? '' : pair.attack.id)}><CardFace card={pair.attack} /><span className="sr-only">{t('attackCard', { index: index + 1 })}: {cardText(pair.attack)}. {pair.defense ? cardText(pair.defense) : t('uncovered')}</span></button>{pair.defense && <div className="playing-card defense" aria-label={cardText(pair.defense)}><CardFace card={pair.defense} /></div>}</li>; })}</ol>}</div>
    <div className="hand panel"><div className="section-heading hand-heading"><h2>{t('yourHand', { count: me?.hand.length ?? 0 })}</h2><HandSortControls settings={handSorting.settings} setMode={handSorting.setMode} setDirection={handSorting.setDirection} /></div><div className="hand-cards" role="group" aria-label={t('yourHand', { count: me?.hand.length ?? 0 })}>{handSorting.cards.map((card, index) => { const playable = isHandCardPlayable(card); const isSelected = activeSelected.includes(card.id); return <button key={card.id} data-card-id={card.id} className={`playing-card ${isSelected ? 'selected' : ''} ${newCardIds.has(card.id) ? 'newly-drawn' : ''}`} disabled={!playable} aria-pressed={isSelected} onClick={() => toggleHandCard(card)} aria-label={t('handCard', { card: cardText(card), index: index + 1, count: me?.hand.length ?? 0, state: playable ? t('playable') : t('notPlayable') })}><CardFace card={card} /></button>; })}</div></div>
    <div className="actions panel"><h2>{t('actions')}</h2><div className="button-row">{canAttack && <button className="primary" disabled={!activeSelected.length} onClick={() => sendAction({ type: 'attack', cardIds: activeSelected })}>{t('playAttack')}</button>}{canDefend && <button className="primary" disabled={activeSelected.length !== 1 || !activeTarget} onClick={() => sendAction({ type: 'defend', cardId: activeSelected[0], attackCardId: activeTarget })}>{t('defendWith')}</button>}{canDefend && <button onClick={() => sendAction({ type: 'take' })}>{t('take')}</button>}{expectedThrower?.id === playerId && game.phase === 'throw-in' && <button onClick={() => sendAction({ type: 'pass' })}>{t('pass')}</button>}</div></div>
    {game.phase === 'finished' && <div className="result panel" role="status"><h2>{t('result')}</h2><p>{game.result?.draw ? t('draw') : t('durakResult', { name: playerName(game.result?.durakId ?? '') })}</p></div>}</section>;
}

function KnackBoard({ game, playerId, selected, setSelected, target, setTarget, sendAction }: { game: KnackGameView; playerId: string; selected: string[]; setSelected: (value: string[]) => void; target: string; setTarget: (value: string) => void; sendAction: (action: object) => void }) {
  const { t } = useTranslation(); const me = game.players.find((player) => player.id === playerId); const current = game.players.find((player) => player.id === game.currentPlayerId); const playerName = (id?: string) => game.players.find((player) => player.id === id)?.name ?? '';
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) => t('card', { suit: t(`suit_${card.suit}`), rank: t(`rank_${card.rank}`, { defaultValue: card.rank }) });
  const canAct = game.phase === 'playing' && current?.id === playerId && Boolean(me?.connected && !me.eliminated); const selectedCard = me?.hand.find((card) => card.id === selected[0]); const centerCard = game.center.find((card) => card.id === target); const ownScore = me?.hand.length === 3 ? scoreKnackHand(me.hand) : undefined;
  return <section className="game-board knack-board" aria-labelledby="knack-game-title">
    <div className="status-card"><p className="eyebrow">{t('phase')}</p><h2 id="knack-game-title">{t(`knackPhase_${game.phase}`)}</h2><dl><div><dt>{t('knackRound')}</dt><dd>{game.roundNumber}</dd></div><div><dt>{t('turn')}</dt><dd>{game.phase === 'playing' ? playerName(game.currentPlayerId) : '–'}</dd></div><div><dt>{t('knackStock')}</dt><dd>{game.deckCount}</dd></div><div><dt>{t('knackYourScore')}</dt><dd>{ownScore === undefined ? '–' : ownScore === 32 ? t('knackFire') : ownScore === 31 ? t('knackThirtyOne') : String(ownScore).replace('.', ',')}</dd></div>{game.closingPlayerId && <div className="knack-closing"><dt>{t('knackKnocked')}</dt><dd>{playerName(game.closingPlayerId)}</dd></div>}</dl></div>
    <div className="table panel knack-table"><div className="section-heading"><div><p className="eyebrow">{t('knackExchange')}</p><h2>{t('knackCenter')}</h2></div><span className="knack-stock" aria-label={t('deck', { count: game.deckCount })}>🂠 × {game.deckCount}</span></div><div className="knack-center-cards" role="group" aria-label={t('knackCenter')}>{game.center.map((card, index) => <button key={card.id} className={`playing-card ${target === card.id ? 'selected' : ''}`} disabled={!canAct} aria-pressed={target === card.id} aria-label={t('knackCenterCard', { card: cardText(card), index: index + 1 })} onClick={() => setTarget(target === card.id ? '' : card.id)}><CardFace card={card} /></button>)}</div></div>
    <div className="hand panel"><div className="section-heading hand-heading"><h2>{t('yourHand', { count: me?.hand.length ?? 0 })}</h2><div className="hand-heading-tools">{ownScore !== undefined && <span className="knack-score-badge">{t('knackScoreBadge', { score: ownScore === 32 ? t('knackFire') : String(ownScore).replace('.', ',') })}</span>}<HandSortControls settings={handSorting.settings} setMode={handSorting.setMode} setDirection={handSorting.setDirection} /></div></div><div className="hand-cards" role="group" aria-label={t('yourHand', { count: me?.hand.length ?? 0 })}>{handSorting.cards.map((card, index) => <button key={card.id} data-card-id={card.id} className={`playing-card ${selected[0] === card.id ? 'selected' : ''} ${newCardIds.has(card.id) ? 'newly-drawn' : ''}`} disabled={!canAct} aria-pressed={selected[0] === card.id} aria-label={t('handCard', { card: cardText(card), index: index + 1, count: me?.hand.length ?? 0, state: canAct ? t('playable') : t('notPlayable') })} onClick={() => setSelected(selected[0] === card.id ? [] : [card.id])}><CardFace card={card} /></button>)}</div></div>
    {game.phase === 'playing' && <div className="actions panel"><h2>{t('actions')}</h2><div className="button-row"><button className="primary" disabled={!canAct || !selectedCard || !centerCard} onClick={() => sendAction({ type: 'schwimmen:swap-one', handCardId: selectedCard?.id, centerCardId: centerCard?.id })}>{t('knackSwapOne')}</button><button disabled={!canAct} onClick={() => sendAction({ type: 'schwimmen:swap-all' })}>{t('knackSwapAll')}</button><button disabled={!canAct} onClick={() => sendAction({ type: 'schwimmen:pass' })}>{t('knackPass')}</button><button disabled={!canAct || Boolean(game.closingPlayerId)} onClick={() => sendAction({ type: 'schwimmen:knock' })}>{t('knackKnock')}</button></div>{!canAct && current && <p className="action-hint">{t('knackWaitingFor', { name: current.name })}</p>}</div>}
  </section>;
}

function MauMauBoard({ game, playerId, selected, setSelected, sendAction }: { game: MauMauGameView; playerId: string; selected: string[]; setSelected: (value: string[]) => void; sendAction: (action: object) => void }) {
  const { t } = useTranslation(); const [chosenSuit, setChosenSuit] = useState<Suit>();
  const me = game.players.find((player) => player.id === playerId); const current = game.players.find((player) => player.id === game.currentPlayerId); const topCard = game.discard.at(-1); const selectedCard = me?.hand.find((card) => card.id === selected[0]); const canAct = game.phase === 'playing' && current?.id === playerId && Boolean(me?.connected);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  const cardText = (card: Card) => t('card', { suit: t(`suit_${card.suit}`), rank: t(`rank_${card.rank}`, { defaultValue: card.rank }) });
  const isPlayable = (card: Card) => Boolean(canAct && topCard && (!game.drawnCardId || game.drawnCardId === card.id) && (!game.pendingDraw || card.rank === '7') && canPlayMauMauCard(card, topCard, game.activeSuit) && !(game.rules.forbidJackOnJack && card.rank === 'jack' && topCard.rank === 'jack') && !(game.rules.forbidJackAsFinal && card.rank === 'jack' && me?.hand.length === 1));
  const hasPlayableCard = Boolean(me?.hand.some(isPlayable)); const playReady = Boolean(canAct && selectedCard && isPlayable(selectedCard) && (selectedCard.rank !== 'jack' || chosenSuit));
  useEffect(() => { setChosenSuit(undefined); }, [selectedCard?.id]);
  const playerName = (id?: string) => game.players.find((player) => player.id === id)?.name ?? '';
  return <section className="game-board mau-mau-board" aria-labelledby="mau-mau-game-title">
    <div className="status-card"><p className="eyebrow">{t('phase')}</p><h2 id="mau-mau-game-title">{t(`mauMauPhase_${game.phase}`)}</h2><dl><div><dt>{t('turn')}</dt><dd>{game.phase === 'playing' ? playerName(game.currentPlayerId) : '–'}</dd></div><div><dt>{t('mauMauActiveSuit')}</dt><dd><span aria-hidden="true" className={game.activeSuit === 'hearts' || game.activeSuit === 'diamonds' ? 'red-suit' : ''}>{suitSymbols[game.activeSuit]} </span>{t(`suit_${game.activeSuit}`)}</dd></div><div><dt>{t('mauMauStock')}</dt><dd>{game.deckCount}</dd></div><div><dt>{game.pendingDraw ? t('mauMauPendingDraw') : t('mauMauDirection')}</dt><dd>{game.pendingDraw ? `+${game.pendingDraw}` : t(game.direction === 1 ? 'mauMauClockwise' : 'mauMauCounterClockwise')}</dd></div></dl></div>
    <div className="table panel mau-mau-table"><div className="section-heading"><div><p className="eyebrow">{t('mauMauDiscard')}</p><h2>{t('mauMauTopCard')}</h2></div><span className="knack-stock" aria-label={t('deck', { count: game.deckCount })}>🂠 × {game.deckCount}</span></div><div className="mau-mau-piles">{topCard && <div className={`mau-mau-discard-card ${game.discardCount > 1 ? 'stacked' : ''}`} aria-label={cardText(topCard)}><CardFace card={topCard} /></div>}<div className="mau-mau-suit"><span>{t('mauMauRequestedSuit')}</span><strong><span aria-hidden="true">{suitSymbols[game.activeSuit]} </span>{t(`suit_${game.activeSuit}`)}</strong></div></div></div>
    <div className="hand panel"><div className="section-heading hand-heading"><h2>{t('yourHand', { count: me?.hand.length ?? 0 })}</h2><div className="hand-heading-tools">{game.drawnCardId && <span className="mau-mau-drawn-hint">{t('mauMauDrawnChoice')}</span>}<HandSortControls settings={handSorting.settings} setMode={handSorting.setMode} setDirection={handSorting.setDirection} /></div></div><div className="hand-cards" role="group" aria-label={t('yourHand', { count: me?.hand.length ?? 0 })}>{handSorting.cards.map((card, index) => { const playable = isPlayable(card); return <button key={card.id} data-card-id={card.id} className={`playing-card ${selected[0] === card.id ? 'selected' : ''} ${game.drawnCardId === card.id ? 'just-drawn' : ''} ${newCardIds.has(card.id) ? 'newly-drawn' : ''}`} disabled={!playable} aria-pressed={selected[0] === card.id} aria-label={t('handCard', { card: cardText(card), index: index + 1, count: me?.hand.length ?? 0, state: playable ? t('playable') : t('notPlayable') })} onClick={() => setSelected(selected[0] === card.id ? [] : [card.id])}><CardFace card={card} /></button>; })}</div></div>
    {game.phase === 'playing' && <div className="actions panel mau-mau-actions"><h2>{t('actions')}</h2>{selectedCard?.rank === 'jack' && <fieldset className="mau-mau-suit-choice"><legend>{t('mauMauChooseSuit')}</legend>{(['clubs','diamonds','hearts','spades'] as Suit[]).map((suit) => <button type="button" key={suit} className={chosenSuit === suit ? 'selected' : ''} aria-pressed={chosenSuit === suit} onClick={() => setChosenSuit(suit)}><span aria-hidden="true">{suitSymbols[suit]}</span>{t(`suit_${suit}`)}</button>)}</fieldset>}<div className="button-row"><button className="primary" disabled={!playReady} onClick={() => selectedCard && sendAction({ type: 'mau-mau:play', cardId: selectedCard.id, ...(selectedCard.rank === 'jack' ? { chosenSuit } : {}) })}>{t('mauMauPlayCard')}</button>{game.drawnCardId ? <button disabled={!canAct} onClick={() => sendAction({ type: 'mau-mau:pass' })}>{t('mauMauKeepCard')}</button> : <button disabled={!canAct || (!game.pendingDraw && hasPlayableCard)} onClick={() => sendAction({ type: 'mau-mau:draw' })}>{t(game.pendingDraw ? 'mauMauTakePenalty' : 'mauMauDrawCard', { count: game.pendingDraw })}</button>}</div>{!canAct && current && <p className="action-hint">{t('mauMauWaitingFor', { name: current.name })}</p>}{canAct && !game.drawnCardId && hasPlayableCard && <p className="action-hint">{t(game.pendingDraw ? 'mauMauStackHint' : 'mauMauPlayableHint', { count: game.pendingDraw })}</p>}</div>}
    {game.phase === 'finished' && <div className="result panel" role="status"><h2>{t('result')}</h2><p>{t('mauMauWinner', { name: playerName(game.result?.winnerId) })}</p></div>}
  </section>;
}

function RommeBoard({ game, playerId, selected, setSelected, sendAction }: { game: RommeGameView; playerId: string; selected: string[]; setSelected: (value: string[]) => void; sendAction: (action: object) => void }) {
  const { t } = useTranslation(); const [groups, setGroups] = useState<Array<{ kind:'set'|'run'; cardIds:string[] }>>([]); const me = game.players.find((player) => player.id === playerId); const current = game.players.find((player) => player.id === game.currentPlayerId); const canAct = game.phase === 'playing' && game.currentPlayerId === playerId; const top = game.discard.at(-1);
  const handSorting = useHandSorting(me?.hand ?? []);
  const newCardIds = useNewHandCards(me?.hand ?? [], game.id);
  useEffect(() => { setSelected([]); setGroups([]); }, [game.version]);
  const name = (id:string) => game.players.find((player) => player.id === id)?.name ?? '–';
  const cardText = (card:RommeCard) => card.rank === 'joker' ? t('rommeJoker') : t('card', { suit:t(`suit_${card.suit}`), rank:t(`rank_${card.rank}`, { defaultValue:card.rank }) });
  const stagedIds = new Set(groups.flatMap((group) => group.cardIds));
  const selectedCards = selected.map((id) => me?.hand.find((card) => card.id === id)).filter((card): card is RommeCard => Boolean(card));
  const selectedMeld = selectedCards.length === selected.length ? detectRommeMeld(selectedCards) : undefined;
  const replacementFits = (meld:RommeGameView['melds'][number], jokerId:string, replacement:RommeCard) => { if (replacement.rank === 'joker') return false; const replaced = meld.cards.map((card) => card.id === jokerId ? replacement : card); return isValidRommeMeld(meld.kind,replaced) && (meld.kind !== 'set' || replaced.length === 4); };
  const canLayOff = (meld:RommeGameView['melds'][number]) => selectedCards.length === selected.length && selectedCards.length > 0 && isValidRommeMeld(meld.kind,[...meld.cards,...selectedCards]);
  const isPotentialJokerExchange = (cards:RommeCard[]) => Boolean(me?.opened) && game.melds.some((meld) => { const tableJoker = meld.cards.find((card) => card.rank === 'joker'); if (!tableJoker) return false; const selectedReplacementWorks = cards.some((replacement) => replacementFits(meld,tableJoker.id,replacement) && isPotentialRommeMeld([tableJoker,...cards.filter((card) => card.id !== replacement.id)])); if (selectedReplacementWorks) return true; return (me?.hand ?? []).some((replacement) => !stagedIds.has(replacement.id) && !cards.some((card) => card.id === replacement.id) && replacementFits(meld,tableJoker.id,replacement)) && isPotentialRommeMeld([tableJoker,...cards]); });
  const canExchangeJoker = (meld:RommeGameView['melds'][number], tableJoker:RommeCard) => selectedCards.some((replacement) => replacementFits(meld,tableJoker.id,replacement) && Boolean(detectRommeMeld([tableJoker,...selectedCards.filter((card) => card.id !== replacement.id)])));
  const canAddToSelection = (card:RommeCard) => !selected.length || isPotentialRommeMeld([...selectedCards, card]) || isPotentialJokerExchange([...selectedCards, card]);
  const toggle = (id:string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const stage = () => { if (!selectedMeld) return; setGroups([...groups, { kind:selectedMeld.kind, cardIds:[...selected] }]); setSelected([]); };
  return <section className="game-board romme-board" aria-labelledby="romme-title">
    <div className="status-card"><p className="eyebrow">{t('phase')}</p><h2 id="romme-title">{t(`rommePhase_${game.phase}`)}</h2><dl><div><dt>{t('turn')}</dt><dd>{game.phase === 'playing' ? name(game.currentPlayerId) : '–'}</dd></div><div><dt>{t('rommeStock')}</dt><dd>{game.deckCount}</dd></div><div><dt>{t('rommeOpening')}</dt><dd>{t('rommeOpeningPoints', { count:game.rules.openingPoints })}</dd></div><div><dt>{t('rommeYourStatus')}</dt><dd>{t(me?.opened ? 'rommeOpened' : 'rommeNotOpened')}</dd></div></dl></div>
    <div className="table panel romme-table"><div className="section-heading"><div><p className="eyebrow">{t('rommeTable')}</p><h2>{t('rommeMelds')}</h2></div><span className="knack-stock">🂠 × {game.deckCount}</span></div><div className="romme-melds">{game.melds.length ? game.melds.map((meld) => { const tableJoker = meld.cards.find((card) => card.rank === 'joker'); return <article key={meld.id} className="romme-meld"><header><strong>{t(meld.kind === 'set' ? 'rommeSet' : 'rommeRun')}</strong><small>{name(meld.ownerId)}</small></header><div>{meld.cards.map((card) => <span className="romme-table-card" key={card.id} aria-label={cardText(card)}><CardFace card={card} /></span>)}</div>{canAct && me?.opened && game.hasDrawn && <><button disabled={!canLayOff(meld)} onClick={() => sendAction({ type:'romme:lay-off', meldId:meld.id, cardIds:selected })}>{t('rommeLayOff')}</button>{tableJoker && <div className="romme-joker-actions"><button disabled={!canExchangeJoker(meld,tableJoker)} onClick={() => sendAction({ type:'romme:replace-joker', meldId:meld.id, jokerId:tableJoker.id, cardIds:selected })}>{t('rommeExchangeJoker')}</button></div>}</>}</article>; }) : <p className="empty-table">{t('rommeNoMelds')}</p>}</div></div>
    <div className="panel romme-discard"><div><p className="eyebrow">{t('rommeDiscard')}</p>{top && <span className={`romme-table-card ${game.discardCount > 1 ? 'stacked' : ''}`} aria-label={cardText(top)}><CardFace card={top} /></span>}</div><div className="button-row"><button className="primary" disabled={!canAct || game.hasDrawn || !game.deckCount} onClick={() => sendAction({ type:'romme:draw', source:'stock' })}>{t('rommeDrawStock')}</button><button disabled={!canAct || game.hasDrawn || !top} onClick={() => sendAction({ type:'romme:draw', source:'discard' })}>{t('rommeTakeDiscard')}</button></div></div>
    <div className="hand panel"><div className="section-heading hand-heading"><h2>{t('yourHand', { count:me?.hand.length ?? 0 })}</h2><div className="hand-heading-tools">{game.hasDrawn && <span className="mau-mau-drawn-hint">{t('rommeDrawn')}</span>}<HandSortControls settings={handSorting.settings} setMode={handSorting.setMode} setDirection={handSorting.setDirection} /></div></div><div className="hand-cards">{handSorting.cards.map((card, index) => { const selectedCard = selected.includes(card.id); const selectable = selectedCard || canAddToSelection(card); return <button key={card.id} data-card-id={card.id} className={`playing-card ${selectedCard ? 'selected' : ''} ${stagedIds.has(card.id) ? 'staged' : ''} ${newCardIds.has(card.id) ? 'newly-drawn' : ''}`} disabled={!canAct || !game.hasDrawn || stagedIds.has(card.id) || !selectable} aria-pressed={selectedCard} aria-label={t('handCard', { card:cardText(card), index:index+1, count:me?.hand.length ?? 0, state:selectable ? '' : t('notPlayable') })} onClick={() => toggle(card.id)}><CardFace card={card} /></button>; })}</div></div>
    {game.phase === 'playing' && <div className="actions panel romme-actions"><h2>{t('actions')}</h2>{groups.length > 0 && <ol className="romme-staged">{groups.map((group,index) => <li key={`${group.kind}-${index}`}><span>{t(group.kind === 'set' ? 'rommeSet' : 'rommeRun')} · {group.cardIds.length}</span><button onClick={() => setGroups(groups.filter((_,groupIndex) => groupIndex !== index))}>{t('remove')}</button></li>)}</ol>}<div className="button-row"><button disabled={!canAct || !game.hasDrawn || !selectedMeld} onClick={stage}>{t('rommeStageMeld')}</button><button className="primary" disabled={!canAct || !game.hasDrawn || !groups.length} onClick={() => sendAction({ type:'romme:meld', groups:groups.map((group) => ({ cardIds:group.cardIds })) })}>{t(me?.opened ? 'rommeMeld' : 'rommeOpen')}</button><button disabled={!canAct || !game.hasDrawn || selected.length !== 1} onClick={() => sendAction({ type:'romme:discard', cardId:selected[0] })}>{t('rommeDiscardCard')}</button></div>{!canAct && current && <p className="action-hint">{t('rommeWaitingFor', { name:current.name })}</p>}</div>}
    {game.phase === 'finished' && <div className="result panel"><h2>{t('result')}</h2><p>{t('rommeWinner', { name:name(game.result?.winnerId ?? '') })}</p>{game.result && <ul>{Object.entries(game.result.handPoints).map(([id,points]) => <li key={id}>{name(id)}: {t('rommePoints', { count:points })}</li>)}</ul>}</div>}
  </section>;
}

function CardFace({ card }: { card: RommeCard }) { const faces: Record<string,string> = { jack:'J', queen:'Q', king:'K', ace:'A' }; if (card.rank === 'joker') return <span aria-hidden="true" className="joker"><b>JOKER</b></span>; return <span aria-hidden="true" className={card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : ''}><b>{faces[card.rank] ?? card.rank}</b><i>{suitSymbols[card.suit]}</i></span>; }

function LobbySettings({ lobby, setError }: { lobby: PublicLobby; setError: (value: string) => void }) {
  const { t } = useTranslation(); const [maxPlayers, setMaxPlayers] = useState(lobby.maxPlayers); const [deckSize, setDeckSize] = useState<36 | 52>(lobby.deckSize === 52 ? 52 : 36); const [visibility, setVisibility] = useState(lobby.visibility); const [passwordEnabled, setPasswordEnabled] = useState(lobby.passwordProtected); const [password, setPassword] = useState(''); const [saved, setSaved] = useState(false); const [mauMauRules, setMauMauRules] = useState<MauMauRules>(lobby.mauMauRules ?? defaultMauMauRules); const [rommeRules, setRommeRules] = useState<RommeRules>(lobby.rommeRules ?? defaultRommeRules);
  const updateMauMauRule = <K extends keyof MauMauRules>(key: K, value: MauMauRules[K]) => { setSaved(false); setMauMauRules((current) => ({ ...current, [key]: value })); };
  const savedMauMauRules = lobby.mauMauRules ?? defaultMauMauRules; const mauMauRulesChanged = lobby.gameId === 'mau-mau' && (Object.keys(defaultMauMauRules) as Array<keyof MauMauRules>).some((key) => mauMauRules[key] !== savedMauMauRules[key]); const savedRommeRules = lobby.rommeRules ?? defaultRommeRules; const rommeRulesChanged = lobby.gameId === 'romme' && (rommeRules.openingPoints !== savedRommeRules.openingPoints || rommeRules.requireDiscardUse !== savedRommeRules.requireDiscardUse); const hasSettingsChanges = maxPlayers !== lobby.maxPlayers || visibility !== lobby.visibility || (lobby.gameId === 'durak' && deckSize !== lobby.deckSize) || mauMauRulesChanged || rommeRulesChanged || passwordEnabled !== lobby.passwordProtected || Boolean(password); const passwordReady = !passwordEnabled || lobby.passwordProtected || Boolean(password);
  return <form className="panel lobby-settings" aria-labelledby="lobby-settings-title" onSubmit={(event) => { event.preventDefault(); if (!hasSettingsChanges || !passwordReady) return; setSaved(false); const passwordChange = passwordEnabled ? (password ? { password } : {}) : (lobby.passwordProtected ? { password: '' } : {}); socket.emit('lobby:update', { maxPlayers, ...(lobby.gameId === 'durak' ? { deckSize } : {}), ...(lobby.gameId === 'mau-mau' ? { mauMauRules } : {}), ...(lobby.gameId === 'romme' ? { rommeRules } : {}), visibility, ...passwordChange }, (raw) => { const result = raw as Ack; if (!result.ok) setError(result.error ?? 'unknown_error'); else { if (lobby.gameId === 'mau-mau') localStorage.setItem('c52:mau-mau-rules', JSON.stringify(mauMauRules)); if (lobby.gameId === 'romme') localStorage.setItem('c52:romme-rules', JSON.stringify(rommeRules)); setPassword(''); setSaved(true); } }); }}><h2 id="lobby-settings-title">{t('lobbySettings')}</h2>{lobby.gameId === 'durak' ? <label>{t('deckSize')}<ResponsiveSelect label={t('deckSize')} value={String(deckSize)} onChange={(value) => { setSaved(false); setDeckSize(Number(value) as 36|52); }} options={[{ value:'36', label:t('cards36') },{ value:'52', label:t('cards52') }]} /></label> : <div className="fixed-setting"><span>{t('deckSize')}</span><strong>{t(lobby.gameId === 'romme' ? 'rommeCards110' : 'cards32')}</strong></div>}<label>{t('maxPlayers')}<ResponsiveSelect label={t('maxPlayers')} value={String(maxPlayers)} onChange={(value) => { setSaved(false); setMaxPlayers(Number(value)); }} options={[2,3,4,5,6].map((count) => ({ value:String(count), label:String(count), disabled:count < lobby.playerCount }))} /></label><label>{t('visibility')}<ResponsiveSelect label={t('visibility')} value={visibility} onChange={(value) => { setSaved(false); setVisibility(value as 'public'|'private'); }} options={[{ value:'public', label:t('public') },{ value:'private', label:t('private') }]} /></label>{lobby.gameId === 'mau-mau' && <fieldset className="mau-mau-variant-settings"><legend>{t('mauMauVariants')}</legend>{(['stackSevens','forbidJackOnJack','forbidJackAsFinal','aceReverses'] as const).map((key) => <label className="check" key={key}><input type="checkbox" checked={mauMauRules[key]} onChange={(event) => updateMauMauRule(key, event.target.checked)} /><span><strong>{t(`mauMauVariant_${key}`)}</strong><small>{t(`mauMauVariant_${key}Hint`)}</small></span></label>)}</fieldset>}{lobby.gameId === 'romme' && <fieldset className="mau-mau-variant-settings"><legend>{t('rommeVariants')}</legend><label>{t('rommeOpeningThreshold')}<ResponsiveSelect label={t('rommeOpeningThreshold')} value={String(rommeRules.openingPoints)} onChange={(value) => { setSaved(false); setRommeRules({ ...rommeRules, openingPoints:Number(value) as 30|40 }); }} options={[{value:'40',label:t('romme40Points')},{value:'30',label:t('romme30Points')}]}/></label><label className="check"><input type="checkbox" checked={rommeRules.requireDiscardUse} onChange={(event) => { setSaved(false); setRommeRules({ ...rommeRules, requireDiscardUse:event.target.checked }); }}/><span><strong>{t('rommeRequireDiscardUse')}</strong><small>{t('rommeRequireDiscardUseHint')}</small></span></label></fieldset>}<label className="check"><input type="checkbox" checked={passwordEnabled} onChange={(event) => { setSaved(false); setPasswordEnabled(event.target.checked); }} />{t('passwordProtection')}</label>{passwordEnabled && <TextInput label={lobby.passwordProtected ? t('newPasswordOptional') : t('passwordRequired')} value={password} onChange={(value) => { setSaved(false); setPassword(value); }} type="password" maxLength={72} required={!lobby.passwordProtected} />}<button className={`settings-save-button ${hasSettingsChanges ? 'primary has-changes' : 'is-current'}`} type="submit" disabled={!hasSettingsChanges || !passwordReady}><svg aria-hidden="true" viewBox="0 0 24 24">{hasSettingsChanges ? <><path d="M5 3.75h12.2L20.25 6.8V20.25H3.75V3.75H5Z"/><path d="M7.25 3.75v6h9.5v-6M7.5 20.25v-6.5h9v6.5"/></> : <path d="m5.25 12.25 4.1 4.1 9.4-9.4"/>}</svg><span>{t(hasSettingsChanges ? 'saveSettings' : 'settingsUpToDate')}</span></button>{saved && <p className="action-feedback settings-feedback" role="status">{t('settingsSaved')}</p>}</form>;
}

function SettingsDialog({ prefs, setPrefs, close, language, setLanguage }: { prefs: Preferences; setPrefs: (p: Preferences) => void; close: () => void; language: string; setLanguage: (l: string) => void }) {
  const { t } = useTranslation(); const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs({ ...prefs, [key]: value });
  const customColor = validHexColor(prefs.customAccent) ? prefs.customAccent : defaultPrefs.customAccent;
  return <Dialog title={t('settings')} close={close}><div className="settings-grid"><label>{t('language')}<ResponsiveSelect label={t('language')} value={language} onChange={setLanguage} options={[{ value:'de', label:'Deutsch' },{ value:'en', label:'English' }]} /></label><label>{t('theme')}<ResponsiveSelect label={t('theme')} value={prefs.theme} onChange={(value) => update('theme', value as Preferences['theme'])} options={[{ value:'system', label:t('themeSystem') },{ value:'light', label:t('themeLight') },{ value:'dark', label:t('themeDark') }]} /></label><label>{t('accentColor')}<ResponsiveSelect label={t('accentColor')} value={prefs.accent} onChange={(value) => update('accent', value as Preferences['accent'])} options={[{ value:'collection', label:t('accentCollection') },{ value:'ocean', label:t('accentOcean') },{ value:'violet', label:t('accentViolet') },{ value:'amber', label:t('accentAmber') },{ value:'rose', label:t('accentRose') },{ value:'custom', label:t('accentCustom') }]} /></label><div className={`custom-accent-card ${prefs.accent === 'custom' ? 'active' : 'disabled'}`} aria-disabled={prefs.accent !== 'custom'}><span className="custom-accent-copy"><strong>{t('accentCustomColor')}</strong><small>{t('accentCustomHint')}</small></span><label className="accent-color-picker"><span className="sr-only">{t('accentCustomColor')}</span><input className="accent-color-input" type="color" value={customColor} disabled={prefs.accent !== 'custom'} onChange={(event) => setPrefs({ ...prefs, customAccent: event.target.value })} /><output>{customColor.toUpperCase()}</output></label></div>{(['largeText','largeCards','highContrast','reducedMotion','turnSound','speech'] as const).map((key) => <label className="check" key={key}><input type="checkbox" checked={prefs[key]} onChange={(e) => update(key, e.target.checked)} />{t(key)}</label>)}<label>{t('speechRate')}<input type="range" min="0.6" max="1.6" step="0.1" value={prefs.rate} disabled={!prefs.speech} onChange={(e) => update('rate', Number(e.target.value))} /><output>{prefs.rate.toFixed(1)}</output></label><label>{t('speechVolume')}<input type="range" min="0" max="1" step="0.1" value={prefs.volume} disabled={!prefs.speech} onChange={(e) => update('volume', Number(e.target.value))} /><output>{Math.round(prefs.volume*100)}%</output></label>{!('speechSynthesis' in window) && <p role="status">{t('speechUnavailable')}</p>}</div></Dialog>;
}

type SelectOption = { value: string; label: string; aliases?: string[]; disabled?: boolean };
function useSmallScreen() {
  const [small, setSmall] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => { const media = window.matchMedia('(max-width: 760px)'); const update = () => setSmall(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  return small;
}

function ResponsiveSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; disabled?: boolean }) {
  const small = useSmallScreen(); const [open, setOpen] = useState(false); const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value)); const selectedOption = options[selectedIndex]; const [activeIndex, setActiveIndex] = useState(selectedIndex); const root = useRef<HTMLDivElement>(null); const listId = useMemo(() => `select-${Math.random().toString(36).slice(2)}`, []);
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [open]);
  useEffect(() => { if (open) setActiveIndex(selectedIndex); }, [open, selectedIndex]);
  if (small) return <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>;
  const move = (direction: 1 | -1) => { let index = activeIndex; for (let count = 0; count < options.length; count += 1) { index = (index + direction + options.length) % options.length; if (!options[index]?.disabled) { setActiveIndex(index); return; } } };
  const select = (index: number) => { const option = options[index]; if (!option || option.disabled) return; onChange(option.value); setOpen(false); };
  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => { if (event.key === 'Escape') { setOpen(false); return; } if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) setOpen(true); else move(event.key === 'ArrowDown' ? 1 : -1); return; } if (event.key === 'Home' && open) { event.preventDefault(); setActiveIndex(options.findIndex((option) => !option.disabled)); return; } if (event.key === 'End' && open) { event.preventDefault(); setActiveIndex(Math.max(0, options.map((option) => !option.disabled).lastIndexOf(true))); return; } if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); select(activeIndex); } };
  return <div className={`custom-select ${open ? 'open' : ''}`} ref={root}><button type="button" className="custom-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={keyDown}><span>{selectedOption?.label}</span><span className="custom-select-chevron" aria-hidden="true">▾</span></button><ul className="custom-select-list" id={listId} role="listbox" aria-label={label} aria-hidden={!open}>{options.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} className={`${index === activeIndex ? 'active' : ''} ${option.value === value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`} onPointerMove={() => !option.disabled && setActiveIndex(index)} onClick={(event) => { event.preventDefault(); event.stopPropagation(); select(index); }}><span className="select-option-copy"><span>{option.label}</span>{option.aliases?.length ? <small>{option.aliases.join(', ')}</small> : null}</span>{option.value === value && <span aria-hidden="true">✓</span>}</li>)}</ul></div>;
}

function RulesContent({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  if (gameId === 'schwimmen') return <div className="rules-content"><p>{t('knackRulesIntro')}</p><h3>{t('knackRulesGoalTitle')}</h3><p>{t('knackRulesGoalBody')}</p><h3>{t('knackRulesFlowTitle')}</h3><ol>{(['setup','score','turn','pass','knock','round','lives'] as const).map((step) => <li key={step}><strong>{t(`knackRules_${step}Title`)}</strong><span>{t(`knackRules_${step}Body`)}</span></li>)}</ol><h3>{t('knackRulesEndTitle')}</h3><p>{t('knackRulesEndBody')}</p></div>;
  if (gameId === 'mau-mau') return <div className="rules-content"><p>{t('mauMauRulesIntro')}</p><h3>{t('mauMauRulesGoalTitle')}</h3><p>{t('mauMauRulesGoalBody')}</p><h3>{t('mauMauRulesFlowTitle')}</h3><ol>{(['setup','play','draw','seven','eight','jack','stock'] as const).map((step) => <li key={step}><strong>{t(`mauMauRules_${step}Title`)}</strong><span>{t(`mauMauRules_${step}Body`)}</span></li>)}</ol><h3>{t('mauMauRulesEndTitle')}</h3><p>{t('mauMauRulesEndBody')}</p></div>;
  if (gameId === 'romme') return <div className="rules-content"><p>{t('rommeRulesIntro')}</p><h3>{t('rommeRulesGoalTitle')}</h3><p>{t('rommeRulesGoalBody')}</p><h3>{t('rommeRulesFlowTitle')}</h3><ol>{(['setup','draw','melds','opening','layoff','joker','discard','stock'] as const).map((step) => <li key={step}><strong>{t(`rommeRules_${step}Title`)}</strong><span>{t(`rommeRules_${step}Body`)}</span></li>)}</ol><h3>{t('rommeRulesEndTitle')}</h3><p>{t('rommeRulesEndBody')}</p></div>;
  const steps = ['setup', 'attack', 'defense', 'throwIn', 'take', 'roundEnd'] as const;
  return <div className="rules-content"><p>{t('rulesIntro')}</p><h3>{t('rulesGoalTitle')}</h3><p>{t('rulesGoalBody')}</p><h3>{t('rulesFlowTitle')}</h3><ol>{steps.map((step) => <li key={step}><strong>{t(`rules_${step}Title`)}</strong><span>{t(`rules_${step}Body`)}</span></li>)}</ol><h3>{t('rulesGameEndTitle')}</h3><p>{t('rulesGameEndBody')}</p></div>;
}

function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { const { t } = useTranslation(); const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); window.dispatchEvent(new Event('c52:dialog-layer-change')); return () => { queueMicrotask(() => window.dispatchEvent(new Event('c52:dialog-layer-change'))); previous?.focus(); }; }, []); return <dialog ref={ref} onCancel={close} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom; if (outside) close(); }}><div className="dialog-message-layer" /><div className="dialog-head"><h2>{title}</h2><button className="icon-close" type="button" aria-label={t('dismiss')} onClick={close}><span aria-hidden="true" /></button></div>{children}</dialog>; }
function TextInput({ label, value, onChange, onBlur, hint, error, ...rest }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; hint?: string; error?: string; required?: boolean; maxLength?: number; type?: string }) { const id = useMemo(() => `field-${Math.random().toString(36).slice(2)}`, []); const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined; return <label htmlFor={id}>{label}<input id={id} name={label.toLowerCase().includes('code') ? 'code' : undefined} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />{hint && <small id={`${id}-hint`}>{hint}</small>}{error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}</label>; }
function Footer({ inLobby, openRules }: { inLobby: boolean; openRules: () => void }) { const { t } = useTranslation(); const paypal = (import.meta.env.VITE_PAYPAL_URL as string | undefined) || 'https://paypal.me/steinente'; return <footer>{inLobby ? <button className="footer-action footer-rules" onClick={openRules}><svg className="rules-mark" aria-hidden="true" viewBox="0 0 24 24"><rect x="4.25" y="5.25" width="11.5" height="15" rx="2.25"/><rect x="8.25" y="3.25" width="11.5" height="15" rx="2.25"/><path d="m14 7.2-2.2 2.55L14 12.3l2.2-2.55L14 7.2Z"/></svg>{t('rules')}</button> : <span />}<nav className="footer-center" aria-label={t('legalNavigation')}><a href="/impressum">{t('footerLegal')}</a><a href="/datenschutz">{t('footerPrivacy')}</a></nav><a className="footer-action paypal-button" href={paypal} target="_blank" rel="noopener noreferrer"><svg className="paypal-mark" aria-hidden="true" viewBox="0 0 48 48"><path fill="#002991" d="M38.914 13.35c0 5.574-5.144 12.15-12.927 12.15H18.49l-.368 2.322L16.373 39H7.056l5.605-36h15.095c5.083 0 9.082 2.833 10.555 6.77a9.687 9.687 0 0 1 .603 3.58z"/><path fill="#60CDFF" d="M44.284 23.7A12.894 12.894 0 0 1 31.53 34.5h-5.206L24.157 48H14.89l1.483-9 1.75-11.178.367-2.322h7.497c7.773 0 12.927-6.576 12.927-12.15 3.825 1.974 6.055 5.963 5.37 10.35z"/><path fill="#008CFF" d="M38.914 13.35C37.31 12.511 35.365 12 33.248 12h-12.64L18.49 25.5h7.497c7.773 0 12.927-6.576 12.927-12.15z"/></svg>{t('donate')}</a></footer>; }
