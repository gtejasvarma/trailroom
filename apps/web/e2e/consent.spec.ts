import { acceptConsent, card, expect, test } from "./helpers";

// Hard rule: no code path opens a picker before consent is accepted. A MutationObserver installed
// before any page script records whether an input[type=file] was EVER in the DOM, so a flash that
// is gone by the time we look still fails the test.
const WATCH = () => {
  (window as unknown as { __fileInputSeen: boolean }).__fileInputSeen = false;
  const check = () => {
    if (document.querySelector("input[type=file]")) {
      (window as unknown as { __fileInputSeen: boolean }).__fileInputSeen =
        true;
    }
  };
  new MutationObserver(check).observe(document, {
    childList: true,
    subtree: true,
  });
};
const seen = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as { __fileInputSeen: boolean }).__fileInputSeen,
  );

test("no file input exists before consent, on any screen", async ({ page }) => {
  await page.addInitScript(WATCH);

  await page.goto("/");
  await expect(page.getByTestId("item-card")).toHaveCount(5);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  await card(page, "Cropped denim jacket")
    .getByRole("link", { name: "View Cropped denim jacket" })
    .click();
  await expect(page).toHaveURL(/\/item\/g-denim-jacket$/);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  await page.getByRole("button", { name: "Try it on" }).click();
  await expect(page).toHaveURL(/\/consent$/);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  // Straight to the photo route: it must send us to consent without ever rendering the input.
  await page.goto("/item/g-denim-jacket/photo");
  await expect(page).toHaveURL(/\/item\/g-denim-jacket\/consent$/);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  // Declining returns to the product page, still with no file input.
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page).toHaveURL(/\/item\/g-denim-jacket$/);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  expect(await seen(page)).toBe(false);
});

test("the input appears only after consent is recorded", async ({ page }) => {
  await page.goto("/item/g-denim-jacket/consent");
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await acceptConsent(page);
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  // No camera trigger either.
  await expect(page.locator("input[capture]")).toHaveCount(0);
});

test("consent states the mechanism in plain sentences", async ({ page }) => {
  await page.goto("/item/g-denim-jacket/consent");
  const main = page.getByRole("main");
  await expect(main).toContainText("We store one photo of you");
  await expect(main).toContainText("deleted after about 48 hours");
  await expect(main).toContainText("Delete my photo");
  await expect(main).toContainText("never train on your photos");
  await expect(main).toContainText("Gemini API");
  await expect(main).toContainText("we ask Google not to retain it");
  await expect(main).not.toContainText("does not store");
  await expect(main).toContainText("AI-generated previews");
  await expect(page.getByLabel("I am 18 or older")).not.toBeChecked();
  await expect(page.getByLabel(/I agree to my photo/)).not.toBeChecked();
});
