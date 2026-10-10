import type { Page } from "@playwright/test";
import {
  confirmWhichPhoto,
  continueWithGoogle,
  dismissSheet,
  expect,
  setScript,
  settle,
  uploadFirst,
  uploadFirstAsGuest,
  tryOnFromScratch,
  waitForGuestReady,
  waitForResult,
} from "./helpers";

/** Every screen, with the steps to reach it and the primary action a keyboard user needs. */
export interface Screen {
  name: string;
  go: (page: Page) => Promise<void>;
  /** CSS for the element that is the screen's primary action. */
  primary: string;
}

export const SCREENS: Screen[] = [
  {
    name: "discover",
    go: async (page) => {
      await page.goto("/");
      await expect(page.getByTestId("item-card")).toHaveCount(12);
      await expect(page.getByTestId("proof")).toBeVisible();
    },
    primary: 'article[data-item=jump] button:has-text("Try it on")',
  },
  {
    name: "product",
    go: async (page) => {
      await page.goto("/item/jump");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: 'main button:has-text("Try it on")',
  },
  {
    name: "label",
    go: async (page) => {
      await page.goto("/label/marchand");
      await expect(page.getByTestId("label-grid")).toBeVisible();
    },
    primary: "main button",
  },
  {
    name: "lists",
    go: async (page) => {
      await page.goto("/lists");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "main button",
  },
  {
    name: "upload",
    go: async (page) => {
      await page.goto("/upload");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "main button:visible",
  },
  {
    name: "photo for a piece",
    go: async (page) => {
      await page.goto("/item/vest/photo");
      await expect(page.locator("input[type=file]")).toBeAttached();
    },
    primary: "main button:visible",
  },
  {
    name: "camera view",
    go: async (page) => {
      await page.goto("/upload");
      await page.getByRole("button", { name: "or take one now" }).click();
      await expect(page.getByTestId("camera-frame")).toBeVisible();
    },
    primary: "[data-testid=camera] button:not([disabled])",
  },
  {
    name: "details sheet",
    go: async (page) => {
      await page.goto("/upload");
      await page.getByRole("button", { name: "Details" }).click();
      await expect(
        page.getByRole("dialog", { name: "Your photos" }),
      ).toBeVisible();
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations().map((a) => a.finished.catch(() => {})),
        ),
      );
    },
    primary: "dialog button",
  },
  {
    name: "starters",
    go: async (page) => {
      await uploadFirst(page);
    },
    primary: "main button:visible",
  },
  {
    name: "which photo sheet",
    go: async (page) => {
      await uploadFirst(page);
      await page.goto("/item/vest");
      await page.getByRole("button", { name: "Try it on" }).click();
      await expect(
        page.getByRole("dialog", { name: "Which photo?" }),
      ).toBeVisible();
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations().map((a) => a.finished.catch(() => {})),
        ),
      );
    },
    primary: "dialog button",
  },
  {
    name: "library",
    go: async (page) => {
      await uploadFirst(page);
      await page.goto("/item/vest/photos");
      await expect(page.getByTestId("library-photo")).toHaveCount(1);
    },
    primary: "[data-testid=library-photo]",
  },
  {
    name: "queue",
    go: async (page) => {
      // Long enough that the queue is still the queue while a slow run tabs through it: at 8 s
      // the job could finish mid-test and swap the screen for the result.
      setScript([{ outcome: "ok", delayMs: 30000 }]);
      await tryOnFromScratch(page, "Knit button vest");
      await expect(page.getByTestId("status-line")).toBeVisible();
    },
    primary: "main a[href='/']",
  },
  {
    name: "guest ready",
    go: async (page) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await dismissSheet(page);
    },
    primary: "[data-testid=see-poses]",
  },
  {
    name: "account sheet",
    go: async (page) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await expect(page.getByRole("dialog")).toBeVisible();
      await settle(page);
    },
    primary: "dialog button",
  },
  {
    name: "pick three labels",
    go: async (page) => {
      await uploadFirstAsGuest(page);
      await continueWithGoogle(page);
      await expect(page).toHaveURL(/\/upload\/labels$/);
      await expect(page.getByTestId("label-picks")).toBeVisible();
    },
    primary: "[data-testid=label-picks] button",
  },
  {
    name: "result",
    go: async (page) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page);
    },
    primary: 'main button:has-text("Buy")',
  },
  {
    name: "your try-ons",
    go: async (page) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForResult(page);
      await page.goto("/you/try-ons");
      await expect(page.getByTestId("tryons-grid")).toBeVisible();
      await expect(page.locator("img[data-render]")).toHaveCount(1);
    },
    primary: "[data-testid=tryons-grid] a",
  },
  {
    name: "honest failure",
    go: async (page) => {
      await page.goto("/item/jacket/unavailable");
      await expect(page.getByTestId("honest-failure")).toBeVisible();
    },
    primary: "[data-testid=honest-failure] [data-testid=closest] button",
  },
  {
    name: "you",
    go: async (page) => {
      await page.goto("/you");
      await expect(page.getByTestId("you-photos")).toBeVisible();
    },
    primary: "main a",
  },
  {
    name: "you with photos managed",
    go: async (page) => {
      await uploadFirst(page);
      // Manage is the phone layout; from 768px the same photos are always shown (Studio).
      if ((page.viewportSize()?.width ?? 0) >= 768)
        await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/you");
      await page.getByRole("button", { name: "Manage" }).click();
      await expect(page.getByTestId("manage-photo")).toHaveCount(1);
    },
    primary: "main a",
  },
  {
    name: "credits",
    go: async (page) => {
      await page.goto("/credits");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "main a",
  },
  {
    name: "sign-up",
    go: async (page) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await dismissSheet(page);
      await page.goto("/");
      await page
        .locator("article[data-item=coat]")
        .getByRole("button", { name: "Try it on" })
        .click();
      await confirmWhichPhoto(page);
      await expect(page).toHaveURL(/\/signup$/);
    },
    primary: "main button",
  },
];
