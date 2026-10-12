// An account is required to start any render. A guest may browse, favourite and upload a photo;
// pressing Try it on after the upload raises the account sheet (the "tryon" reason), and signing in
// starts the try-on by itself, with the photo they just uploaded, and lands on its queue.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "@playwright/test";
import {
  card,
  confirmWhichPhoto,
  continueWithGoogle,
  expect,
  listDocs,
  setScript,
  newEmail,
  passGate,
  PHOTO,
  test,
  tryOnFromScratch,
  uploadFirstAsGuest,
  waitForResult,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/signup-first",
);
mkdirSync(RUNS_DIR, { recursive: true });

const SHEET = "Create an account to try it on";

/** Counts the POSTs that start a render, and records the id of every photo the page uploads. */
function watch(page: Page) {
  const seen = { starts: 0, photoIds: [] as string[] };
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/try-on")
      seen.starts++;
  });
  page.on("response", async (r) => {
    if (
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/photo"
    ) {
      const body = (await r.json().catch(() => null)) as {
        photoId?: string;
      } | null;
      if (body?.photoId) seen.photoIds.push(body.photoId);
    }
  });
  return seen;
}

const jobPhotoIds = async () =>
  (await listDocs("jobs")).map(
    (d) =>
      (d as { fields: { photoId: { stringValue: string } } }).fields.photoId
        .stringValue,
  );

/** A Google account that already exists in the project: made through the popup in another browser. */
async function existingAccount(browser: Browser): Promise<string> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await passGate(p);
  await uploadFirstAsGuest(p);
  const email = await continueWithGoogle(p);
  await expect(p).toHaveURL(/\/upload\/done$/);
  await ctx.close();
  return email;
}

