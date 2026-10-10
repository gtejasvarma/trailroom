import { afterEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { getItem } from "@trailroom/catalog";
import {
  listRecentPublished,
  loadPublishedCatalog,
  resetPublishedCatalogCache,
} from "./published-catalog";

const piece = (id: string) => ({
  id,
  name: "Washed linen shirt",
  label: "LOAM STUDIO",
  labelSlug: "loam-studio",
  priceUsd: 140,
  shopCategory: "apparel",
  shelf: "New in",
  stock: { line: "In stock", low: false },
  pairsWith: [],
  photos: [{ file: `${id}-1.jpg`, label: "Front", focus: "50% 26%" }],
  description: "Washed linen with a camp collar and a straight cut.",
  category: "top",
  promptDescription: "washed linen camp-collar shirt",
  readiness: 85,
  readinessReasons: ["Clear label photographs with the whole garment visible."],
  tryOn: "ready",
});
const row = (id: string, at: Date) =>
  ({
    id,
    doc: {
      labelSlug: "loam-studio",
      piece: piece(id),
      publishedAt: Timestamp.fromDate(at),
    },
  }) as never;

const DAY = 24 * 60 * 60 * 1000;
afterEach(() => resetPublishedCatalogCache());

describe("the published-pieces cache", () => {
  it("derives the recent list from the cached read: one read serves both", async () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const reader = vi.fn(async () => [
      row("older-shirt", new Date(now.getTime() - 40 * DAY)),
      row("new-shirt", new Date(now.getTime() - 2 * DAY)),
      row("newer-shirt", new Date(now.getTime() - 1 * DAY)),
    ]);
    await loadPublishedCatalog({ force: true, reader });
    for (let i = 0; i < 3; i++) {
      const recent = await listRecentPublished(now, 30);
      expect(recent.map((r) => r.item.id)).toEqual([
        "newer-shirt",
        "new-shirt",
      ]);
    }
    expect(reader).toHaveBeenCalledTimes(1);
    expect(getItem("older-shirt")).toBeDefined();
  });

  it("gives up on a read that hangs, serves the stale list, and waits before trying again", async () => {
    const hang = vi.fn(() => new Promise<never>(() => undefined));
    let t = 1_000_000;
    const now = () => t;
    const started = Date.now();
    const first = await loadPublishedCatalog({
      reader: hang,
      deadlineMs: 20,
      now,
    });
    expect(first).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(hang).toHaveBeenCalledTimes(1);

    t += 1_000; // inside the back-off: no second attempt, an immediate answer
    await loadPublishedCatalog({ reader: hang, deadlineMs: 20, now });
    expect(hang).toHaveBeenCalledTimes(1);

    t += 5_000; // past it: one more attempt
    await loadPublishedCatalog({ reader: hang, deadlineMs: 20, now });
    expect(hang).toHaveBeenCalledTimes(2);
  });

  it("a slow read that misses the deadline still fills the cache when it finishes", async () => {
    let finish!: (rows: unknown[]) => void;
    const slow = vi.fn(
      () => new Promise<never>((res) => (finish = res as never)),
    );
    const first = await loadPublishedCatalog({
      reader: slow,
      deadlineMs: 10,
    });
    expect(first).toEqual([]); // the caller was not kept waiting
    finish([row("late-shirt", new Date())]);
    await new Promise((r) => setTimeout(r, 10));
    expect(getItem("late-shirt")).toBeDefined();
    const recent = await listRecentPublished(new Date(), 30);
    expect(recent.map((r) => r.item.id)).toEqual(["late-shirt"]);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("keeps the last good list when the read throws, and does not retry inside the back-off", async () => {
    const good = vi.fn(async () => [row("kept-shirt", new Date())]);
    let t = 2_000_000;
    const now = () => t;
    await loadPublishedCatalog({ reader: good, now });
    const boom = vi.fn(async () => {
      throw new Error("firestore down");
    });
    t += 6_000; // the cache is stale: this load reads, fails, and starts the back-off
    const items = await loadPublishedCatalog({ reader: boom, now });
    expect(items.map((i) => i.id)).toEqual(["kept-shirt"]);
    t += 4_000;
    await loadPublishedCatalog({ reader: boom, now });
    await loadPublishedCatalog({ reader: boom, now });
    expect(boom).toHaveBeenCalledTimes(1);
    t += 2_000;
    await loadPublishedCatalog({ reader: boom, now });
    expect(boom).toHaveBeenCalledTimes(2);
  });
});
