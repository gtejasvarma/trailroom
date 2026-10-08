import {
  card,
  dismissSheet,
  expect,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";

test("account sheet: dismissible, renders stay full size, actions locked", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);

  const dialog = page.getByRole("dialog", { name: "Four poses are ready" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Create an account. They're yours to keep.",
  );
  await expect(
    dialog.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();

  const hero = page.locator("img[data-hero]");
  await expect(hero).toBeVisible();
  // Layout size, not the bounding box: the hero's reveal animation scales it for 400 ms.
  const size = () =>
    hero.evaluate((el) => [
      (el as HTMLImageElement).offsetWidth,
      (el as HTMLImageElement).offsetHeight,
    ]);
  const before = await size();

  // Escape dismisses.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(hero).toBeVisible();
  expect(await size()).toEqual(before);
  expect(before[0]).toBeGreaterThan(200);

  // Save is locked for a guest: it re-opens the sheet. The close button dismisses it.
  await page.getByRole("button", { name: "Save this render" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  // So is Add to a list. A click on the backdrop dismisses it too.
  await page.getByRole("button", { name: "Add to a list" }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  expect(await size()).toEqual(before);

  // The result's actions, in order: Add another, Add to a list, Save.
  const bar = page.locator("div.sticky");
  const names = await bar
    .locator("a, button")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()),
    );
  expect(names).toEqual(["Add another", "Add to a list", "Save this render"]);
  // No Buy link in this build.
  await expect(page.getByText(/\bbuy\b/i)).toHaveCount(0);
  await expect(page.getByTestId("internal-note")).toContainText(
    "Internal build note",
  );
});

test("the sheet traps keyboard focus", async ({ page }) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    );
    expect(inside).toBe(true);
  }
});

test("a guest's second item goes to the sign-up screen", async ({ page }) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  await dismissSheet(page);

  await page.goto("/");
  await card(page, "Wool car coat")
    .getByRole("button", { name: "Try it on" })
    .click();
  await expect(page).toHaveURL(/\/item\/coat\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Guests get one try-on" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("You: delete my photo, visibly, then consent is asked again", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  await dismissSheet(page);

  await page.getByRole("link", { name: "Your try-ons" }).click();
  await expect(page).toHaveURL(/\/you$/);
  await expect(page.getByTestId("photo-state")).toHaveText(
    "A photo of you is stored.",
  );
  await page.getByRole("button", { name: "Delete my photo" }).click();
  const deleted = page.getByTestId("deleted");
  await expect(deleted).toBeVisible();
  await expect(deleted).toContainText(
    "Your photo and every render made from it are gone.",
  );
  await expect(
    page.getByRole("button", { name: "Delete my photo" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/you$/); // same screen, no modal

  await page.goto("/");
  await card(page, "Knit button vest")
    .getByRole("button", { name: "Try it on" })
    .click();
  await expect(page).toHaveURL(/\/consent$/);
});
