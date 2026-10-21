export const suits = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof suits)[number];
export const ranks52 = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "jack",
  "queen",
  "king",
  "ace",
] as const;
export type Rank = (typeof ranks52)[number];
export type Card = { id: string; suit: Suit; rank: Rank };
export type DeckSize = 32 | 36 | 52;

export function createDeck(size: DeckSize): Card[] {
  const ranks =
    size === 32 ? ranks52.slice(5) : size === 36 ? ranks52.slice(4) : ranks52;
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({ id: `${suit}-${rank}`, suit, rank })),
  );
}

export function rankValue(card: Card): number {
  return ranks52.indexOf(card.rank);
}

export function beats(defense: Card, attack: Card, trump: Suit): boolean {
  if (defense.suit === attack.suit)
    return rankValue(defense) > rankValue(attack);
  return defense.suit === trump && attack.suit !== trump;
}

export function shuffle<T>(
  items: readonly T[],
  randomInt: (max: number) => number,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
