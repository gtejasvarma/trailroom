// The Firestore-backed layer of the catalogue. Published pieces (added by scripts/publish-piece.ts,
// standing in for the designer back office) live in Firestore, their images in Cloud Storage under
// catalog/, and are merged with the static twelve behind the same accessors (@trailroom/catalog).
// Lives here, like catalog-images.ts, so the catalogue package stays free of Firebase.
import {
  checkPublishedPiece,
  isFreeId,
  setPublishedItems,
  type CatalogItem,
} from "@trailroom/catalog";
import { catalogContentType } from "@trailroom/catalog/server";
import {
  changePublishedPrice,
  createPublishedPiece,
  getPublishedPiece,
  listPublishedPieces,
  putCatalogImage,
} from "@trailroom/db";
import { logError } from "@trailroom/render";

const TTL_MS = 5_000;
/** A read that has not answered by now is given up on; the stale list keeps being served. */
const READ_DEADLINE_MS = 2_000;
/** After a failed or timed-out read the next attempt waits this long, so requests do not each retry and log. */
const BACKOFF_MS = 5_000;

type PublishedRows = Awaited<ReturnType<typeof listPublishedPieces>>;
interface Cached {
  item: CatalogItem;
  publishedAt: Date;
}

let loadedAt = 0;
let backoffUntil = 0;
let inflight: Promise<CatalogItem[]> | null = null;
let current: CatalogItem[] = [];
/** The same valid pieces with their publish time, for listRecentPublished (no second read). */
let currentRecent: Cached[] = [];

/**
 * Reads the published pieces into the catalogue's registry (at most every 5 seconds per process;
 * `force` skips the wait, `maxAgeMs` shortens it). A stored piece that no longer passes the checks is left out and logged,
 * never shown. A Firestore failure or a read slower than about 2 seconds keeps whatever was loaded
 * before and makes the next attempt wait 5 seconds (`force` ignores that wait).
 */
export async function loadPublishedCatalog(
  opts: {
    force?: boolean;
    maxAgeMs?: number;
    now?: () => number;
    /** Test seams: the Firestore read and the two timings. */
    reader?: () => Promise<PublishedRows>;
    deadlineMs?: number;
    backoffMs?: number;
  } = {},
): Promise<CatalogItem[]> {
  const clock = opts.now ?? Date.now;
  const now = clock();
  if (!opts.force) {
    if (now - loadedAt < (opts.maxAgeMs ?? TTL_MS)) return current;
    if (now < backoffUntil) return current;
  }
  inflight ??= (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Applies a successful read. Also used by a read that missed its deadline but finished later,
    // so a slow first read (a cold start) still fills the cache for the requests after it.
    const apply = (rows: PublishedRows) => {
      const items: CatalogItem[] = [];
      const recent: Cached[] = [];
      for (const r of rows) {
        const c = checkPublishedPiece(r.doc.piece);
        if (
          c.item &&
          c.item.id === r.id &&
          c.item.labelSlug === r.doc.labelSlug
        ) {
          items.push(c.item);
          recent.push({
            item: c.item,
            publishedAt: r.doc.publishedAt.toDate(),
          });
        } else {
          logError(
            `published piece ${r.id} is invalid and is not shown`,
            new Error(c.problems.join("; ")),
          );
        }
      }
      setPublishedItems(items);
      current = items;
      currentRecent = recent;
      loadedAt = clock();
      backoffUntil = 0;
    };
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("reading published pieces timed out")),
          opts.deadlineMs ?? READ_DEADLINE_MS,
        );
      });
      const read = (opts.reader ?? listPublishedPieces)();
      let timedOut = false;
      read.then(
        (rows) => {
          if (timedOut) apply(rows);
        },
        () => undefined, // a read that lost the race must not become an unhandled rejection
      );
      try {
        apply(await Promise.race([read, deadline]));
      } catch (e) {
        timedOut = true;
        throw e;
      }
    } catch (e) {
      backoffUntil = clock() + (opts.backoffMs ?? BACKOFF_MS);
      logError("loading published pieces failed", e);
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
    return current;
  })();
  return inflight;
}

