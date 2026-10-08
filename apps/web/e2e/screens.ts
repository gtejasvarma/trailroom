import type { Page } from "@playwright/test";
import {
  acceptConsent,
  expect,
  setScript,
  tryOnFromScratch,
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
    name: "catalogue",
    go: async (page) => {
      await page.goto("/");
      await expect(page.getByTestId("item-card")).toHaveCount(5);
    },
    primary: "article[data-item=g-shell-jacket] button",
  },
  {
    name: "product",
    go: async (page) => {
      await page.goto("/item/g-shell-jacket");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "main button",
  },
  {
    name: "consent",
    go: async (page) => {
      await page.goto("/item/g-shell-jacket/consent");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "input[type=checkbox]",
  },
  {
    name: "photo",
    go: async (page) => {
      await page.goto("/item/g-shell-jacket/consent");
      await acceptConsent(page);
      await expect(page.locator("input[type=file]")).toBeAttached();
    },
    primary: "input[type=file]",
  },
  {
    name: "queue",
    go: async (page) => {
      // Long enough that the queue is still the queue while a slow run tabs through it: at 8 s
      // the job could finish mid-test and swap the screen for the result.
      setScript([{ outcome: "ok", delayMs: 30000 }]);
      await tryOnFromScratch(page, "Hooded shell jacket");
      await expect(page.getByTestId("status-line")).toBeVisible();
    },
    primary: "a[href='/']:not(nav a)",
  },
  {
    name: "result",
    go: async (page) => {
      await tryOnFromScratch(page, "Hooded shell jacket");
      await waitForResult(page);
      await page.keyboard.press("Escape"); // the account sheet
      await expect(page.getByRole("dialog")).toBeHidden();
    },
    primary: "div.sticky a",
  },
  {
    name: "honest failure",
    go: async (page) => {
      await page.goto("/item/g-leather-coat/unavailable");
      await expect(page.getByTestId("honest-failure")).toBeVisible();
    },
    primary: "[data-testid=honest-failure] article button",
  },
  {
    name: "you",
    go: async (page) => {
      await page.goto("/you");
      await expect(page.getByTestId("photo-state")).toBeVisible();
    },
    primary: "main a",
  },
  {
    name: "credits",
    go: async (page) => {
      await page.goto("/credits");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
    primary: "main a[target=_blank]",
  },
  {
    name: "sign-up",
    go: async (page) => {
      await tryOnFromScratch(page, "Hooded shell jacket");
      await waitForResult(page);
      await page.goto("/");
      await page
        .locator("article[data-item=g-denim-jacket]")
        .getByRole("button")
        .click();
      await expect(page).toHaveURL(/\/signup$/);
    },
    primary: "main button",
  },
];
