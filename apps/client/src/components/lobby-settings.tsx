import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  MauMauRules,
  PublicLobby,
  RommeRules,
} from "@collection52/shared";
import {
  defaultMauMauRules,
  defaultRommeRules,
  storageKeys,
} from "../client-config";
import { socket } from "../socket";
import { ResponsiveSelect, TextInput } from "./ui";

type LobbySettingsUpdate = {
  maxPlayers?: number;
  deckSize?: 36 | 52;
  visibility?: "public" | "private";
  password?: string;
  mauMauRules?: MauMauRules;
  rommeRules?: RommeRules;
};

export function LobbySettings({
  lobby,
  setError,
  setSelectedRommeVariant,
}: {
  lobby: PublicLobby;
  setError: (value: string) => void;
  setSelectedRommeVariant: (variant: RommeRules["variant"]) => void;
}) {
  const { t } = useTranslation();
  const [maxPlayers, setMaxPlayers] = useState(lobby.maxPlayers);
  const [deckSize, setDeckSize] = useState<36 | 52>(
    lobby.deckSize === 52 ? 52 : 36,
  );
  const [visibility, setVisibility] = useState(lobby.visibility);
  const [passwordEnabled, setPasswordEnabled] = useState(
    lobby.passwordProtected,
  );
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [mauMauRules, setMauMauRules] = useState<MauMauRules>(
    lobby.mauMauRules ?? defaultMauMauRules,
  );
  const [rommeRules, setRommeRules] = useState<RommeRules>({
    ...defaultRommeRules,
    ...lobby.rommeRules,
  });
  const saveUpdate = (
    update: LobbySettingsUpdate,
    onSaved?: () => void,
    onFailed?: () => void,
  ) => {
    setSaved(false);
    socket.emit("lobby:update", update, (result) => {
      if (!result.ok) {
        onFailed?.();
        setError(result.error ?? "unknown_error");
        return;
      }
      onSaved?.();
      setSaved(true);
    });
  };
  const updateMauMauRule = <K extends keyof MauMauRules>(
    key: K,
    value: MauMauRules[K],
  ) => {
    const previous = mauMauRules;
    const next = { ...previous, [key]: value };
    setMauMauRules(next);
    saveUpdate(
      { mauMauRules: next },
      () => localStorage.setItem(storageKeys.mauMauRules, JSON.stringify(next)),
      () => setMauMauRules(previous),
    );
  };
  const updateRommeRules = (
    next: RommeRules,
    extraUpdate: LobbySettingsUpdate = {},
  ) => {
    const previous = rommeRules;
    setRommeRules(next);
    saveUpdate(
      { ...extraUpdate, rommeRules: next },
      () => {
        localStorage.setItem(storageKeys.rommeRules, JSON.stringify(next));
        localStorage.setItem(
          storageKeys.selectedGame,
          next.variant === "gin" ? "gin-romme" : "romme",
        );
      },
      () => setRommeRules(previous),
    );
  };
  const passwordChanged =
    passwordEnabled !== lobby.passwordProtected || Boolean(password);
  const passwordReady =
    !passwordEnabled || lobby.passwordProtected || Boolean(password);
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);
  const changeRommeVariant = (variant: RommeRules["variant"]) => {
    if (variant === "gin" && lobby.playerCount > 2) {
      setError("gin_requires_two_players");
      return;
    }
    const next = { ...rommeRules, variant };
    setSelectedRommeVariant(variant);
    if (variant === "gin") {
      setMaxPlayers(2);
      updateRommeRules(next, { maxPlayers: 2 });
    } else updateRommeRules(next);
  };
  return (
    <form
      className="panel lobby-settings"
      aria-labelledby="lobby-settings-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (!passwordChanged || !passwordReady) return;
        const passwordChange = passwordEnabled
          ? password
            ? { password }
            : {}
          : lobby.passwordProtected
            ? { password: "" }
            : {};
        saveUpdate(passwordChange, () => setPassword(""));
      }}
    >
      <h2 id="lobby-settings-title">{t("lobbySettings")}</h2>
      {lobby.gameId === "durak" ? (
        <label>
          {t("deckSize")}
          <ResponsiveSelect
            label={t("deckSize")}
            value={String(deckSize)}
            onChange={(value) => {
              const previous = deckSize;
              const next = Number(value) as 36 | 52;
              setDeckSize(next);
              saveUpdate({ deckSize: next }, undefined, () =>
                setDeckSize(previous),
              );
            }}
            options={[
              { value: "36", label: t("cards36") },
              { value: "52", label: t("cards52") },
            ]}
          />
        </label>
      ) : (
        <div className="fixed-setting">
          <span>{t("deckSize")}</span>
          <strong>
            {t(
              lobby.gameId === "romme"
                ? rommeRules.variant === "gin"
                  ? "cards52"
                  : "rommeCards110"
                : "cards32",
            )}
          </strong>
        </div>
      )}
      <label>
        {t("maxPlayers")}
        <ResponsiveSelect
          label={t("maxPlayers")}
          value={String(maxPlayers)}
          disabled={lobby.gameId === "romme" && rommeRules.variant === "gin"}
          onChange={(value) => {
            const previous = maxPlayers;
            const next = Number(value);
            setMaxPlayers(next);
            saveUpdate({ maxPlayers: next }, undefined, () =>
              setMaxPlayers(previous),
            );
          }}
          options={[2, 3, 4, 5, 6].map((count) => ({
            value: String(count),
            label: String(count),
            disabled:
              count < lobby.playerCount ||
              (lobby.gameId === "romme" &&
                rommeRules.variant === "gin" &&
                count !== 2),
          }))}
        />
      </label>
      <label>
        {t("visibility")}
        <ResponsiveSelect
          label={t("visibility")}
          value={visibility}
          onChange={(value) => {
            const previous = visibility;
            const next = value as "public" | "private";
            setVisibility(next);
            saveUpdate({ visibility: next }, undefined, () =>
              setVisibility(previous),
            );
          }}
          options={[
            { value: "public", label: t("public") },
            { value: "private", label: t("private") },
          ]}
        />
      </label>
      {lobby.gameId === "mau-mau" && (
        <fieldset className="mau-mau-variant-settings">
          <legend>{t("mauMauVariants")}</legend>
          {(
            [
              "stackSevens",
              "forbidJackOnJack",
              "forbidJackAsFinal",
              "aceReverses",
            ] as const
          ).map((key) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={mauMauRules[key]}
                onChange={(event) =>
                  updateMauMauRule(key, event.target.checked)
                }
              />
              <span>
                <strong>{t(`mauMauVariant_${key}`)}</strong>
                <small>{t(`mauMauVariant_${key}Hint`)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {lobby.gameId === "romme" && (
        <fieldset className="mau-mau-variant-settings">
          <legend>{t("rommeVariants")}</legend>
          <label>
            {t("rommeVariant")}
            <ResponsiveSelect
              label={t("rommeVariant")}
              value={rommeRules.variant}
              onChange={(value) =>
                changeRommeVariant(value as RommeRules["variant"])
              }
              options={[
                { value: "classic", label: t("rommeVariantClassic") },
                { value: "gin", label: t("rommeVariantGin") },
              ]}
            />
            {rommeRules.variant === "gin" && (
              <small>{t("ginVariantHint")}</small>
            )}
          </label>
          {rommeRules.variant === "classic" ? (
            <>
              <label>
                {t("rommeOpeningThreshold")}
                <ResponsiveSelect
                  label={t("rommeOpeningThreshold")}
                  value={String(rommeRules.openingPoints)}
                  onChange={(value) => {
                    updateRommeRules({
                      ...rommeRules,
                      openingPoints: Number(value) as 30 | 40,
                    });
                  }}
                  options={[
                    { value: "40", label: t("romme40Points") },
                    { value: "30", label: t("romme30Points") },
                  ]}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={rommeRules.requireDiscardUse}
                  onChange={(event) => {
                    updateRommeRules({
                      ...rommeRules,
                      requireDiscardUse: event.target.checked,
                    });
                  }}
                />
                <span>
                  <strong>{t("rommeRequireDiscardUse")}</strong>
                  <small>{t("rommeRequireDiscardUseHint")}</small>
                </span>
              </label>
            </>
          ) : (
            <label>
              {t("ginTargetScore")}
              <ResponsiveSelect
                label={t("ginTargetScore")}
                value={String(rommeRules.ginTargetScore)}
                onChange={(value) => {
                  updateRommeRules({
                    ...rommeRules,
                    ginTargetScore: Number(value),
                  });
                }}
                options={[50, 100, 150, 200, 300, 500].map((count) => ({
                  value: String(count),
                  label: t("ginTargetOption", { count }),
                }))}
              />
            </label>
          )}
        </fieldset>
      )}
      <div className={`password-setting${passwordEnabled ? " enabled" : ""}`}>
        <label className="check">
          <input
            type="checkbox"
            checked={passwordEnabled}
            onChange={(event) => {
              const enabled = event.target.checked;
              setSaved(false);
              setPasswordEnabled(enabled);
              if (!enabled) setPassword("");
            }}
          />
          {t("passwordProtection")}
        </label>
        {passwordEnabled && (
          <TextInput
            label={
              lobby.passwordProtected
                ? t("newPasswordOptional")
                : t("passwordRequired")
            }
            value={password}
            onChange={(value) => {
              setSaved(false);
              setPassword(value);
            }}
            type="password"
            maxLength={72}
            required={!lobby.passwordProtected}
          />
        )}
        <button
          className="password-save-button primary"
          type="submit"
          disabled={!passwordChanged || !passwordReady}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 3.75h12.2L20.25 6.8V20.25H3.75V3.75H5Z" />
            <path d="M7.25 3.75v6h9.5v-6M7.5 20.25v-6.5h9v6.5" />
          </svg>
          <span>{t("savePassword")}</span>
        </button>
      </div>
      {saved && (
        <p className="action-feedback settings-feedback" role="status">
          {t("settingsSaved")}
        </p>
      )}
    </form>
  );
}
