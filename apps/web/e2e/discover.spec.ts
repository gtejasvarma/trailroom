// Phase A: the first screens, on a phone and on a desktop. Each describe block runs the same
// checks at both sizes.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { card, expect, listDocs, PHOTO, test, waitForResult } from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-a",
);
mkdirSync(RUNS_DIR, { recursive: true });
// Hides the Next.js dev-mode indicator from screenshots.
const HIDE_DEV_BADGE = "nextjs-portal { display: none !important; }";

/** Fonts loaded and every image decoded, so a screenshot is the finished screen. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Entry animations finished: a screenshot or contrast check mid-motion is a flaky one.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    ),
  );
  // Images on screen: lazy ones below the fold, and the hidden twin of a responsive pair,
  // are rightly not loaded.
  await page.waitForFunction(() =>
    [...document.images].every((i) => {
      const r = i.getBoundingClientRect();
      const onScreen =
        r.width > 0 &&
        r.height > 0 &&
        r.top < innerHeight &&
        r.bottom > 0 &&
        r.left < innerWidth &&
        r.right > 0;
      return !onScreen || (i.complete && i.naturalWidth > 0);
    }),
  );
}

async function serious(page: Page) {
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

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const phone = size.name === "phone";

    test("Discover shows the proof slider to a new visitor, and it moves with the keyboard", async ({
      page,
    }) => {
      await page.goto("/");
      const proof = page.getByTestId("proof");
      await expect(proof).toBeVisible();
      await expect(proof).toContainText(
        "Maya uploaded one photo. Now every piece here comes back on her body, in four poses.",
      );
      await expect(proof.getByText("On her photo")).toBeVisible();
      await expect(
        proof.getByText(phone ? "Model shot" : "Label’s photo"),
      ).toBeVisible();
      const range = page.getByTestId("proof-range");
      await expect(range).toHaveValue("52");
      await range.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(range).toHaveValue("54");
      await page.keyboard.press("ArrowLeft");
      await expect(range).toHaveValue("53");
      await expect(
        proof.getByRole("link", { name: "Upload your picture" }),
      ).toHaveAttribute("href", "/upload");
    });

    test("the category filter changes the cards", async ({ page }) => {
      await page.goto("/");
      const cards = page.getByTestId("item-card");
      await expect(cards).toHaveCount(12);
      await page.getByRole("button", { name: "Jewellery" }).click();
      await expect(cards).toHaveCount(2);
      await expect(card(page, "Sculpted hoops")).toBeVisible();
      await page.getByRole("button", { name: "Accessories" }).click();
      await expect(cards).toHaveCount(0);
      await expect(page.getByText("Nothing here yet.")).toBeVisible();
      await page.getByRole("button", { name: "Apparel" }).click();
      await expect(cards).toHaveCount(10);
      if (!phone) {
        await page.getByRole("button", { name: "Everything" }).click();
        await expect(cards).toHaveCount(12);
      }
    });

    test("a card's photos advance and the count chip is right", async ({
      page,
    }) => {
      await page.goto("/");
      const jump = page.locator("article[data-item=jump]");
      await expect(jump.getByTestId("count-chip")).toHaveText("↔ 4 photos");
      await expect(jump.getByTestId("state-chip")).toHaveText("Model shot");
      await expect(jump.getByTestId("dot")).toHaveCount(4);
      const active = jump.locator("[data-testid=dot][data-active=true]");
      await expect(active).toHaveCount(1);
      if (phone) {
        await jump
          .getByTestId("frames")
          .evaluate((el) => el.scrollTo({ left: el.clientWidth * 2 }));
      } else {
        await jump.hover();
        await jump.getByRole("button", { name: "Next photo" }).click();
        await jump.getByRole("button", { name: "Next photo" }).click();
      }
      await expect(jump.locator("[data-testid=dot]").nth(2)).toHaveAttribute(
        "data-active",
        "true",
      );
      const coat = page.locator("article[data-item=coat]");
      await expect(coat.getByTestId("count-chip")).toHaveText("↔ 1 photo");
      await expect(coat.getByTestId("dot")).toHaveCount(0);
    });

    test("no heading or description sits above the grid, and the filters still work", async ({
      page,
    }) => {
      await page.goto("/");
      const main = page.getByRole("main");
      for (const text of [
        "Every piece from every label we carry",
        "Coats, dresses and tailoring from independent labels",
      ])
        await expect(main.getByText(text)).toHaveCount(0);
      // The only visible heading before the grid belongs to the proof slider or the start row.
      const visibleH1 = await main
        .getByRole("heading", { level: 1 })
        .evaluateAll(
          (els) =>
            els.filter((e) => e.getBoundingClientRect().width > 2).length,
        );
      expect(visibleH1).toBe(0);
      await expect(page.getByTestId("item-card")).toHaveCount(12);
      if (phone) {
        await page.getByRole("button", { name: "Jewellery" }).click();
        await expect(page.getByTestId("item-card")).toHaveCount(2);
        await expect(main.getByText("Earrings and necklaces")).toHaveCount(0);
      } else {
        await page.getByRole("button", { name: "Jewellery" }).click();
        await expect(page.getByTestId("item-card")).toHaveCount(2);
        await expect(
          main.getByText("Trying jewellery on is not built"),
        ).toHaveCount(0);
      }
    });

    test("listing cards have no Follow control and start with the image; product and label pages still follow", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.getByTestId("item-card")).toHaveCount(12);
      await expect(
        page.getByTestId("item-card").getByRole("button", { name: /Follow/ }),
      ).toHaveCount(0);
      const jump = page.locator("article[data-item=jump]");
      // The first thing in the card is the image frames; the label name is plain text below.
      expect(
        await jump.evaluate(
          (el) => (el.firstElementChild as HTMLElement).dataset.testid,
        ),
      ).toBe("frames-wrap");
      await expect(jump.getByTestId("card-label")).toHaveText("MARCHAND");
      expect(
        await jump
          .getByTestId("card-label")
          .evaluate((el) => el.querySelectorAll("a,button,img").length),
      ).toBe(0);
      const imgBox = await jump.getByTestId("frames").boundingBox();
      const labelBox = await jump.getByTestId("card-label").boundingBox();
      expect(labelBox!.y).toBeGreaterThan(imgBox!.y + imgBox!.height - 1);

      // Follow lives on the product page and persists.
      await page.goto("/item/jump");
      await page.getByRole("button", { name: "Follow MARCHAND" }).click();
      await expect(page.getByTestId("toast")).toHaveText("Following MARCHAND.");
      expect(await listDocs("follows")).toHaveLength(1);
      await page.reload();
      await expect(
        page.getByRole("button", { name: /^Following MARCHAND/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Following MARCHAND/ }).click();
      await expect(page.getByTestId("toast")).toHaveText(
        "Unfollowed MARCHAND.",
      );
    });

    test("navigation: tab bar on a phone, top navigation on a desktop", async ({
      page,
    }) => {
      await page.goto("/");
      if (phone) {
        const tabs = page.getByRole("navigation", { name: "Sections" });
        await expect(tabs).toBeVisible();
        await expect(
          tabs.getByRole("link", { name: "Discover" }),
        ).toHaveAttribute("aria-current", "page");
        await tabs.getByRole("link", { name: "Lists" }).click();
        await expect(page).toHaveURL(/\/lists$/);
        await expect(
          page.getByRole("heading", { name: "Lists", level: 1 }),
        ).toBeVisible();
        await tabs.getByRole("link", { name: "You" }).click();
        await expect(page).toHaveURL(/\/you$/);
        await tabs.getByRole("link", { name: "Discover" }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(
          page.getByRole("navigation", { name: "Main" }),
        ).toBeHidden();
      } else {
        await expect(
          page.getByRole("navigation", { name: "Sections" }),
        ).toBeHidden();
        const nav = page.getByRole("navigation", { name: "Main" });
        await expect(
          nav.getByRole("link", { name: "Discover" }),
        ).toHaveAttribute("aria-current", "page");
        await nav.getByRole("link", { name: "Lists" }).click();
        await expect(page).toHaveURL(/\/lists$/);
        await nav.getByRole("link", { name: "Your try-ons" }).click();
        await expect(page).toHaveURL(/\/you\/try-ons$/);
        await nav.getByRole("link", { name: "Discover" }).click();
        await expect(page).toHaveURL(/\/$/);
        await nav.getByRole("button", { name: "Sign in" }).click();
        await expect(
          page.getByRole("dialog", { name: "Create an account" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });

    test("for a guest, Add to a list and Buy ask for an account; New list is an interim toast", async ({
      page,
    }) => {
      await page.goto("/item/jump");
      await page.getByRole("button", { name: "Add to a list" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Create an account to save",
      });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: "Buy $268" }).click();
      await expect(
        page.getByRole("dialog", { name: "Create an account to buy" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.goto("/lists");
      await page.getByRole("button", { name: "New list" }).first().click();
      await expect(
        page.getByRole("dialog", { name: "Create an account to save" }),
      ).toBeVisible();
    });

    test("the product page shows gallery, price, stock, description and More from", async ({
      page,
    }) => {
      await page.goto("/item/jump");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Chambray wide-leg jumpsuit",
        }),
      ).toBeVisible();
      await expect(page.getByText("$268").first()).toBeVisible();
      await expect(page.getByTestId("stock")).toHaveText("Only 2 left");
      await expect(page.getByTestId("stock")).toHaveClass(/text-danger/);
      await expect(page.getByTestId("description")).toContainText(
        "Washed chambray",
      );
      const gallery = page.getByTestId("gallery");
      if (phone) {
        await expect(gallery.getByTestId("count-chip")).toHaveText(
          "↔ 4 photos",
        );
      } else {
        await expect(
          gallery.getByRole("button", { name: /^Show photo/ }),
        ).toHaveCount(4);
        await gallery.getByRole("button", { name: "Next photo" }).click();
        await expect(gallery.getByText("2 / 4")).toBeVisible();
      }
      await expect(
        page.getByRole("heading", { name: "More from MARCHAND" }),
      ).toBeVisible();
      const more = page.getByTestId("more-from").getByTestId("piece-tile");
      await expect(more).toHaveCount(4);
      await more.first().click();
      await expect(page).toHaveURL(/\/item\/(vest|slip|blouse|jacket)$/);
    });

    test("the label page lists its pieces", async ({ page }) => {
      await page.goto("/label/marchand");
      await expect(
        page.getByRole("heading", { level: 1, name: "MARCHAND" }),
      ).toBeVisible();
      await expect(page.getByText("Independent · Paris")).toBeVisible();
      const tiles = page.getByTestId("label-grid").getByTestId("piece-tile");
      await expect(tiles).toHaveCount(5);
      await expect(
        page.getByTestId("label-grid").getByText("Pink wrap top"),
      ).toBeVisible();
      await page.getByRole("button", { name: "Follow MARCHAND" }).click();
      await expect(page.getByTestId("toast")).toHaveText("Following MARCHAND.");
      await page.getByRole("button", { name: /^Following MARCHAND/ }).click();
      await expect(page.getByTestId("toast")).toHaveText(
        "Unfollowed MARCHAND.",
      );
      await page.goto("/label/nobody");
      await expect(
        page.getByText("This page could not be found"),
      ).toBeVisible();
    });

    test("Try it on from a product completes the flow with the fake renderer (a .webp render image)", async ({
      page,
    }) => {
      await page.goto("/item/blouse");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(page).toHaveURL(/\/item\/blouse\/photo$/);
      await page.locator("input[type=file]").setInputFiles(PHOTO);
      await page.getByRole("button", { name: "Use this photo" }).click();
      await expect(page).toHaveURL(/\/try-on\//);
      await waitForResult(page);
      await expect(page.locator("img[data-render]")).toHaveCount(4);
    });

    test("the jacket is an honest failure with three alternatives and no upload", async ({
      page,
    }) => {
      const calls: string[] = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (/\/api\/(photo|photos|try-on)/.test(u.pathname))
          calls.push(u.pathname);
      });
      await page.goto("/item/jacket");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(page).toHaveURL(/\/item\/jacket\/unavailable$/);
      const screen = page.getByTestId("honest-failure");
      await expect(screen).toHaveAttribute("data-try-on", "cannot");
      await expect(screen).toContainText("folded over an arm");
      await expect(
        screen.getByTestId("closest").getByRole("button"),
      ).toHaveCount(3);
      await expect(page.locator("input[type=file]")).toHaveCount(0);
      expect(calls).toEqual([]);
    });

    test("hoops lead to the not-yet state, with apparel alternatives", async ({
      page,
    }) => {
      await page.goto("/item/hoops");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(page).toHaveURL(/\/item\/hoops\/unavailable$/);
      const screen = page.getByTestId("honest-failure");
      await expect(screen).toHaveAttribute("data-try-on", "not_yet");
      await expect(
        screen.getByRole("heading", { name: "Not yet for jewellery" }),
      ).toBeVisible();
      await expect(screen).toContainText("jewellery");
      await expect(
        screen.getByTestId("closest").getByRole("button"),
      ).toHaveCount(3);
      await expect(page.locator("input[type=file]")).toHaveCount(0);
    });

    test("axe: Discover, product, label and Lists have no serious or critical violations", async ({
      page,
    }) => {
      for (const path of ["/", "/item/jump", "/label/marchand", "/lists"]) {
        await page.goto(path);
        await settle(page);
        expect(await serious(page), path).toEqual([]);
      }
    });

    test("screenshots: Discover (new visitor), a product page and a label page", async ({
      page,
    }) => {
      const shots: [string, string][] = [
        ["discover", "/"],
        ["product", "/item/jump"],
        ["label", "/label/marchand"],
      ];
      for (const [name, path] of shots) {
        await page.goto(path);
        await page.addStyleTag({ content: HIDE_DEV_BADGE });
        if (name === "discover")
          await expect(page.getByTestId("proof")).toBeVisible();
        await settle(page);
        await page.screenshot({
          path: join(RUNS_DIR, `${name}-${size.name}.png`),
        });
        await expect(page).toHaveScreenshot(`${name}-${size.name}.png`);
      }
    });
  });
}
