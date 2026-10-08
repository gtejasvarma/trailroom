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

/** From the product page of `name`: Try it on, consent, upload. Ends on the try-on route. */
export async function tryOnFromScratch(page: Page, name: string) {
  await card(page, name)
    .getByRole("link", { name: `View ${name}` })
    .click();
  await expect(page).toHaveURL(/\/item\/[^/]+$/);
  // The button is server-rendered before its click handler is attached. On a slow dev server a
  // click can land in that gap and do nothing, so click until the page actually moves on.
  await expect(async () => {
    await page.getByRole("button", { name: "Try it on" }).click();
    await expect(page).toHaveURL(/\/consent$/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await acceptConsent(page);
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page).toHaveURL(/\/try-on\//);
}

export async function acceptConsent(page: Page) {
  await expect(page).toHaveURL(/\/consent$/);
  await page.getByLabel("I am 18 or older").check();
  await page.getByLabel(/I agree to my photo/).check();
  await page.getByRole("button", { name: "Agree and add my photo" }).click();
  await expect(page).toHaveURL(/\/photo$/);
}

export async function waitForResult(page: Page) {
  await expect(page.getByTestId("hero")).toBeVisible({ timeout: 30_000 });
}

/** The guest's account sheet opens a beat after the result: wait for it, then dismiss it. */
export async function dismissSheet(page: Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}
