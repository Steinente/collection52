import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { GameId, LobbySummary } from "@collection52/shared";
import {
  gameDefinitions,
  hasMinimumUsernameLetters,
  invitationCode,
  isValidUsername,
  loadMauMauRules,
  loadRommeRules,
  storageKeys,
  usernamePattern,
} from "../client-config";
import type { Ack, RetainedLobby } from "../models";
import { socket } from "../socket";
import { Dialog, ResponsiveSelect, TextInput } from "./ui";

export function Home({
  lobbies,
  remember,
  retainedLobby,
  resumeRetainedLobby,
  permanentlyLeaveRetainedLobby,
}: {
  lobbies: LobbySummary[];
  remember: (result: Ack) => void;
  retainedLobby: RetainedLobby | undefined;
  resumeRetainedLobby: () => void;
  permanentlyLeaveRetainedLobby: () => void;
}) {
  const { t, i18n } = useTranslation();
  const invitedCode = useMemo(invitationCode, []);
  const [savedInvitationName] = useState(() =>
    invitedCode ? (localStorage.getItem(storageKeys.playerName) ?? "") : "",
  );
  const [name, setName] = useState(
    localStorage.getItem(storageKeys.playerName) ?? "",
  );
  const [code, setCode] = useState(invitedCode);
  const [password, setPassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [createPasswordEnabled, setCreatePasswordEnabled] = useState(false);
  const [createPassword, setCreatePassword] = useState("");
  const [codeStatus, setCodeStatus] = useState<
    "idle" | "checking" | "joinable" | "missing" | "unavailable"
  >("idle");
  const [gamesOpen, setGamesOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<GameId>(() => {
    const stored = localStorage.getItem(storageKeys.selectedGame);
    return gameDefinitions.some((game) => game.id === stored)
      ? (stored as GameId)
      : "durak";
  });
  const [nameTouched, setNameTouched] = useState(
    Boolean(invitedCode && !isValidUsername(savedInvitationName)),
  );
  const [codeTouched, setCodeTouched] = useState(false);
  const [createVisibility, setCreateVisibility] = useState<
    "public" | "private"
  >("public");
  const [lobbyPasswords, setLobbyPasswords] = useState<Record<string, string>>(
    {},
  );
  const automaticJoinAttempted = useRef(false);
  const rememberRef = useRef(remember);
  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);
  useEffect(() => {
    localStorage.setItem(storageKeys.selectedGame, selectedGame);
  }, [selectedGame]);
  const validName = isValidUsername(name);
  const validCode = /^[A-Z2-9]{8}$/.test(code);
  const nameError =
    name && !usernamePattern.test(name)
      ? t("usernameInvalid")
      : name && !hasMinimumUsernameLetters(name)
        ? t("usernameTooFewLetters")
        : nameTouched && !name
          ? t("usernameRequired")
          : "";
  const codeError =
    codeStatus === "missing"
      ? t("lobbyCodeNotFound")
      : codeStatus === "unavailable"
        ? t("lobbyCodeUnavailable")
        : codeTouched && code && !validCode
          ? t("lobbyCodeInvalid")
          : "";
  const games = gameDefinitions
    .map((definition) => {
      const translatedAliases = t(definition.aliasesKey, {
        returnObjects: true,
      }) as unknown;
      const aliases = Array.isArray(translatedAliases)
        ? translatedAliases.filter(
            (alias): alias is string => typeof alias === "string",
          )
        : [];
      const searchKey =
        "searchAliasesKey" in definition
          ? definition.searchAliasesKey
          : undefined;
      const translatedSearchAliases = searchKey
        ? (t(searchKey, { returnObjects: true }) as unknown)
        : [];
      const searchAliases = Array.isArray(translatedSearchAliases)
        ? translatedSearchAliases.filter(
            (alias): alias is string => typeof alias === "string",
          )
        : [];
      return {
        ...definition,
        name: t(definition.nameKey),
        description: t(definition.descriptionKey),
        aliases,
        searchAliases,
      };
    })
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        i18n.resolvedLanguage ?? i18n.language,
        { sensitivity: "base" },
      ),
    );
  const normalizeGameSearch = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase()
      .replace(/[-‐‑‒–—]+/g, " ")
      .replace(/\s+/g, " ");
  const normalizedGameSearch = normalizeGameSearch(gameSearch);
  const filteredGames = games.filter(
    (game) =>
      !normalizedGameSearch ||
      [
        game.name,
        game.description,
        ...game.aliases,
        ...game.searchAliases,
      ].some((text) =>
        normalizeGameSearch(text).includes(normalizedGameSearch),
      ),
  );
  useEffect(() => {
    setPassword("");
    setPasswordRequired(false);
    if (!validCode) {
      setCodeStatus("idle");
      return;
    }
    setCodeStatus("checking");
    let cancelled = false;
    const timer = window.setTimeout(
      () =>
        socket.emit("lobby:inspect", { code }, (result) => {
          if (cancelled) return;
          if (!result.ok) {
            if (result.error === "lobby_not_found" && code === invitedCode) {
              history.replaceState({}, "", location.pathname);
              setCode("");
              setCodeTouched(false);
              setNameTouched(false);
              return;
            }
            setCodeStatus(
              result.error === "lobby_not_found" ? "missing" : "unavailable",
            );
            return;
          }
          setPasswordRequired(Boolean(result.passwordProtected));
          setCodeStatus(result.joinable ? "joinable" : "unavailable");
          if (
            !retainedLobby &&
            result.joinable &&
            !result.passwordProtected &&
            code === invitedCode &&
            isValidUsername(savedInvitationName) &&
            !automaticJoinAttempted.current
          ) {
            automaticJoinAttempted.current = true;
            socket.emit(
              "lobby:join",
              { code, name: savedInvitationName },
              (joinResult) => rememberRef.current(joinResult),
            );
          }
        }),
      250,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, invitedCode, retainedLobby, savedInvitationName, validCode]);
  const joinLobby = (joinCode: string, joinPassword = "") => {
    setNameTouched(true);
    if (retainedLobby || !validName) return;
    localStorage.setItem(storageKeys.playerName, name);
    socket.emit(
      "lobby:join",
      {
        code: joinCode,
        name,
        ...(joinPassword ? { password: joinPassword } : {}),
      },
      remember,
    );
  };
  const submitJoin = (e: FormEvent) => {
    e.preventDefault();
    setCodeTouched(true);
    if (
      retainedLobby ||
      !validCode ||
      codeStatus !== "joinable" ||
      (passwordRequired && !password)
    )
      return;
    joinLobby(code, password);
  };
  return (
    <>
      {retainedLobby && (
        <section
          className="retained-lobby panel"
          aria-labelledby="retained-lobby-title"
        >
          <div>
            <p className="eyebrow">{t("activeLobbyEyebrow")}</p>
            <h1 id="retained-lobby-title">{t("activeLobbyTitle")}</h1>
            <p>
              {t("activeLobbyExplanation", {
                game: t(retainedLobby.gameId),
                code: retainedLobby.code,
              })}
            </p>
            <p className="retained-lobby-blocker">{t("activeLobbyBlocker")}</p>
          </div>
          <div className="retained-lobby-actions">
            <button
              className="primary"
              type="button"
              onClick={resumeRetainedLobby}
            >
              {t("returnToLobby")}
            </button>
            <button
              className="danger"
              type="button"
              onClick={permanentlyLeaveRetainedLobby}
            >
              {t("leavePermanently")}
            </button>
          </div>
        </section>
      )}
      <form
        className="panel home-actions"
        aria-labelledby="start-playing-title"
        onSubmit={submitJoin}
      >
        <h1 id="start-playing-title">{t("startPlaying")}</h1>
        <TextInput
          label={t("name")}
          value={name}
          onChange={setName}
          onBlur={() => setNameTouched(true)}
          required
          maxLength={16}
          error={nameError}
        />
        <div className="game-picker">
          <label>
            {t("game")}
            <ResponsiveSelect
              label={t("game")}
              value={selectedGame}
              onChange={(value) => setSelectedGame(value as GameId)}
              options={games.map((game) => ({
                value: game.id,
                label: game.name,
                aliases: [...game.aliases],
              }))}
            />
          </label>
          <button type="button" onClick={() => setGamesOpen(true)}>
            {t("showAllGames")}
          </button>
        </div>
        <label>
          {t("visibility")}
          <ResponsiveSelect
            label={t("visibility")}
            value={createVisibility}
            onChange={(value) =>
              setCreateVisibility(value as "public" | "private")
            }
            options={[
              { value: "public", label: t("public") },
              { value: "private", label: t("private") },
            ]}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={createPasswordEnabled}
            onChange={(event) => {
              setCreatePasswordEnabled(event.target.checked);
              if (!event.target.checked) setCreatePassword("");
            }}
          />
          {t("passwordProtection")}
        </label>
        {createPasswordEnabled && (
          <TextInput
            label={t("passwordRequired")}
            value={createPassword}
            onChange={setCreatePassword}
            type="password"
            maxLength={72}
            required
          />
        )}
        <button
          className="primary full-button"
          type="button"
          aria-describedby={
            retainedLobby ? "active-lobby-form-hint" : undefined
          }
          disabled={
            Boolean(retainedLobby) ||
            !validName ||
            (createPasswordEnabled && !createPassword)
          }
          onClick={() => {
            setNameTouched(true);
            if (
              retainedLobby ||
              !validName ||
              (createPasswordEnabled && !createPassword)
            )
              return;
            localStorage.setItem(storageKeys.playerName, name);
            socket.emit(
              "lobby:create",
              {
                name,
                settings: {
                  gameId: selectedGame,
                  maxPlayers: 4,
                  deckSize:
                    selectedGame === "durak"
                      ? 36
                      : selectedGame === "romme"
                        ? 52
                        : 32,
                  visibility: createVisibility,
                  ...(selectedGame === "mau-mau"
                    ? { mauMauRules: loadMauMauRules() }
                    : {}),
                  ...(selectedGame === "romme"
                    ? { rommeRules: loadRommeRules() }
                    : {}),
                  ...(createPasswordEnabled
                    ? { password: createPassword }
                    : {}),
                },
              },
              remember,
            );
          }}
        >
          {t("createLobby")}
        </button>
        {retainedLobby && (
          <p
            id="active-lobby-form-hint"
            className="active-lobby-form-hint"
            role="note"
          >
            {t("activeLobbyFormHint")}
          </p>
        )}
        <div className="or-divider" role="separator">
          <span>{t("or")}</span>
        </div>
        <TextInput
          label={t("code")}
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          onBlur={() => setCodeTouched(true)}
          maxLength={8}
          error={codeError}
        />
        {passwordRequired && (
          <TextInput
            label={t("passwordRequired")}
            value={password}
            onChange={setPassword}
            type="password"
            maxLength={72}
            required
          />
        )}
        <button
          className="primary full-button"
          type="submit"
          disabled={
            Boolean(retainedLobby) ||
            !validName ||
            !validCode ||
            codeStatus !== "joinable" ||
            (passwordRequired && !password)
          }
        >
          {t("joinLobby")}
        </button>
      </form>
      <section className="lobby-list">
        <h2>{t("openLobbies")}</h2>
        {!lobbies.length ? (
          <p className="empty">{t("noLobbies")}</p>
        ) : (
          <ul>
            {lobbies.map((l) => {
              const rowPassword = lobbyPasswords[l.code] ?? "";
              return (
                <li key={l.code}>
                  <div className="lobby-summary">
                    <strong>{t(l.gameId)}</strong>
                    <span>{t("lobbyHost", { name: l.hostName })}</span>
                    <span>
                      {l.code} · {t(l.status)} ·{" "}
                      {t("playersCount", {
                        count: l.playerCount,
                        max: l.maxPlayers,
                      })}
                      {l.passwordProtected ? ` · ${t("protected")}` : ""}
                    </span>
                  </div>
                  <form
                    className="lobby-row-join"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!retainedLobby) joinLobby(l.code, rowPassword);
                    }}
                  >
                    {l.passwordProtected && (
                      <TextInput
                        label={t("lobbyPasswordFor", { code: l.code })}
                        value={rowPassword}
                        onChange={(value) =>
                          setLobbyPasswords((current) => ({
                            ...current,
                            [l.code]: value,
                          }))
                        }
                        type="password"
                        maxLength={72}
                        required
                      />
                    )}
                    <button
                      type="submit"
                      disabled={
                        Boolean(retainedLobby) ||
                        !l.joinable ||
                        !validName ||
                        (l.passwordProtected && !rowPassword)
                      }
                    >
                      {t("join")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {gamesOpen && (
        <Dialog title={t("allGames")} close={() => setGamesOpen(false)}>
          <div className="game-catalog">
            <label className="game-search">
              {t("searchGames")}
              <span className="game-search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={gameSearch}
                  onChange={(event) => setGameSearch(event.target.value)}
                  placeholder={t("searchGamesPlaceholder")}
                  autoFocus
                />
              </span>
            </label>
            <p className="game-result-count" role="status">
              {t("gameSearchResults", { count: filteredGames.length })}
            </p>
            <div className="game-catalog-results">
              {filteredGames.map((game) => (
                <article
                  className={`game-catalog-card ${selectedGame === game.id ? "selected" : ""}`}
                  key={game.id}
                >
                  <div className="game-catalog-copy">
                    <h3>{game.name}</h3>
                    {game.aliases.length > 0 && (
                      <div className="game-aliases">
                        <span>{t("gameAliases")}</span>
                        {game.aliases.map((alias) => (
                          <span className="game-alias-chip" key={alias}>
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}
                    <p>{game.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGame(game.id);
                      setGamesOpen(false);
                    }}
                  >
                    {t(
                      selectedGame === game.id ? "selectedGame" : "selectGame",
                    )}
                  </button>
                </article>
              ))}
              {!filteredGames.length && (
                <div className="game-catalog-empty">
                  <strong>{t("noGamesFound")}</strong>
                  <p>{t("noGamesFoundHint")}</p>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
