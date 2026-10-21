import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { defaultPreferences, validHexColor } from "../client-config";
import type { Preferences } from "../models";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`loading-state${compact ? " loading-state-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="loading-card-mark" aria-hidden="true">
        <span className="brand-card loading-brand-card">52</span>
      </div>
      <div className="loading-state-copy">
        <strong>Collection52</strong>
        <span>{t("loading")}</span>
      </div>
      <span className="loading-progress" aria-hidden="true">
        <span />
      </span>
    </div>
  );
}

export function TopLayerMessage({
  className,
  role,
  children,
}: {
  className: string;
  role: "alert" | "status";
  children: ReactNode;
}) {
  const [dialogLayer, setDialogLayer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const updateLayer = () =>
      setDialogLayer(
        document.querySelector<HTMLElement>(
          "dialog[open] .dialog-message-layer",
        ),
      );
    updateLayer();
    window.addEventListener("c52:dialog-layer-change", updateLayer);
    return () =>
      window.removeEventListener("c52:dialog-layer-change", updateLayer);
  }, []);
  const message = (
    <div className={className} role={role}>
      {children}
    </div>
  );
  return dialogLayer ? createPortal(message, dialogLayer) : message;
}

export function SettingsDialog({
  prefs,
  setPrefs,
  close,
  language,
  setLanguage,
}: {
  prefs: Preferences;
  setPrefs: (p: Preferences) => void;
  close: () => void;
  language: string;
  setLanguage: (l: string) => void;
}) {
  const { t } = useTranslation();
  const tabs = ["general", "display", "cards", "audio"] as const;
  type SettingsTab = (typeof tabs)[number];
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const tabLabels: Record<SettingsTab, string> = {
    general: t("settingsTabGeneral"),
    display: t("settingsTabDisplay"),
    cards: t("settingsTabCards"),
    audio: t("settingsTabAudio"),
  };
  const cardDesigns = [
    {
      value: "classic",
      label: t("cardDesignClassic"),
      description: t("cardDesignClassicDescription"),
    },
    {
      value: "four-color",
      label: t("cardDesignFourColor"),
      description: t("cardDesignFourColorDescription"),
    },
    {
      value: "outline",
      label: t("cardDesignOutline"),
      description: t("cardDesignOutlineDescription"),
    },
    {
      value: "midnight",
      label: t("cardDesignMidnight"),
      description: t("cardDesignMidnightDescription"),
    },
  ] as const;
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPrefs({ ...prefs, [key]: value });
  const customColor = validHexColor(prefs.customAccent)
    ? prefs.customAccent
    : defaultPreferences.customAccent;
  const selectTab = (tab: SettingsTab, focus = false) => {
    setActiveTab(tab);
    if (focus) {
      requestAnimationFrame(() =>
        document.getElementById(`settings-tab-${tab}`)?.focus(),
      );
    }
  };
  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tab: SettingsTab,
  ) => {
    const currentIndex = tabs.indexOf(tab);
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(tabs[nextIndex]!, true);
  };
  return (
    <Dialog title={t("settings")} close={close}>
      <div className="settings-dialog-content">
        <div
          className="settings-tabs"
          role="tablist"
          aria-label={t("settingsTabsLabel")}
        >
          {tabs.map((tab) => (
            <button
              id={`settings-tab-${tab}`}
              className="settings-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`settings-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
              key={tab}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div
          id="settings-panel-general"
          className="settings-grid settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          hidden={activeTab !== "general"}
        >
          <label>
            {t("language")}
            <ResponsiveSelect
              label={t("language")}
              value={language}
              onChange={setLanguage}
              options={[
                { value: "de", label: "Deutsch" },
                { value: "en", label: "English" },
              ]}
            />
          </label>
          <label>
            {t("theme")}
            <ResponsiveSelect
              label={t("theme")}
              value={prefs.theme}
              onChange={(value) =>
                update("theme", value as Preferences["theme"])
              }
              options={[
                { value: "system", label: t("themeSystem") },
                { value: "light", label: t("themeLight") },
                { value: "dark", label: t("themeDark") },
              ]}
            />
          </label>
        </div>

        <div
          id="settings-panel-display"
          className="settings-grid settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-display"
          hidden={activeTab !== "display"}
        >
          <label>
            {t("accentColor")}
            <ResponsiveSelect
              label={t("accentColor")}
              value={prefs.accent}
              onChange={(value) =>
                update("accent", value as Preferences["accent"])
              }
              options={[
                { value: "collection", label: t("accentCollection") },
                { value: "ocean", label: t("accentOcean") },
                { value: "violet", label: t("accentViolet") },
                { value: "amber", label: t("accentAmber") },
                { value: "rose", label: t("accentRose") },
                { value: "custom", label: t("accentCustom") },
              ]}
            />
          </label>
          <div
            className={`custom-accent-card ${prefs.accent === "custom" ? "active" : "disabled"}`}
            aria-disabled={prefs.accent !== "custom"}
          >
            <span className="custom-accent-copy">
              <strong>{t("accentCustomColor")}</strong>
              <small>{t("accentCustomHint")}</small>
            </span>
            <label className="accent-color-picker">
              <span className="sr-only">{t("accentCustomColor")}</span>
              <input
                className="accent-color-input"
                type="color"
                value={customColor}
                disabled={prefs.accent !== "custom"}
                onChange={(event) =>
                  setPrefs({ ...prefs, customAccent: event.target.value })
                }
              />
              <output>{customColor.toUpperCase()}</output>
            </label>
          </div>
          {(["largeText", "highContrast", "reducedMotion"] as const).map(
            (key) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
                {t(key)}
              </label>
            ),
          )}
        </div>

        <div
          id="settings-panel-cards"
          className="settings-grid settings-panel card-settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-cards"
          hidden={activeTab !== "cards"}
        >
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.largeCards}
              onChange={(event) => update("largeCards", event.target.checked)}
            />
            {t("largeCards")}
          </label>
          <div className="settings-range-card">
            <span>
              <strong>{t("cardRankSize")}</strong>
              <output>{Math.round(prefs.cardRankScale * 100)}%</output>
            </span>
            <input
              type="range"
              aria-label={t("cardRankSize")}
              min="0.8"
              max="1.4"
              step="0.1"
              value={prefs.cardRankScale}
              onChange={(event) =>
                update("cardRankScale", Number(event.target.value))
              }
            />
            <small>
              <span>{t("sizeSmall")}</span>
              <span>{t("sizeLarge")}</span>
            </small>
          </div>
          <div className="settings-range-card">
            <span>
              <strong>{t("cardSuitSize")}</strong>
              <output>{Math.round(prefs.cardSuitScale * 100)}%</output>
            </span>
            <input
              type="range"
              aria-label={t("cardSuitSize")}
              min="0.8"
              max="1.4"
              step="0.1"
              value={prefs.cardSuitScale}
              onChange={(event) =>
                update("cardSuitScale", Number(event.target.value))
              }
            />
            <small>
              <span>{t("sizeSmall")}</span>
              <span>{t("sizeLarge")}</span>
            </small>
          </div>
          <fieldset className="card-design-settings">
            <legend>{t("cardDesign")}</legend>
            <div className="card-design-options">
              {cardDesigns.map((design) => {
                const outlined = design.value === "outline";
                return (
                  <label
                    className="card-design-option"
                    data-preview-design={design.value}
                    key={design.value}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="card-design"
                      value={design.value}
                      checked={prefs.cardDesign === design.value}
                      onChange={() => update("cardDesign", design.value)}
                    />
                    <span className="card-design-preview" aria-hidden="true">
                      <span data-suit="clubs">
                        <b>A</b>
                        <i>{outlined ? "♧" : "♣"}</i>
                      </span>
                      <span data-suit="diamonds">
                        <b>Q</b>
                        <i>{outlined ? "♢" : "♦"}</i>
                      </span>
                    </span>
                    <span className="card-design-copy">
                      <strong>{design.label}</strong>
                      <small>{design.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div
          id="settings-panel-audio"
          className="settings-grid settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-audio"
          hidden={activeTab !== "audio"}
        >
          {(["turnSound", "speech"] as const).map((key) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(event) => update(key, event.target.checked)}
              />
              {t(key)}
            </label>
          ))}
          <label>
            {t("speechRate")}
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.1"
              value={prefs.rate}
              disabled={!prefs.speech}
              onChange={(event) => update("rate", Number(event.target.value))}
            />
            <output>{prefs.rate.toFixed(1)}</output>
          </label>
          <label>
            {t("speechVolume")}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={prefs.volume}
              disabled={!prefs.speech}
              onChange={(event) => update("volume", Number(event.target.value))}
            />
            <output>{Math.round(prefs.volume * 100)}%</output>
          </label>
          {!("speechSynthesis" in window) && (
            <p role="status">{t("speechUnavailable")}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

type SelectOption = {
  value: string;
  label: string;
  aliases?: string[];
  disabled?: boolean;
};
function useSmallScreen() {
  const [small, setSmall] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setSmall(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return small;
}

export function ResponsiveSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}) {
  const small = useSmallScreen();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex];
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const root = useRef<HTMLDivElement>(null);
  const listId = useMemo(
    () => `select-${Math.random().toString(36).slice(2)}`,
    [],
  );
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);
  if (small)
    return (
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  const move = (direction: 1 | -1) => {
    let index = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActiveIndex(index);
        return;
      }
    }
  };
  const select = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };
  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(options.findIndex((option) => !option.disabled));
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(
        Math.max(
          0,
          options.map((option) => !option.disabled).lastIndexOf(true),
        ),
      );
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      select(activeIndex);
    }
  };
  return (
    <div className={`custom-select ${open ? "open" : ""}`} ref={root}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={keyDown}
      >
        <span>{selectedOption?.label}</span>
        <span className="custom-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      <ul
        className="custom-select-list"
        id={listId}
        role="listbox"
        aria-label={label}
        aria-hidden={!open}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={`${index === activeIndex ? "active" : ""} ${option.value === value ? "selected" : ""} ${option.disabled ? "disabled" : ""}`}
            onPointerMove={() => !option.disabled && setActiveIndex(index)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              select(index);
            }}
          >
            <span className="select-option-copy">
              <span>{option.label}</span>
              {option.aliases?.length ? (
                <small>{option.aliases.join(", ")}</small>
              ) : null}
            </span>
            {option.value === value && <span aria-hidden="true">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dialog({
  title,
  close,
  children,
  className,
  role,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    window.dispatchEvent(new Event("c52:dialog-layer-change"));
    return () => {
      queueMicrotask(() =>
        window.dispatchEvent(new Event("c52:dialog-layer-change")),
      );
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      role={role}
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) close();
      }}
    >
      <div className="dialog-message-layer" />
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-close"
          type="button"
          aria-label={t("dismiss")}
          onClick={close}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function TextInput({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  hint?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  type?: string;
}) {
  const id = useMemo(() => `field-${Math.random().toString(36).slice(2)}`, []);
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        name={label.toLowerCase().includes("code") ? "code" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small className="field-error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Footer({
  inLobby,
  openRules,
}: {
  inLobby: boolean;
  openRules: () => void;
}) {
  const { t } = useTranslation();
  const paypal =
    (import.meta.env.VITE_PAYPAL_URL as string | undefined) ||
    "https://paypal.me/steinente";
  return (
    <footer>
      {inLobby ? (
        <button className="footer-action footer-rules" onClick={openRules}>
          <svg className="rules-mark" aria-hidden="true" viewBox="0 0 24 24">
            <rect x="4.25" y="5.25" width="11.5" height="15" rx="2.25" />
            <rect x="8.25" y="3.25" width="11.5" height="15" rx="2.25" />
            <path d="m14 7.2-2.2 2.55L14 12.3l2.2-2.55L14 7.2Z" />
          </svg>
          {t("rules")}
        </button>
      ) : (
        <span />
      )}
      <nav className="footer-center" aria-label={t("legalNavigation")}>
        <a href="/impressum">{t("footerLegal")}</a>
        <a href="/datenschutz">{t("footerPrivacy")}</a>
      </nav>
      <a
        className="footer-action paypal-button"
        href={paypal}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="paypal-mark" aria-hidden="true" viewBox="0 0 48 48">
          <path
            fill="#002991"
            d="M38.914 13.35c0 5.574-5.144 12.15-12.927 12.15H18.49l-.368 2.322L16.373 39H7.056l5.605-36h15.095c5.083 0 9.082 2.833 10.555 6.77a9.687 9.687 0 0 1 .603 3.58z"
          />
          <path
            fill="#60CDFF"
            d="M44.284 23.7A12.894 12.894 0 0 1 31.53 34.5h-5.206L24.157 48H14.89l1.483-9 1.75-11.178.367-2.322h7.497c7.773 0 12.927-6.576 12.927-12.15 3.825 1.974 6.055 5.963 5.37 10.35z"
          />
          <path
            fill="#008CFF"
            d="M38.914 13.35C37.31 12.511 35.365 12 33.248 12h-12.64L18.49 25.5h7.497c7.773 0 12.927-6.576 12.927-12.15z"
          />
        </svg>
        {t("donate")}
      </a>
    </footer>
  );
}
