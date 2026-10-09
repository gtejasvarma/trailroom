import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { E2E_PORT } from "../playwright.config";
import {
  exhaustBudget,
  PHOTO,
  expect,
  setScript,
  settle,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";
import { SCREENS } from "./screens";

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

for (const screen of SCREENS) {
  test(`axe: ${screen.name} has no serious or critical violations`, async ({
    page,
  }) => {
    await screen.go(page);
    expect(await serious(page)).toEqual([]);
  });

  test(`keyboard: ${screen.name} primary action is reachable by Tab`, async ({
    page,
  }) => {
    await screen.go(page);
    const target = page.locator(screen.primary).first();
    await expect(target).toBeAttached();
    let focused = false;
    for (let i = 0; i < 60 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await target.evaluate((el) => el === document.activeElement);
    }
    expect(focused, `Tab reached ${screen.primary}`).toBe(true);
    // Focus must be visible: the :focus-visible outline is on.
    const outline = await target.evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    const parentOutline = await target.evaluate((el) => {
      const p = el.closest("label");
      return p ? getComputedStyle(p).outlineStyle : "none";
    });
    expect(outline !== "none" || parentOutline !== "none").toBe(true);
  });
}

const blocked = (pose: string) => ({
  pose,
  outcome: "blocked" as const,
  times: 2,
});

test("axe: honest failure, render failed", async ({ page }) => {
  setScript([blocked("front"), blocked("three-quarter"), blocked("walking")]);
  await tryOnFromScratch(page, "Knit button vest");
  await expect(page.getByTestId("honest-failure")).toHaveAttribute(
    "data-kind",
    "render_failed",
    { timeout: 30_000 },
  );
  expect(await serious(page)).toEqual([]);
});

test("axe: honest failure, provider error on every call (internal)", async ({
  page,
}) => {
  setScript([{ outcome: "error" }]);
  await tryOnFromScratch(page, "Knit button vest");
  await expect(page.getByTestId("honest-failure")).toHaveAttribute(
    "data-kind",
    "internal",
    { timeout: 30_000 },
  );
  expect(await serious(page)).toEqual([]);
});

test("axe: honest failure, capacity", async ({ page }) => {
  await exhaustBudget();
  await tryOnFromScratch(page, "Knit button vest");
  await expect(page.getByTestId("honest-failure")).toHaveAttribute(
    "data-kind",
    "capacity",
    { timeout: 30_000 },
  );
  expect(await serious(page)).toEqual([]);
});

test("axe: honest failure, jewellery not yet", async ({ page }) => {
  await page.goto("/item/hoops/unavailable");
  await expect(page.getByTestId("honest-failure")).toHaveAttribute(
    "data-try-on",
    "not_yet",
  );
  expect(await serious(page)).toEqual([]);
});

test("axe: the partial result, signed in, names three poses", async ({
  page,
}) => {
  setScript([blocked("walking")]);
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  await expect(page.getByTestId("partial-line")).toBeVisible();
  await expect(page.getByTestId("queue-title")).toHaveCount(0);
  await settle(page);
  expect(await serious(page)).toEqual([]);
});

test("axe: /gate", async ({ browser }) => {
  const ctx = await browser.newContext(); // no gate cookie
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${E2E_PORT}/gate`);
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await ctx.close();
});

test("axe: photo screen with a chosen photo", async ({ page }) => {
  await page.goto("/item/vest/photo");
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(
    page.getByRole("button", { name: "Use this photo" }),
  ).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("Enter activates the primary action", async ({ page }) => {
  setScript([]);
  await page.goto("/item/vest");
  const button = page.getByRole("button", { name: "Try it on" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/photo$/);

  // The file input opens the picker with Enter (the OS picker is the one allowed system dialog).
  const chooser = page.waitForEvent("filechooser");
  await page.locator("input[type=file]").focus();
  await page.keyboard.press("Enter");
  await chooser;
});
