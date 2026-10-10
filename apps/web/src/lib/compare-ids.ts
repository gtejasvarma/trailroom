// Compare: which try-ons are being compared. The ids are the person's own pose-set ids, carried
// in the URL (/compare?ids=a,b,c) so the view is linkable and survives a reload. Whether they are
// really theirs is decided on the server; this only fixes the shape: unique, at most four.
export const MAX_COMPARE = 4;
/** Compare is a wide-screen view: the entry points and the route appear from this width. */
export const COMPARE_MIN_WIDTH = 768;

const ID = /^[A-Za-z0-9][A-Za-z0-9._@=-]{0,199}$/;

/** "a,b,a,,c" gives ["a","b","c"]; anything that is not a plain id is dropped; capped at four. */
export function parseCompareIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!ID.test(id) || id.includes("..") || out.includes(id)) continue;
    out.push(id);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

/** True when the raw value asked for more than four distinct ids (the API refuses these). */
export function tooManyCompareIds(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ID.test(s));
  return new Set(ids).size > MAX_COMPARE;
}

export const compareHref = (ids: string[]) =>
  `/compare?ids=${ids.slice(0, MAX_COMPARE).map(encodeURIComponent).join(",")}`;

/** Adds the id to the tray, or takes it out when it is already there. A fifth is ignored. */
export function toggleTray(tray: string[], id: string): string[] {
  if (tray.includes(id)) return tray.filter((x) => x !== id);
  return tray.length >= MAX_COMPARE ? tray : [...tray, id];
}

/** "Compare all": the four most recent tried pieces (newest first in, newest first out). */
export function mostRecent(ids: string[]): string[] {
  return ids.slice(0, MAX_COMPARE);
}

/**
 * The pose a column shows when every column is on `pose`: the same pose, or null when this
 * piece's set lacks it (a three-pose set). Never a different pose.
 */
export function poseFor(published: string[], pose: string): string | null {
  return published.includes(pose) ? pose : null;
}

/** The C key opens Compare with two or more selected, unless focus is in a field or a dialog is open. */
export function shouldOpenCompare(
  e: {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    target: EventTarget | null;
  },
  selected: number,
  dialogOpen = false,
): boolean {
  if (e.key.toLowerCase() !== "c") return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (selected < 2 || dialogOpen) return false;
  const t = e.target as {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;
  const tag = (t?.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (t?.isContentEditable) return false;
  return true;
}
