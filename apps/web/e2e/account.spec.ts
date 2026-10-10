import {
  card,
  confirmWhichPhoto,
  dismissSheet,
  expect,
  test,
  tryOnFromScratch,
  waitForGuestReady,
  waitForResult,
} from "./helpers";

test("guest-ready: tiles only, the sheet is dismissible, and the result stays unreachable", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForGuestReady(page);

  const dialog = page.getByRole("dialog", {
    name: "4 poses are ready — create an account",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Yours to keep. An account is what saves them, and your photo, for next time.",
  );
  await expect(dialog).toContainText(
    "Your photos and try-ons carry over. Then your 4 poses open.",
  );
  await expect(
    dialog.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  // Google only: no email field, no other way in.
  await expect(dialog.getByRole("textbox")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("queue-title")).toHaveText("4 poses, ready");
  await expect(page.getByTestId("status-line")).toHaveText(
    "The knit button vest on your photo, 4 poses. Create an account to open them.",
  );
  await expect(page.getByTestId("pose-gallery")).toHaveCount(0);
  await expect(page.locator("img[data-hero]")).toHaveCount(0);

  // The call to action reopens the sheet; the close button dismisses it; a backdrop click too.
  await page.getByRole("button", { name: "See your 4 poses" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "See your 4 poses" }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();

  // The tiles are all there is on the page: four tile-size previews, no hero.
  await expect(page.locator("img[data-render]")).toHaveCount(4);
});

test("the sheet traps keyboard focus", async ({ page }) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForGuestReady(page);
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
  await waitForGuestReady(page);
  await dismissSheet(page);

  await page.goto("/");
  await card(page, "Wool car coat")
    .getByRole("button", { name: "Try it on" })
    .click();
  await confirmWhichPhoto(page);
  await expect(page).toHaveURL(/\/item\/coat\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Guests get one try-on" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("You: delete everything, visibly, then the next upload starts clean", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);

  await page.goto("/you");
  await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
  await page.getByRole("button", { name: "Delete everything" }).click();
  const deleted = page.getByTestId("deleted");
  await expect(deleted).toBeVisible();
  await expect(deleted).toContainText(
    "Your photos, try-ons, lists and asks are gone.",
  );
  await expect(
    page.getByRole("button", { name: "Delete everything" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/you$/); // same screen, no modal

  await page.goto("/");
  await card(page, "Knit button vest")
    .getByRole("button", { name: "Try it on" })
    .click();
  await expect(page).toHaveURL(/\/photo$/);
});
