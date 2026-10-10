// Vote arithmetic, shared by the list card, the Sent screen and the vote page. Pure.

/**
 * Whole-number percentages that always add to 100 when there is at least one vote (largest
 * remainder; ties go to the earlier piece). With no votes, every share is 0.
 */
export function shares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return floors;
}

/** "61%", or an em dash for a piece with no votes (the prototype's Sent screen). */
export const shareLabel = (count: number, pct: number): string =>
  count === 0 ? "—" : `${pct}%`;

/** The piece strictly ahead, or null when nothing has been voted or the lead is shared. */
export function leader(
  itemIds: readonly string[],
  counts: Readonly<Record<string, number>>,
): string | null {
  let best: string | null = null;
  let bestN = 0;
  let tied = false;
  for (const id of itemIds) {
    const n = counts[id] ?? 0;
    if (n > bestN) {
      best = id;
      bestN = n;
      tied = false;
    } else if (n === bestN && n > 0) tied = true;
  }
  return tied ? null : best;
}

export const totalVotes = (
  itemIds: readonly string[],
  counts: Readonly<Record<string, number>>,
): number => itemIds.reduce((n, id) => n + (counts[id] ?? 0), 0);
