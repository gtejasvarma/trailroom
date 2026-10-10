// Signing in after a guest try-on finished, on phone and desktop: with a new Google account (the
// guest becomes it), with one that already existed (the guest's things move into it), and when
// the move fails.
import type { Browser, Page } from "@playwright/test";
import {
  continueWithGoogle,
  expect,
  listDocs,
  passGate,
  test,
  tryOnFromScratch,
  uploadFirstAsGuest,
  waitForGuestReady,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** A Google account that already exists in the project: made through the popup in another browser. */
async function existingAccount(browser: Browser): Promise<string> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await passGate(p);
  await uploadFirstAsGuest(p);
  const email = await continueWithGoogle(p);
  await expect(p).toHaveURL(/\/upload\/labels$/);
  await ctx.close();
  return email;
}

function watchRenders(page: Page) {
  const seen = { tryOnPosts: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/try-on")
      seen.tryOnPosts++;
  });
  return seen;
}

async function expectFourFullPoses(page: Page) {
  await expect(page.getByTestId("pose-gallery")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("img[data-render]")).toHaveCount(4, {
    timeout: 20_000,
  });
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("img[data-render]")].map(
      (i) => Math.max(i.naturalWidth, i.naturalHeight),
    ),
  );
  for (const s of sizes) expect(s).toBeGreaterThan(320);
}

for (const size of SIZES) {
  test.describe(`${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("existing Google account: the guest's try-on moves in and opens, no re-render", async ({
      page,
      browser,
    }) => {
      const email = await existingAccount(browser);
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      const jobUrl = page.url();
      const jobsBefore = (await listDocs("jobs")).length;
      const renders = watchRenders(page);

      await continueWithGoogle(page, { email, existing: true });
      await expectFourFullPoses(page);
      await expect(page.getByTestId("toast")).toContainText(
        "Signed in. Your try-ons are saved.",
      );
      expect(page.url()).toBe(jobUrl);
      expect(renders.tryOnPosts).toBe(0);
      expect((await listDocs("jobs")).length).toBe(jobsBefore);

      await page.reload();
      await expectFourFullPoses(page);

      await page.goto("/");
      const onYou = page.locator("article[data-item=vest][data-on-you=true]");
      await expect(onYou).toBeVisible();
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await page.getByTestId("tryon-card").getByRole("link").click();
      await expectFourFullPoses(page);
    });

    test("new Google account: from See your poses, dismissed and reopened, and across a reload", async ({
      page,
    }) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // A reload with the sheet closed: the page is still the guest-ready queue.
      await page.reload();
      await waitForGuestReady(page);
      const renders = watchRenders(page);
      await page.getByRole("button", { name: "See your 4 poses" }).click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: "See your 4 poses" }).click();

      await continueWithGoogle(page);
      await expectFourFullPoses(page);
      await expect(page.getByTestId("toast")).toContainText("Signed in");
      expect(renders.tryOnPosts).toBe(0);
    });

    test("existing account, but the move fails: signed in, one plain sentence, nothing deleted", async ({
      page,
      browser,
    }) => {
      const email = await existingAccount(browser);
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await page.route("**/api/account/merge", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "internal", message: "x" }),
        }),
      );
      const photosBefore = (await listDocs("poseSets")).length;
      await continueWithGoogle(page, { email, existing: true });
      await expect(page.getByTestId("toast")).toContainText(
        "You are signed in, but we could not move your try-on across, so try it on again.",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect((await listDocs("poseSets")).length).toBe(photosBefore);
      await page.goto("/you");
      await expect(
        page.getByRole("button", { name: "Sign out" }).first(),
      ).toBeVisible();
    });
  });
}