/** Discover: Try it on on the card, upload the photo; ends with the account sheet up. */
async function pressTryItOn(page: Page, name = "Knit button vest") {
  await card(page, name).getByRole("button", { name: "Try it on" }).click();
  await expect(page).toHaveURL(/\/photo$/);
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.getByRole("dialog", { name: SHEET })).toBeVisible();
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("new Google account: upload, the sheet, sign in, and the try-on starts by itself", async ({
      page,
    }) => {
      const seen = watch(page);
      // Slow the fake renderer a little, so the queue is on screen long enough to be seen. With
      // instant renders the job can finish before the page paints and the result shows at once.
      setScript([{ outcome: "ok", delayMs: 1500 }]);
      await page.goto("/");
      await pressTryItOn(page);

      // The reason is written for this moment: an account makes the try-on, nothing about cost.
      const dialog = page.getByRole("dialog", { name: SHEET });
      await expect(dialog).toContainText(
        "An account is what makes your try-on. You get 4 poses on your photo, kept for you until you remove them.",
      );
      await expect(dialog).toContainText("Then your try-on starts.");
      await expect(dialog.getByText(/\$|cost|free|credit|pay/i)).toHaveCount(0);
      await expect(dialog.getByRole("textbox")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600); // the sheet's rise
      await page.screenshot({
        path: join(RUNS_DIR, `sheet-${size.name}.png`),
      });

      // Nothing has been created, counted or started for the guest.
      expect(seen.starts).toBe(0);
      expect(await listDocs("jobs")).toHaveLength(0);
      expect(await listDocs("poseSets")).toHaveLength(0);
      // The spend log is not checked here: a render still settling from the test before this
      // one can write a line after the emulators were reset. With no job there is nothing of
      // this guest's to spend on, and tryon.emu.test.ts proves no spend line is written.

      await continueWithGoogle(page, { email: newEmail() });
      // Straight to the queue for that piece: no second press.
      await expect(page).toHaveURL(/\/try-on\//);
      await expect(page.getByTestId("queue-title")).toContainText(/poses?, /);
      await waitForResult(page);
      expect(seen.starts).toBe(1);
      expect(await jobPhotoIds()).toEqual(seen.photoIds);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
    });

    test("existing Google account: the photo just uploaded carries over and is the one used", async ({
      page,
      browser,
    }) => {
      const email = await existingAccount(browser);
      const seen = watch(page);
      await page.goto("/");
      await pressTryItOn(page, "Wool car coat");
      expect(await listDocs("jobs")).toHaveLength(0);

      await continueWithGoogle(page, { email, existing: true });
      await expect(page).toHaveURL(/\/try-on\//, { timeout: 30_000 });
      await waitForResult(page);
      expect(seen.starts).toBe(1);
      // The account already held a photo (its default); the one just uploaded was used instead.
      expect(seen.photoIds).toHaveLength(1);
      expect(await jobPhotoIds()).toEqual(seen.photoIds);
      await page.goto("/you");
      await expect(page.getByTestId("photo-count")).toHaveText("2 photos");
    });

    test("not now: nothing is rendered, the photo is kept, and Try it on brings the sheet back", async ({
      page,
    }) => {
      const seen = watch(page);
      await page.goto("/");
      await pressTryItOn(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      // They stay with the piece they asked for.
      await expect(page).toHaveURL(/\/item\/vest$/);
      expect(seen.starts).toBe(0);
      expect(await listDocs("jobs")).toHaveLength(0);
      expect(await listDocs("poseSets")).toHaveLength(0);

      // The photo is kept: Try it on now asks which photo, and confirming raises the sheet again.
      await expect(async () => {
        await page.getByRole("button", { name: "Try it on" }).click();
        await expect(
          page.getByRole("dialog", { name: "Which photo?" }),
        ).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await confirmWhichPhoto(page, { signedIn: false });
      await expect(page.getByRole("dialog", { name: SHEET })).toBeVisible();
      // The sheet shows the photo that was kept, not an empty box.
      await expect(
        page.getByRole("dialog", { name: SHEET }).locator("img"),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: SHEET })
        .getByRole("button", { name: "Not now" })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(seen.starts).toBe(0);
      expect(await listDocs("jobs")).toHaveLength(0);
      await page.goto("/you");
      await expect(page.getByTestId("photo-count")).toHaveText("1 photo");

      // And signing in from the sheet then starts it with that photo.
      await page.goto("/item/vest");
      await expect(async () => {
        await page.getByRole("button", { name: "Try it on" }).click();
        await expect(
          page.getByRole("dialog", { name: "Which photo?" }),
        ).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await confirmWhichPhoto(page, { signedIn: false });
      await continueWithGoogle(page);
      await expect(page).toHaveURL(/\/try-on\//, { timeout: 30_000 });
      await waitForResult(page);
    });

    test("the starters screen as a guest with a photo: a tap raises the sheet, sign-in starts it", async ({
      page,
    }) => {
      await uploadFirstAsGuest(page);
      await page.keyboard.press("Escape"); // not now: Discover, photo kept
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/upload/done");
      await page.getByTestId("starter-try").first().click();
      await expect(page.getByRole("dialog", { name: SHEET })).toBeVisible();
      expect(await listDocs("jobs")).toHaveLength(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page).toHaveURL(/\/upload\/done$/);
      await expect(page.getByTestId("starter-try").first()).toBeEnabled();

      await page.getByTestId("starter-try").first().click();
      await continueWithGoogle(page);
      await expect(page).toHaveURL(/\/try-on\//, { timeout: 30_000 });
      await waitForResult(page);
    });

    test("signed in, Try it on goes straight to the queue: no sheet", async ({
      page,
    }) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page);
      await page.goto("/");
      await card(page, "Wool car coat")
        .getByRole("button", { name: "Try it on" })
        .click();
      await confirmWhichPhoto(page);
      await expect(page.getByRole("dialog", { name: SHEET })).toHaveCount(0);
      await expect(page).toHaveURL(/\/try-on\//);
    });
  });
}
