import { expect, test, tryOnFromScratch, waitForResult } from "./helpers";

// Uses the Auth emulator's fake Google popup. Links the anonymous user in place, so the same
// renders stay on screen and Save / Add to a list unlock without a re-render.
test("Continue with Google links the guest and unlocks actions in place", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const tryOnCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/try-on") tryOnCalls.push(r.url());
  });
  const hero = page.locator("img[data-hero]");
  const heroSrc = await hero.getAttribute("src");

  const popupPromise = page.waitForEvent("popup");
  await dialog.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("load");
  await popup.getByText("Add new account").click();
  await expect(popup.locator("#email-input")).toBeVisible();
  await popup.locator("#email-input").fill("e2e-linked@example.com");
  await popup.locator("#sign-in").click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  // Unlocked in place: no re-render was started, and the same image is still showing.
  expect(tryOnCalls).toEqual([]);
  await expect(hero).toBeVisible();
  expect(await hero.getAttribute("src")).toBe(heroSrc);

  // Add to a list shows the honest note instead of the sheet.
  await page.getByRole("button", { name: "Add to a list" }).click();
  await expect(page.getByText("Lists arrive in a later build.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Save downloads the selected render.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save this render" }).click();
  expect((await download).suggestedFilename()).toMatch(/^trailroom-.*\.jpg$/);
});
