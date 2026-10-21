import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import type { Ack } from "../models";
import { socket } from "../socket";
import { Dialog } from "./ui";

export type DeviceTransferMode = "send" | "receive";

const normalizeTransferCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 8);

const displayTransferCode = (value: string) => {
  const normalized = normalizeTransferCode(value);
  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
};

const transferUrlForCode = (code: string) => {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set("transfer", code);
  return url.toString();
};

export function DeviceTransferDialog({
  mode,
  initialCode = "",
  close,
  onClaimed,
  announce,
}: {
  mode: DeviceTransferMode;
  initialCode?: string;
  close: () => void;
  onClaimed: (result: Ack) => void;
  announce: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [transferCode, setTransferCode] = useState(() =>
    displayTransferCode(initialCode),
  );
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(mode === "send");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"code" | "link" | null>(
    null,
  );
  const deadline = useRef(0);
  const requestSequence = useRef(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const copyFeedbackTimer = useRef<number | undefined>(undefined);
  const transferUrl = transferCode ? transferUrlForCode(transferCode) : "";

  const generate = useCallback(() => {
    const sequence = ++requestSequence.current;
    const requestedAt = performance.now();
    setLoading(true);
    setExpired(false);
    setError("");
    setCopyError("");
    setCopiedTarget(null);
    setQrDataUrl("");
    socket.emit("session:transfer:create", (result) => {
      if (sequence !== requestSequence.current) return;
      setLoading(false);
      if (
        !result.ok ||
        !result.transferCode ||
        result.expiresAt === undefined ||
        result.serverTime === undefined
      ) {
        setError(result.error ?? "unknown_error");
        return;
      }
      setTransferCode(result.transferCode);
      const roundTripTime = performance.now() - requestedAt;
      const duration = Math.max(
        0,
        result.expiresAt - result.serverTime - roundTripTime / 2,
      );
      deadline.current = performance.now() + duration;
      setRemainingSeconds(Math.ceil(duration / 1000));
    });
  }, []);

  useEffect(() => {
    if (mode === "send") generate();
  }, [generate, mode]);

  useEffect(() => {
    if (mode !== "receive") return;
    const frame = requestAnimationFrame(() => codeInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (mode !== "send" || !transferCode || loading || error) return;
    const update = () => {
      const remaining = Math.max(0, deadline.current - performance.now());
      setRemainingSeconds(Math.ceil(remaining / 1000));
      if (remaining <= 0) setExpired(true);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [error, loading, mode, transferCode]);

  useEffect(() => {
    if (mode !== "send" || !transferCode || expired) return;
    let cancelled = false;
    void QRCode.toDataURL(transferUrlForCode(transferCode), {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#07110e", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [expired, mode, transferCode]);

  useEffect(
    () => () => {
      if (copyFeedbackTimer.current !== undefined)
        window.clearTimeout(copyFeedbackTimer.current);
    },
    [],
  );

  const copy = async (value: string, target: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError("");
      setCopiedTarget(target);
      if (copyFeedbackTimer.current !== undefined)
        window.clearTimeout(copyFeedbackTimer.current);
      copyFeedbackTimer.current = window.setTimeout(() => {
        setCopiedTarget(null);
        copyFeedbackTimer.current = undefined;
      }, 3000);
      announce(
        t(
          target === "code"
            ? "deviceTransferCodeCopied"
            : "deviceTransferLinkCopied",
        ),
      );
    } catch {
      setCopyError(t("errors.clipboard_unavailable"));
    }
  };

  const regenerate = useCallback(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setExpired(false);
    setError("");
    setQrDataUrl("");
    socket.emit("session:transfer:cancel", (result) => {
      if (sequence !== requestSequence.current) return;
      if (!result.ok) {
        setLoading(false);
        setError(result.error ?? "unknown_error");
        return;
      }
      generate();
    });
  }, [generate]);

  const cancelAndClose = () => {
    requestSequence.current += 1;
    if (mode === "send") socket.emit("session:transfer:cancel", () => close());
    else close();
  };

  const claim = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeTransferCode(transferCode);
    if (normalized.length !== 8 || loading) return;
    setLoading(true);
    setError("");
    socket.emit(
      "session:transfer:claim",
      { transferCode: normalized },
      (result) => {
        setLoading(false);
        if (!result.ok) {
          setError(result.error ?? "unknown_error");
          return;
        }
        onClaimed(result);
      },
    );
  };

  return (
    <Dialog
      title={t(
        mode === "send" ? "deviceTransferTitle" : "deviceTransferClaimTitle",
      )}
      close={close}
    >
      {mode === "send" ? (
        <div className="device-transfer-content">
          <p>{t("deviceTransferExplanation")}</p>
          {loading ? (
            <p className="device-transfer-loading" role="status">
              {t("deviceTransferGenerating")}
            </p>
          ) : error ? (
            <p className="field-error" role="alert">
              {t(`errors.${error}`, { defaultValue: error })}
            </p>
          ) : expired ? (
            <div className="device-transfer-expired" role="status">
              <strong>{t("deviceTransferExpired")}</strong>
              <p>{t("deviceTransferExpiredHint")}</p>
            </div>
          ) : (
            <div className="device-transfer-share">
              <div className="device-transfer-qr">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={t("deviceTransferQrAlt")} />
                ) : (
                  <span role="status">{t("deviceTransferQrLoading")}</span>
                )}
              </div>
              <div className="device-transfer-share-details">
                <div className="device-transfer-code-block">
                  <div>
                    <span>{t("deviceTransferCodeLabel")}</span>
                    <strong>{transferCode}</strong>
                  </div>
                  <button
                    className={copiedTarget === "code" ? "copy-success" : ""}
                    type="button"
                    onClick={() => void copy(transferCode, "code")}
                  >
                    {copiedTarget === "code"
                      ? `✓ ${t("copied")}`
                      : t("deviceTransferCopyCode")}
                  </button>
                </div>
                <div className="device-transfer-link-block">
                  <span>{t("deviceTransferLinkLabel")}</span>
                  <code title={transferUrl}>{transferUrl}</code>
                  <button
                    className={copiedTarget === "link" ? "copy-success" : ""}
                    type="button"
                    onClick={() => void copy(transferUrl, "link")}
                  >
                    {copiedTarget === "link"
                      ? `✓ ${t("copied")}`
                      : t("deviceTransferCopyLink")}
                  </button>
                </div>
                {copyError && (
                  <p className="field-error" role="alert">
                    {copyError}
                  </p>
                )}
                <p className="device-transfer-countdown" role="timer">
                  {t("deviceTransferExpiresIn", { count: remainingSeconds })}
                </p>
                <p className="device-transfer-security-note">
                  {t("deviceTransferSecurityNote")}
                </p>
              </div>
            </div>
          )}
          <div className="device-transfer-actions">
            {(expired || error) && (
              <button className="primary" type="button" onClick={generate}>
                {t("deviceTransferGenerateNew")}
              </button>
            )}
            {!expired && !error && !loading && (
              <button type="button" onClick={regenerate}>
                {t("deviceTransferRegenerate")}
              </button>
            )}
            <button type="button" onClick={cancelAndClose}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <form className="device-transfer-content" onSubmit={claim}>
          <p>{t("deviceTransferClaimExplanation")}</p>
          <label>
            {t("deviceTransferCodeLabel")}
            <input
              ref={codeInput}
              value={transferCode}
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              aria-invalid={Boolean(error)}
              onChange={(event) =>
                setTransferCode(displayTransferCode(event.target.value))
              }
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {t(`errors.${error}`, { defaultValue: error })}
            </p>
          )}
          <div className="device-transfer-actions">
            <button
              className="primary"
              type="submit"
              disabled={
                normalizeTransferCode(transferCode).length !== 8 || loading
              }
            >
              {t(loading ? "deviceTransferClaiming" : "deviceTransferClaim")}
            </button>
            <button type="button" onClick={cancelAndClose}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
