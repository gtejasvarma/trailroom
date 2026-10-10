// Phase F: "Wear it with" (outfit renders). At 390x844 and 1440x900. Review PNGs go to
// runs/phase-f/ (git-ignored). The fake provider stands in for the model: no real call is made.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  continueWithGoogle,
  dismissSheet,
  expect,
  setScript,
  test,
  tryOnFromScratch,
  waitForGuestReady,
} from "./helpers";
import {
  SIZES,
  noHScroll,
  serious,
  settle,
  signedInWithTryOns,
} from "./e-helpers";

test.describe.configure({ timeout: 180_000 });

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-f",
);
mkdirSync(RUNS_DIR, { recursive: true });
async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: join(RUNS_DIR, `${name}.png`) });
}
const MASK = (page: Page) => [
  page.locator("nextjs-portal"),
  page.getByTestId("toast"),
];

const pairSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Worn with your wool car coat" });

/** A signed-in person with a finished coat try-on, on its result. */
async function onCoatResult(page: Page) {
  await signedInWithTryOns(page, ["coat"]);
  await expect(page.getByTestId("outfit-row")).toBeVisible();
}

async function openSlipPair(page: Page) {
  await page
    .getByTestId("pair-thumb")
    .and(page.locator("[data-item=slip]"))
    .click();
  await expect(pairSheet(page)).toBeVisible();
  await settle(page);
}

