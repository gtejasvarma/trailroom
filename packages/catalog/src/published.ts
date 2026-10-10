// Pieces published after the static twelve, with no back office: stored in Firestore by the
// publish script, loaded by @trailroom/pipeline, and merged here. This module has no Firebase in
// it. The registry sits on globalThis because the server and a route handler can load this module
// twice (separate bundles) and must still agree on what is published.
import { findFitLanguage } from "./copy-rules";
import { getLabel } from "./labels";
import { hasUnsafeText } from "./unsafe-text";
import { ITEMS, type CatalogItem, type Category, type Photo } from "./items";

type Holder = { __trailroomPublished?: Map<string, CatalogItem> };
const holder = globalThis as Holder;
const store = (): Map<string, CatalogItem> =>
  (holder.__trailroomPublished ??= new Map());

/** Replaces the published set. Static pieces always win over a published piece with the same id. */
export function setPublishedItems(items: readonly CatalogItem[]): void {
  const next = new Map<string, CatalogItem>();
  for (const i of items)
    if (!ITEMS.some((s) => s.id === i.id)) next.set(i.id, i);
  holder.__trailroomPublished = next;
}

/** Adds to the published set without dropping what is there (the client learns pieces one call at a time). */
export function registerPublishedItems(items: readonly CatalogItem[]): void {
  const cur = store();
  for (const i of items) {
    if (!ITEMS.some((s) => s.id === i.id)) cur.set(i.id, i);
  }
}

export const publishedItems = (): CatalogItem[] => [...store().values()];

/** Static pieces, then published ones (newest registered last). */
export const allItems = (): readonly CatalogItem[] =>
  store().size === 0 ? ITEMS : [...ITEMS, ...store().values()];

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(jpg|jpeg|png|webp)$/;
/** A file name that is safe as one path segment: the pattern, and no ".." anywhere in it. */
const fileOk = (f: unknown): f is string =>
  typeof f === "string" && FILE.test(f) && !f.includes("..");
const FOCUS = /^\d{1,3}% \d{1,3}%$/;
const CATEGORIES: readonly (Category | null)[] = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  null,
];
const SHOP = ["apparel", "jewellery", "accessories"];
const TRY_ON = ["ready", "not_yet", "cannot"];

/** Piece ids a published piece may not use: they are routes or the static catalogue's. */
export const isFreeId = (id: string): boolean =>
  ID.test(id) && !ITEMS.some((i) => i.id === id);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;

/**
 * Checks a piece's shape and its words. Returns the piece (as the catalogue type) and no problems,
 * or the list of problems. The copy rule is the catalogue's own: no fit or size language in any
 * text that reaches a shopper (CLAUDE.md hard rule).
 */
