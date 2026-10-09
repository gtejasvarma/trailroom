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

  // Buy and Add to a list say plainly that they arrive soon.
  await page.getByRole("button", { name: "Add to a list" }).click();
  await expect(page.getByTestId("toast")).toHaveText("Lists arrive soon.");
  await page.getByRole("button", { name: /^Buy \$/ }).click();
  await expect(page.getByTestId("toast")).toHaveText("Buying arrives soon.");
  await page.getByRole("button", { name: "Build the outfit" }).click();
  await expect(page.getByTestId("toast")).toHaveText("Outfits arrive soon.");
});
