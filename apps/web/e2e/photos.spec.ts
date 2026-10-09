// Phase B: photos and capture, on a phone and on a desktop. Adding a photo is the consent: one
// line of text sits under every upload control, there is no tick and no consent route.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  card,
  confirmWhichPhoto,
  continueWithGoogle,
  expect,
  PHOTO,
  pickThreeLabels,
  test,
  uploadFirst,
  waitForResult,
} from "./helpers";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const RUNS_DIR = join(
  fileURLToPath(import.meta.url),
  "../../../../runs/phase-b",
);
mkdirSync(RUNS_DIR, { recursive: true });
const HIDE_DEV_BADGE = "nextjs-portal { display: none !important; }";
const LINE =
  "By adding a photo you confirm you’re 18 or over and agree to it being used to make your try-ons.";

async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
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

/** Records every camera stream the page opens, so a test can see whether its tracks were stopped. */
const TRACK_SPY = () => {
  const w = window as unknown as { __streams: MediaStream[] };
  w.__streams = [];
  const md = navigator.mediaDevices;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    const s = await orig(c);
    w.__streams.push(s);
    return s;
  };
};
const liveTracks = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __streams: MediaStream[] }).__streams.flatMap(
        (s) => s.getTracks().filter((t) => t.readyState === "live"),
      ).length,
  );

async function uploadSecond(page: Page) {
  await page.goto("/upload");
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/upload\/done$/);
}

