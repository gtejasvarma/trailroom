import { card, expect, PHOTO, setScript, test, waitForResult } from "./helpers";

test("happy path: catalogue to four tiles to result", async ({ page }) => {
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
  await expect(page.getByTestId("status-line")).toHaveText(
    /^Rendering four poses\. [0-3] of 4 ready\.$/,
  );
  await expect(
    page
      .getByTestId("pose-tile")
      .first()
      .getByAltText(/the piece being rendered/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Keep browsing" })).toBeVisible();

  // Every tile fills in (the result may take over the same route as they do).
  await waitForResult(page);
  await expect(page.locator("img[data-render]")).toHaveCount(5); // hero + four thumbnails
  for (const img of await page.locator("img[data-render]").all()) {
    await expect(img).toBeVisible();
    expect(
      await img.evaluate((e) => (e as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(100);
  }
  await expect(
    page.getByTestId("hero").getByText("AI-generated preview"),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("hero")
      .getByText("A preview, not a fitting — it can't tell you size or fit."),
  ).toBeVisible();
  await expect(page.getByTestId("partial-line")).toHaveCount(0);
});
