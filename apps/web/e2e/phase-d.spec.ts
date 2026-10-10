// Phase D: lists, asks, the public vote page and the Asks inbox, at 390x844 and 1440x900.
// Review PNGs go to runs/phase-d/ (git-ignored).
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  request as pwRequest,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { E2E_PORT } from "../playwright.config";
import {
  continueWithGoogle,
  expect,
  newEmail,
  passGate,
  seedAsk,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
const BASE = `http://localhost:${E2E_PORT}`;

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-d",
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

async function serious(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
}

const noHScroll = async (page: Page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

const heart = (page: Page, item: string) =>
  page.locator(`article[data-item=${item}]`).getByTestId("heart");
const listSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Save to a list" });

/** A guest taps a heart, signs in, and lands on the list sheet for that piece. */
async function signInFromHeart(page: Page, item: string, name?: string) {
  await page.goto("/");
  await expect(page.getByTestId("item-card")).toHaveCount(12);
  await heart(page, item).click();
  await expect(
    page.getByRole("dialog", { name: "Create an account to save" }),
  ).toBeVisible();
  const email = await continueWithGoogle(page, { email: newEmail(), name });
  await expect(listSheet(page)).toBeVisible();
  return email;
}

/** A browser context with no cookies at all: no gate cookie, no session. */
async function stranger(
  page: Page,
  size: { width: number; height: number },
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await page
    .context()
    .browser()!
    .newContext({
      baseURL: BASE,
      viewport: { width: size.width, height: size.height },
    });
  return { ctx, page: await ctx.newPage() };
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("lists: guest to account sheet to list sheet; create, add, remove; Lists tab; list page", async ({
      page,
    }) => {
      // A guest taps the heart: the account sheet with the list reason; signing in resumes.
      await signInFromHeart(page, "coat");
      await settle(page);
      expect(await serious(page)).toEqual([]);

      // Create a list from the sheet: it is created with the piece in it.
      const sheet = listSheet(page);
      await expect(sheet.getByTestId("list-choice")).toHaveCount(0);
      await shot(page, "list-sheet-empty", size.name);
      await sheet.getByTestId("new-list-name").fill("Wedding in September");
      await sheet.getByRole("button", { name: "Create list and add" }).click();
      await expect(page.getByTestId("toast")).toContainText(
        "Created Wedding in September",
      );
      await expect(page.getByTestId("toast")).toContainText("Open list");
      const row = sheet.getByTestId("list-choice");
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute("data-in", "true");
      await expect(row).toContainText("1 piece");
      await shot(page, "list-sheet", size.name);
      expect(await serious(page)).toEqual([]);
      await sheet.getByRole("button", { name: "Done" }).click();
      await expect(sheet).toBeHidden();
      await expect(heart(page, "coat")).toHaveAttribute("data-saved", "true");
      await expect(heart(page, "slip")).toHaveAttribute("data-saved", "false");

      // Add another piece to it, then remove it, then add it again: the heart follows.
      await heart(page, "slip").click();
      await expect(sheet).toBeVisible();
      await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "false",
      );
      await sheet.getByTestId("list-choice").click();
      await expect(page.getByTestId("toast")).toContainText(
        "Added to Wedding in September",
      );
      await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "true",
      );
      await sheet.getByTestId("list-choice").click();
      await expect(page.getByTestId("toast")).toContainText(
        "Removed from Wedding in September",
      );
      await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "false",
      );
      await sheet.getByTestId("list-choice").click();
      await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "true",
      );
      await sheet.getByRole("button", { name: "Done" }).click();
      await expect(heart(page, "slip")).toHaveAttribute("data-saved", "true");

      // The product page's heart agrees, and "Add to a list" is the same sheet.
      await page.goto("/item/coat");
      await expect(page.getByTestId("heart")).toHaveAttribute(
        "data-saved",
        "true",
      );

      // The Lists tab: both segments.
      await page.goto("/lists");
      const cardEl = page.getByTestId("list-card");
      await expect(cardEl).toHaveCount(1);
      await expect(cardEl).toContainText("Wedding in September");
      await expect(cardEl).toContainText("2 pieces · ready to ask");
      await expect(page.getByTestId("asks-badge")).toHaveCount(0);
      await settle(page);
      await expect(page).toHaveScreenshot(`lists-mine-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "lists-mine", size.name);
      expect(await serious(page)).toEqual([]);
      await page.getByRole("tab", { name: "Asks" }).click();
      await expect(page.getByTestId("asks-empty")).toBeVisible();
      await shot(page, "lists-asks-empty", size.name);
      expect(await serious(page)).toEqual([]);
      await page.getByRole("tab", { name: "My lists" }).click();

      // The list page.
      await cardEl.click();
      await expect(page).toHaveURL(/\/lists\/[^/]+$/);
      await expect(page.getByTestId("list-title")).toHaveText(
        "Wedding in September",
      );
      await expect(page.getByTestId("list-piece")).toHaveCount(2);
      await expect(page.getByTestId("ask-button")).toHaveText(
        "Ask friends to pick",
      );
      await settle(page);
      await expect(page).toHaveScreenshot(`list-page-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "list-page", size.name, true);
      expect(await serious(page)).toEqual([]);
      await noHScroll(page);

      await page.getByRole("button", { name: "Rename" }).click();
      await page.getByTestId("rename-input").fill("Work capsule");
      await page.getByRole("button", { name: "Save name" }).click();
      await expect(page.getByTestId("list-title")).toHaveText("Work capsule");

      await page
        .getByRole("button", {
          name: "Remove Bias-cut slip dress from this list",
        })
        .click();
      await expect(page.getByTestId("list-piece")).toHaveCount(1);
      await expect(page.getByTestId("ask-button")).toHaveText(
        "Ask friends about this one",
      );

      // Remove the last piece: nothing to ask about.
      await page
        .getByRole("button", { name: "Remove Wool car coat from this list" })
        .click();
      await expect(page.getByTestId("list-empty")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add something first" }),
      ).toBeDisabled();

      // Delete: visible, then gone.
      await page.getByTestId("delete-list").click();
      await page.getByTestId("confirm-delete").click();
      await expect(page).toHaveURL(/\/lists$/);
      await expect(page.getByTestId("list-card")).toHaveCount(0);
      await expect(page.getByTestId("lists-empty")).toBeVisible();
      // The empty state has a live piece to start with.
      await expect(
        page.getByTestId("lists-empty").getByRole("button"),
      ).toContainText("to a list");
    });

    test("the whole loop: ask, share, a stranger votes without the gate, the inbox, revoke", async ({
      page,
      context,
    }) => {
      test.setTimeout(240_000);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);

      // Maya: signs in with a name, tries on the vest, saves two pieces in a list.
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page, { name: "Maya Chen" });
      await page.goto("/");
      await expect(page.getByTestId("item-card")).toHaveCount(12);
      await heart(page, "vest").click();
      const sheet = listSheet(page);
      await expect(sheet).toBeVisible();
      await sheet.getByTestId("new-list-name").fill("Wedding in September");
      await sheet.getByRole("button", { name: "Create list and add" }).click();
      await expect(sheet.getByTestId("list-choice")).toHaveCount(1);
      await sheet.getByRole("button", { name: "Done" }).click();
      await heart(page, "coat").click();
      await sheet.getByTestId("list-choice").click();
      await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
        "data-in",
        "true",
      );
      await sheet.getByRole("button", { name: "Done" }).click();

      // The list page shows the person's own Front render where they have one.
      await page.goto("/lists");
      await page.getByTestId("list-card").click();
      await expect(page.getByTestId("list-piece")).toHaveCount(2);
      await expect(
        page.locator(
          "[data-testid=list-piece][data-item=vest] img[data-render]",
        ),
      ).toBeVisible();
      await expect(
        page.locator(
          "[data-testid=list-piece][data-item=coat] img[data-render]",
        ),
      ).toHaveCount(0);
      await expect(
        page
          .locator("[data-testid=list-piece][data-item=vest]")
          .getByTestId("ai-caption"),
      ).toHaveText("AI-generated preview");

      // Ask: the share screen says plainly what the link does, before any link exists.
      await page.getByTestId("ask-button").click();
      await expect(page).toHaveURL(/\/share$/);
      await expect(page.getByTestId("share-sentence")).toHaveText(
        "Anyone with the link can see the list name and these pieces, and any you have tried on show on you. You can switch the link off whenever you like.",
      );
      await expect(page.getByTestId("ask-link")).toHaveCount(0);
      await expect(page.getByTestId("share-thumb")).toHaveCount(2);
      await settle(page);
      await expect(page).toHaveScreenshot(`share-${size.name}.png`, {
        mask: [page.locator("nextjs-portal")],
      });
      await shot(page, "share", size.name);
      expect(await serious(page)).toEqual([]);
      await page.getByTestId("ask-question").fill("Which one for Saturday?");
      await page.getByTestId("create-link").click();
      const link = await page.getByTestId("ask-link").inputValue();
      expect(link).toMatch(/^http:\/\/localhost:3101\/ask\/[A-Za-z0-9_-]{43}$/);
      await shot(page, "share-link", size.name);
      expect(await serious(page)).toEqual([]);

      // Copy link puts it on the clipboard; Share exists only where the browser can share.
      await page.getByTestId("copy-link").click();
      await expect(page.getByTestId("toast")).toHaveText("Link copied.");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        link,
      );
      const canShare = await page.evaluate(
        () => typeof navigator.share === "function",
      );
      await expect(page.getByTestId("share-link")).toHaveCount(
        canShare ? 1 : 0,
      );

      // A fresh browser: no gate cookie, no session.
      const v1 = await stranger(page, size);
      const first = await v1.page.goto(link);
      expect(first!.status()).toBe(200);
      await expect(v1.page).toHaveURL(link);
      expect(first!.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      // Next may widen this (it adds no-cache and must-revalidate to dynamic pages): never cacheable.
      expect(first!.headers()["cache-control"]).toMatch(/no-store/);
      expect(first!.headers()["referrer-policy"]).toBe("no-referrer");
      await expect(v1.page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expect(v1.page.getByTestId("vote-title")).toHaveText(
        "Wedding in September",
      );
      await expect(v1.page.getByTestId("vote-sub")).toHaveText(
        "Maya is asking. One tap, no sign-in.",
      );
      await expect(v1.page.getByTestId("vote-question")).toHaveText(
        "Which one for Saturday?",
      );
      const vest = v1.page.locator("[data-testid=ask-piece][data-item=vest]");
      const coat = v1.page.locator("[data-testid=ask-piece][data-item=coat]");
      await expect(vest.getByTestId("ai-caption")).toHaveText(
        "AI-generated preview",
      );
      await expect(vest).toContainText("Knit button vest, $");
      await expect(coat.getByTestId("ai-caption")).toHaveCount(0);
      await expect(coat).toContainText("Wool car coat, $328");
      await expect(vest.locator("img")).toHaveAttribute(
        "src",
        /\/api\/ask\/[^/]+\/image\/vest$/,
      );
      await shot(v1.page, "vote-before", size.name);
      await expect(v1.page).toHaveScreenshot(`vote-before-${size.name}.png`, {
        mask: [v1.page.locator("nextjs-portal")],
      });
      expect(await serious(v1.page)).toEqual([]);
      await noHScroll(v1.page);

      // Vote: thanks and the split; reload keeps it.
      await vest.getByRole("button", { name: "This one" }).click();
      await expect(v1.page.getByTestId("thanks")).toHaveText(
        "Thanks — Maya can see your vote",
      );
      await expect(vest.getByTestId("split-row")).toContainText("100%");
      await expect(coat.getByTestId("split-row")).toContainText("0%");
      await expect(v1.page.getByTestId("vote-button")).toHaveCount(0);
      await expect(v1.page.getByTestId("see-it-on-me")).toBeVisible();
      await expect(v1.page.getByTestId("just-browse")).toBeVisible();
      await expect(v1.page).toHaveScreenshot(`vote-after-${size.name}.png`, {
        mask: [v1.page.locator("nextjs-portal")],
      });
      await shot(v1.page, "vote-after", size.name, true);
      expect(await serious(v1.page)).toEqual([]);
      await noHScroll(v1.page);
      await v1.page.reload();
      await expect(v1.page.getByTestId("thanks")).toBeVisible();
      await expect(vest.getByTestId("split-row")).toContainText("100%");
      // The cookie is HttpOnly: the page cannot read it.
      expect(await v1.page.evaluate(() => document.cookie)).toBe("");
      const cookies = await v1.ctx.cookies();
      const voter = cookies.find((c) => c.name === "trailroom_voter");
      expect(voter).toMatchObject({ httpOnly: true, sameSite: "Lax" });
      expect(cookies.some((c) => c.name === "trailroom_gate")).toBe(false);

      // "See it on me" leads into the app, which is behind the password gate for now.
      await v1.page.getByTestId("see-it-on-me").click();
      await expect(v1.page).toHaveURL(/\/gate$/);
      await v1.page.goBack();
      await v1.page.getByTestId("just-browse").click();
      await expect(v1.page).toHaveURL(/\/gate$/);

      // A second fresh browser votes for the other piece: 1 and 1.
      const v2 = await stranger(page, size);
      await v2.page.goto(link);
      await v2.page
        .locator("[data-testid=ask-piece][data-item=coat]")
        .getByRole("button", { name: "This one" })
        .click();
      await expect(v2.page.getByTestId("thanks")).toBeVisible();
      await expect(
        v2.page
          .locator("[data-testid=ask-piece][data-item=vest]")
          .getByTestId("split-row"),
      ).toContainText("50%");

      // Back with Maya: the list card and the Sent screen show counts and no names.
      await page.goto("/lists");
      await expect(page.getByTestId("vote-line")).toHaveText("2 votes", {
        timeout: 20_000,
      });
      await expect(page.getByTestId("list-card")).toContainText(
        "shared with friends",
      );
      await shot(page, "lists-with-votes", size.name);
      await page.getByTestId("list-card").click();
      await page.getByTestId("see-votes").click();
      await expect(page).toHaveURL(/\/asks\/[^/]+$/);
      const rows = page.getByTestId("vote-row");
      await expect(rows).toHaveCount(2);
      await expect(
        page.locator("[data-testid=vote-row][data-item=vest]"),
      ).toHaveAttribute("data-count", "1");
      await expect(
        page.locator("[data-testid=vote-row][data-item=coat]"),
      ).toHaveAttribute("data-count", "1");
      await expect(page.getByTestId("vote-pct")).toHaveText(["50%", "50%"]);
      await expect(page.getByTestId("sent-sub")).toContainText("updates");
      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("example.com");
      expect(body).not.toContain("e-mail");
      expect(body).not.toContain("email");
      await shot(page, "sent-votes", size.name);
      expect(await serious(page)).toEqual([]);
      await noHScroll(page);

      // A signed-in friend opens the link: it appears in their Asks tab, unread.
      const b = await stranger(page, size);
      await passGate(b.page);
      const bEmail = await signInFromHeart(b.page, "coat", "Sam Rivera");
      await b.page.keyboard.press("Escape");
      await b.page.goto(link);
      await expect(b.page.getByTestId("vote-title")).toBeVisible();
      await expect(b.page.getByTestId("vote-button")).toHaveCount(2);
      await b.page.goto("/lists?tab=asks");
      await expect(b.page.getByTestId("asks-badge")).toHaveText("1");
      await expect(b.page.getByTestId("lists-dot").first()).toBeAttached();
      const askCard = b.page.getByTestId("ask-card");
      await expect(askCard).toHaveCount(1);
      await expect(askCard).toContainText("Maya is asking");
      await expect(askCard).toContainText("Which one for Saturday?");
      await expect(askCard).toHaveAttribute("data-unread", "true");
      await shot(b.page, "lists-asks", size.name);
      expect(await serious(b.page)).toEqual([]);
      await noHScroll(b.page);
      await askCard.click();
      await expect(b.page).toHaveURL(/\/asked\/[^/]+$/);
      const bVest = b.page.locator("[data-testid=ask-piece][data-item=vest]");
      await expect(bVest.locator("img")).toBeVisible();
      await expect(bVest.getByTestId("ai-caption")).toBeVisible();
      await shot(b.page, "ask-detail", size.name);
      expect(await serious(b.page)).toEqual([]);
      await bVest.getByRole("button", { name: "This one" }).click();
      await expect(b.page.getByTestId("asked-voted")).toContainText(
        "Sent. Maya can see it.",
      );
      await expect(bVest.getByTestId("split-row")).toContainText("Your pick");
      await shot(b.page, "ask-detail-voted", size.name);
      expect(await serious(b.page)).toEqual([]);
      await b.page.goto("/lists?tab=asks");
      await expect(b.page.getByTestId("asks-badge")).toHaveCount(0);
      await expect(b.page.getByTestId("ask-card")).toContainText(
        "You picked knit button vest",
      );
      expect(bEmail).toContain("@");

      // Maya sees 2 and 1, still with no names.
      await page.reload();
      await expect(
        page.locator("[data-testid=vote-row][data-item=vest]"),
      ).toHaveAttribute("data-count", "2", { timeout: 20_000 });
      expect((await page.locator("body").innerText()).includes("Sam")).toBe(
        false,
      );
      expect((await page.locator("body").innerText()).includes(bEmail)).toBe(
        false,
      );

      // Widths: nothing scrolls sideways on the new screens.
      for (const width of [360, 375, 430]) {
        for (const p of [page, v1.page, b.page]) {
          await p.setViewportSize({ width, height: 812 });
          await noHScroll(p);
        }
      }
      await page.setViewportSize({ width: size.width, height: size.height });

      // Revoke: the very next request from the voter's browser says no longer active.
      const imageUrl = new URL(
        `/api/ask/${link.split("/ask/")[1]}/image/vest`,
        BASE,
      ).toString();
      expect((await v1.ctx.request.get(imageUrl)).status()).toBe(200);
      await page.getByTestId("switch-off").click();
      await expect(page.getByTestId("toast")).toContainText(
        "Link switched off",
      );
      await expect(page.getByTestId("switched-off")).toBeVisible();
      const gone = await v1.page.goto(link);
      expect(gone!.status()).toBe(404);
      await expect(v1.page.getByTestId("closed")).toContainText(
        "This link is no longer active",
      );
      await expect(v1.page.locator("img")).toHaveCount(0);
      await shot(v1.page, "no-longer-active", size.name);
      expect(await serious(v1.page)).toEqual([]);
      expect((await v1.ctx.request.get(imageUrl)).status()).toBe(404);
      expect((await v2.ctx.request.get(imageUrl)).status()).toBe(404);
      // In the friend's Asks tab it reads as closed.
      await b.page.goto("/lists?tab=asks");
      await expect(b.page.getByTestId("ask-card")).toContainText("Closed");

      await v1.ctx.close();
      await v2.ctx.close();
      await b.ctx.close();
    });

    test("the vote page is open to everyone and nothing else is; an expired link is closed", async ({
      page,
    }) => {
      const gateless = await pwRequest.newContext({
        baseURL: BASE,
        maxRedirects: 0,
      });
      // The page and its API answer without the gate (404 here: this token is unknown).
      const token = "A".repeat(43);
      expect((await gateless.get(`/ask/${token}`)).status()).toBe(404);
      expect((await gateless.get(`/api/ask/${token}`)).status()).toBe(404);
      expect(
        (await gateless.get(`/api/ask/${token}/image/coat`)).status(),
      ).toBe(404);
      expect(
        (
          await gateless.post(`/api/ask/${token}/vote`, {
            data: { itemId: "coat" },
          })
        ).status(),
      ).toBe(404);
      for (const junk of ["x", "a".repeat(500)]) {
        expect((await gateless.get(`/ask/${junk}`)).status()).toBe(404);
        expect((await gateless.get(`/api/ask/${junk}`)).status()).toBe(404);
      }
      // Everything else is still behind the gate.
      for (const path of [
        "/",
        "/lists",
        "/asks",
        "/ask",
        "/asked/x",
        "/lists/x/share",
      ]) {
        const res = await gateless.get(path);
        expect([
          path,
          res.status(),
          new URL(res.headers()["location"] ?? "", BASE).pathname,
        ]).toEqual([path, 307, "/gate"]);
      }
      for (const path of [
        "/api/lists",
        "/api/asks",
        "/api/inbox",
        "/api/me",
        "/api/ask-anything",
        "/api/%61sk/x",
        "/%61sk/x",
      ]) {
        const res = await gateless.get(path);
        expect([path, [307, 401].includes(res.status())]).toEqual([path, true]);
      }
      expect((await gateless.get("/api/lists")).status()).toBe(401);
      expect(
        ((await (await gateless.get("/api/lists")).json()) as { error: string })
          .error,
      ).toBe("gate_required");

      // An expired link: a plain closed page, and no image.
      const seeded = "B".repeat(43);
      await seedAsk({
        id: "expiredask",
        token: seeded,
        uid: "someone",
        itemIds: ["coat", "vest"],
        expiresAt: new Date(Date.now() - 3_600_000),
      });
      const fresh = await stranger(page, size);
      const res = await fresh.page.goto(`/ask/${seeded}`);
      expect(res!.status()).toBe(404);
      await expect(fresh.page.getByTestId("closed")).toContainText(
        "This link is no longer active",
      );
      expect(
        (await fresh.ctx.request.get(`/api/ask/${seeded}/image/coat`)).status(),
      ).toBe(404);
      expect((await fresh.ctx.request.get(`/api/ask/${seeded}`)).status()).toBe(
        410,
      );
      // A live seeded one works, so the closed page is about expiry and not the seeding.
      const liveToken = "C".repeat(43);
      await seedAsk({
        id: "liveask",
        token: liveToken,
        uid: "someone",
        itemIds: ["coat", "vest"],
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      expect((await fresh.page.goto(`/ask/${liveToken}`))!.status()).toBe(200);
      await expect(fresh.page.getByTestId("ask-piece")).toHaveCount(2);
      await expect(fresh.page.getByTestId("ai-caption")).toHaveCount(0);
      await fresh.ctx.close();
      await gateless.dispose();
    });

    test("Share appears only where the browser can share, and shares the link", async ({
      page,
    }) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page);
      await page.goto("/");
      await heart(page, "vest").click();
      const sheet = listSheet(page);
      await sheet.getByTestId("new-list-name").fill("Work capsule");
      await sheet.getByRole("button", { name: "Create list and add" }).click();
      await expect(sheet.getByTestId("list-choice")).toHaveCount(1);
      await sheet.getByRole("button", { name: "Done" }).click();
      await page.goto("/lists");
      await page.getByTestId("list-card").click();
      await expect(page.getByTestId("ask-button")).toHaveText(
        "Ask friends about this one",
      );
      await page.getByTestId("ask-button").click();

      // Without the Web Share API: Copy link only.
      const bare = await page.context().newPage();
      await bare.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "share", {
          value: undefined,
          configurable: true,
        });
      });
      await bare.goto("/lists");
      await bare.getByTestId("list-card").click();
      await bare.getByTestId("ask-button").click();
      await bare.getByTestId("create-link").click();
      await expect(bare.getByTestId("copy-link")).toBeVisible();
      await expect(bare.getByTestId("share-link")).toHaveCount(0);
      await expect(
        bare.getByRole("button", { name: /whatsapp|messages/i }),
      ).toHaveCount(0);
      await bare.close();

      // With it: the button hands the link to the browser's share sheet.
      const sharing = await page.context().newPage();
      await sharing.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "share", {
          value: async (d: unknown) => {
            (window as unknown as { __shared: unknown }).__shared = d;
          },
          configurable: true,
        });
      });
      await sharing.goto("/lists");
      await sharing.getByTestId("list-card").click();
      await sharing.getByTestId("ask-button").click();
      await sharing.getByTestId("create-link").click();
      const link = await sharing.getByTestId("ask-link").inputValue();
      await sharing.getByTestId("share-link").click();
      await expect
        .poll(() =>
          sharing.evaluate(
            () =>
              (window as unknown as { __shared?: { url: string } }).__shared
                ?.url,
          ),
        )
        .toBe(link);
    });
  });
}
