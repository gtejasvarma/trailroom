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

      // Try-on: the arrival at three moments, the settled mirror, and the hold.
      await page.goto("/");
      await tryOnFromScratch(page, "Wool car coat", { name: "Maya Chen" });
      await expect(
        page
          .getByTestId("queue-title")
          .filter({ hasText: /ready$/ })
          .or(page.getByTestId("pose-gallery")),
      ).toBeVisible({ timeout: 40_000 });
      if (!(await page.getByTestId("pose-gallery").isVisible())) {
        await expect(page.getByRole("dialog")).toBeVisible();
        await continueWithGoogle(page, { name: "Maya Chen" });
      }
      const stage = page.getByTestId("mirror-stage");
      await expect(stage).toBeVisible({ timeout: 30_000 });
      await shot(page, "arrival-1-focus", size.name);
      await page.waitForTimeout(2_400);
      await shot(page, "arrival-2-turning", size.name);
      await expect(stage).toHaveAttribute("data-stage", "done", {
        timeout: 10_000,
      });
      await page.waitForTimeout(400);
      await shot(page, "mirror", size.name);
      await shot(page, "mirror-full", size.name, true);
      const surface = page.getByTestId("pose-surface");
      const b = (await surface.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await page.waitForTimeout(200);
      await shot(page, "mirror-hold", size.name);
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
