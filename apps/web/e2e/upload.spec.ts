import { readFileSync } from "node:fs";
import { acceptConsent, expect, PHOTO, TINY, test } from "./helpers";

test("a tiny image shows the API's too_small message and stays put", async ({
  page,
}) => {
  await page.goto("/item/g-shell-jacket/consent");
  await acceptConsent(page);
  await page.locator("input[type=file]").setInputFiles(TINY);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "under 768 pixels on its short side",
  );
  await expect(page).toHaveURL(/\/photo$/);
  // They can choose another straight away.
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(
    page.getByRole("button", { name: "Use this photo" }),
  ).toBeVisible();
});

test("with a photo on file, the current one can be reused", async ({
  page,
}) => {
  await page.goto("/item/g-shell-jacket/consent");
  await acceptConsent(page);
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/try-on\//);

  await page.goto("/item/g-elbow-sweater/photo");
  await expect(
    page.getByRole("button", { name: "Use my current photo" }),
  ).toBeVisible();
  await expect(page.getByText("Choose a different photo")).toBeVisible();
});

test("a photo just under the 10 MiB limit goes through the real server intact", async ({
  page,
}) => {
  // Valid JPEG plus trailing bytes (decoders stop at the end marker) up to just under the limit.
  // With middleware present Next truncates bodies past its own buffer limit, so this would
  // arrive cut short (and be rejected) if proxyClientMaxBodySize were left at the default.
  const jpeg = readFileSync(PHOTO);
  const size = 10 * 1024 * 1024 - 2000;
  const big = Buffer.concat([jpeg, Buffer.alloc(size - jpeg.length, 0)]);
  await page.goto("/item/g-shell-jacket/consent");
  await acceptConsent(page);
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: big });
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/try-on\//);
});
