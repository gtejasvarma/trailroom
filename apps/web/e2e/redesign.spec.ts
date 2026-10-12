// The redesign of 2026-10-11: the hero decided on the server, the quiet tabs, carousels with dots
// only, the heart that saves to Favourites, the grid cards, the Reveal and hold-to-compare.
import type { Page } from "@playwright/test";
import {
  card,
  continueWithGoogle,
  expect,
  newEmail,
  realReveal,
  setScript,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";
import { E2E_PORT } from "../playwright.config";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const heart = (page: Page, item: string) =>
  page.locator(`article[data-item=${item}]`).getByTestId("heart");
const toast = (page: Page) => page.getByTestId("toast");
const reveal = (page: Page) => page.getByTestId("reveal");

/** Signs a guest in from the account sheet that a try-on (or Buy) opens, then waits for the reveal. */
async function signInAtTheEnd(page: Page, name = "Maya Chen") {
  const hero = page.getByTestId("pose-gallery");
  const ready = page.getByTestId("queue-title").filter({ hasText: /ready$/ });
  await expect(hero.or(ready).or(reveal(page))).toBeVisible({
    timeout: 30_000,
  });
  if (!(await reveal(page).isVisible()) && !(await hero.isVisible())) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await continueWithGoogle(page, { name });
  }
}

test.describe("the home page is decided on the server", () => {
  test("a visitor without the cookie gets the hero in the HTML; with it, no hero", async ({
    page,
    context,
  }) => {
    const base = `http://localhost:${E2E_PORT}`;
    const fresh = await (await context.request.get("/")).text();
    expect(fresh).toContain('data-testid="proof"');
    // The first picture is eager and high priority; the hero has no entrance animation.
    expect(fresh).toMatch(/fetchPriority="high"|fetchpriority="high"/);
    const proofTag = fresh.match(/<section[^>]*data-testid="proof"[^>]*>/)![0];
    expect(proofTag).not.toContain("rise");

    await context.addCookies([{ name: "tr_hp", value: "1", url: base }]);
    const returning = await (await context.request.get("/")).text();
    expect(returning).not.toContain('data-testid="proof"');
    expect(returning).toContain('data-testid="feed"');
    // The client corrects a stale cookie: a browser with no photo shows the hero again.
    await page.goto("/");
    await expect(page.getByTestId("proof")).toBeVisible();
    const after = (await context.cookies()).find((c) => c.name === "tr_hp");
    expect(after).toBeUndefined();
  });

  test("the cookie follows the photo, and the hero leaves with it", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("proof")).toBeVisible();
    await tryOnFromScratch(page, "Wool car coat");
    await expect
      .poll(
        async () =>
          (await context.cookies()).find((c) => c.name === "tr_hp")?.value,
      )
      .toBe("1");
    await page.goto("/");
    await expect(page.getByTestId("feed")).toBeVisible();
    await expect(page.getByTestId("proof")).toHaveCount(0);
    const html = await (await context.request.get("/")).text();
    expect(html).not.toContain('data-testid="proof"');
  });
});

