import { useState } from "react";
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

export function LobbySettings({
  lobby,
  setError,
}: {
  lobby: PublicLobby;
  setError: (value: string) => void;
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
  const updateMauMauRule = <K extends keyof MauMauRules>(
    key: K,
    value: MauMauRules[K],
  ) => {
    setSaved(false);
    setMauMauRules((current) => ({ ...current, [key]: value }));
  };
  const savedMauMauRules = lobby.mauMauRules ?? defaultMauMauRules;
  const mauMauRulesChanged =
    lobby.gameId === "mau-mau" &&
    (Object.keys(defaultMauMauRules) as Array<keyof MauMauRules>).some(
      (key) => mauMauRules[key] !== savedMauMauRules[key],
    );
  const savedRommeRules = { ...defaultRommeRules, ...lobby.rommeRules };
  const rommeRulesChanged =
    lobby.gameId === "romme" &&
    (Object.keys(defaultRommeRules) as Array<keyof RommeRules>).some(
      (key) => rommeRules[key] !== savedRommeRules[key],
    );
  const hasSettingsChanges =
    maxPlayers !== lobby.maxPlayers ||
    visibility !== lobby.visibility ||
    (lobby.gameId === "durak" && deckSize !== lobby.deckSize) ||
    mauMauRulesChanged ||
    rommeRulesChanged ||
    passwordEnabled !== lobby.passwordProtected ||
    Boolean(password);
  const passwordReady =
    !passwordEnabled || lobby.passwordProtected || Boolean(password);
  const changeRommeVariant = (variant: RommeRules["variant"]) => {
    if (variant === "gin" && lobby.playerCount > 2) {
      setError("gin_requires_two_players");
      return;
    }
    setSaved(false);
    setRommeRules({ ...rommeRules, variant });
    if (variant === "gin") setMaxPlayers(2);
  };
  return (
    <form
      className="panel lobby-settings"
      aria-labelledby="lobby-settings-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (!hasSettingsChanges || !passwordReady) return;
        setSaved(false);
        const passwordChange = passwordEnabled
          ? password
            ? { password }
            : {}
          : lobby.passwordProtected
            ? { password: "" }
            : {};
        socket.emit(
          "lobby:update",
          {
            maxPlayers,
            ...(lobby.gameId === "durak" ? { deckSize } : {}),
            ...(lobby.gameId === "mau-mau" ? { mauMauRules } : {}),
            ...(lobby.gameId === "romme" ? { rommeRules } : {}),
            visibility,
            ...passwordChange,
          },
          (result) => {
            if (!result.ok) setError(result.error ?? "unknown_error");
            else {
              if (lobby.gameId === "mau-mau")
                localStorage.setItem(
                  storageKeys.mauMauRules,
                  JSON.stringify(mauMauRules),
                );
              if (lobby.gameId === "romme")
                localStorage.setItem(
                  storageKeys.rommeRules,
                  JSON.stringify(rommeRules),
                );
              setPassword("");
              setSaved(true);
            }
          },
        );
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
              setSaved(false);
              setDeckSize(Number(value) as 36 | 52);
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
            setSaved(false);
            setMaxPlayers(Number(value));
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
            setSaved(false);
            setVisibility(value as "public" | "private");
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
                    setSaved(false);
                    setRommeRules({
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
                    setSaved(false);
                    setRommeRules({
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
                  setSaved(false);
                  setRommeRules({
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
      <label className="check">
        <input
          type="checkbox"
          checked={passwordEnabled}
          onChange={(event) => {
            setSaved(false);
            setPasswordEnabled(event.target.checked);
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
        className={`settings-save-button ${hasSettingsChanges ? "primary has-changes" : "is-current"}`}
        type="submit"
        disabled={!hasSettingsChanges || !passwordReady}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          {hasSettingsChanges ? (
            <>
              <path d="M5 3.75h12.2L20.25 6.8V20.25H3.75V3.75H5Z" />
              <path d="M7.25 3.75v6h9.5v-6M7.5 20.25v-6.5h9v6.5" />
            </>
          ) : (
            <path d="m5.25 12.25 4.1 4.1 9.4-9.4" />
          )}
        </svg>
        <span>
          {t(hasSettingsChanges ? "saveSettings" : "settingsUpToDate")}
        </span>
      </button>
      {saved && (
        <p className="action-feedback settings-feedback" role="status">
          {t("settingsSaved")}
        </p>
      )}
    </form>
  );
}
