// Phase G on the second dev server: ARRIVALS_BUFFER=on and EMAIL_TRANSPORT=log. The scheduled step
// is run once by script (the local stand-in for the Scheduler call), with the fake model. At
// 390x844 and 1440x900; PNGs go to runs/phase-g/ (git-ignored).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, listDocs, test, uploadFirst } from "./helpers";
import { SIZES, noHScroll, serious, settle } from "./e-helpers";
import { publishViaScript, runFollowLoopOnce } from "./g-helpers";

test.describe.configure({ timeout: 240_000 });

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-g",
);
mkdirSync(RUNS_DIR, { recursive: true });
async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: join(RUNS_DIR, `${name}.png`) });
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("a pre-rendered card arrives on the person, with the AI label beside it", async ({
      page,
    }) => {
      await uploadFirst(page);
      const piece = publishViaScript();
      const out = JSON.parse(runFollowLoopOnce());
      expect(out.arrivals).toMatchObject({ enabled: true, started: 1 });
      await page.goto("/");

      const shelf = page.getByTestId("arrivals");
      await expect(shelf).toHaveAttribute("data-mode", "on-you");
      await expect(
        shelf.getByRole("heading", { name: "Arrives on you" }),
      ).toBeVisible();
      const tile = shelf.locator(`[data-item="${piece.id}"]`);
      await expect(tile).toHaveAttribute("data-on-you", "true");
      await expect(tile.getByTestId("arrival-chip")).toHaveText("On you");
      // The label sits beside the render, never in its pixels.
      await expect(tile.getByTestId("arrival-ai")).toHaveText(
        "AI-generated preview",
      );
      await expect(
        tile.getByRole("img", { name: /on your photo, front view/ }),
      ).toBeVisible();
      await noHScroll(page);
      expect(await serious(page)).toEqual([]);
      await shot(page, `arrives-on-you-${size.name}`);

      // Being on screen marks the card seen, which is what lets the next batch start.
      await expect
        .poll(async () => JSON.stringify(await listDocs("arrivals")), {
          timeout: 15_000,
        })
        .toMatch(/"seenAt":\s*\{\s*"timestampValue"/);

      // Asking for the full set is an ordinary try-on: the usual sheet, then four poses.
      await tile.getByRole("button", { name: "Try it on" }).click();
      await expect(
        page.getByRole("dialog", { name: "Which photo?" }),
      ).toBeVisible();
    });

    test("a render that failed is not shown, and nothing says so", async ({
      page,
    }) => {
      await uploadFirst(page);
      const piece = publishViaScript();
      // The model refuses the Front pose: the card never appears.
      const { setScript } = await import("./helpers");
      setScript([{ pose: "front", outcome: "blocked" }]);
      runFollowLoopOnce();
      setScript([]);
      await page.goto("/");
      const shelf = page.getByTestId("arrivals");
      await expect(shelf).toHaveAttribute("data-mode", "label");
      await expect(
        shelf.locator(`[data-item="${piece.id}"]`),
      ).not.toHaveAttribute("data-on-you", "true");
      // (Next's own route announcer is outside <main>.)
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });

    test("with email available, You offers the two switches and they stick", async ({
      page,
    }) => {
      await uploadFirst(page);
      await page.goto("/you");
      const prefs = page.getByTestId("email-prefs");
      await expect(prefs).toBeVisible();
      const news = page.getByTestId("email-news");
      await expect(news).toHaveAttribute("aria-checked", "false");
      await news.click();
      await expect(news).toHaveAttribute("aria-checked", "true");
      await page.reload();
      await expect(page.getByTestId("email-news")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page.getByTestId("email-price")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(await serious(page)).toEqual([]);
      await shot(page, `you-email-${size.name}`);
    });
  });
}
