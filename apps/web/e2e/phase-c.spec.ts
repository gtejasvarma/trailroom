// Phase C: the walk-away queue, account to open, the result, on-you cards, try-ons, and the
// honest failures, at 390x844 and 1440x900. Review PNGs go to runs/phase-c/ (git-ignored).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  card,
  continueWithGoogle,
  dismissSheet,
  exhaustBudget,
  expect,
  listDocs,
  pickThreeLabels,
  setScript,
  test,
  tryOnFromScratch,
  uploadFirstAsGuest,
  waitForGuestReady,
  waitForResult,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-c",
);
mkdirSync(RUNS_DIR, { recursive: true });
const HIDE_DEV_BADGE = "nextjs-portal { display: none !important; }";

/** Fonts, animations and visible images settled; the dev badge hidden. */
async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForFunction(() =>
    [...document.images].every((i) => {
      const r = i.getBoundingClientRect();
      const onScreen = r.width > 0 && r.height > 0 && r.top < innerHeight;
      return !onScreen || (i.complete && i.naturalWidth > 0);
    }),
  );
}

async function shot(page: Page, name: string, size: string, full = false) {
  await settle(page);
  await page.screenshot({
    path: join(RUNS_DIR, `${name}-${size}.png`),
    fullPage: full,
  });
}

