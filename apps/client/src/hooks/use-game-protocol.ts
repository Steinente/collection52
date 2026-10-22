import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PublicLobby, StructuredEvent } from "@collection52/shared";
import { loadHandSortSettings } from "../client-config";
import { sortHand } from "../hand-sort";
import type {
  AnyGameView,
  DurakGameView,
  MauMauGameView,
  ProtocolEntry,
  RommeGameView,
  SchwimmenGameView,
  SpadesGameView,
  OhHellGameView,
  CheatGameView,
} from "../models";

type GameProtocolOptions = {
  lobby: PublicLobby | undefined;
  game: AnyGameView | undefined;
  playerId: string;
  events: StructuredEvent[];
  announce: (message: string) => void;
};

export function useGameProtocol({
  lobby,
  game,
  playerId,
  events,
  announce,
}: GameProtocolOptions) {
  const { t } = useTranslation();
  const [protocolOpen, setProtocolOpen] = useState(true);
  const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);
  const narratedGameId = useRef("");
  const lastNarratedSequence = useRef(0);
  const previousGame = useRef<AnyGameView | undefined>(undefined);
  const me = game?.players.find((player) => player.id === playerId);

  useEffect(() => {
    if (!game || !lobby) {
      previousGame.current = undefined;
      return;
    }
    const playerName = (id?: string) =>
      lobby.players.find((player) => player.id === id)?.name ?? "";
    const cardName = (id: unknown) => {
      const rawCard = String(id ?? "");
      const card = /^d\d+-/.test(rawCard)
        ? rawCard.replace(/^d\d+-/, "")
        : rawCard;
      if (card.startsWith("joker-")) return t("rommeJoker");
      const [suit, rank] = card.split("-");
      if (!suit || !rank) return card;
      return t("card", {
        suit: t(`suit_${suit}`),
        rank: t(`rank_${rank}`, { defaultValue: rank }),
      });
    };
    const privateDrawText = (event: StructuredEvent) => {
      const cardIds = Array.isArray(event.data.cardIds)
        ? event.data.cardIds
        : [];
      return t(
        cardIds.length === 1
          ? "protocolPrivateDraw"
          : "protocolPrivateDrawMultiple",
        {
          card: cardName(cardIds[0]),
          cards: cardIds.map(cardName).join(", "),
          count: cardIds.length,
        },
      );
    };
    const additions: ProtocolEntry[] = [];
    if (lobby.gameId === "mau-mau") {
      const mauGame = game as MauMauGameView;
      const mauMe = mauGame.players.find((player) => player.id === playerId);
      const topCard = mauGame.discard.at(-1);
      if (narratedGameId.current !== mauGame.id) {
        if (!mauMe?.hand.length) return;
        narratedGameId.current = mauGame.id;
        setProtocolEntries([]);
        setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(
          0,
          ...events.map((event) => event.sequence),
        );
        additions.push({
          id: `start-${mauGame.id}`,
          timestamp: Date.now(),
          text: t("mauMauProtocolStarted", {
            player: playerName(mauGame.currentPlayerId),
            card: topCard ? cardName(topCard.id) : "",
            cards: mauMe.hand.map((card) => cardName(card.id)).join(", "),
          }),
          private: true,
        });
      } else {
        for (const event of events
          .filter(
            (candidate) => candidate.sequence > lastNarratedSequence.current,
          )
          .sort((a, b) => a.sequence - b.sequence)) {
          const name =
            playerName(event.actorId) || String(event.data.name ?? "");
          let text = "";
          if (event.type === "game.cards.drawn") text = privateDrawText(event);
          else if (event.type === "game.mau-mau.play") {
            const played = cardName(event.data.cardId);
            const rank = String(event.data.cardId ?? "")
              .split("-")
              .at(-1);
            text = t("mauMauProtocolPlay", { name, card: played });
            if (rank === "7")
              text += ` ${t(mauGame.rules.stackSevens ? "mauMauProtocolSevenStack" : "mauMauProtocolSeven", { count: mauGame.pendingDraw })}`;
            else if (rank === "8") text += ` ${t("mauMauProtocolEight")}`;
            else if (rank === "jack")
              text += ` ${t("mauMauProtocolJack", { suit: t(`suit_${String(event.data.chosenSuit ?? "")}`) })}`;
            else if (rank === "ace" && mauGame.rules.aceReverses)
              text += ` ${t("mauMauProtocolAce")}`;
          } else if (
            event.type === "game.mau-mau.draw" &&
            event.actorId !== playerId
          )
            text = t("mauMauProtocolDraw", { name });
          else if (event.type === "game.mau-mau.pass")
            text = t("mauMauProtocolKeep", { name });
          if (text)
            additions.push({
              id: `event-${event.id}`,
              timestamp: event.timestamp,
              text,
              private: event.visibility === "private",
            });
          lastNarratedSequence.current = Math.max(
            lastNarratedSequence.current,
            event.sequence,
          );
        }
        const previous = previousGame.current as MauMauGameView | undefined;
        if (previous?.phase !== "finished" && mauGame.phase === "finished")
          additions.push({
            id: `result-${mauGame.version}`,
            timestamp: Date.now(),
            text: t("mauMauProtocolFinished", {
              name: playerName(mauGame.result?.winnerId),
            }),
          });
      }
      previousGame.current = mauGame;
      if (additions.length) {
        setProtocolEntries((current) => [...current, ...additions].slice(-100));
        announce(additions.map((entry) => entry.text).join(" "));
      }
      return;
    }
    if (lobby.gameId === "schwimmen") {
      const knackGame = game as SchwimmenGameView;
      const knackMe = knackGame.players.find(
        (player) => player.id === playerId,
      );
      if (narratedGameId.current !== knackGame.id) {
        if (!knackMe?.hand.length) return;
        narratedGameId.current = knackGame.id;
        setProtocolEntries([]);
        setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(
          0,
          ...events.map((event) => event.sequence),
        );
        additions.push({
          id: `start-${knackGame.id}`,
          timestamp: Date.now(),
          text: t("knackProtocolStarted", {
            player: playerName(knackGame.currentPlayerId),
            cards: knackMe.hand.map((card) => cardName(card.id)).join(", "),
          }),
          private: true,
        });
      } else {
        for (const event of events
          .filter(
            (candidate) => candidate.sequence > lastNarratedSequence.current,
          )
          .sort((a, b) => a.sequence - b.sequence)) {
          const name =
            playerName(event.actorId) || String(event.data.name ?? "");
          let text = "";
          if (event.type === "game.cards.drawn") text = privateDrawText(event);
          else if (event.type === "game.schwimmen.swap-one")
            text = t("knackProtocolSwapOne", {
              name,
              hand: cardName(event.data.handCardId),
              center: cardName(event.data.centerCardId),
            });
          else if (event.type === "game.schwimmen.swap-all") {
            const taken = Array.isArray(event.data.centerCardIds)
              ? event.data.centerCardIds.map(cardName).join(", ")
              : "";
            const placed = Array.isArray(event.data.handCardIds)
              ? event.data.handCardIds.map(cardName).join(", ")
              : "";
            text =
              taken && placed
                ? t("knackProtocolSwapAllDetailed", { name, taken, placed })
                : t("knackProtocolSwapAll", { name });
          } else if (event.type === "game.schwimmen.pass")
            text = t("knackProtocolPass", { name });
          else if (event.type === "game.schwimmen.knock")
            text = t("knackProtocolKnock", { name });
          else if (event.type === "game.schwimmen.next-round")
            text = t("knackProtocolNextRound", {
              round: knackGame.roundNumber,
            });
          if (text)
            additions.push({
              id: `event-${event.id}`,
              timestamp: event.timestamp,
              text,
              private: event.visibility === "private",
            });
          lastNarratedSequence.current = Math.max(
            lastNarratedSequence.current,
            event.sequence,
          );
        }
        const previous = previousGame.current as SchwimmenGameView | undefined;
        if (
          previous?.phase === "playing" &&
          knackGame.phase !== "playing" &&
          knackGame.roundResult
        )
          additions.push({
            id: `round-result-${knackGame.version}`,
            timestamp: Date.now(),
            text: t("knackProtocolRoundEnded", {
              reason: t(`knackReason_${knackGame.roundResult.reason}`),
            }),
          });
        if (previous?.phase !== "finished" && knackGame.phase === "finished")
          additions.push({
            id: `result-${knackGame.version}`,
            timestamp: Date.now(),
            text: t("knackProtocolFinished", {
              name: playerName(knackGame.result?.winnerId),
            }),
          });
      }
      previousGame.current = knackGame;
      if (additions.length) {
        setProtocolEntries((current) => [...current, ...additions].slice(-100));
        announce(additions.map((entry) => entry.text).join(" "));
      }
      return;
    }
    if (lobby.gameId === "romme") {
      const rommeGame = game as RommeGameView;
      const rommeMe = rommeGame.players.find(
        (player) => player.id === playerId,
      );
      if (narratedGameId.current !== rommeGame.id) {
        if (!rommeMe?.hand.length) return;
        narratedGameId.current = rommeGame.id;
        setProtocolEntries([]);
        setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(
          0,
          ...events.map((event) => event.sequence),
        );
        const spokenHand = sortHand(rommeMe.hand, loadHandSortSettings());
        additions.push({
          id: `start-${rommeGame.id}`,
          timestamp: Date.now(),
          text: t(
            rommeGame.rules.variant === "gin"
              ? "ginProtocolStarted"
              : rommeGame.rules.variant === "canasta"
                ? "canastaProtocolStarted"
                : "rommeProtocolStarted",
            {
              player: playerName(rommeGame.currentPlayerId),
              cards: spokenHand.map((card) => cardName(card.id)).join(", "),
            },
          ),
          private: true,
        });
      } else {
        for (const event of events
          .filter(
            (candidate) => candidate.sequence > lastNarratedSequence.current,
          )
          .sort((a, b) => a.sequence - b.sequence)) {
          const name = playerName(event.actorId);
          let text = "";
          if (event.type === "game.cards.drawn") text = privateDrawText(event);
          else if (
            event.type === "game.romme.draw" &&
            event.actorId !== playerId
          )
            text = t(
              event.data.source === "discard"
                ? "rommeProtocolDrawDiscard"
                : "rommeProtocolDrawStock",
              { name },
            );
          else if (event.type === "game.romme.meld")
            text = t("rommeProtocolMeld", {
              name,
              count: event.data.groupCount,
            });
          else if (event.type === "game.romme.lay-off")
            text = t("rommeProtocolLayOff", {
              name,
              count: Array.isArray(event.data.cardIds)
                ? event.data.cardIds.length
                : 1,
            });
          else if (event.type === "game.romme.discard")
            text = t("rommeProtocolDiscard", {
              name,
              card: cardName(event.data.cardId),
            });
          else if (event.type === "game.romme.pass-opening")
            text = t("ginProtocolPass", { name });
          else if (event.type === "game.romme.knock")
            text = t("ginProtocolKnock", {
              name,
              card: cardName(event.data.cardId),
            });
          else if (event.type === "game.romme.next-round")
            text = t(
              rommeGame.rules.variant === "canasta"
                ? "canastaProtocolNextRound"
                : "ginProtocolNextRound",
              { round: rommeGame.roundNumber },
            );
          if (text)
            additions.push({
              id: `event-${event.id}`,
              timestamp: event.timestamp,
              text,
              private: event.visibility === "private",
            });
          lastNarratedSequence.current = Math.max(
            lastNarratedSequence.current,
            event.sequence,
          );
        }
        const previous = previousGame.current as RommeGameView | undefined;
        if (
          rommeGame.rules.variant === "gin" &&
          previous?.phase === "playing" &&
          rommeGame.phase !== "playing" &&
          rommeGame.roundResult
        )
          additions.push({
            id: `round-result-${rommeGame.version}`,
            timestamp: Date.now(),
            text: t(
              rommeGame.roundResult.reason === "stock"
                ? "ginProtocolStockEnd"
                : "ginProtocolRoundEnd",
              {
                name: playerName(rommeGame.roundResult.winnerId),
                count: rommeGame.roundResult.pointsAwarded,
              },
            ),
          });
        if (
          rommeGame.rules.variant === "canasta" &&
          previous?.phase === "playing" &&
          rommeGame.phase !== "playing" &&
          rommeGame.canastaRoundResult
        )
          additions.push({
            id: `round-result-${rommeGame.version}`,
            timestamp: Date.now(),
            text: t("canastaProtocolRoundEnd"),
          });
        if (previous?.phase !== "finished" && rommeGame.phase === "finished")
          additions.push({
            id: `result-${rommeGame.version}`,
            timestamp: Date.now(),
            text: t(
              rommeGame.rules.variant === "gin"
                ? "ginProtocolFinished"
                : rommeGame.rules.variant === "canasta"
                  ? "canastaProtocolFinished"
                  : "rommeProtocolFinished",
              {
                name:
                  rommeGame.rules.variant === "canasta"
                    ? rommeGame.players
                        .filter(
                          (player) =>
                            player.teamId === rommeGame.result?.winnerTeamId,
                        )
                        .map((player) => player.name)
                        .join(" & ")
                    : playerName(rommeGame.result?.winnerId),
              },
            ),
          });
      }
      previousGame.current = rommeGame;
      if (additions.length) {
        setProtocolEntries((current) => [...current, ...additions].slice(-100));
        announce(additions.map((entry) => entry.text).join(" "));
      }
      return;
    }
    if (["spades", "oh-hell", "cheat"].includes(lobby.gameId)) {
      const socialGame = game as
        | SpadesGameView
        | OhHellGameView
        | CheatGameView;
      const socialMe = socialGame.players.find(
        (player) => player.id === playerId,
      );
      if (narratedGameId.current !== socialGame.id) {
        if (!socialMe?.hand.length) return;
        narratedGameId.current = socialGame.id;
        setProtocolEntries([]);
        setProtocolOpen(true);
        lastNarratedSequence.current = Math.max(
          0,
          ...events.map((event) => event.sequence),
        );
        additions.push({
          id: `start-${socialGame.id}`,
          timestamp: Date.now(),
          text: t("socialProtocolStarted", {
            game: t(lobby.gameId),
            cards: socialMe.hand.map((card) => cardName(card.id)).join(", "),
          }),
          private: true,
        });
      } else {
        for (const event of events
          .filter(
            (candidate) => candidate.sequence > lastNarratedSequence.current,
          )
          .sort((a, b) => a.sequence - b.sequence)) {
          const name = playerName(event.actorId);
          let text = "";
          if (event.type === "game.cards.drawn") text = privateDrawText(event);
          else if (
            event.type === "game.spades.bid" ||
            event.type === "game.oh-hell.bid"
          )
            text = t("trickProtocolBid", { name, count: event.data.bid });
          else if (
            event.type === "game.spades.play" ||
            event.type === "game.oh-hell.play"
          )
            text = t("trickProtocolPlay", {
              name,
              card: cardName(event.data.cardId),
            });
          else if (
            event.type === "game.spades.next-round" ||
            event.type === "game.oh-hell.next-round"
          )
            text = t("protocolNextRound");
          else if (event.type === "game.cheat.play")
            text = t("cheatProtocolPlay", { name, count: event.data.count });
          else if (event.type === "game.cheat.challenge")
            text = t("cheatProtocolChallenge", { name });
          else if (event.type === "game.cheat.accept")
            text = t("cheatProtocolAccept", { name });
          if (text)
            additions.push({
              id: `event-${event.id}`,
              timestamp: event.timestamp,
              text,
              private: event.visibility === "private",
            });
          lastNarratedSequence.current = Math.max(
            lastNarratedSequence.current,
            event.sequence,
          );
        }
        const previous = previousGame.current;
        if (previous?.phase !== "finished" && socialGame.phase === "finished")
          additions.push({
            id: `result-${socialGame.version}`,
            timestamp: Date.now(),
            text: t("socialProtocolFinished"),
          });
      }
      previousGame.current = socialGame;
      if (additions.length) {
        setProtocolEntries((current) => [...current, ...additions].slice(-100));
        announce(additions.map((entry) => entry.text).join(" "));
      }
      return;
    }
    const durakGame = game as DurakGameView;
    if (narratedGameId.current !== durakGame.id) {
      if (!me?.hand.length) return;
      narratedGameId.current = durakGame.id;
      setProtocolEntries([]);
      setProtocolOpen(true);
      lastNarratedSequence.current = Math.max(
        0,
        ...events.map((event) => event.sequence),
      );
      const cards = me.hand.map((card) => cardName(card.id)).join(", ");
      additions.push({
        id: `start-${durakGame.id}`,
        timestamp: Date.now(),
        text: t("protocolGameStarted", {
          trump: t(`suit_${durakGame.trumpSuit}`),
          attacker: playerName(durakGame.attackerId),
          defender: playerName(durakGame.defenderId),
          cards,
        }),
        private: true,
      });
    } else {
      for (const event of events
        .filter(
          (candidate) => candidate.sequence > lastNarratedSequence.current,
        )
        .sort((a, b) => a.sequence - b.sequence)) {
        const name = playerName(event.actorId) || String(event.data.name ?? "");
        let text = "";
        if (event.type === "game.cards.drawn") text = privateDrawText(event);
        else if (event.type === "game.attack") {
          const cardIds = Array.isArray(event.data.cardIds)
            ? event.data.cardIds
            : [event.data.cardId];
          text = t(
            cardIds.length > 1 ? "protocolAttackMultiple" : "protocolAttack",
            {
              name,
              card: cardName(cardIds[0]),
              cards: cardIds.map(cardName).join(", "),
            },
          );
        } else if (event.type === "game.defend")
          text = t("protocolDefend", {
            name,
            attack: cardName(event.data.attackCardId),
            card: cardName(event.data.cardId),
          });
        else if (event.type === "game.take") text = t("protocolTake", { name });
        else if (event.type === "game.pass") text = t("protocolPass", { name });
        if (text)
          additions.push({
            id: `event-${event.id}`,
            timestamp: event.timestamp,
            text,
            private: event.visibility === "private",
          });
        lastNarratedSequence.current = Math.max(
          lastNarratedSequence.current,
          event.sequence,
        );
      }
      const previous = previousGame.current;
      if (
        previous &&
        "table" in previous &&
        previous.table.length > 0 &&
        durakGame.table.length === 0
      ) {
        if (durakGame.phase === "finished") {
          const result = durakGame.result?.draw
            ? t("draw")
            : t("durakResult", { name: playerName(durakGame.result?.durakId) });
          additions.push({
            id: `result-${durakGame.id}-${durakGame.version}`,
            timestamp: Date.now(),
            text: t("protocolFinished", { result }),
          });
        } else {
          additions.push({
            id: `round-${durakGame.id}-${durakGame.version}`,
            timestamp: Date.now(),
            text: t("protocolNewRound", {
              attacker: playerName(durakGame.attackerId),
              defender: playerName(durakGame.defenderId),
            }),
          });
        }
      }
    }
    previousGame.current = durakGame;
    if (!additions.length) return;
    setProtocolEntries((current) => [...current, ...additions].slice(-100));
    announce(additions.map((entry) => entry.text).join(" "));
  }, [announce, events, game, lobby, me, playerId, t]);
  return { protocolEntries, protocolOpen, setProtocolOpen };
}
