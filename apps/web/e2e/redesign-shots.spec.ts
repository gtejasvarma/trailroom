// Review screenshots for the redesign, into runs/redesign/ (git-ignored). Not assertions.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  continueWithGoogle,
  expect,
  realReveal,
  test,
  tryOnFromScratch,
} from "./helpers";

const OUT = process.env.SHOTS_DIR ?? "redesign";
const DIR = join(fileURLToPath(import.meta.url), "../../../../runs", OUT);
mkdirSync(DIR, { recursive: true });
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function shot(page: Page, name: string, size: string, full = false) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(DIR, `${name}-${size}.png`),
    fullPage: full,
  });
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("shots", async ({ page }) => {
      test.setTimeout(240_000);
      await realReveal(page);

      // New visitor.
      await page.goto("/");
      await expect(page.getByTestId("proof-range")).toHaveValue("50", {
        timeout: 15_000,
      });
      await page.waitForFunction(() =>
        [...document.images].every((i) => {
          const r = i.getBoundingClientRect();
          return (
            r.top >= innerHeight || r.bottom <= 0 || r.width === 0 || i.complete
          );
        }),
      );
      await shot(page, "home-new-fold", size.name);
      await shot(page, "home-new-full", size.name, true);

      // A card hovered/heart saved with its toast; the product page.
      await page.locator("article[data-item=coat] [data-testid=heart]").click();
      await expect(page.getByTestId("toast")).toBeVisible();
      await page.locator("article[data-item=coat]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, "heart-toast", size.name);
      await page.goto("/item/jump");
      await page.waitForTimeout(600);
      await shot(page, "product", size.name);
      await page.goto("/lists");
      await page.waitForTimeout(600);
      await shot(page, "lists-favourites", size.name);

      // Try-on: the reveal at three moments.
      await page.goto("/");
      await tryOnFromScratch(page, "Wool car coat");
      const dialog = page.getByRole("dialog", {
        name: "Create an account to save",
      });
      await expect(
        page
          .getByTestId("queue-title")
          .filter({ hasText: /ready$/ })
          .or(page.getByTestId("reveal")),
      ).toBeVisible({ timeout: 40_000 });
      if (!(await page.getByTestId("reveal").isVisible())) {
        await expect(page.getByRole("dialog")).toBeVisible();
        await continueWithGoogle(page, { name: "Maya Chen" });
      }
      void dialog;
      const r = page.getByTestId("reveal");
      await expect(r).toHaveAttribute("data-step", /^[0-4]$/, {
        timeout: 30_000,
      });
      await shot(page, "reveal-1-label-photo", size.name);
      await expect(r).toHaveAttribute("data-step", /^[2-4]$/);
      await page.waitForTimeout(420);
      await shot(page, "reveal-2-mid-wipe", size.name);
      await expect(r).toHaveAttribute("data-step", "4", { timeout: 5_000 });
      await page.waitForTimeout(400);
      await shot(page, "reveal-3-end", size.name);
      await page.getByTestId("reveal-continue").click();
      await expect(r).toHaveCount(0);
      await page.waitForTimeout(500);
      await shot(page, "result", size.name);
      await shot(page, "result-full", size.name, true);
      const hold = page.getByTestId("hold-compare");
      await hold.scrollIntoViewIfNeeded();
      const b = (await hold.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.getByTestId("pose-gallery").scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot(page, "result-hold", size.name);
      await page.mouse.up();

      // Home with a photo: the card on you.
      await page.goto("/");
      await expect(
        page.locator("article[data-item=coat][data-on-you=true]"),
      ).toBeVisible();
      await page.waitForTimeout(800);
      await shot(page, "home-photo-fold", size.name);
      await page.locator("article[data-item=coat]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, "card-on-you", size.name);
      await page.goto("/lists");
      await page.waitForTimeout(500);
      await shot(page, "lists-signed-in", size.name);
    });
  });
}
