// The mirror (2026-10-17): the signed-in result. The arrival (once, skippable, reduced motion),
// turning (drag, keys, thumbnails, dots), hold for the label's photo, the first-time hint, and the
// three choices: Love it, Ask a friend, Not for me (with and without Undo). Phone and desktop.
import type { Page } from "@playwright/test";
import { NAME, signedInWithTryOns, tryOnItems } from "./e-helpers";
import {
  expect,
  listDocs,
  realReveal,
  setScript,
  test,
  tryOnFromScratch,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844, step: 64 },
  { name: "desktop", width: 1440, height: 900, step: 90 },
] as const;

const toast = (p: Page) => p.getByTestId("toast");
const stage = (p: Page) => p.getByTestId("mirror-stage");
const surface = (p: Page) => p.getByTestId("pose-surface");
const activeDot = (p: Page) => p.locator("[data-testid=dot][data-active=true]");

/** The index of the dot that is lit, or -1. */
const lit = (p: Page) =>
  p
    .locator("[data-testid=dot]")
    .evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("data-active") === "true"),
    );

/** Drags across the picture by `dx` pixels, in steps, and releases. */
async function drag(p: Page, dx: number, opts: { release?: boolean } = {}) {
  const b = (await surface(p).boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  const n = 8;
  for (let i = 1; i <= n; i++) await p.mouse.move(x + (dx * i) / n, y);
  if (opts.release !== false) await p.mouse.up();
}

/** Records which dot is lit, every 40ms, from the page's first script on. */
async function recordDots(p: Page) {
  await p.addInitScript(() => {
    const w = window as unknown as { __dots: number[] };
    w.__dots = [];
    setInterval(() => {
      const els = [...document.querySelectorAll("[data-testid=dot]")];
      const i = els.findIndex((e) => e.getAttribute("data-active") === "true");
      if (els.length && w.__dots[w.__dots.length - 1] !== i) w.__dots.push(i);
    }, 40);
  });
}
const dotsSeen = (p: Page) =>
  p.evaluate(() => (window as unknown as { __dots: number[] }).__dots);

for (const size of SIZES) {
  test.describe(`the mirror, ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("the arrival plays once: focus, one turn all the way round, then the controls; the second visit has none", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await realReveal(page);
      await recordDots(page);
      await tryOnFromScratch(page, "Wool car coat", { name: NAME });
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 40_000,
      });
      // The picture starts blurred and transparent and comes into focus (it is not the mirror yet).
      await expect(stage(page)).not.toHaveAttribute("data-stage", "done");
      // She turns through every pose, in order, and back to the first.
      await expect(stage(page)).toHaveAttribute("data-stage", "done", {
        timeout: 15_000,
      });
      const seen = await dotsSeen(page);
      expect(seen.filter((i) => i >= 0)).toEqual([0, 1, 2, 3, 0]);
      expect(await lit(page)).toBe(0);
      // Settled: the hint, the choices.
      await expect(page.getByTestId("mirror-hint")).toHaveText(
        "Drag to turn. Hold to see the model.",
      );
      await expect(page.getByTestId("choices")).toBeVisible();
      // Once per try-on: a reload opens the mirror settled, with no arrival at all.
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await expect(stage(page)).toHaveAttribute("data-stage", "done");
      await expect(page.getByTestId("queue-title")).toHaveCount(0);
    });

    test("any touch or key during the arrival skips to the end state", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await realReveal(page);
      await recordDots(page);
      await tryOnFromScratch(page, "Wool car coat", { name: NAME });
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 40_000,
      });
      await expect(stage(page)).not.toHaveAttribute("data-stage", "done");
      await page.keyboard.press("Space");
      await expect(stage(page)).toHaveAttribute("data-stage", "done");
      expect(await lit(page)).toBe(0);
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
    });

    test("until the Front render is loaded and decoded the queue stays up", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await realReveal(page);
      // Hold every render back: the finished job must not open the mirror yet.
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      await page.route("**/api/renders/**", async (route) => {
        await gate;
        await route.continue();
      });
      await tryOnFromScratch(page, "Wool car coat", { name: NAME });
      await expect(page.getByTestId("queue-title")).toHaveText(
        /poses?, on you$/,
        {
          timeout: 40_000,
        },
      );
      await page.waitForTimeout(1_500);
      await expect(page.getByTestId("pose-gallery")).toHaveCount(0);
      release();
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 15_000,
      });
    });

    test("turning: drag follows the finger one pose per step, keys and thumbnails turn too", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      await expect(page.getByTestId("pose-thumb")).toHaveCount(4);
      await expect(page.locator("img[data-render]")).toHaveCount(4);
      expect(await lit(page)).toBe(0);
      // Drag left by 1.2 steps: one pose forward.
      await drag(page, -size.step * 1.2);
      expect(await lit(page)).toBe(1);
      await drag(page, -size.step * 2.2);
      expect(await lit(page)).toBe(3);
      // The last pose has no next one: more dragging stays, and leans while it is held.
      await drag(page, -size.step * 3, { release: false });
      expect(await lit(page)).toBe(3);
      const leaning = await surface(page).evaluate(
        (e) => getComputedStyle(e).transform,
      );
      expect(leaning).not.toBe("none");
      await page.mouse.up();
      // It settles back flat.
      await expect
        .poll(async () =>
          surface(page).evaluate((e) => getComputedStyle(e).transform),
        )
        .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      // Right drags go back.
      await drag(page, size.step * 1.2);
      expect(await lit(page)).toBe(2);
      // Arrow keys when the picture is focused, announced politely.
      await page.getByTestId("pose-gallery").focus();
      await page.keyboard.press("ArrowLeft");
      expect(await lit(page)).toBe(1);
      await expect(page.getByTestId("pose-announce")).toHaveText(
        "Turn, 2 of 4",
      );
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      expect(await lit(page)).toBe(3);
      await expect(page.getByTestId("pose-announce")).toHaveText("Sit, 4 of 4");
      // The first pose leans against a drag to the right and stays.
      await page.getByTestId("pose-thumb").first().click();
      expect(await lit(page)).toBe(0);
      await drag(page, size.step * 3);
      expect(await lit(page)).toBe(0);
    });

    test("a mostly vertical movement is the page's: it neither turns nor holds", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      const b = (await surface(page).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 4, b.y + b.height / 2 + 60, {
        steps: 6,
      });
      await page.waitForTimeout(450);
      expect(await lit(page)).toBe(0);
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      await page.mouse.up();
      // The picture is set to let the browser scroll vertically.
      await expect(surface(page)).toHaveCSS("touch-action", "pan-y");
    });

    test("thumbnails and dots: a verb under each, the current one outlined, tap to turn", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      const thumbs = page.getByTestId("pose-thumb");
      await expect(thumbs).toHaveCount(4);
      await expect(thumbs).toHaveText(["Stand", "Turn", "Walk", "Sit"]);
      await expect(thumbs.first()).toHaveAttribute("aria-pressed", "true");
      const pic = thumbs.first().locator("span").first();
      const box = (await pic.boundingBox())!;
      expect([box.width, box.height]).toEqual(
        size.name === "phone" ? [44, 58] : [52, 68],
      );
      await expect(pic).toHaveCSS("border-radius", "8px");
      await expect(pic).toHaveCSS("outline-width", "2px");
      await expect(pic).toHaveCSS("opacity", "1");
      await expect(thumbs.nth(1).locator("span").first()).toHaveCSS(
        "opacity",
        "0.6",
      );
      // At least 44px to tap.
      expect(
        (await thumbs.first().boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
      await thumbs.nth(2).click();
      expect(await lit(page)).toBe(2);
      await expect(thumbs.nth(2)).toHaveAttribute("aria-pressed", "true");
      await expect(thumbs.first()).toHaveAttribute("aria-pressed", "false");
      // Four dots, 6px, the current one solid and the others faded.
      const dots = page.getByTestId("dot");
      await expect(dots).toHaveCount(4);
      const d = (await dots.first().boundingBox())!;
      expect([d.width, d.height]).toEqual([6, 6]);
      await expect(dots.nth(2)).toHaveCSS("opacity", "1");
      await expect(dots.nth(0)).toHaveCSS("opacity", "0.55");
      // The pose images are the ones the dots stand for; only the current one is exposed.
      await expect(
        page.locator("img[data-render]:not([aria-hidden])"),
      ).toHaveCount(1);
      await expect(
        page.locator("img[data-render]:not([aria-hidden])"),
      ).toHaveAttribute("data-pose", "walking");
    });

    test("hold for the label's photo: a still press swaps it in, release returns; a drag does not", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      const b = (await surface(page).boundingBox())!;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      // A short press does nothing.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(120);
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      await page.mouse.up();
      // A still press longer than 280ms swaps it in at once, with a frosted label.
      await page.mouse.down();
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await expect(page.getByTestId("label-badge")).toHaveText(
        "On the label’s model",
      );
      await expect(page.getByTestId("label-photo")).toHaveCSS("opacity", "1");
      await page.mouse.up();
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      await expect(page.getByTestId("label-badge")).toHaveCount(0);
      // Moving beyond 8px before the hold lands cancels it: that is a drag.
      await page.mouse.down();
      await page.mouse.move(x + 14, y, { steps: 3 });
      await page.waitForTimeout(450);
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      await page.mouse.up();
      // The old button under the picture is gone.
      await expect(page.getByTestId("hold-compare")).toHaveCount(0);
      // The keyboard and screen-reader equivalent: a toggle in the details.
      const toggle = page.getByTestId("label-toggle");
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await toggle.click();
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
    });

    test("the first-time hint: shown until she has turned or held once, then never again", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      const hint = page.getByTestId("mirror-hint");
      await expect(hint).toBeVisible();
      await expect(hint).toHaveText("Drag to turn. Hold to see the model.");
      await drag(page, -size.step * 1.2);
      await expect(hint).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await page.waitForTimeout(600);
      await expect(hint).toHaveCount(0);
    });

    test("holding also teaches: the hint goes after a hold", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      await expect(page.getByTestId("mirror-hint")).toBeVisible();
      const b = (await surface(page).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await page.mouse.up();
      await expect(page.getByTestId("mirror-hint")).toHaveCount(0);
    });

    test("the name line carries the AI label beside the picture, not on it; there is no On you chip", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Wool car coat",
      );
      await expect(page.getByTestId("ai-caption")).toHaveText(
        /^[A-Z ]+, \$328\. AI-generated preview\.$/i,
      );
      if (size.name === "desktop")
        await expect(page.getByTestId("mirror-note")).toBeVisible();
      await expect(page.getByTestId("state-chip")).toHaveCount(0);
      // Nothing is drawn on the render itself: the image is a plain image.
      await expect(page.locator("canvas")).toHaveCount(0);
    });

    test("Love it toggles Favourites, and is filled when the piece already is one", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      const love = page.getByTestId("choice-love");
      await expect(love).toHaveAttribute("aria-pressed", "false");
      const mirrorUrl = page.url();
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PATCH" && r.url().includes("/api/lists/"),
      );
      await love.click();
      await expect(toast(page)).toHaveText("Added to Favourites.");
      await saved;
      await expect(love).toHaveAttribute("aria-pressed", "true");
      await expect(love.locator("svg path")).toHaveAttribute(
        "fill",
        "currentColor",
      );
      await page.goto("/lists");
      await page.getByTestId("list-card").first().click();
      await expect(
        page.locator("[data-testid=list-piece][data-item=coat]"),
      ).toBeVisible();
      // Back in the mirror it is already filled; one more press takes it out.
      await page.goto(mirrorUrl);
      await expect(love).toHaveAttribute("aria-pressed", "true");
      await love.click();
      await expect(toast(page)).toHaveText("Removed from Favourites.");
      await expect(love).toHaveAttribute("aria-pressed", "false");
    });

    test("Ask a friend makes a link for this one piece and opens the share sheet", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        const w = window as unknown as { __shared: unknown[] };
        w.__shared = [];
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (d: unknown) => {
            w.__shared.push(d);
          },
        });
      });
      await signedInWithTryOns(page, ["coat"]);
      const created = page.waitForRequest(
        (r) => r.url().endsWith("/api/asks") && r.method() === "POST",
      );
      await page.getByTestId("choice-ask").click();
      const body = (await created).postDataJSON();
      expect(Object.keys(body).sort()).toEqual(["poseSetId", "question"]);
      await expect(toast(page)).toHaveText("Sent.");
      const shared = (await page.evaluate(
        () => (window as unknown as { __shared: unknown[] }).__shared,
      )) as { url: string; text: string }[];
      expect(shared).toHaveLength(1);
      expect(shared[0]!.url).toMatch(/\/ask\/[A-Za-z0-9_-]+$/);
      expect(shared[0]!.text).toBe("What do you think of the wool car coat?");
      // The link is the vote page for that one piece.
      await page.goto(shared[0]!.url);
      await expect(page.getByTestId("vote-title")).toHaveText("Wool car coat");
      await expect(page.getByTestId("vote-question")).toContainText(
        "wool car coat",
      );
      expect(await listDocs("asks")).toHaveLength(1);
    });

    test("without a share sheet the link is copied", async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        const w = window as unknown as { __copied: string[] };
        w.__copied = [];
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (t: string) => {
              w.__copied.push(t);
            },
          },
        });
      });
      await signedInWithTryOns(page, ["coat"]);
      await page.getByTestId("choice-ask").click();
      await expect(toast(page)).toHaveText(
        "Link copied. They vote in one tap, no app needed.",
      );
      const copied = await page.evaluate(
        () => (window as unknown as { __copied: string[] }).__copied,
      );
      expect(copied).toHaveLength(1);
      expect(copied[0]).toMatch(/\/ask\/[A-Za-z0-9_-]+$/);
    });

    test("when the browser refuses the share sheet after the link is made, a second tap shares it", async ({
      page,
    }) => {
      // Safari on iPhone refuses navigator.share (and the clipboard) when the tap was too long
      // ago, as after a slow request. The first call is refused here; the second, from a fresh tap,
      // goes through.
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        const w = window as unknown as { __shared: unknown[]; __calls: number };
        w.__shared = [];
        w.__calls = 0;
        const refuse = () =>
          Promise.reject(
            new DOMException("needs a fresh tap", "NotAllowedError"),
          );
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (d: unknown) => {
            w.__calls += 1;
            if (w.__calls === 1) return refuse();
            w.__shared.push(d);
          },
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: refuse },
        });
      });
      await signedInWithTryOns(page, ["coat"]);
      const ask = page.getByTestId("choice-ask");
      await ask.click();
      await expect(toast(page)).toHaveText(
        "Your link is ready. Tap Share link to send it.",
      );
      await expect(ask).toContainText("Share link");
      expect(await listDocs("asks")).toHaveLength(1);

      await ask.click();
      await expect(toast(page)).toHaveText("Sent.");
      await expect(ask).toContainText("Ask a friend");
      const shared = (await page.evaluate(
        () => (window as unknown as { __shared: unknown[] }).__shared,
      )) as { url: string }[];
      expect(shared).toHaveLength(1);
      expect(shared[0]!.url).toMatch(/\/ask\/[A-Za-z0-9_-]+$/);
      // The second tap reused the link: still one ask.
      expect(await listDocs("asks")).toHaveLength(1);
    });

    test("Not for me with Undo: the picture drops away, nothing is deleted, the mirror returns", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const deletes: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "DELETE" && r.url().includes("/api/try-ons/"))
          deletes.push(r.url());
      });
      await signedInWithTryOns(page, ["coat"]);
      const url = page.url();
      await page.getByTestId("choice-not-for-me").click();
      await expect(toast(page)).toContainText("Removed from your try-ons.");
      await expect(page.getByTestId("mirror-gone")).toBeVisible();
      await expect(stage(page)).toHaveCSS("opacity", "0");
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect(page.getByTestId("mirror-gone")).toHaveCount(0);
      await expect(stage(page)).toHaveCSS("opacity", "1");
      // Past the five seconds the removal would have been sent: it never was.
      await page.waitForTimeout(6_000);
      expect(deletes).toEqual([]);
      expect(page.url()).toBe(url);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      expect(await tryOnItems(page)).toEqual(["coat"]);
    });

    test("Not for me without Undo: sent when the window ends, then the next try-on opens, settled", async ({
      page,
    }) => {
      test.setTimeout(150_000);
      const deletes: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "DELETE" && r.url().includes("/api/try-ons/"))
          deletes.push(r.url());
      });
      await signedInWithTryOns(page, ["vest", "coat"]);
      const coatUrl = page.url();
      await page.getByTestId("choice-not-for-me").click();
      await expect(toast(page)).toContainText("Removed from your try-ons.");
      await expect(page.getByTestId("mirror-gone")).toContainText(
        "Next up is the knit button vest.",
      );
      // Not sent yet: the window is five seconds.
      await page.waitForTimeout(2_000);
      expect(deletes).toEqual([]);
      await expect(page).toHaveURL(/\/try-on\//);
      expect(page.url()).toBe(coatUrl);
      // Then it is, and the vest's mirror opens with no arrival.
      await expect.poll(() => deletes.length, { timeout: 10_000 }).toBe(1);
      await expect(page).not.toHaveURL(coatUrl);
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await expect(stage(page)).toHaveAttribute("data-stage", "done");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Knit button vest",
      );
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      expect(await tryOnItems(page)).toEqual(["vest"]);
    });

    test("Not for me on the only try-on goes to Discover", async ({ page }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      await page.getByTestId("choice-not-for-me").click();
      await expect(page.getByTestId("mirror-gone")).toContainText(
        "Back to Discover.",
      );
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.getByTestId("feed")).toBeVisible();
    });

    test("leaving the screen sends a pending removal at once", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const deletes: number[] = [];
      page.on("request", (r) => {
        if (r.method() === "DELETE" && r.url().includes("/api/try-ons/"))
          deletes.push(Date.now());
      });
      await signedInWithTryOns(page, ["coat"]);
      await page.getByTestId("choice-not-for-me").click();
      await expect(toast(page)).toContainText("Removed from your try-ons.");
      const left = Date.now();
      // Leaving by a link inside the app (the heart on a phone, Lists on desktop).
      await page.locator("header a[href='/lists']:visible").first().click();
      await expect.poll(() => deletes.length, { timeout: 3_000 }).toBe(1);
      expect(deletes[0]! - left).toBeLessThan(4_000);
    });

    test("details sit below: description, Wear it with, Add to a list, Compare on wide screens", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await signedInWithTryOns(page, ["coat"]);
      await expect(page.getByTestId("outfit-row")).toBeVisible();
      const add = page.getByRole("button", { name: "Add to a list" });
      await expect(add).toBeVisible();
      await add.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      if (size.name === "desktop") {
        await expect(page.getByTestId("compare-toggle")).toBeVisible();
        await expect(
          page.locator("#main").getByRole("link", { name: "Your try-ons" }),
        ).toBeVisible();
      } else {
        await expect(page.getByTestId("compare-toggle")).toHaveCount(0);
      }
      // Choices: a toolbar of three on a phone, a vertical list on desktop; 44px at least.
      const choices = page.getByTestId("choices").getByRole("button");
      await expect(choices).toHaveCount(3);
      const boxes = await Promise.all(
        [0, 1, 2].map(async (i) => (await choices.nth(i).boundingBox())!),
      );
      for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);
      if (size.name === "phone") {
        expect(boxes[0]!.y).toBe(boxes[1]!.y);
        expect(boxes[0]!.height).toBeGreaterThanOrEqual(64);
        await expect(choices).toHaveText([
          "Not for me",
          "Ask a friend",
          "Love it",
        ]);
      } else {
        expect(boxes[0]!.x).toBe(boxes[1]!.x);
        await expect(choices).toHaveText([
          "Love it",
          "Ask a friend",
          "Not for me",
        ]);
      }
      await expect(
        page.getByRole("group", { name: /^Your try-on of/ }),
      ).toBeVisible();
    });
  });
}

test.describe("the arrival under reduced motion", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });

  test("a short cross-fade: no blur, no automatic turn", async ({ page }) => {
    test.setTimeout(120_000);
    await realReveal(page);
    await recordDots(page);
    await tryOnFromScratch(page, "Wool car coat", { name: NAME });
    await expect(page.getByTestId("pose-gallery")).toBeVisible({
      timeout: 40_000,
    });
    await expect(stage(page)).toHaveAttribute("data-stage", "done", {
      timeout: 3_000,
    });
    await page.waitForTimeout(2_000);
    expect((await dotsSeen(page)).filter((i) => i >= 0)).toEqual([0]);
    const filter = await stage(page).evaluate(
      (e) => getComputedStyle(e).filter,
    );
    expect(filter).toBe("none");
    // No tilt under reduced motion either.
    await drag(page, -64 * 1.2, { release: false });
    await expect(surface(page)).toHaveCSS(
      "transform",
      /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
    );
    await page.mouse.up();
  });

  test("a failed job never shows the mirror", async ({ page }) => {
    test.setTimeout(120_000);
    await realReveal(page);
    setScript([{ outcome: "blocked", times: 99 }]);
    await tryOnFromScratch(page, "Wool car coat");
    await expect(page.getByTestId("honest-failure")).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByTestId("pose-gallery")).toHaveCount(0);
  });
});
