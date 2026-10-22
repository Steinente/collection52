import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameId, RommeRules } from "@collection52/shared";

export function RulesContent({
  gameId,
  rommeVariant,
}: {
  gameId: GameId;
  rommeVariant: RommeRules["variant"] | undefined;
}) {
  const { t } = useTranslation();
  const [activeRommeVariant, setActiveRommeVariant] = useState<
    RommeRules["variant"]
  >(rommeVariant ?? "classic");
  useEffect(() => {
    setActiveRommeVariant(rommeVariant ?? "classic");
  }, [rommeVariant]);
  if (gameId === "schwimmen")
    return (
      <div className="rules-content">
        <p>{t("knackRulesIntro")}</p>
        <h3>{t("knackRulesGoalTitle")}</h3>
        <p>{t("knackRulesGoalBody")}</p>
        <h3>{t("knackRulesFlowTitle")}</h3>
        <ol>
          {(
            [
              "setup",
              "score",
              "turn",
              "pass",
              "knock",
              "round",
              "lives",
            ] as const
          ).map((step) => (
            <li key={step}>
              <strong>{t(`knackRules_${step}Title`)}</strong>
              <span>{t(`knackRules_${step}Body`)}</span>
            </li>
          ))}
        </ol>
        <h3>{t("knackRulesEndTitle")}</h3>
        <p>{t("knackRulesEndBody")}</p>
      </div>
    );
  if (gameId === "mau-mau")
    return (
      <div className="rules-content">
        <p>{t("mauMauRulesIntro")}</p>
        <h3>{t("mauMauRulesGoalTitle")}</h3>
        <p>{t("mauMauRulesGoalBody")}</p>
        <h3>{t("mauMauRulesFlowTitle")}</h3>
        <ol>
          {(
            [
              "setup",
              "play",
              "draw",
              "seven",
              "eight",
              "jack",
              "stock",
            ] as const
          ).map((step) => (
            <li key={step}>
              <strong>{t(`mauMauRules_${step}Title`)}</strong>
              <span>{t(`mauMauRules_${step}Body`)}</span>
            </li>
          ))}
        </ol>
        <h3>{t("mauMauRulesEndTitle")}</h3>
        <p>{t("mauMauRulesEndBody")}</p>
      </div>
    );
  if (gameId === "romme")
    return (
      <div className="rules-content romme-rules-content">
        <div
          className="rules-tabs"
          role="tablist"
          aria-label={t("rommeVariants")}
        >
          {(["classic", "gin", "canasta"] as const).map((variant) => (
            <button
              key={variant}
              id={`romme-rules-tab-${variant}`}
              type="button"
              role="tab"
              aria-selected={activeRommeVariant === variant}
              aria-controls={`romme-rules-panel-${variant}`}
              className={activeRommeVariant === variant ? "active" : ""}
              onClick={() => setActiveRommeVariant(variant)}
            >
              {t(
                variant === "classic"
                  ? "rommeVariantClassic"
                  : variant === "gin"
                    ? "rommeVariantGin"
                    : "rommeVariantCanasta",
              )}
            </button>
          ))}
        </div>
        {activeRommeVariant === "canasta" ? (
          <div
            className="rules-panel"
            id="romme-rules-panel-canasta"
            role="tabpanel"
            aria-labelledby="romme-rules-tab-canasta"
          >
            <p>{t("canastaRulesIntro")}</p>
            <h3>{t("canastaRulesGoalTitle")}</h3>
            <p>{t("canastaRulesGoalBody")}</p>
            <h3>{t("canastaRulesFlowTitle")}</h3>
            <ol>
              {(
                [
                  "teams",
                  "setup",
                  "threes",
                  "draw",
                  "melds",
                  "opening",
                  "discardPile",
                  "goingOut",
                  "scoring",
                ] as const
              ).map((step) => (
                <li key={step}>
                  <strong>{t(`canastaRules_${step}Title`)}</strong>
                  <span>{t(`canastaRules_${step}Body`)}</span>
                </li>
              ))}
            </ol>
            <h3>{t("canastaRulesEndTitle")}</h3>
            <p>{t("canastaRulesEndBody")}</p>
          </div>
        ) : activeRommeVariant === "gin" ? (
          <div
            className="rules-panel"
            id="romme-rules-panel-gin"
            role="tabpanel"
            aria-labelledby="romme-rules-tab-gin"
          >
            <p>{t("ginRulesIntro")}</p>
            <h3>{t("ginRulesGoalTitle")}</h3>
            <p>{t("ginRulesGoalBody")}</p>
            <h3>{t("ginRulesFlowTitle")}</h3>
            <ol>
              {(
                [
                  "setup",
                  "melds",
                  "opening",
                  "turn",
                  "knock",
                  "layoff",
                  "stock",
                  "scoring",
                ] as const
              ).map((step) => (
                <li key={step}>
                  <strong>{t(`ginRules_${step}Title`)}</strong>
                  <span>{t(`ginRules_${step}Body`)}</span>
                </li>
              ))}
            </ol>
            <h3>{t("ginRulesEndTitle")}</h3>
            <p>{t("ginRulesEndBody")}</p>
          </div>
        ) : (
          <div
            className="rules-panel"
            id="romme-rules-panel-classic"
            role="tabpanel"
            aria-labelledby="romme-rules-tab-classic"
          >
            <p>{t("rommeRulesIntro")}</p>
            <h3>{t("rommeRulesGoalTitle")}</h3>
            <p>{t("rommeRulesGoalBody")}</p>
            <h3>{t("rommeRulesFlowTitle")}</h3>
            <ol>
              {(
                [
                  "setup",
                  "draw",
                  "melds",
                  "opening",
                  "layoff",
                  "joker",
                  "discard",
                  "stock",
                ] as const
              ).map((step) => (
                <li key={step}>
                  <strong>{t(`rommeRules_${step}Title`)}</strong>
                  <span>{t(`rommeRules_${step}Body`)}</span>
                </li>
              ))}
            </ol>
            <h3>{t("rommeRulesEndTitle")}</h3>
            <p>{t("rommeRulesEndBody")}</p>
          </div>
        )}
      </div>
    );
  if (
    gameId === "spades" ||
    gameId === "oh-hell" ||
    gameId === "cheat" ||
    gameId === "skat"
  ) {
    const prefix =
      gameId === "spades"
        ? "spadesRules"
        : gameId === "oh-hell"
          ? "ohHellRules"
          : gameId === "cheat"
            ? "cheatRules"
            : "skatRules";
    const steps =
      gameId === "spades"
        ? ["setup", "bidding", "nil", "play", "scoring", "bags"]
        : gameId === "oh-hell"
          ? ["setup", "schedule", "bidding", "dealer", "play", "scoring"]
          : gameId === "cheat"
            ? ["setup", "sequence", "play", "challenge", "pickup", "finalPlay"]
            : [
                "setup",
                "bidding",
                "skat",
                "contracts",
                "announcements",
                "play",
                "scoring",
                "series",
              ];
    return (
      <div className="rules-content">
        <p>{t(`${prefix}Intro`)}</p>
        <h3>{t(`${prefix}GoalTitle`)}</h3>
        <p>{t(`${prefix}GoalBody`)}</p>
        <h3>{t(`${prefix}FlowTitle`)}</h3>
        <ol>
          {steps.map((step) => (
            <li key={step}>
              <strong>{t(`${prefix}_${step}Title`)}</strong>
              <span>{t(`${prefix}_${step}Body`)}</span>
            </li>
          ))}
        </ol>
        <h3>{t(`${prefix}EndTitle`)}</h3>
        <p>{t(`${prefix}EndBody`)}</p>
      </div>
    );
  }
  const steps = [
    "setup",
    "attack",
    "defense",
    "throwIn",
    "take",
    "roundEnd",
  ] as const;
  return (
    <div className="rules-content">
      <p>{t("rulesIntro")}</p>
      <h3>{t("rulesGoalTitle")}</h3>
      <p>{t("rulesGoalBody")}</p>
      <h3>{t("rulesFlowTitle")}</h3>
      <ol>
        {steps.map((step) => (
          <li key={step}>
            <strong>{t(`rules_${step}Title`)}</strong>
            <span>{t(`rules_${step}Body`)}</span>
          </li>
        ))}
      </ol>
      <h3>{t("rulesGameEndTitle")}</h3>
      <p>{t("rulesGameEndBody")}</p>
    </div>
  );
}