export function checkPublishedPiece(
  raw: unknown,
): { item: CatalogItem; problems: [] } | { item: null; problems: string[] } {
  const problems: string[] = [];
  if (!isObj(raw))
    return { item: null, problems: ["the piece is not an object"] };
  const p = raw;
  if (typeof p.id !== "string" || !ID.test(p.id))
    problems.push("id must be 2 to 40 characters of a-z, 0-9 and -");
  if (typeof p.id === "string" && ITEMS.some((i) => i.id === p.id))
    problems.push("id is already a piece in the static catalogue");
  if (!str(p.name, 80))
    problems.push("name is required (80 characters at most)");
  const label =
    typeof p.labelSlug === "string" ? getLabel(p.labelSlug) : undefined;
  if (!label) problems.push("labelSlug is not one of the catalogue's labels");
  if (label && p.label !== label.name)
    problems.push(`label must be "${label.name}" for ${label.slug}`);
  if (
    typeof p.priceUsd !== "number" ||
    !Number.isFinite(p.priceUsd) ||
    p.priceUsd <= 0 ||
    p.priceUsd > 100000 ||
    Math.round(p.priceUsd * 100) !== p.priceUsd * 100
  )
    problems.push("priceUsd must be a positive amount with at most 2 decimals");
  if (typeof p.shopCategory !== "string" || !SHOP.includes(p.shopCategory))
    problems.push("shopCategory must be apparel, jewellery or accessories");
  if (!str(p.shelf, 40)) problems.push("shelf is required");
  const stock = p.stock;
  if (!isObj(stock) || !str(stock.line, 60) || typeof stock.low !== "boolean")
    problems.push("stock must be { line, low }");
  if (
    !Array.isArray(p.pairsWith) ||
    !p.pairsWith.every((x) => typeof x === "string")
  )
    problems.push("pairsWith must be a list of piece ids");
  if (!str(p.description, 400)) problems.push("description is required");
  if (!CATEGORIES.includes(p.category as Category | null))
    problems.push("category must be top, bottom, dress, outerwear or null");
  if (!str(p.promptDescription, 80))
    problems.push("promptDescription is required");
  if (
    typeof p.readiness !== "number" ||
    !(p.readiness >= 0 && p.readiness <= 100)
  )
    problems.push("readiness must be 0 to 100");
  if (
    !Array.isArray(p.readinessReasons) ||
    !p.readinessReasons.every((x) => str(x, 200))
  )
    problems.push("readinessReasons must be a list of sentences");
  if (typeof p.tryOn !== "string" || !TRY_ON.includes(p.tryOn))
    problems.push("tryOn must be ready, not_yet or cannot");
  const photos = p.photos;
  if (
    !Array.isArray(photos) ||
    photos.length < 1 ||
    photos.length > 4 ||
    !photos.every(
      (x) =>
        isObj(x) &&
        fileOk(x.file) &&
        str(x.label, 40) &&
        typeof x.focus === "string" &&
        FOCUS.test(x.focus),
    )
  )
    problems.push(
      'photos must be 1 to 4 of { file (.jpg/.png/.webp), label, focus: "50% 30%" }',
    );
  if (typeof p.renderImage === "string" && !fileOk(p.renderImage))
    problems.push("renderImage is not a valid file name");

  // The copy rule, over every sentence a shopper can read.
  if (problems.length === 0) {
    const texts = [
      p.name,
      p.label,
      p.shelf,
      (stock as { line: string }).line,
      p.description,
      p.promptDescription,
      ...(p.readinessReasons as string[]),
      ...(photos as Photo[]).map((x) => x.label),
      ...(p.pairsWith as string[]),
    ] as string[];
    for (const t of texts) {
      if (hasUnsafeText(t)) {
        problems.push(
          "a text field has a control character, line break or invisible formatting character",
        );
        break;
      }
    }
    for (const t of texts) {
      const hit = findFitLanguage(t);
      if (hit) problems.push(`fit or size language ("${hit.trim()}") in: ${t}`);
    }
  }
  if (problems.length > 0) return { item: null, problems };
  const ph = photos as Photo[];
  const item: CatalogItem = {
    id: p.id as string,
    name: (p.name as string).trim(),
    label: p.label as string,
    labelSlug: p.labelSlug as string,
    priceUsd: p.priceUsd as number,
    shopCategory: p.shopCategory as CatalogItem["shopCategory"],
    shelf: p.shelf as string,
    stock: {
      line: (stock as { line: string }).line,
      low: (stock as { low: boolean }).low,
    },
    pairsWith: p.pairsWith as string[],
    photos: ph.map((x) => ({ file: x.file, label: x.label, focus: x.focus })),
    description: p.description as string,
    category: p.category as Category | null,
    promptDescription: p.promptDescription as string,
    renderImage:
      typeof p.renderImage === "string" ? p.renderImage : ph[0]!.file,
    readiness: p.readiness as number,
    readinessReasons: p.readinessReasons as string[],
    tryOn: p.tryOn as CatalogItem["tryOn"],
  };
  return { item, problems: [] };
}