for (const size of SIZES) {
  const wide = size.width >= 768;
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("the pair row, the pair sheet, the queue chip, the outfit screen, Buy, lists, Your try-ons, remove", async ({
      page,
    }) => {
      await onCoatResult(page);

      // Only valid, ready pairs: the vest, the slip dress and the top. Never jewellery.
      const thumbs = page.getByTestId("pair-thumb");
      await expect(thumbs).toHaveCount(3);
      expect(
        await thumbs.evaluateAll((els) =>
          els.map((e) => e.getAttribute("data-item")),
        ),
      ).toEqual(["vest", "slip", "blouse"]);
      await expect(page.getByTestId("outfit-row")).toContainText(
        wide ? "Wear it with" : "Build the outfit",
      );
      await expect(page.getByTestId("outfit-row")).toContainText(
        wide ? "Both pieces, one render" : "Have a look, then decide",
      );
      await expect(page.getByTestId("toast")).toHaveCount(0);
      await page.getByTestId("outfit-row").scrollIntoViewIfNeeded();
      await shot(page, `result-pair-row-${size.name}`);

      // The pair sheet: photo, label, name, price, description, stock, both prices summed.
      await openSlipPair(page);
      const sheet = pairSheet(page);
      await expect(sheet).toContainText("Bias-cut slip dress");
      await expect(sheet).toContainText("$245");
      await expect(sheet).toContainText("MARCHAND");
      await expect(sheet.getByTestId("pair-add")).toHaveText(
        "Add to the outfit — $573 together",
      );
      await expect(
        sheet.getByRole("button", { name: "Not this one" }),
      ).toBeVisible();
      expect(await sheet.innerText()).not.toMatch(
        /\b(runs (small|large)|true to size|hits (mid|above|below)|your size|fits? you)\b/i,
      );
      await shot(page, `pair-sheet-${size.name}`);
      await expect(page).toHaveScreenshot(`pair-sheet-${size.name}.png`, {
        mask: MASK(page),
      });
      expect(await serious(page)).toEqual([]);
      // "Not this one" closes it and starts nothing.
      await sheet.getByRole("button", { name: "Not this one" }).click();
      await expect(sheet).toBeHidden();
      await expect(page).toHaveURL(/\/try-on\//);

      // Start it: the walk-away queue says it is the outfit.
      setScript([{ pose: "front", outcome: "ok", delayMs: 3_000, times: 1 }]);
      await openSlipPair(page);
      await pairSheet(page).getByTestId("pair-add").click();
      await expect(page.getByTestId("outfit-queue")).toBeVisible();
      await expect(page.getByTestId("queue-title")).toHaveText(
        "Both pieces, coming up",
      );
      await page.goto("/");
      const chip = page.getByTestId("job-chip");
      await expect(chip).toBeVisible();
      await expect(chip).toContainText(
        "Putting the wool car coat and the bias-cut slip dress on you",
      );
      await expect(page.getByTestId("job-chip-sub")).toHaveText(
        "Rendering · you can keep browsing",
      );
      await shot(page, `queue-chip-outfit-${size.name}`);

      // Ready: the toast names the outfit and opens it.
      const toast = page.getByTestId("toast");
      await expect(toast).toContainText("Your outfit is ready", {
        timeout: 30_000,
      });
      await toast.getByRole("link", { name: "See it" }).click();

      // The outfit screen: one image, the chip, the caption beside (not over) it, both pieces.
      const screen = page.getByTestId("outfit-screen");
      await expect(screen).toBeVisible();
      await expect(page.locator("img[data-hero]")).toHaveCount(1);
      await expect(page.getByTestId("pose-gallery")).toHaveCount(0);
      await expect(page.getByTestId("state-chip")).toHaveText(
        "Outfit · on you",
      );
      await expect(page.getByTestId("outfit-title")).toHaveText(
        "wool car coat over the bias-cut slip dress",
      );
      const caption = page.getByTestId("ai-caption");
      await expect(caption).toHaveText("AI-generated preview");
      const img = (await page.locator("img[data-hero]").boundingBox())!;
      const cap = (await caption.boundingBox())!;
      expect(cap.y).toBeGreaterThanOrEqual(img.y + img.height - 1);
      expect(cap.y - (img.y + img.height)).toBeLessThan(24);
      const pieces = page.getByTestId("outfit-piece");
      await expect(pieces).toHaveCount(2);
      await expect(pieces.nth(0)).toContainText("Wool car coat");
      await expect(pieces.nth(0)).toContainText("$328");
      await expect(pieces.nth(1)).toContainText("Bias-cut slip dress");
      await expect(pieces.nth(1)).toContainText("$245");
      await expect(page.getByTestId("outfit-total")).toHaveText("$573");
      await expect(
        page.getByText("Both pieces", { exact: true }),
      ).toBeVisible();
      // The coat has a try-on; the slip dress does not, so it offers one (no second render is
      // spent silently).
      await expect(
        pieces.nth(0).getByRole("button", { name: /Try it on/ }),
      ).toHaveCount(0);
      await expect(
        pieces.nth(1).getByRole("button", { name: /Try it on/ }),
      ).toBeVisible();
      await expect(
        pieces
          .nth(1)
          .getByRole("link", { name: "Open the bias-cut slip dress" }),
      ).toHaveAttribute("href", "/item/slip");
      await shot(page, `outfit-screen-${size.name}`);
      await expect(page).toHaveScreenshot(`outfit-screen-${size.name}.png`, {
        mask: MASK(page),
      });
      expect(await serious(page)).toEqual([]);
      if (!wide) {
        for (const width of [360, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          await noHScroll(page);
        }
        await page.setViewportSize({ width: size.width, height: size.height });
      }

      // Buy the outfit: one sheet, a Go to for each piece.
      await page.getByTestId("buy-outfit").click();
      const buy = page.getByRole("dialog", { name: "Both pieces, $573" });
      await expect(buy).toBeVisible();
      await expect(buy.getByTestId("go-to-label")).toHaveCount(2);
      await expect(buy.getByTestId("outfit-buy-rows")).toContainText(
        "Wool car coat",
      );
      await expect(buy.getByTestId("outfit-buy-rows")).toContainText(
        "Bias-cut slip dress",
      );
      await buy.getByRole("button", { name: "Keep looking" }).click();
      await expect(buy).toBeHidden();

      // Add outfit to a list adds both pieces.
      await page.getByTestId("outfit-to-list").click();
      const list = page.getByRole("dialog", { name: "Save to a list" });
      await list.getByTestId("new-list-name").fill("Weekend");
      await list.getByRole("button", { name: "Create list and add" }).click();
      await expect(page.getByTestId("toast")).toContainText("Created Weekend");
      await expect(list.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "true",
      );
      await expect(list.getByTestId("list-choice")).toContainText("2 pieces");
      await list.getByRole("button", { name: "Done" }).click();
      await expect(list).toBeHidden();

      // Your try-ons: the outfit with its tag and both names; not selectable for Compare.
      await page.goto("/you/try-ons");
      const card = page.getByTestId("outfit-card");
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId("outfit-tag")).toHaveText("Outfit");
      await expect(card).toContainText("Wool car coat and Bias-cut slip dress");
      await expect(card.getByTestId("select-tryon")).toHaveCount(0);
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await shot(page, `your-tryons-outfit-${size.name}`);
      await card.getByTestId("remove-outfit").click();
      await expect(page.getByTestId("toast")).toContainText(
        "Removed your wool car coat and bias-cut slip dress outfit.",
      );
      await expect(card).toHaveCount(0);
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
    });

    test("a piece with no valid pair shows no outfit control", async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["suit"]);
      await expect(page.getByTestId("buy")).toBeVisible();
      await expect(page.getByTestId("outfit-row")).toHaveCount(0);
      await expect(page.getByTestId("pair-thumb")).toHaveCount(0);
    });

    test("an outfit that fails QA shows the honest failure, serves nothing, and Try again works", async ({
      page,
    }) => {
      await onCoatResult(page);
      setScript([{ pose: "front", outcome: "blank", times: 5 }]);
      await openSlipPair(page);
      await pairSheet(page).getByTestId("pair-add").click();
      const fail = page.getByTestId("honest-failure");
      await expect(fail).toBeVisible({ timeout: 30_000 });
      await expect(fail).toHaveAttribute("data-kind", "render_failed");
      await expect(fail).toHaveAttribute("data-outfit", "true");
      await expect(fail).toContainText(
        "That outfit did not come out well enough to show",
      );
      await expect(page.locator("img[data-hero]")).toHaveCount(0);
      await expect(page.getByTestId("outfit-screen")).toHaveCount(0);
      // Try again repeats the outfit; this time the model is fine.
      setScript([]);
      await fail.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByTestId("outfit-screen")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("img[data-hero]")).toHaveCount(1);
    });
  });
}

test("a guest has no way to start an outfit", async ({ page }) => {
  await tryOnFromScratch(page, "Wool car coat");
  await waitForGuestReady(page);
  await dismissSheet(page);
  await expect(page.getByTestId("outfit-row")).toHaveCount(0);
  await expect(page.getByTestId("pair-thumb")).toHaveCount(0);
  await expect(page.getByTestId("buy-outfit")).toHaveCount(0);
  // Signing in is what opens the result and, with it, the pair row.
  await page.getByTestId("see-poses").click();
  await continueWithGoogle(page);
  await expect(page.getByTestId("outfit-row")).toBeVisible({ timeout: 30_000 });
});