/** True once a read of the published pieces has succeeded in this process (before that, "no pieces" means "not known"). */
export const publishedCatalogLoaded = (): boolean => loadedAt > 0;

/** For tests and the script: forget the cache so the next load reads Firestore. */
export function resetPublishedCatalogCache(): void {
  loadedAt = 0;
  backoffUntil = 0;
  current = [];
  currentRecent = [];
  setPublishedItems([]);
}

export interface PieceSpec extends Record<string, unknown> {
  id: string;
}
export interface PieceImage {
  /** The file name to store under catalog/, as the piece's `photos[].file` names it. */
  file: string;
  data: Buffer;
}

export type PublishResult =
  | { ok: true; item: CatalogItem; eventId: string }
  | { ok: false; problems: string[] };

/** Validates the piece (shape, label, copy rules), stores its images and records the publish event. */
export async function publishPiece(
  spec: unknown,
  images: readonly PieceImage[],
  now: Date = new Date(),
): Promise<PublishResult> {
  const checked = checkPublishedPiece(spec);
  if (!checked.item) return { ok: false, problems: checked.problems };
  const item = checked.item;
  if (!isFreeId(item.id)) {
    return { ok: false, problems: [`the id "${item.id}" cannot be used`] };
  }
  const needed = new Set([...item.photos.map((p) => p.file), item.renderImage]);
  const have = new Map(images.map((i) => [i.file, i.data]));
  const missing = [...needed].filter((f) => !have.has(f));
  if (missing.length > 0) {
    return {
      ok: false,
      problems: missing.map((f) => `no image given for ${f}`),
    };
  }
  if (await getPublishedPiece(item.id)) {
    return {
      ok: false,
      problems: [`a piece with id "${item.id}" is already published`],
    };
  }
  for (const f of needed) {
    await putCatalogImage(f, have.get(f)!, catalogContentType(f));
  }
  const r = await createPublishedPiece(
    item.id,
    item.labelSlug,
    item as unknown as Record<string, unknown>,
    now,
  );
  if (!r.created || !r.eventId) {
    return {
      ok: false,
      problems: [`a piece with id "${item.id}" is already published`],
    };
  }
  await loadPublishedCatalog({ force: true });
  return { ok: true, item, eventId: r.eventId };
}

export type PriceResult =
  | { ok: true; eventId: string; oldPriceUsd: number }
  | { ok: false; problem: string };

/** Changes the price of a published piece and records the event the price email reads. */
export async function changePiecePrice(
  id: string,
  newPriceUsd: number,
  now: Date = new Date(),
): Promise<PriceResult> {
  if (
    !Number.isFinite(newPriceUsd) ||
    newPriceUsd <= 0 ||
    newPriceUsd > 100000 ||
    Math.round(newPriceUsd * 100) !== newPriceUsd * 100
  ) {
    return {
      ok: false,
      problem: "the price must be a positive amount with at most 2 decimals",
    };
  }
  const r = await changePublishedPrice(id, newPriceUsd, now);
  if (!r) {
    return {
      ok: false,
      problem: "no published piece with that id, or the price is already that",
    };
  }
  await loadPublishedCatalog({ force: true });
  return { ok: true, ...r };
}

/**
 * Published pieces from the last `days` days, newest first, with their publish time. Invalid ones
 * are left out. Read from the catalogue cache (at most one Firestore read per 5 seconds per
 * process), never from Firestore directly.
 */
export async function listRecentPublished(
  now: Date,
  days: number,
): Promise<{ item: CatalogItem; publishedAt: Date }[]> {
  await loadPublishedCatalog();
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  return currentRecent
    .filter(
      (r) =>
        r.publishedAt.getTime() >= since &&
        r.publishedAt.getTime() <= now.getTime() + 60_000,
    )
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
