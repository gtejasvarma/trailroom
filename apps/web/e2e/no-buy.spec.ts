// Buy is switched off (BUY_ENABLED = false, Tejas 2026-10-17: "For now temporarily hide buy
// button"). While it is, no Buy button or link, and no "Did it arrive?", appears anywhere. The
// specs that exercise Buy itself (phase-e-buy and the Buy parts of others) run only when it is on.
import type { Page } from "@playwright/test";
import { BUY_ENABLED } from "../src/lib/flags";
import { SIZES, signedInWithTryOns } from "./e-helpers";
import { expect, test } from "./helpers";

test.skip(BUY_ENABLED, "Buy is switched on");
test.describe.configure({ timeout: 180_000 });

/** Nothing on the page is, or reads as, a Buy control. */
async function noBuy(page: Page, where: string) {
  const hits = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "button, a, [role=button], [role=link], [data-testid]",
      ),
    ]
      .filter((e) => {
        const text = (e.textContent ?? "").trim();
        const id = e.getAttribute("data-testid") ?? "";
        return /^buy\b/i.test(text) || /(^|-)buy(-|$)/.test(id);
      })
      .map(
        (e) =>
          `${e.tagName} ${e.getAttribute("data-testid") ?? ""} ${e.textContent?.trim().slice(0, 40)}`,
      ),
  );
  expect(hits, where).toEqual([]);
  await expect(page.getByText(/Did the .* arrive\?/), where).toHaveCount(0);
}

for (const size of SIZES) {
  test.describe(`no Buy anywhere, ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("the mirror, Discover, the piece, lists, Compare, outfits and Your try-ons", async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["suit", "vest", "coat"]);
      await noBuy(page, "the mirror");

      // Discover: the on-you card says "See it on you" and opens the mirror.
      await page.goto("/");
      const coat = page.locator("article[data-item=coat][data-on-you=true]");
      await expect(coat).toBeVisible();
      await noBuy(page, "Discover");
      const see = coat.getByRole("link", { name: "See it on you" });
      await expect(see).toBeVisible();
      await see.click();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await expect(page).toHaveURL(/\/try-on\//);

      // The piece's own page, on you and not.
      await page.goto("/item/coat");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noBuy(page, "a piece");
      await page.goto("/item/slip");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noBuy(page, "a piece not tried on");

      // A list with a piece in it.
      await page.goto("/item/coat");
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PATCH" && r.url().includes("/api/lists/"),
      );
      await page.locator("[data-testid=heart]:visible").first().click();
      await saved;
      await page.goto("/lists");
      await page.getByTestId("list-card").first().click();
      await expect(page.getByTestId("list-piece").first()).toBeVisible();
      await noBuy(page, "a list");

      // Your try-ons.
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card").first()).toBeVisible();
      await noBuy(page, "Your try-ons");
    });

    test("Compare", async ({ page }) => {
      test.skip(size.name === "phone", "Compare is for wide screens");
      await signedInWithTryOns(page, ["suit", "vest"]);
      await page.goto("/you/try-ons");
      const picks = page.getByTestId("select-tryon");
      await picks.nth(0).click();
      await picks.nth(1).click();
      await page.keyboard.press("c");
      await expect(page).toHaveURL(/\/compare\?ids=/);
      await expect(page.getByTestId("compare-column").first()).toBeVisible();
      await noBuy(page, "Compare");
    });

    test("an outfit", async ({ page }) => {
      await signedInWithTryOns(page, ["coat"]);
      await page.getByTestId("pair-thumb").first().click();
      await page.getByTestId("pair-add").click();
      await expect(page.getByTestId("outfit-screen")).toBeVisible({
        timeout: 40_000,
      });
      await expect(page.getByTestId("buy-outfit")).toHaveCount(0);
      await noBuy(page, "the outfit");
    });
  });
}