/** The pose-set id, read from the first render request the page makes. */
function watchPoseSet(page: Page) {
  const seen = { poseSetId: "", token: "" };
  page.on("request", (r) => {
    const m = /\/api\/renders\/([^/]+)\/[^/?]+/.exec(r.url());
    if (m) seen.poseSetId = m[1]!;
    const h = r.headers()["authorization"];
    if (h && r.url().includes("/api/")) seen.token = h;
  });
  return seen;
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("the queue and the chip: tiles fill, keep browsing, the chip follows on every screen", async ({
      page,
    }) => {
      // Front is ready at once; the other three take long enough to browse around.
      setScript([
        { pose: "front", outcome: "ok" },
        { outcome: "ok", delayMs: 120_000 },
      ]);
      await tryOnFromScratch(page, "Knit button vest");

      // The queue: tiles fill as poses pass, and the line is a true count.
      await expect(page.getByTestId("queue-title")).toHaveText(
        "4 poses, coming up",
      );
      await expect(
        page.locator("[data-testid=pose-tile][data-pose=front]"),
      ).toHaveAttribute("data-state", "passed");
      await expect(page.getByTestId("status-line")).toContainText(
        "1 of 4 ready",
      );
      await expect(page.getByTestId("job-chip")).toHaveCount(0); // not on its own screen
      await shot(page, "queue-mid-render", size.name);
      await expect(page).toHaveScreenshot(`queue-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });

      // Keep browsing: the chip is on Discover and on a product page, and opens the queue.
      await page
        .getByRole("link", { name: "Keep browsing while it renders" })
        .click();
      await expect(page).toHaveURL(/\/$/);
      const chip = page.getByTestId("job-chip");
      await expect(chip).toBeVisible();
      await expect(chip).toContainText("Putting the knit button vest on you");
      await expect(page.getByTestId("job-chip-sub")).toHaveText(
        "1 of 4 poses ready · you can keep browsing",
      );
      await shot(page, "chip-on-discover", size.name);
      await card(page, "Wool car coat")
        .getByRole("link", { name: "View Wool car coat" })
        .click();
      await expect(page).toHaveURL(/\/item\/coat$/);
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(page).toHaveURL(/\/try-on\//);
      await expect(page.getByTestId("queue-title")).toHaveText(
        "4 poses, coming up",
      );

      // A reload on a product page: the running job is found from the server.
      await page.goto("/item/coat");
      await expect(page.getByTestId("job-chip")).toBeVisible();
      await expect(page.getByTestId("ready-bar")).toHaveCount(0);
    });

    test("walk away, ready toast, account to open, sign in, result, on-you, try-ons, sign out", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      setScript([
        { pose: "front", outcome: "ok" },
        { outcome: "ok", delayMs: 9_000 },
      ]);
      const seen = watchPoseSet(page);
      await tryOnFromScratch(page, "Knit button vest");
      await page
        .getByRole("link", { name: "Keep browsing while it renders" })
        .click();
      await expect(page).toHaveURL(/\/$/);
      await card(page, "Wool car coat")
        .getByRole("link", { name: "View Wool car coat" })
        .click();
      await expect(page).toHaveURL(/\/item\/coat$/);

      // It finishes while the person is elsewhere: the ready bar and the toast with See it.
      const bar = page.getByTestId("ready-bar");
      await expect(bar).toBeVisible({ timeout: 60_000 });
      await expect(bar).toContainText(
        "Your knit button vest is ready — 4 poses",
      );
      await expect(page.getByTestId("job-chip")).toHaveCount(0);
      await shot(page, "ready-toast", size.name);
      await page
        .getByTestId("toast")
        .getByRole("link", { name: "See it" })
        .or(bar)
        .first()
        .click();

      // Guest-ready: tiles at tile size, the account to open, no full render.
      await waitForGuestReady(page);
      await expect(page.getByTestId("status-line")).toHaveText(
        "The knit button vest on your photo, 4 poses. Create an account to open them.",
      );
      await expect(page.getByTestId("pose-tile")).toHaveCount(4);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveScreenshot(`account-sheet-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "account-sheet", size.name);
      await dismissSheet(page);
      await expect(page).toHaveScreenshot(`guest-ready-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "guest-ready", size.name, true);
      expect(seen.poseSetId).not.toBe("");

      // The server refuses a guest the full image, for every pose; tiles are fine.
      for (const pose of ["front", "three-quarter", "walking", "seated"]) {
        const full = await page.request.get(
          `/api/renders/${seen.poseSetId}/${pose}`,
          { headers: { authorization: seen.token } },
        );
        expect(full.status(), `${pose} full`).toBe(403);
        expect((await full.json()).error).toBe("account_required");
        const tile = await page.request.get(
          `/api/renders/${seen.poseSetId}/${pose}?size=tile`,
          { headers: { authorization: seen.token } },
        );
        expect(tile.status(), `${pose} tile`).toBe(200);
      }
      await expect(page.getByTestId("pose-gallery")).toHaveCount(0);

      // Sign in with Google: the result opens, no re-render.
      const spendBefore = (await listDocs("spendLog")).length;
      const tryOnCalls: string[] = [];
      page.on("request", (r) => {
        if (new URL(r.url()).pathname === "/api/try-on")
          tryOnCalls.push(r.url());
      });
      await page.getByRole("button", { name: "See your 4 poses" }).click();
      await continueWithGoogle(page);
      const gallery = page.getByTestId("pose-gallery");
      await expect(gallery).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("img[data-render]")).toHaveCount(4);
      for (const img of await page.locator("img[data-render]").all()) {
        await expect(async () => {
          expect(
            await img.evaluate((e) => (e as HTMLImageElement).naturalWidth),
          ).toBeGreaterThan(500);
        }).toPass();
      }
      expect(tryOnCalls).toEqual([]);
      expect((await listDocs("spendLog")).length).toBe(spendBefore);

      // Gallery: the counter, thumbnails that jump, a swipe; caption directly under it.
      const counter = page.getByTestId("counter");
      await expect(counter).toHaveText("Front · 1/4");
      await expect(page.getByTestId("state-chip")).toBeVisible();
      await expect(page.getByTestId("dot")).toHaveCount(4);
      await expect(page).toHaveScreenshot(`result-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
      });
      await shot(page, "result-first-pose", size.name);
      await page.getByRole("button", { name: "Seated" }).click();
      await expect(counter).toHaveText("Seated · 4/4");
      await gallery.evaluate((el) =>
        el.scrollTo({ left: el.clientWidth * 2, behavior: "instant" }),
      );
      await expect(counter).toHaveText("Walking · 3/4");
      await shot(page, "result-third-pose", size.name);
      const gb = (await gallery.boundingBox())!;
      const cb = (await page.getByTestId("ai-caption").boundingBox())!;
      expect(cb.y).toBeGreaterThanOrEqual(gb.y + gb.height - 1);
      await expect(
        page.getByText(
          "A preview, not a fitting — it can't tell you size or fit.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Buy \$\d+ at / }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add to a list" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Build the outfit" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /download|save/i }),
      ).toHaveCount(0);

      // Reload keeps the signed-in state and the result.
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("img[data-render]")).toHaveCount(4);

      // Signed in: the tried piece is on you in Discover, the product says See your 4 poses,
      // Your try-ons lists it, and signing out returns to a clean guest state.
      await page.goto("/");
      const onYou = page.locator("article[data-item=vest][data-on-you=true]");
      await expect(onYou).toBeVisible();
      await expect(onYou.getByTestId("state-chip")).toHaveText("On you");
      await expect(onYou.getByTestId("count-chip")).toHaveText("↔ 4 poses");
      await expect(onYou.locator("img").first()).toHaveAttribute(
        "src",
        /^blob:/,
      );
      await onYou.scrollIntoViewIfNeeded();
      await shot(page, "discover-on-you", size.name);
      await onYou.getByTestId("state-chip").scrollIntoViewIfNeeded();
      await page.goto("/item/vest");
      await expect(page.getByTestId("see-poses")).toHaveText(
        "See your 4 poses",
      );
      await page.getByTestId("see-poses").click();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();

      if (size.name === "desktop") {
        await page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name: "Your try-ons" })
          .click();
      } else {
        await page.goto("/you"); // the tab bar is hidden on try-on screens
        await page
          .getByRole("heading", { name: "Your try-ons" })
          .scrollIntoViewIfNeeded();
      }
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await expect(page.getByTestId("tryon-card")).toContainText(
        "Knit button vest",
      );
      await shot(page, "your-tryons", size.name);
      await page.getByTestId("tryon-card").getByRole("link").click();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();

      if (size.name === "desktop") {
        await expect(page.getByTestId("account-initial")).toBeVisible();
        await page.getByRole("button", { name: "Sign out" }).click();
      } else {
        await page.goto("/you");
        await page.getByRole("button", { name: "Sign out" }).click();
      }
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("article[data-on-you=true]")).toHaveCount(0);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryons-guest")).toBeVisible();
      await expect(page.locator("img[data-render]")).toHaveCount(0);
      await expect(page.getByTestId("tryon-card")).toHaveCount(0);
      await expect(page.getByTestId("job-chip")).toHaveCount(0);
    });

    test("upload first as a guest: sheet, sign in, pick three labels, starters, try-on opens the result", async ({
      page,
    }) => {
      await uploadFirstAsGuest(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(
        "It saves your photo so you only ever do this once, and keeps every try-on you make.",
      );
      await expect(dialog).toContainText(
        "Then pick the first thing to see on yourself.",
      );
      await shot(page, "account-sheet-upload", size.name);
      await continueWithGoogle(page);

      // Pick three labels: one step, no email, no "Step 1 of 2".
      await expect(page).toHaveURL(/\/upload\/labels$/);
      await expect(
        page.getByRole("heading", { name: "Pick three labels" }),
      ).toBeVisible();
      await expect(
        page.getByText("Whatever they add shows up in Discover."),
      ).toBeVisible();
      await expect(page.getByText(/step \d of/i)).toHaveCount(0);
      await expect(page.getByText(/e-?mail/i)).toHaveCount(0);
      await shot(page, "pick-three-labels", size.name);
      await pickThreeLabels(page);
      await expect(page.getByTestId("starter")).toHaveCount(4);

      // A starter: the try-on completes and opens the result directly (no sheet).
      await page.getByTestId("starter").first().click();
      await expect(page).toHaveURL(/\/try-on\//);
      await waitForResult(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("upload first, not now: back on Discover with the photo kept", async ({
      page,
    }) => {
      await uploadFirstAsGuest(page);
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId("proof")).toHaveCount(0); // a photo is on file
      await page.goto("/you");
      await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
    });

    test("a Google account that already has an account: signed into it, the guest try-on stays", async ({
      page,
      browser,
    }) => {
      // Make an account first, in another browser context.
      const other = await browser.newContext();
      const p2 = await other.newPage();
      await p2.goto("/gate");
      await p2.getByLabel("Password").fill("e2e-password");
      await p2.getByRole("button", { name: "Open Trailroom" }).click();
      await uploadFirstAsGuest(p2);
      const email = await continueWithGoogle(p2);
      await expect(p2).toHaveURL(/\/upload\/labels$/);
      await other.close();

      // This guest signs in with the same Google account.
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await continueWithGoogle(page, { email, existing: true });
      await expect(page.getByTestId("toast")).toContainText(
        "You are signed in to your existing account. The guest try-on stays with the guest session.",
      );
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryons-empty")).toBeVisible();
    });

    test("when we can't render it: each variant shows exactly its actions", async ({
      page,
    }) => {
      const failure = page.getByTestId("honest-failure");
      const blocked = (pose: string) => ({
        pose,
        outcome: "blocked" as const,
        times: 2,
      });

      // The jacket: the honest reason, the closest three, nothing else.
      await page.goto("/item/jacket/unavailable");
      await expect(failure).toHaveAttribute("data-try-on", "cannot");
      await expect(failure).toContainText("folded over an arm");
      await expect(
        failure.getByTestId("closest").getByRole("button"),
      ).toHaveCount(3);
      await expect(failure.getByRole("button")).toHaveCount(3);
      await expect(failure.getByRole("link")).toHaveCount(0);
      await expect(failure).not.toContainText(/e-?mail/i);
      await shot(page, "fail-cannot", size.name);

      // Jewellery: not yet.
      await page.goto("/item/hoops/unavailable");
      await expect(failure).toHaveAttribute("data-try-on", "not_yet");
      await expect(failure.getByRole("heading", { level: 1 })).toHaveText(
        "Not yet for jewellery",
      );
      await expect(failure.getByRole("button")).toHaveCount(3);
      await expect(failure).not.toContainText(/e-?mail/i);
      await shot(page, "fail-not-yet", size.name);

      // render_failed: Try again, Use a different photo, the closest three.
      setScript([blocked("walking"), blocked("seated")]);
      await page.goto("/");
      await tryOnFromScratch(page, "Knit button vest");
      await expect(failure).toHaveAttribute("data-kind", "render_failed", {
        timeout: 30_000,
      });
      await expect(failure.getByRole("button")).toHaveCount(4);
      await expect(
        failure.getByRole("button", { name: "Try again" }),
      ).toBeVisible();
      await expect(
        failure.getByRole("link", { name: "Use a different photo" }),
      ).toBeVisible();
      await expect(page).toHaveScreenshot(`failure-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "fail-render-failed", size.name);

      // internal: a provider failure on every call is our fault, with one action.
      setScript([{ outcome: "error" }]);
      await failure.getByRole("button", { name: "Try again" }).click();
      await expect(failure).toHaveAttribute("data-kind", "internal", {
        timeout: 30_000,
      });
      await expect(failure).toContainText("Something went wrong on our side");
      await expect(failure).not.toContainText("did not come out well enough");
      await expect(failure.getByRole("button")).toHaveCount(1);
      await expect(failure.getByRole("link")).toHaveCount(0);
      await shot(page, "fail-internal", size.name);
    });

    test("capacity and the daily limit: one way back, no retry", async ({
      page,
    }) => {
      await exhaustBudget();
      await tryOnFromScratch(page, "Knit button vest");
      const failure = page.getByTestId("honest-failure");
      await expect(failure).toHaveAttribute("data-kind", "capacity", {
        timeout: 30_000,
      });
      await expect(failure.getByRole("link")).toHaveCount(1);
      await expect(failure.getByRole("button")).toHaveCount(0);
      await shot(page, "fail-capacity", size.name);
    });

    test("a partial set: three poses and the plain line", async ({ page }) => {
      setScript([{ pose: "walking", outcome: "blocked", times: 2 }]);
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page);
      await expect(page.getByTestId("partial-line")).toBeVisible();
      await expect(page.getByTestId("dot")).toHaveCount(3);
      await expect(page.getByTestId("pose-thumb")).toHaveCount(3);
      await shot(page, "result-partial", size.name);
    });
  });
}
