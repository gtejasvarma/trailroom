import { card, expect, PHOTO, setScript, test, waitForResult } from "./helpers";

test("happy path: catalogue to four tiles to the guest-ready state, then the result", async ({
  page,
}) => {
  // Slow the renders a little so the queue can be watched.
  setScript([{ outcome: "ok", delayMs: 2500 }]);

  await page.goto("/");
  await expect(page.locator("article[data-testid=item-card]")).toHaveCount(12);
  await card(page, "Knit button vest")
    .getByRole("link", { name: "View Knit button vest" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Knit button vest" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try it on" }).click();

  // Photo (adding one is the consent; the line says so).
  await expect(page).toHaveURL(/\/photo$/);
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(page.getByAltText("The photo you chose")).toBeVisible();
  await page.getByRole("button", { name: "Use this photo" }).click();

  // Queue: four tiles, the garment visible on each skeleton, one honest status line.
  await expect(page).toHaveURL(/\/try-on\//);
  await expect(page.getByTestId("pose-tile")).toHaveCount(4);
  await expect(page.getByTestId("queue-title")).toHaveText(
    "4 poses, coming up",
  );
  await expect(page.getByTestId("status-line")).toContainText(
    "Your photo, the knit button vest, 4 poses.",
  );
  await expect(
    page
      .getByTestId("pose-tile")
      .first()
      .getByAltText(/the piece being rendered/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Keep browsing while it renders" }),
  ).toBeVisible();

  // Signed in with Google from the sheet, the result opens with all four poses at full size.
  await waitForResult(page);
  await expect(page.locator("img[data-render]")).toHaveCount(4);
  for (const img of await page.locator("img[data-render]").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    expect(
      await img.evaluate((e) => (e as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(500);
  }
  await expect(page.getByTestId("ai-caption")).toHaveText(
    "AI-generated preview",
  );
  await expect(
    page.getByText("A preview, not a fitting — it can't tell you size or fit."),
  ).toBeVisible();
  await expect(page.getByTestId("partial-line")).toHaveCount(0);
});
