// Review screenshots of the mirror, into runs/mirror/ (git-ignored). Not assertions. A finished
// try-on is seeded with the real renders from runs/hero-proof/ (the pink wrap top on the fictional
// test person) in place of the fake renderer's test pattern: test-only, emulators only.
// SHOTS_DIR names the folder (the second pass writes to runs/mirror-pass2).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { FAKE_SCRIPT_FILE } from "../playwright.config";
import { NAME } from "./e-helpers";
import {
  expect,
  listDocs,
  realReveal,
  test,
  tryOnFromScratch,
} from "./helpers";

const ROOT = join(fileURLToPath(import.meta.url), "../../../..");
const OUT = process.env.SHOTS_DIR ?? "mirror";
const DIR = join(ROOT, "runs", OUT);
mkdirSync(DIR, { recursive: true });

const SIZES = [
  { name: "phone", width: 390, height: 844, step: 64 },
  { name: "desktop", width: 1440, height: 900, step: 90 },
] as const;

async function shot(page: Page, name: string, size: string, full = false) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(DIR, `${name}-${size}.png`),
    fullPage: full,
  });
}

/** The newest pose set's owner and id, read from the emulator. */
async function newestPoseSet() {
  const docs = (await listDocs("poseSets")) as {
    name: string;
    fields: { uid: { stringValue: string } };
  }[];
  const d = docs.at(-1)!;
  return {
    poseSetId: d.name.split("/").at(-1)!,
    uid: d.fields.uid.stringValue,
  };
}

function seedReal(uid: string, poseSetId: string) {
  execFileSync("npx", ["tsx", "scripts/seed-real-renders.ts", uid, poseSetId], {
    cwd: ROOT,
    env: {
      ...process.env,
      GOOGLE_CLOUD_PROJECT: "demo-trailroom",
      RENDER_PROVIDER: "fake",
      RENDER_FAKE_SCRIPT_FILE: FAKE_SCRIPT_FILE,
      FIRESTORE_EMULATOR_HOST:
        process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST:
        process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST:
        process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199",
    },
    encoding: "utf8",
  });
}

test.skip(
  !existsSync(join(ROOT, "runs", "hero-proof", "blouse-on-s01.png")),
  "needs the real renders in runs/hero-proof/ (git-ignored)",
);

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("shots", async ({ page }) => {
      test.setTimeout(240_000);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: async () => {} },
        });
      });
      await tryOnFromScratch(page, "Pink wrap top", { name: NAME });
      await expect(page.getByTestId("pose-gallery")).toBeVisible({
        timeout: 40_000,
      });
      const { uid, poseSetId } = await newestPoseSet();
      seedReal(uid, poseSetId);

      // The arrival, with the real renders: reload with the arrival switched on.
      await realReveal(page);
      await page.reload();
      await expect(page.getByTestId("mirror-stage")).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(350);
      await shot(page, "1-arrival-focus", size.name);
      await page.waitForTimeout(2_700);
      await shot(page, "2-arrival-turning", size.name);
      await expect(page.getByTestId("mirror-stage")).toHaveAttribute(
        "data-stage",
        "done",
        { timeout: 15_000 },
      );
      await page.waitForTimeout(500);
      await shot(page, "3-mirror", size.name);

      // Mid-drag: held past a step and a half.
      const surface = page.getByTestId("pose-surface");
      const b = (await surface.boundingBox())!;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - size.step * 0.8, y, { steps: 8 });
      await page.waitForTimeout(150);
      await shot(page, "4-mid-drag", size.name);
      await page.mouse.up();
      await page.waitForTimeout(600);
      await shot(page, "5-turned", size.name);
      await page.getByTestId("pose-thumb").first().click();
      await page.waitForTimeout(400);

      // Holding: the label's own photograph.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await expect(page.getByTestId("label-photo")).toBeVisible();
      await page.waitForTimeout(250);
      await shot(page, "6-holding", size.name);
      await page.mouse.up();
      await page.waitForTimeout(300);

      // The toasts.
      await page.getByTestId("choice-love").click();
      await expect(page.getByTestId("toast")).toBeVisible();
      await page.waitForTimeout(350);
      await shot(page, "7-toast-love", size.name);
      await page.getByTestId("choice-ask").click();
      await expect(page.getByTestId("toast")).toContainText("Link copied");
      await page.waitForTimeout(350);
      await shot(page, "8-toast-ask", size.name);
      await page.getByTestId("choice-not-for-me").click();
      await expect(page.getByTestId("toast")).toContainText("Removed");
      await page.waitForTimeout(120);
      await shot(page, "9-not-for-me-dropping", size.name);
      await page.waitForTimeout(500);
      await shot(page, "10-not-for-me-toast", size.name);
      await page
        .getByTestId("toast")
        .getByRole("button", { name: "Undo" })
        .click();
      await page.waitForTimeout(500);

      // The details.
      await shot(page, "11-details-full", size.name, true);
      await page.getByTestId("label-toggle").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot(page, "12-details", size.name);
    });
  });
}
