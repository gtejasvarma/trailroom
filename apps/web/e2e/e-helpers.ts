// Shared by the Phase E specs: sizes, review PNGs (runs/phase-e/, git-ignored), axe, and a signed-in
// person with several finished try-ons.
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  confirmWhichPhoto,
  expect,
  settle as settleAnimations,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";

export const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
export type Size = (typeof SIZES)[number];

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-e",
);
mkdirSync(RUNS_DIR, { recursive: true });
const HIDE_DEV_BADGE = "nextjs-portal { display: none !important; }";

/** Fonts, animations and visible images settled; the dev badge hidden. */
export async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page.evaluate(() => document.fonts.ready);
  await settleAnimations(page);
  await page.waitForFunction(() =>
    [...document.images].every((i) => {
      const r = i.getBoundingClientRect();
      const onScreen = r.width > 0 && r.height > 0 && r.top < innerHeight;
      return !onScreen || (i.complete && i.naturalWidth > 0);
    }),
  );
}

export async function shot(page: Page, name: string, full = false) {
  await settle(page);
  await page.screenshot({
    path: join(RUNS_DIR, `${name}.png`),
    fullPage: full,
  });
}

export async function serious(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
}

export async function noHScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

export const NAME = "Maya Rao";

/** One more try-on for a signed-in person with a photo: product page, Try it on, default photo. */
export async function tryOnNext(page: Page, itemId: string) {
  await page.goto(`/item/${itemId}`);
  await expect(async () => {
    await page.getByRole("button", { name: "Try it on" }).click();
    await expect(
      page.getByRole("dialog", { name: "Which photo?" }),
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await confirmWhichPhoto(page);
  await expect(page.getByTestId("pose-gallery")).toBeVisible({
    timeout: 30_000,
  });
}

const PIECES: Record<string, string> = {
  vest: "Knit button vest",
  coat: "Wool car coat",
  slip: "Bias-cut slip dress",
  suit: "Tailored linen suit",
};

/**
 * A signed-in person (Maya Rao) with a finished try-on of each piece, in order. The first goes
 * through the guest path and account sheet; the rest start from the product page.
 */
export async function signedInWithTryOns(page: Page, itemIds: string[]) {
  const [first, ...rest] = itemIds;
  await tryOnFromScratch(page, PIECES[first!]!);
  await waitForResult(page, { name: NAME });
  for (const id of rest) await tryOnNext(page, id);
}

/** The newest-first order "Your try-ons" lists, as item ids. */
export async function tryOnItems(page: Page): Promise<string[]> {
  return page
    .getByTestId("tryon-card")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-item") ?? ""));
}