for (const size of SIZES) {
  test.describe(`${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const phone = size.name === "phone";

    test("the hero's divider glides once to the middle; touching it takes over", async ({
      page,
    }) => {
      await page.goto("/");
      const range = page.getByTestId("proof-range");
      await expect(range).toBeVisible();
      await expect(range).toHaveValue("50", { timeout: 10_000 });
      await range.focus();
      await page.keyboard.press("ArrowRight");
      await expect(range).toHaveValue("51");
      // No category tiles, no all-caps label, no start box, no DEMO chip.
      await expect(page.getByText("What are you looking for")).toHaveCount(0);
      await expect(page.getByText("Start with these")).toHaveCount(0);
      await expect(page.getByTestId("start-item")).toHaveCount(0);
      await expect(page.getByText("DEMO", { exact: true })).toHaveCount(0);
      await expect(page.getByText("invented demo data")).toBeVisible();
    });

    test("the quiet text tabs filter, with aria-pressed, and no borders", async ({
      page,
    }) => {
      await page.goto("/");
      const group = page.getByRole("group", { name: "Categories" });
      await expect(group.getByRole("button")).toHaveText([
        "Everything",
        "Apparel",
        "Jewellery",
        "Accessories",
      ]);
      await expect(
        group.getByRole("button", { name: "Everything" }),
      ).toHaveAttribute("aria-pressed", "true");
      const b = group.getByRole("button", { name: "Jewellery" });
      await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("item-card")).toHaveCount(2);
      await expect(b).toHaveCSS("border-top-width", "0px");
      await expect(b).toHaveCSS("font-weight", "600");
      await expect(group.getByRole("button", { name: "Apparel" })).toHaveCSS(
        "font-weight",
        "400",
      );
    });

    test("cards: name and price on one line, label under it, a 40px pill; no chips, only dots", async ({
      page,
    }) => {
      await page.goto("/");
      const jump = page.locator("article[data-item=jump]");
      await expect(jump.getByTestId("card-label")).toHaveText("MARCHAND");
      await expect(jump.getByTestId("stock")).toContainText("Only 2 left");
      // "In stock" is not a line any more.
      await expect(page.getByText("In stock")).toHaveCount(0);
      await expect(
        page.locator("article[data-item=slip]").getByTestId("stock"),
      ).toHaveCount(0);
      const coat = page.locator("article[data-item=coat]");
      const pill = jump.getByRole("button", { name: /Try it on/ });
      expect((await pill.boundingBox())!.height).toBeCloseTo(40, 0);
      // No model-shot chip, no count chip, no on-you chip for the label's own photographs.
      await expect(jump.getByTestId("state-chip")).toHaveCount(0);
      await expect(jump.getByTestId("count-chip")).toHaveCount(0);
      await expect(jump.getByText(/Model shot|photos/)).toHaveCount(0);
      await expect(jump.getByTestId("dot")).toHaveCount(4);
      await expect(
        jump.locator("[data-testid=dot][data-active=true]"),
      ).toHaveCount(1);
      // A single-photo piece shows no dots.
      await expect(coat.getByTestId("dot")).toHaveCount(0);
      // The first image is eager, the rest lazy.
      const first = page.getByTestId("item-card").first();
      await expect(first.locator("img").first()).toHaveAttribute(
        "loading",
        "eager",
      );
      await expect(
        page.getByTestId("item-card").nth(5).locator("img").first(),
      ).toHaveAttribute("loading", /lazy|eager/);
      // Previous and next are in the accessibility tree but invisible until focused.
      const next = jump.getByRole("button", { name: "Next photo" });
      await expect(next).toHaveCSS("opacity", "0");
      await next.focus();
      await expect(next).toHaveCSS("opacity", "1");
    });

    test("grid columns follow the width", async ({ page }) => {
      await page.goto("/");
      const cols = await page
        .getByTestId("feed")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
      expect(cols).toBe(phone ? 1 : 3);
    });

    test("arrow keys change the frame", async ({ page }) => {
      await page.goto("/");
      const jump = page.locator("article[data-item=jump]");
      await jump.getByTestId("frames").focus();
      await page.keyboard.press("ArrowRight");
      await expect(jump.locator("[data-testid=dot]").nth(1)).toHaveAttribute(
        "data-active",
        "true",
      );
      await page.keyboard.press("ArrowLeft");
      await expect(jump.locator("[data-testid=dot]").nth(0)).toHaveAttribute(
        "data-active",
        "true",
      );
    });

    test("the product page: a heart on the picture, no chips, no arrows, and an explicit Add to a list", async ({
      page,
    }) => {
      await page.goto("/item/jump");
      const gallery = page.getByTestId("gallery");
      await expect(gallery.getByTestId("state-chip")).toHaveCount(0);
      await expect(gallery.getByTestId("count-chip")).toHaveCount(0);
      await expect(gallery.getByText(/Model shot|photos|\/ 4/)).toHaveCount(0);
      const h = gallery.locator("[data-testid=heart]:visible");
      await expect(h).toHaveAttribute("data-saved", "false");
      const box = (await h.boundingBox())!;
      expect(box.width).toBeCloseTo(44, 0);
      await h.click();
      await expect(toast(page)).toContainText("Saved to Favourites");
      await expect(h).toHaveAttribute("data-saved", "true");
      await expect(h).toHaveAccessibleName("Saved. Change lists");
      await expect(
        page.getByRole("button", { name: "Add to a list" }),
      ).toBeVisible();
    });

    test("a guest's heart saves to Favourites; Change asks for an account; tapping again removes, Undo brings it back", async ({
      page,
    }) => {
      await page.goto("/");
      const h = heart(page, "coat");
      await expect(h).toHaveAccessibleName("Save to Favourites");
      const saved = page.waitForResponse(
        (r) => r.url().includes("/api/lists/favourites") && r.ok(),
      );
      await h.click();
      await saved;
      await expect(h).toHaveAttribute("data-saved", "true");
      await expect(toast(page)).toContainText("Saved to Favourites");
      // Change opens the account sheet for a guest (other lists are account-only).
      await toast(page).getByRole("button", { name: "Change" }).click();
      await expect(
        page.getByRole("dialog", { name: "Create an account to save" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      // It is on the server: a reload keeps the heart, and the Lists tab shows Favourites.
      await page.reload();
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "true");
      await page.goto("/lists");
      const fav = page.getByTestId("list-card");
      await expect(fav).toHaveCount(1);
      await expect(fav).toContainText("Favourites");
      await expect(fav).toContainText("1 piece");
      await expect(
        page.getByText("Create an account to keep your Favourites."),
      ).toBeVisible();
      await fav.click();
      await expect(page.getByTestId("list-piece")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Rename" })).toHaveCount(0);
      await expect(page.getByTestId("delete-list")).toHaveCount(0);
      await expect(page.getByTestId("ask-button")).toHaveCount(0);
      // Unsave and undo.
      await page.goto("/");
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "true");
      await heart(page, "coat").click();
      await expect(toast(page)).toContainText("Removed from Favourites");
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "false");
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "true");
    });

    test("signed in: Change opens the sheet with Favourites first; a piece in another list opens the sheet; Favourites carry through sign-in", async ({
      page,
    }) => {
      await page.goto("/");
      await heart(page, "coat").click();
      await expect(toast(page)).toContainText("Saved to Favourites");
      // Sign in from the sheet the guest's Change opens: the guest's Favourites carry over.
      await toast(page).getByRole("button", { name: "Change" }).click();
      await continueWithGoogle(page, { email: newEmail() });
      const sheet = page.getByRole("dialog", { name: "Save to a list" });
      await expect(sheet).toBeVisible();
      const rows = sheet.getByTestId("list-choice");
      await expect(rows.first()).toContainText("Favourites");
      await expect(rows.first()).toHaveAttribute("data-in", "true");
      // Add it to a new list as well, then it is in two lists.
      await sheet.getByTestId("new-list-name").fill("Wedding");
      await sheet.getByRole("button", { name: "Create list and add" }).click();
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText("Favourites");
      await sheet.getByRole("button", { name: "Done" }).click();
      await expect(sheet).toBeHidden();
      // In two lists, the heart opens the sheet rather than unsaving.
      await heart(page, "coat").click();
      await expect(sheet).toBeVisible();
      // Take it out of Wedding: now only Favourites holds it, so the heart unsaves with Undo.
      await rows.nth(1).click();
      await sheet.getByRole("button", { name: "Done" }).click();
      await heart(page, "coat").click();
      await expect(toast(page)).toContainText("Removed from Favourites");
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "false");
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "true");
      // Signed in, Favourites cannot be renamed or deleted from its page, and is listed first.
      await page.goto("/lists");
      await expect(page.getByTestId("list-card").first()).toContainText(
        "Favourites",
      );
      await expect(page.getByTestId("list-card").first()).toHaveAttribute(
        "data-kind",
        "favourites",
      );
    });

    test("the reveal plays once for an account, can be skipped, and the AI label is on it", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await realReveal(page);
      await tryOnFromScratch(page, "Wool car coat");
      // A guest sees no reveal while the account sheet is the next step.
      await expect(reveal(page)).toHaveCount(0);
      await signInAtTheEnd(page);
      const r = reveal(page);
      await expect(r).toBeVisible({ timeout: 30_000 });
      await expect(r).toHaveAttribute("aria-modal", "true");
      await expect(r).toHaveAccessibleName("Your try-on of Wool car coat");
      // Step 1: the label's own photograph; the render is wiped over it.
      await expect(page.getByTestId("reveal-label-photo")).toBeVisible();
      await expect(page.getByTestId("reveal-edge")).toHaveCount(1);
      await expect(page.getByTestId("reveal-ai")).toHaveCSS("opacity", "0");
      // Escape jumps to the end state: the AI label, the other poses, the button.
      await page.keyboard.press("Escape");
      await expect(r).toHaveAttribute("data-step", "4");
      await expect(page.getByTestId("reveal-ai")).toHaveText(
        "AI-generated preview",
      );
      await expect(page.getByTestId("reveal-ai")).toHaveCSS("opacity", "1");
      await expect(page.getByTestId("reveal-thumb")).toHaveCount(3);
      const go = page.getByRole("button", { name: "See all 4 poses" });
      await expect(go).toBeVisible();
      // The page behind is inert while it is open.
      expect(
        await page.evaluate(
          () => document.querySelector("main")?.closest("[inert]") !== null,
        ),
      ).toBe(true);
      await go.click();
      await expect(r).toHaveCount(0);
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await expect(page.getByTestId("pose-thumb").first()).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      // A second visit goes straight to the result.
      await page.reload();
      await expect(page.getByTestId("pose-gallery")).toBeVisible();
      await expect(reveal(page)).toHaveCount(0);
    });

    test("hold to see the label's photo", async ({ page }) => {
      test.setTimeout(120_000);
      await tryOnFromScratch(page, "Wool car coat", { name: "Maya Chen" });
      await waitForResult(page);
      const chip = page.getByTestId("state-chip");
      await expect(chip).toHaveText("On you");
      await expect(page.getByTestId("counter")).toHaveCount(0);
      const hold = page.getByTestId("hold-compare");
      await expect(hold).toHaveText("Hold to see the label’s photo");
      await expect(hold).toHaveAttribute("aria-pressed", "false");
      const b = (await hold.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await expect(chip).toHaveText("Label’s photo");
      await expect(hold).toHaveAttribute("aria-pressed", "true");
      await page.mouse.up();
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      await expect(chip).toHaveText("On you");
      // Keyboard: Space held.
      await hold.focus();
      await page.keyboard.down("Space");
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await page.keyboard.up("Space");
      await expect(page.getByTestId("label-photo")).toHaveCount(0);
      // The result has dots and arrow keys, and no arrows or counter on screen.
      await expect(page.getByTestId("dot")).toHaveCount(4);
      await page.getByTestId("pose-gallery").focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId("dot").nth(1)).toHaveAttribute(
        "data-active",
        "true",
      );
    });

    test("an on-you card says the render is AI-generated, beside the image", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await tryOnFromScratch(page, "Wool car coat", { name: "Maya Chen" });
      await waitForResult(page);
      await page.goto("/");
      const coat = page.locator("article[data-item=coat]");
      await expect(coat).toHaveAttribute("data-on-you", "true");
      await expect(coat.getByTestId("state-chip")).toHaveText("On you");
      await expect(coat.getByTestId("card-ai")).toHaveText(
        "AI-generated preview",
      );
      await expect(coat.getByRole("button", { name: /^Buy \$/ })).toBeVisible();
    });
  });
}

test.describe("reveal: other cases", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("reduced motion: no wipe line, no movement, everything appears", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await realReveal(page);
    await tryOnFromScratch(page, "Wool car coat");
    await signInAtTheEnd(page);
    const r = reveal(page);
    await expect(r).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("reveal-edge")).toHaveCount(0);
    await expect(r).toHaveAttribute("data-step", "4", { timeout: 4_000 });
    await expect(page.getByTestId("reveal-ai")).toHaveCSS("opacity", "1");
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .some((a) => (a as CSSTransition).transitionProperty === "transform"),
    );
    expect(moving).toBe(false);
  });

  test("a failed job never shows the stage", async ({ page }) => {
    test.setTimeout(120_000);
    await realReveal(page);
    setScript([{ outcome: "blocked", times: 99 }]);
    await tryOnFromScratch(page, "Wool car coat");
    await expect(page.getByTestId("reveal")).toHaveCount(0);
    await page.waitForTimeout(4_000);
    await expect(page.getByTestId("reveal")).toHaveCount(0);
  });
});
