// Phase G with both switches off (the default): a followed label's new piece arrives as the
// label's own photo with the ordinary "Try it on", nothing is "on you", and nothing about email
// appears anywhere. At 390x844 and 1440x900; PNGs go to runs/phase-g/ (git-ignored).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test, uploadFirst } from "./helpers";
import { SIZES, noHScroll, serious, settle } from "./e-helpers";
import { publishViaScript } from "./g-helpers";

test.describe.configure({ timeout: 180_000 });

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-g",
);
mkdirSync(RUNS_DIR, { recursive: true });
async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: join(RUNS_DIR, `${name}.png`) });
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("a new piece from a followed label arrives as the label's photo, with no email anywhere", async ({
      page,
    }) => {
      await uploadFirst(page); // an account; the first three labels are followed
      const piece = publishViaScript();
      await page.goto("/");

      const shelf = page.getByTestId("arrivals");
      await expect(shelf).toBeVisible();
      await expect(shelf).toHaveAttribute("data-mode", "label");
      await expect(
        shelf.getByRole("heading", { name: "New from labels you follow" }),
      ).toBeVisible();
      const tile = shelf.locator(`[data-item="${piece.id}"]`);
      await expect(tile).toBeVisible();
      await expect(tile.getByTestId("arrival-chip")).toHaveText("New in");
      // With the buffer off the card never claims to be on the person.
      await expect(tile).not.toHaveAttribute("data-on-you", "true");
      await expect(shelf.getByText(/on you/i)).toHaveCount(0);
      await expect(
        tile.getByRole("button", { name: "Try it on" }),
      ).toBeVisible();
      // The piece is also an ordinary card in the feed.
      await expect(
        page.locator(`article[data-testid=item-card][data-item="${piece.id}"]`),
      ).toBeVisible();

      await expect(page.locator("body")).not.toContainText(/e-?mail/i);
      await noHScroll(page);
      expect(await serious(page)).toEqual([]);
      await shot(page, `new-arrival-label-${size.name}`);

      // The piece opens like any other, and You has no email controls.
      await tile.getByRole("link").first().click();
      await expect(page).toHaveURL(new RegExp(`/item/${piece.id}$`));
      await expect(
        page.getByRole("button", { name: "Try it on" }),
      ).toBeVisible();
      await page.goto("/you");
      await expect(page.getByTestId("following")).toBeVisible();
      await expect(page.getByTestId("email-prefs")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(/e-?mail/i);
      await shot(page, `you-no-email-${size.name}`);
    });

    test("a visitor who follows nothing sees no shelf", async ({ page }) => {
      publishViaScript();
      await page.goto("/");
      await expect(page.getByTestId("feed")).toBeVisible();
      await expect(page.getByTestId("arrivals")).toHaveCount(0);
    });
  });
}

test.describe("the unsubscribe page", () => {
  test("opens without the password, works on any token alike, and is not indexed", async ({
    browser,
  }) => {
    const context = await browser.newContext(); // no gate cookie
    const page = await context.newPage();
    const token = "A".repeat(43);
    const res = await page.goto(`/unsubscribe/${token}`);
    expect(res!.status()).toBe(200);
    expect(res!.headers()["x-robots-tag"]).toContain("noindex");
    expect(res!.headers()["cache-control"]).toContain("no-store");
    expect(res!.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      page.getByRole("heading", { name: "Stop these emails?" }),
    ).toBeVisible();
    await page.getByTestId("unsubscribe-button").click();
    await expect(page.getByTestId("unsubscribe-done")).toHaveText(
      "If that link was one of ours, those emails have stopped.",
    );
    // The rest of the app is still behind the password.
    await page.goto("/lists");
    await expect(page).toHaveURL(/\/gate$/);
    await context.close();
  });
});
