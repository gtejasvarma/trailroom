// Phase E: Buy, the demo hand-off page, and "Did it arrive?". At 390x844 and 1440x900. Review PNGs
// go to runs/phase-e/.
import type { Page } from "@playwright/test";
import {
  continueWithGoogle,
  dismissSheet,
  expect,
  listDocs,
  test,
  tryOnFromScratch,
  waitForGuestReady,
} from "./helpers";
import { SIZES, serious, shot, signedInWithTryOns } from "./e-helpers";

test.describe.configure({ timeout: 180_000 });

const buySheet = (page: Page) =>
  page.getByRole("dialog", { name: /^Knit button vest, \$\d+$/ });
const arrivedSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Did the knit button vest arrive?" });

interface Purchase {
  name: string;
  fields: { arrived: { nullValue?: null; booleanValue?: boolean } };
}
const purchases = async () => (await listDocs("purchases")) as Purchase[];

/** A guest with a finished try-on presses Buy on the product page, signs in, and gets the buy sheet. */
async function guestBuysVest(page: Page) {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForGuestReady(page);
  await dismissSheet(page);
  await page.goto("/item/vest");
  await expect(page.getByTestId("buy")).toBeVisible();
  await page.getByTestId("buy").click();
  await expect(
    page.getByRole("dialog", { name: "Create an account to buy" }),
  ).toBeVisible();
  await continueWithGoogle(page);
  await expect(buySheet(page)).toBeVisible();
}

/** Presses "Go to ..." and returns the demo page that opened in a new tab. */
async function goToLabel(page: Page) {
  const [popup] = await Promise.all([
    page.context().waitForEvent("page"),
    buySheet(page).getByTestId("go-to-label").click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  return popup;
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("Buy as a guest: account sheet, buy sheet, demo page, then asked once whether it arrived", async ({
      page,
    }) => {
      await guestBuysVest(page);
      // The buy sheet: the piece, label, price, the stock line, and the confirm action.
      const sheet = buySheet(page);
      await expect(sheet).toContainText("Checking out with");
      await expect(sheet.getByTestId("go-to-label")).toHaveText(
        /^Go to [A-Z &]+$/,
      );
      await expect(sheet).toContainText(
        "Your try-on stays here, and we ask once whether it arrived.",
      );
      await expect(
        sheet.getByRole("button", { name: "Keep looking" }),
      ).toBeVisible();
      await expect(
        page.getByTestId("toast").filter({ hasText: /soon/i }),
      ).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0)); // the page behind the sheet, same every time
      await shot(page, `buy-sheet-${size.name}`);
      await expect(page).toHaveScreenshot(`buy-sheet-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
      });
      expect(await serious(page)).toEqual([]);

      // Confirming opens the demo hand-off page in a new tab, and records the intent once.
      const popup = await goToLabel(page);
      await expect(popup).toHaveURL(/\/demo-checkout\/vest$/);
      await expect(
        popup.getByRole("heading", {
          name: "This is a demo, so there is nothing to buy",
        }),
      ).toBeVisible();
      await expect(popup.getByTestId("demo-body")).toContainText(
        "invented labels",
      );
      await expect(popup.getByText(/own site opens/)).toBeVisible();
      await shot(popup, `demo-checkout-${size.name}`);
      expect(await serious(popup)).toEqual([]);
      await expect.poll(async () => (await purchases()).length).toBe(1);
      expect((await purchases())[0]!.name).toMatch(/_vest$/);
      expect((await purchases())[0]!.fields.arrived.nullValue).toBeNull();
      await popup.close();

      // Back on the piece's result, the question comes once.
      await page.goto("/item/vest");
      await page.getByTestId("see-poses").click();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      const ask = arrivedSheet(page);
      await expect(ask).toBeVisible();
      await expect(
        ask.getByRole("button", { name: "Yes, it’s mine" }),
      ).toBeVisible();
      await expect(
        ask.getByRole("button", { name: "Didn’t buy it" }),
      ).toBeVisible();
      await shot(page, `arrived-sheet-${size.name}`);
      await expect(page).toHaveScreenshot(`arrived-sheet-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
      });
      expect(await serious(page)).toEqual([]);
      await ask.getByRole("button", { name: "Yes, it’s mine" }).click();
      await expect(ask).toBeHidden();
      // The vest goes with the coat, so the toast offers to show what goes with it.
      const toast = page.getByTestId("toast");
      await expect(toast).toContainText("Marked as yours.");
      await toast.getByRole("link", { name: "See what goes with it" }).click();
      await expect(page).toHaveURL(/\/try-on\/[^/]+\?pair=1$/);
      await expect(page.getByTestId("pair-thumb")).toBeFocused();
      await expect
        .poll(async () => (await purchases())[0]!.fields.arrived.booleanValue)
        .toBe(true);

      // Never again for that piece: not on a reload, not on the next visit to the result.
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await page.waitForTimeout(2_000);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Pressing Buy again leaves the answer alone.
      await page.getByTestId("buy").click();
      await expect(buySheet(page)).toBeVisible();
      await buySheet(page)
        .getByRole("button", { name: "Keep looking" })
        .click();
      expect((await purchases())[0]!.fields.arrived.booleanValue).toBe(true);
    });

    test('returning to the tab asks, and "Didn’t buy it" is stored and not asked again', async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["vest"]);
      // Buy from the result.
      await page.getByTestId("buy").click();
      await expect(buySheet(page)).toBeVisible();
      const popup = await goToLabel(page);
      await popup.close();
      // Coming back to this tab: the question follows after a short pause.
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(arrivedSheet(page)).toBeVisible({ timeout: 10_000 });
      await arrivedSheet(page)
        .getByRole("button", { name: "Didn’t buy it" })
        .click();
      await expect(arrivedSheet(page)).toBeHidden();
      await expect
        .poll(async () => (await purchases())[0]!.fields.arrived.booleanValue)
        .toBe(false);
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await page.waitForTimeout(2_000);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("Buy from a list page opens the buy sheet", async ({ page }) => {
      await signedInWithTryOns(page, ["vest"]);
      await page.getByRole("button", { name: "Add to a list" }).click();
      const sheet = page.getByRole("dialog", { name: "Save to a list" });
      await sheet.getByTestId("new-list-name").fill("Weekend");
      await sheet.getByRole("button", { name: "Create list and add" }).click();
      await expect(page.getByTestId("toast")).toContainText("Created Weekend");
      await sheet.getByRole("button", { name: "Done" }).click();
      await page.goto("/lists");
      await page.getByRole("link", { name: /Open Weekend/ }).click();
      await expect(page).toHaveURL(/\/lists\/[^/]+$/);
      await page.getByTestId("list-buy").click();
      await expect(buySheet(page)).toBeVisible();
      await expect(
        page.getByTestId("toast").filter({ hasText: /soon/i }),
      ).toHaveCount(0);
    });
  });
}