test("there is no consent tick and no consent route", async ({ page }) => {
  for (const path of ["/upload", "/item/vest/photo"]) {
    await page.goto(path);
    await expect(page.locator("input[type=checkbox]")).toHaveCount(0);
  }
  const res = await page.goto("/item/vest/consent");
  expect(res?.status()).toBe(404);
  const missing = await page.goto("/item/x/consent");
  expect(missing?.status()).toBe(404);
});

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const phone = size.name === "phone";

    test("the consent line sits directly under the upload controls, and the camera view has it too", async ({
      page,
    }) => {
      for (const path of ["/upload", "/item/vest/photo"]) {
        await page.goto(path);
        const line = page.getByTestId("consent-line");
        await expect(line).toBeVisible();
        await expect(line).toContainText(LINE);
        await expect(
          line.getByRole("button", { name: "Details" }),
        ).toBeVisible();
        // Adjacent: the line is below the visible controls and nothing else sits between them.
        const control = page.getByRole("button", {
          name: phone ? "Browse all photos" : "Browse files",
        });
        const c = await control.boundingBox();
        const l = await line.boundingBox();
        expect(l!.y).toBeGreaterThan(c!.y + c!.height);
        expect(l!.y - (c!.y + c!.height)).toBeLessThan(170);
      }
      await page.getByRole("button", { name: "or take one now" }).click();
      const cam = page.getByTestId("camera");
      await expect(cam.getByTestId("consent-line")).toContainText(LINE);
      await expect(cam.getByTestId("consent-line")).toBeVisible();
    });

    test("upload first: preview, Use this photo, starters, and a try-on that completes", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .getByTestId("proof")
        .getByRole("link", { name: "Upload your picture" })
        .click();
      await expect(page).toHaveURL(/\/upload$/);
      await expect(
        page.getByRole("heading", { name: "Upload your picture" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "One photo, then everything in Trailroom can be seen on you.",
        ),
      ).toBeVisible();
      await page.locator("input[type=file]").setInputFiles(PHOTO);
      await expect(page.getByTestId("photo-preview")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Choose another" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Use this photo" }).click();
      // A guest is asked for an account first, then picks three labels, then the starters.
      await expect(page.getByRole("dialog")).toBeVisible();
      await continueWithGoogle(page);
      await pickThreeLabels(page);
      await expect(
        page.getByRole("heading", { name: "Your photo is in" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Pick anything below and it comes back on you, in four poses.",
        ),
      ).toBeVisible();
      await expect(page.getByTestId("starter")).toHaveCount(4);
      await expect(
        page.getByRole("link", { name: "Browse everything instead" }),
      ).toBeVisible();
      await page.getByTestId("starter").first().click();
      await expect(page).toHaveURL(/\/try-on\//);
      await waitForResult(page);
    });

    test("try-on first with no photo: the upload screen for that piece, then straight into the queue", async ({
      page,
    }) => {
      await page.goto("/item/vest");
      await expect(async () => {
        await page.getByRole("button", { name: "Try it on" }).click();
        await expect(page).toHaveURL(/\/photo$/, { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(
        page.getByText(
          "One photo and the knit button vest comes straight back on you.",
        ),
      ).toBeVisible();
      await page.locator("input[type=file]").setInputFiles(PHOTO);
      await page.getByRole("button", { name: "Use this photo" }).click();
      await expect(page).toHaveURL(/\/try-on\//);
      await waitForResult(page);
    });

    test("try-on first with a photo: the Which photo sheet, then Use a different photo, library, pick, try-on", async ({
      page,
    }) => {
      await uploadFirst(page);
      await uploadSecond(page);
      await page.goto("/item/vest");
      await page.getByRole("button", { name: "Try it on" }).click();
      const sheet = page.getByRole("dialog", { name: "Which photo?" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText("DEFAULT", { exact: true })).toBeVisible();
      await expect(
        sheet.getByText("Try on the knit button vest"),
      ).toBeVisible();
      await sheet
        .getByRole("button", { name: "Use a different photo" })
        .click();
      await expect(page).toHaveURL(/\/item\/vest\/photos$/);
      await expect(
        page.getByRole("heading", { name: "Which photo?" }),
      ).toBeVisible();
      const photos = page.getByTestId("library-photo");
      await expect(photos).toHaveCount(2);
      await expect(page.getByText("DEFAULT", { exact: true })).toHaveCount(1);
      await expect(
        page.getByRole("link", { name: "+ Add a photo" }),
      ).toBeVisible();
      // The second photo is not the default: using it renders it anew.
      await photos.nth(1).click();
      await expect(page).toHaveURL(/\/try-on\//);
      await waitForResult(page);
    });

    test("the sheet's confirm starts the try-on with the default photo", async ({
      page,
    }) => {
      await uploadFirst(page);
      await page.goto("/");
      await card(page, "Knit button vest")
        .getByRole("button", { name: "Try it on" })
        .click();
      await confirmWhichPhoto(page);
      await waitForResult(page);
    });

    test("the Details sheet opens, traps focus and closes with Escape", async ({
      page,
    }) => {
      await page.goto("/upload");
      await page.getByRole("button", { name: "Details" }).click();
      const sheet = page.getByRole("dialog", { name: "Your photos" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("private to you");
      await expect(sheet).toContainText("about 48 hours");
      await expect(sheet).toContainText("not used to train models");
      await expect(sheet).toContainText("18 and over");
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(
          () => !!document.activeElement?.closest("dialog"),
        );
        expect(inside).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
    });

    test("axe: upload, starters, library, the sheets and the camera view", async ({
      page,
    }) => {
      await page.goto("/upload");
      expect(await serious(page), "upload").toEqual([]);
      await page.getByRole("button", { name: "Details" }).click();
      await expect(
        page.getByRole("dialog", { name: "Your photos" }),
      ).toBeVisible();
      await settle(page);
      expect(await serious(page), "details").toEqual([]);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "or take one now" }).click();
      await expect(page.getByTestId("camera-frame")).toBeVisible();
      expect(await serious(page), "camera").toEqual([]);
      await page.getByRole("button", { name: "Cancel" }).click();
      await uploadFirst(page);
      await settle(page);
      expect(await serious(page), "starters").toEqual([]);
      await page.goto("/item/vest/photos");
      await expect(page.getByTestId("library-photo")).toHaveCount(1);
      expect(await serious(page), "library").toEqual([]);
      await page.goto("/item/vest");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(
        page.getByRole("dialog", { name: "Which photo?" }),
      ).toBeVisible();
      await settle(page);
      expect(await serious(page), "which photo").toEqual([]);
    });

    test("no horizontal scroll on the new screens", async ({ page }) => {
      for (const path of ["/upload", "/item/vest/photo"]) {
        await page.goto(path);
        const w = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.clientWidth,
        ]);
        expect(w[0]).toBeLessThanOrEqual(w[1]!);
      }
    });

    test("screenshots: upload, starters and the Which photo sheet; review PNGs", async ({
      page,
    }) => {
      const shot = async (name: string) => {
        await settle(page);
        await page.screenshot({
          path: join(RUNS_DIR, `${name}-${size.name}.png`),
        });
      };
      await page.goto("/");
      await expect(page.getByTestId("proof")).toBeVisible();
      await shot("discover");
      await card(page, "Chambray wide-leg jumpsuit").scrollIntoViewIfNeeded();
      await settle(page);
      await card(page, "Chambray wide-leg jumpsuit").screenshot({
        path: join(RUNS_DIR, `listing-card-${size.name}.png`),
      });
      await page.goto("/item/jump");
      await shot("product");
      await page.goto("/upload");
      await shot(phone ? "upload" : "capture");
      await expect(page).toHaveScreenshot(`upload-${size.name}.png`);
      await page.getByRole("button", { name: "Details" }).click();
      await expect(
        page.getByRole("dialog", { name: "Your photos" }),
      ).toBeVisible();
      await shot("details-sheet");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "or take one now" }).click();
      await expect(page.getByTestId("camera-frame")).toBeVisible();
      await page.waitForTimeout(600);
      await shot("camera");
      await page.getByRole("button", { name: "Cancel" }).click();

      await uploadFirst(page);
      await shot("starters");
      await expect(page).toHaveScreenshot(`starters-${size.name}.png`);
      await page.goto("/item/vest");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(
        page.getByRole("dialog", { name: "Which photo?" }),
      ).toBeVisible();
      await page.waitForTimeout(400);
      await shot("which-photo-sheet");
      await expect(page).toHaveScreenshot(`which-photo-${size.name}.png`);
      await page.keyboard.press("Escape");
      await page.goto("/item/vest/photos");
      await expect(page.getByTestId("library-photo")).toHaveCount(1);
      await shot("library");
      await page.goto("/you");
      await page.getByRole("button", { name: "Manage" }).click();
      await expect(page.getByTestId("manage-photo")).toHaveCount(1);
      await shot("you-photos");
    });
  });
}

test.describe("camera", () => {
  test("open, capture, a real outcome, and every track is stopped after closing", async ({
    page,
  }) => {
    await page.addInitScript(TRACK_SPY);
    await page.goto("/upload");
    await page.getByRole("button", { name: "or take one now" }).click();
    const cam = page.getByTestId("camera");
    await expect(page.getByTestId("camera-frame")).toBeVisible();
    await expect(cam).toContainText(
      "Full body in frame, even light, one person.",
    );
    // Nothing is faked: no automatic-capture cues.
    await expect(cam).not.toContainText("Step back");
    await expect(cam).not.toContainText("Hold it");
    expect(await liveTracks(page)).toBeGreaterThan(0);
    const take = cam.getByRole("button", { name: "Take photo" });
    await expect(take).toBeEnabled();
    await take.click();
    // The camera closes; the capture went through the same check: a preview, or a real reason.
    await expect(cam).toBeHidden();
    await expect(
      page.getByTestId("photo-preview").or(page.getByTestId("photo-error")),
    ).toBeVisible();
    expect(await liveTracks(page)).toBe(0);
    if (await page.getByTestId("photo-preview").isVisible()) {
      await page.getByRole("button", { name: "Use this photo" }).click();
      // A guest is asked for an account before the starters.
      await expect(
        page.getByRole("dialog", { name: /create an account/ }),
      ).toBeVisible();
    } else {
      await expect(page.getByTestId("photo-error")).toContainText(
        /768 pixels|too wide or too tall/,
      );
    }
  });

  test("closing with Cancel or Escape stops the tracks", async ({ page }) => {
    await page.addInitScript(TRACK_SPY);
    await page.goto("/upload");
    for (const close of ["button", "escape"]) {
      await page.getByRole("button", { name: "or take one now" }).click();
      await expect(page.getByTestId("camera-frame")).toBeVisible();
      expect(await liveTracks(page)).toBeGreaterThan(0);
      if (close === "button")
        await page.getByRole("button", { name: "Cancel" }).click();
      else await page.keyboard.press("Escape");
      await expect(page.getByTestId("camera")).toBeHidden();
      expect(await liveTracks(page)).toBe(0);
    }
  });

  test("permission denied: a plain message, and the picker still works", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.goto("/upload");
    await page.getByRole("button", { name: "or take one now" }).click();
    await expect(page.getByTestId("camera-error")).toContainText(
      "We could not open your camera",
    );
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose a photo instead" }).click();
    await (await chooser).setFiles(PHOTO);
    await expect(page.getByTestId("photo-preview")).toBeVisible();
  });

  test("no camera at all: the same plain fallback", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("none", "NotFoundError"));
    });
    await page.goto("/upload");
    await page.getByRole("button", { name: "or take one now" }).click();
    await expect(page.getByTestId("camera-error")).toContainText(
      "No camera is available",
    );
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("input[type=file]")).toBeAttached();
  });
});

