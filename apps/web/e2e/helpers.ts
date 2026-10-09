import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test as base, type Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_TMP, FAKE_SCRIPT_FILE } from "../playwright.config";

export const PHOTO = join(E2E_TMP, "photo.jpg");
export const TINY = join(E2E_TMP, "tiny.png");

export interface FakeRule {
  pose?: string;
  outcome:
    | "ok"
    | "blocked"
    | "no_image"
    | "error"
    | "undersized"
    | "blank"
    | "copy_input";
  times?: number;
  delayMs?: number;
}

// The fake provider resets its `times` counters only when the script text changes, so a script
// identical to the previous test's would arrive with its failures already used up. A never-matching
// nonce entry makes every script unique.
let nonce = 0;
export function setScript(rules: FakeRule[]) {
  const unique = { pose: `nonce-${Date.now()}-${nonce++}`, outcome: "ok" };
  writeFileSync(FAKE_SCRIPT_FILE, JSON.stringify([...rules, unique]));
}

const host = (name: string, fallback: string) => process.env[name] ?? fallback;

/** Clears every emulator Auth account and Firestore document (REST reset endpoints). */
export async function resetEmulators() {
  const auth = host("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
  const fs = host("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
  const a = await fetch(
    `http://${auth}/emulator/v1/projects/demo-trailroom/accounts`,
    { method: "DELETE" },
  );
  const f = await fetch(
    `http://${fs}/emulator/v1/projects/demo-trailroom/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!a.ok || !f.ok) throw new Error("could not reset the emulators");
}

/** Raw Firestore REST read as the emulator's owner (bypasses rules). */
export async function listDocs(collection: string): Promise<unknown[]> {
  const fs = host("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
  const res = await fetch(
    `http://${fs}/v1/projects/demo-trailroom/databases/(default)/documents/${collection}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  const j = (await res.json()) as { documents?: unknown[] };
  return j.documents ?? [];
}

/** Pretends today's render budget is already spent. */
export async function exhaustBudget() {
  const fs = host("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
  const day = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `http://${fs}/v1/projects/demo-trailroom/databases/(default)/documents/spend/${day}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          committedMicros: { integerValue: "1000000000" },
          pendingMicros: { integerValue: "0" },
          ceilingMicros: { integerValue: "5000000" },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    },
  );
  if (!res.ok) throw new Error("could not seed the spend document");
}

export async function passGate(page: Page) {
  await page.goto("/gate");
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open Trailroom" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Each test starts with empty emulators, an all-ok script, and a gate-passed page. */
export const test = base.extend<{ fresh: void }>({
  fresh: [
    async ({ page }, use) => {
      await resetEmulators();
      setScript([]);
      await passGate(page);
      await use();
    },
    { auto: true },
  ],
});
export { expect };

export const card = (page: Page, name: string) =>
  page.locator("article[data-testid=item-card]").filter({ hasText: name });

/** From the product page of `name`: Try it on, upload. Ends on the try-on route. */
export async function tryOnFromScratch(page: Page, name: string) {
  await card(page, name)
    .getByRole("link", { name: `View ${name}` })
    .click();
  await expect(page).toHaveURL(/\/item\/[^/]+$/);
  // The button is server-rendered before its click handler is attached. On a slow dev server a
  // click can land in that gap and do nothing, so click until the page actually moves on.
  await expect(async () => {
    await page.getByRole("button", { name: "Try it on" }).click();
    await expect(page).toHaveURL(/\/photo$/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/try-on\//);
}

/** Upload first as a guest: /upload, choose the photo, Use this photo. Ends on the account sheet. */
export async function uploadFirstAsGuest(page: Page) {
  await page.goto("/upload");
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(
    page.getByRole("dialog", { name: "Your photo is in — create an account" }),
  ).toBeVisible();
}

/** Picks three labels on "Pick three labels" and taps Done. Ends on "Your photo is in". */
export async function pickThreeLabels(page: Page) {
  await expect(page).toHaveURL(/\/upload\/labels$/);
  const done = page.getByTestId("labels-done");
  await expect(done).toBeDisabled();
  const rows = page.getByTestId("label-picks").getByRole("button");
  await rows.nth(0).click();
  await expect(done).toHaveText("Pick 2 more");
  await rows.nth(1).click();
  await expect(done).toHaveText("Pick 1 more");
  await expect(done).toBeDisabled();
  await rows.nth(2).click();
  await expect(done).toHaveText("Done");
  await expect(done).toBeEnabled();
  await done.click();
  await expect(page).toHaveURL(/\/upload\/done$/);
}

/** Upload first, creating an account on the way. Ends on "Your photo is in", signed in. */
export async function uploadFirst(page: Page) {
  await uploadFirstAsGuest(page);
  await continueWithGoogle(page);
  await pickThreeLabels(page);
  await expect(page.getByTestId("starter")).toHaveCount(4);
}

/** The "Which photo?" sheet that follows Try it on when photos exist: start with the default. */
export async function confirmWhichPhoto(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Which photo?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("DEFAULT", { exact: true })).toBeVisible();
  await expect(async () => {
    await sheet.getByRole("button", { name: "Add to the queue" }).click();
    await expect(page).not.toHaveURL(/\/item\//, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

let accountCounter = 0;
/** A fresh Google account address for the Auth emulator's fake popup. */
export const newEmail = () =>
  `e2e-${Date.now()}-${accountCounter++}@example.com`;

/** A guest's finished try-on: tiles and "N poses, ready"; the full result is not reachable. */
export async function waitForGuestReady(page: Page) {
  await expect(page.getByTestId("queue-title")).toHaveText(/poses?, ready$/, {
    timeout: 30_000,
  });
}

/**
 * Clicks Continue with Google in the open account sheet and completes the Auth emulator's fake
 * popup. `email` names a new account; with `existing` it picks that already-known account.
 */
export async function continueWithGoogle(
  page: Page,
  opts: { email?: string; existing?: boolean } = {},
) {
  const dialog = page.getByRole("dialog");
  const email = opts.email ?? newEmail();
  const popupPromise = page.waitForEvent("popup");
  await dialog.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("load");
  if (opts.existing) {
    await popup.getByText(email).click();
  } else {
    await popup.getByText("Add new account").click();
    await expect(popup.locator("#email-input")).toBeVisible();
    await popup.locator("#email-input").fill(email);
    await popup.locator("#sign-in").click();
  }
  return email;
}

/**
 * Reaches the signed-in result for the try-on that is running or finished on this page: waits for
 * the guest-ready state, signs in with Google from the account sheet, and waits for the gallery.
 * Already signed in: just waits for the gallery.
 */
export async function waitForResult(page: Page) {
  const hero = page.getByTestId("pose-gallery");
  const guestReady = page.getByTestId("queue-title");
  await expect(hero.or(guestReady.filter({ hasText: /ready$/ }))).toBeVisible({
    timeout: 30_000,
  });
  if (!(await hero.isVisible())) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await continueWithGoogle(page);
  }
  await expect(hero).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("img[data-hero]").first()).toBeVisible();
}

/** The guest's account sheet opens a beat after the finish: wait for it, then dismiss it. */
export async function dismissSheet(page: Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Waits for animations (the sheet's rise) to finish before axe or a screenshot reads colours. */
export async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}
