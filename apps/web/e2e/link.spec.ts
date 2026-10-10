import {
  continueWithGoogle,
  expect,
  newEmail,
  test,
  tryOnFromScratch,
  waitForGuestReady,
} from "./helpers";

// Uses the Auth emulator's fake Google popup. Links the anonymous user in place, so the same
// renders carry over and open without a re-render.
test("Continue with Google links the guest and opens the result in place, no re-render", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForGuestReady(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const tryOnCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/try-on") tryOnCalls.push(r.url());
  });
  const jobUrl = page.url();

  await continueWithGoogle(page, { email: newEmail() });
  await expect(page.getByTestId("pose-gallery")).toBeVisible({
    timeout: 20_000,
  });
  expect(tryOnCalls).toEqual([]);
  expect(page.url()).toBe(jobUrl);
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("toast")).toContainText("Signed in");

  // Add to a list opens the list sheet, Buy opens the buy sheet, and Build the outfit offers the
  // pieces that make an outfit (the vest goes with the coat) and opens the pair preview.
  await page.getByRole("button", { name: "Add to a list" }).click();
  await expect(
    page.getByRole("dialog", { name: "Save to a list" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Save to a list" }),
  ).toBeHidden();
  await page.getByRole("button", { name: /^Buy \$/ }).click();
  const buy = page.getByRole("dialog", { name: /^Knit button vest, \$\d+$/ });
  await expect(buy).toBeVisible();
  await buy.getByRole("button", { name: "Keep looking" }).click();
  await expect(buy).toBeHidden();
  await expect(page.getByTestId("outfit-row")).toBeVisible();
  await page
    .getByRole("button", { name: "See the wool car coat with this piece" })
    .click();
  const pair = page.getByRole("dialog", {
    name: "Worn with your knit button vest",
  });
  await expect(pair).toBeVisible();
  await pair.getByRole("button", { name: "Not this one" }).click();
  await expect(pair).toBeHidden();
});