test.describe("You: photos", () => {
  test("add, make default, remove; the consent line sits by the add control", async ({
    page,
  }) => {
    await uploadFirst(page);
    await page.goto("/you");
    await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByTestId("manage-photo")).toHaveCount(1);
    await page.getByRole("button", { name: "+ Add" }).click();
    await expect(page.getByTestId("consent-line")).toContainText(LINE);
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await page.getByRole("button", { name: "Use this photo" }).click();
    await expect(page.getByTestId("manage-photo")).toHaveCount(2);
    await expect(page.getByTestId("photo-count")).toHaveText("2 photos");

    const second = page.getByTestId("manage-photo").nth(1);
    await second.getByRole("button", { name: /Make .* the default/ }).click();
    await expect(
      page.getByTestId("manage-photo").nth(1).getByText("Default"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("manage-photo")
        .nth(0)
        .getByRole("button", {
          name: /Make .* the default/,
        }),
    ).toBeVisible();

    // Removing the default promotes the other.
    await page
      .getByTestId("manage-photo")
      .nth(1)
      .getByRole("button", { name: /^Remove/ })
      .click();
    await expect(page.getByTestId("manage-photo")).toHaveCount(1);
    await expect(
      page.getByTestId("manage-photo").first().getByText("Default"),
    ).toBeVisible();
    await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
  });
});
