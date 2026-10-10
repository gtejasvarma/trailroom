// The three numbers at the top of You, from real data.
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface YouCounts {
  tryOnsKept: number;
  thisWeek: number;
  lists: number;
}

/** Try-ons kept, those made in the last seven days, and lists. */
export function youCounts(
  tryOns: { createdAt: string }[],
  lists: number,
  now: Date = new Date(),
): YouCounts {
  const cutoff = now.getTime() - WEEK_MS;
  return {
    tryOnsKept: tryOns.length,
    thisWeek: tryOns.filter((t) => Date.parse(t.createdAt) >= cutoff).length,
    lists,
  };
}
