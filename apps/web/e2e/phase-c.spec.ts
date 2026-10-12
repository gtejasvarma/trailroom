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
  setScript,
  test,
  leftoverGuestTryOn,
  tryOnFromScratch,
  uploadFirst,
  uploadFirstAsGuest,
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
      // The sign-in toast is still up when the queue opens (it is timed, so it is masked).
      await expect(page).toHaveScreenshot(`queue-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
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

    test("walk away, ready toast, the result opens, on-you, try-ons", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      setScript([
        { pose: "front", outcome: "ok" },
        { outcome: "ok", delayMs: 9_000 },
      ]);
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

      // Signed in: the full result opens, with no account sheet in the way.
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("img[data-render]")).toHaveCount(4);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.goto("/");
      await expect(page.locator("article[data-on-you=true]")).toHaveCount(1);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await expect(page.getByTestId("tryons-guest")).toHaveCount(0);
    });

    // A guest cannot start a render any more, but one who made a try-on before that rule keeps it
    // for up to 48 hours. It still shows tiles, raises the account sheet and opens after sign-in.
    test("a leftover guest try-on: tiles, the account to open, no full image, sign in opens it", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const seen = watchPoseSet(page);
      await leftoverGuestTryOn(page, "Knit button vest");
      const jobUrl = page.url();

      // Guest-ready: tiles at tile size, the account to open, no full render.
      await expect(page.getByTestId("status-line")).toHaveText(
        "The knit button vest on your photo, 4 poses. Create an account to open them.",
      );
      await expect(page.getByTestId("pose-tile")).toHaveCount(4);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveScreenshot(`account-sheet-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("ready-bar")],
      });
      await shot(page, "account-sheet", size.name);
      await dismissSheet(page);
      // The ready bar is there because this try-on finished while nobody was watching.
      await expect(page).toHaveScreenshot(`guest-ready-${size.name}.png`, {
        mask: [page.locator("nextjs-portal"), page.getByTestId("ready-bar")],
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
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryons-guest")).toBeVisible();
      await expect(page.getByTestId("tryon-card")).toHaveCount(0);
      await page.goto(jobUrl);

      // Sign in with Google: the result opens, no re-render.
      const tryOnCalls: string[] = [];
      page.on("request", (r) => {
        if (new URL(r.url()).pathname === "/api/try-on")
          tryOnCalls.push(r.url());
      });
      await page.getByRole("button", { name: "See your 4 poses" }).click();
      await continueWithGoogle(page);
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("img[data-render]")).toHaveCount(4);
      expect(tryOnCalls).toEqual([]);
    });

    test("upload first as a guest: sheet, sign in, straight to the starters, one tap starts the try-on", async ({
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

      // No label step: the starters are next. Nothing about labels, steps or email.
      await expect(page).toHaveURL(/\/upload\/done$/);
      await expect(
        page.getByRole("heading", { name: "Your photo is in" }),
      ).toBeVisible();
      await expect(page.getByText(/pick three labels/i)).toHaveCount(0);
      await expect(page.getByText(/step \d of/i)).toHaveCount(0);
      await expect(page.getByText(/e-?mail/i)).toHaveCount(0);
      await expect(page.getByTestId("starter")).toHaveCount(4);
      // Dresses and full-length pieces first.
      await expect(page.getByTestId("starter").first()).toContainText(
        "Chambray wide-leg jumpsuit",
      );
      await shot(page, "starters", size.name);

      // One tap on a starter: the try-on starts with the photo just added (no sheet) and opens
      // the result.
      await page.getByTestId("starter-try").first().click();
      await expect(page).toHaveURL(/\/try-on\//);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await waitForResult(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("the old label step is gone: its URL leads to the starters, and nothing was followed", async ({
      page,
    }) => {
      await uploadFirst(page);
      await page.goto("/upload/labels");
      await expect(page).toHaveURL(/\/upload\/done$/);
      await expect(page.getByTestId("starter")).toHaveCount(4);
      expect(await listDocs("follows")).toHaveLength(0);
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
      setScript([
        blocked("walking"),
        blocked("seated"),
        blocked("three-quarter"),
      ]);
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
        mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
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
