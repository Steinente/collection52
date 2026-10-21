import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { RommeCard } from "@collection52/shared";
import {
  handSortStorageKey,
  loadHandSortSettings,
  suitSymbols,
} from "../client-config";
import {
  moveHandCard,
  reconcileHandOrder,
  type HandSortDirection,
  type HandSortMode,
  type HandSortSettings,
} from "../hand-sort";
import { ResponsiveSelect } from "./ui";

export function useHandSorting<T extends RommeCard>(cards: readonly T[]) {
  const [settings, setSettings] =
    useState<HandSortSettings>(loadHandSortSettings);
  const [order, setOrder] = useState<string[]>(() =>
    reconcileHandOrder([], cards, settings),
  );
  const displayOrder = reconcileHandOrder(order, cards, settings);
  const byId = new Map(cards.map((card) => [card.id, card]));
  const sortedCards = displayOrder
    .map((id) => byId.get(id))
    .filter((card): card is T => Boolean(card));
  useEffect(() => {
    setOrder((current) => {
      const next = reconcileHandOrder(current, cards, settings);
      return next.length === current.length &&
        next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, [cards, settings]);
  useEffect(() => {
    localStorage.setItem(handSortStorageKey, JSON.stringify(settings));
  }, [settings]);
  const setMode = (mode: HandSortMode) => {
    setOrder(displayOrder);
    setSettings((current) => ({ ...current, mode }));
  };
  const setDirection = (direction: HandSortDirection) => {
    setOrder(displayOrder);
    setSettings((current) => ({ ...current, direction }));
  };
  const moveCard = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = moveHandCard(displayOrder, sourceId, targetId);
    if (next.every((id, index) => id === displayOrder[index])) return;
    setOrder(next);
    setSettings((current) => ({ ...current, mode: "none" }));
  };
  const moveCardBy = (cardId: string, offset: -1 | 1) => {
    const sourceIndex = displayOrder.indexOf(cardId);
    const targetId = displayOrder[sourceIndex + offset];
    if (!targetId) return;
    moveCard(cardId, targetId);
  };
  return {
    cards: sortedCards,
    settings,
    setMode,
    setDirection,
    moveCard,
    moveCardBy,
  };
}

export function SortableHandCard({
  cardId,
  moveCard,
  moveCardBy,
  children,
}: {
  cardId: string;
  moveCard: (sourceId: string, targetId: string) => void;
  moveCardBy: (cardId: string, offset: -1 | 1) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(false);
  const pointerDrag = useRef<
    { id: number; x: number; y: number; active: boolean } | undefined
  >(undefined);
  const suppressClick = useRef(false);
  const keyboardMove = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      !event.altKey ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    )
      return;
    event.preventDefault();
    moveCardBy(cardId, event.key === "ArrowLeft" ? -1 : 1);
  };
  const finishPointerDrag = () => {
    if (pointerDrag.current?.active) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    pointerDrag.current = undefined;
    setDragging(false);
    setDragTarget(false);
  };
  return (
    <div
      className={`sortable-hand-card ${dragging ? "dragging" : ""} ${dragTarget ? "drag-target" : ""}`}
      data-sort-card-id={cardId}
      draggable
      title={t("dragCardToSort")}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
      onKeyDown={keyboardMove}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" || event.button !== 0) return;
        pointerDrag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          active: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const pointer = pointerDrag.current;
        if (!pointer || pointer.id !== event.pointerId) return;
        if (!pointer.active && Math.abs(event.clientX - pointer.x) < 9) return;
        pointer.active = true;
        setDragging(true);
        event.preventDefault();
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-sort-card-id]")?.dataset.sortCardId;
        if (target && target !== cardId) moveCard(cardId, target);
      }}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onDragStart={(event) => {
        setDragging(true);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", cardId);
      }}
      onDragEnd={() => {
        setDragging(false);
        setDragTarget(false);
      }}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("text/plain"))
          setDragTarget(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragTarget(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragTarget(false);
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId) moveCard(sourceId, cardId);
      }}
    >
      {children}
    </div>
  );
}

export function useNewHandCards(
  cards: readonly { id: string }[],
  gameId: string,
) {
  const signature = cards.map((card) => card.id).join("|");
  const previous = useRef({
    gameId,
    ids: new Set(cards.map((card) => card.id)),
  });
  const timer = useRef<number | undefined>(undefined);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const currentIds = new Set(cards.map((card) => card.id));
    if (previous.current.gameId !== gameId) {
      previous.current = { gameId, ids: currentIds };
      setNewCardIds(new Set());
      return;
    }
    const additions = cards
      .filter((card) => !previous.current.ids.has(card.id))
      .map((card) => card.id);
    previous.current = { gameId, ids: currentIds };
    if (!additions.length) return;
    window.clearTimeout(timer.current);
    setNewCardIds(new Set(additions));
    timer.current = window.setTimeout(() => setNewCardIds(new Set()), 2500);
  }, [cards, gameId, signature]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return newCardIds;
}

export function HandSortControls({
  settings,
  setMode,
  setDirection,
}: {
  settings: HandSortSettings;
  setMode: (mode: HandSortMode) => void;
  setDirection: (direction: HandSortDirection) => void;
}) {
  const { t } = useTranslation();
  const ascending = settings.direction === "asc";
  return (
    <div className="hand-sort-controls">
      <ResponsiveSelect
        label={t("handSort")}
        value={settings.mode}
        onChange={(value) => setMode(value as HandSortMode)}
        options={[
          { value: "suit", label: t("handSortSuit") },
          { value: "rank", label: t("handSortRank") },
          { value: "none", label: t("handSortNone") },
        ]}
      />
      <button
        type="button"
        className="hand-sort-direction"
        disabled={settings.mode === "none"}
        aria-label={t(ascending ? "handSortAscending" : "handSortDescending")}
        onClick={() => setDirection(ascending ? "desc" : "asc")}
      >
        <span aria-hidden="true">{ascending ? "↑" : "↓"}</span>
        <span className="hand-sort-direction-label">
          {t(ascending ? "handSortAscending" : "handSortDescending")}
        </span>
      </button>
    </div>
  );
}

export function CardFace({ card }: { card: RommeCard }) {
  const faces: Record<string, string> = {
    jack: "J",
    queen: "Q",
    king: "K",
    ace: "A",
  };
  if (card.rank === "joker")
    return (
      <span aria-hidden="true" className="joker">
        <b>JOKER</b>
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={
        card.suit === "hearts" || card.suit === "diamonds" ? "red" : ""
      }
    >
      <b>{faces[card.rank] ?? card.rank}</b>
      <i>{suitSymbols[card.suit]}</i>
    </span>
  );
}
