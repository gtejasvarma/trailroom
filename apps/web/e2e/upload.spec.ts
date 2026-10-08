import { readFileSync } from "node:fs";
import { expect, listDocs, PHOTO, TINY, test, uploadFirst } from "./helpers";

test("a tiny image is stopped in the browser with the specific reason, and stays put", async ({
  page,
}) => {
  await page.goto("/item/vest/photo");
  await page.locator("input[type=file]").setInputFiles(TINY);
  await expect(page.getByTestId("photo-error")).toContainText(
    "under 768 pixels on its short side",
  );
  await expect(page).toHaveURL(/\/photo$/);
  await expect(
    page.getByRole("button", { name: "Use this photo" }),
  ).toHaveCount(0);
  // They can choose another straight away.
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(
    page.getByRole("button", { name: "Use this photo" }),
  ).toBeVisible();
  await expect(page.getByTestId("photo-error")).toHaveCount(0);
});

test("a file that is not an image shows the specific reason", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator("input[type=file]").setInputFiles({
    name: "me.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not a picture"),
  });
  await expect(page.getByTestId("photo-error")).toContainText(
    "not an image we can read",
  );
  await expect(page).toHaveURL(/\/upload$/);
});

test("the server repeats the check: a refused upload shows its reason and stores nothing", async ({
  page,
}) => {
  // Let a too-small photo past the browser check by making the server see it first.
  await page.goto("/upload");
  await page.route("**/api/photo", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: "too_small",
        message:
          "That photo is under 768 pixels on its short side, so choose a higher-resolution one.",
      }),
    });
  });
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.getByTestId("photo-error")).toContainText(
    "under 768 pixels",
  );
  await expect(page).toHaveURL(/\/upload$/);
});

test("an upload request without the consent field is refused 403 and stores nothing", async ({
  page,
}) => {
  // Use a real signed-in browser session: take the token from an upload, then post without consent.
  let token = "";
  page.on("request", (r) => {
    const h = r.headers()["authorization"];
    if (h && r.url().includes("/api/")) token = h;
  });
  await uploadFirst(page);
  expect(token).not.toBe("");
  const before = (await listDocs("photos")).length;
  const res = await page.request.post("/api/photo", {
    headers: { authorization: token },
    multipart: {
      photo: {
        name: "a.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync(PHOTO),
      },
    },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toBe("consent_required");
  expect((await listDocs("photos")).length).toBe(before);
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
  await page.goto("/item/vest/photo");
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: big });
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/try-on\//);
});
