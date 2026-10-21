import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "./ui";

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
};

export type ConfirmationChoiceOptions = ConfirmationOptions & {
  alternativeLabel: string;
  alternativeTone?: "default" | "danger";
};

export type ConfirmationChoice = "confirm" | "alternative" | "cancel";

type PendingConfirmation = ConfirmationOptions & {
  alternativeLabel?: string;
  alternativeTone?: "default" | "danger";
  resolve: (choice: ConfirmationChoice) => void;
};

type ConfirmationContextValue = {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  choose: (options: ConfirmationChoiceOptions) => Promise<ConfirmationChoice>;
};

const ConfirmationContext = createContext<ConfirmationContextValue | undefined>(
  undefined,
);

export function ConfirmationDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingConfirmation>();
  const pendingRef = useRef<PendingConfirmation | undefined>(undefined);
  const queueRef = useRef<PendingConfirmation[]>([]);

  const enqueue = useCallback(
    (options: ConfirmationOptions | ConfirmationChoiceOptions) =>
      new Promise<ConfirmationChoice>((resolve) => {
        const request = { ...options, resolve };
        if (pendingRef.current) {
          queueRef.current.push(request);
          return;
        }
        pendingRef.current = request;
        setPending(request);
      }),
    [],
  );

  const confirm = useCallback(
    async (options: ConfirmationOptions) =>
      (await enqueue(options)) === "confirm",
    [enqueue],
  );

  const settle = useCallback((choice: ConfirmationChoice) => {
    const current = pendingRef.current;
    if (!current) return;
    current.resolve(choice);
    const next = queueRef.current.shift();
    pendingRef.current = next;
    setPending(next);
  }, []);

  useEffect(
    () => () => {
      pendingRef.current?.resolve("cancel");
      for (const request of queueRef.current) request.resolve("cancel");
      queueRef.current = [];
    },
    [],
  );

  return (
    <ConfirmationContext.Provider value={{ confirm, choose: enqueue }}>
      {children}
      {pending && (
        <Dialog
          className={`confirmation-dialog${pending.alternativeLabel ? " confirmation-dialog-wide" : ""}`}
          role="alertdialog"
          title={pending.title}
          close={() => settle("cancel")}
        >
          <div className="confirmation-content">
            <span
              className={`confirmation-symbol ${pending.tone === "danger" ? "danger" : ""}`}
              aria-hidden="true"
            >
              !
            </span>
            <p>{pending.message}</p>
            <div
              className={`confirmation-actions${pending.alternativeLabel ? " has-alternative" : ""}`}
            >
              <button type="button" autoFocus onClick={() => settle("cancel")}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className={
                  pending.tone === "danger"
                    ? "confirmation-confirm danger"
                    : "confirmation-confirm primary"
                }
                onClick={() => settle("confirm")}
              >
                {pending.confirmLabel}
              </button>
              {pending.alternativeLabel && (
                <button
                  type="button"
                  className={
                    pending.alternativeTone === "danger"
                      ? "confirmation-confirm confirmation-alternative danger"
                      : "confirmation-confirm confirmation-alternative"
                  }
                  onClick={() => settle("alternative")}
                >
                  {pending.alternativeLabel}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context)
    throw new Error("useConfirmation requires ConfirmationDialogProvider");
  return context.confirm;
}

export function useConfirmationChoice() {
  const context = useContext(ConfirmationContext);
  if (!context)
    throw new Error(
      "useConfirmationChoice requires ConfirmationDialogProvider",
    );
  return context.choose;
}
