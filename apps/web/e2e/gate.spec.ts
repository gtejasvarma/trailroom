import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "../playwright.config";

test("no cookie redirects to /gate", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/gate$/);
  await expect(
    page.getByRole("heading", { name: "Trailroom is in private testing" }),
  ).toBeVisible();
});

test("wrong password stays on /gate with an error", async ({ page }) => {
  await page.goto("/gate");
  await page.getByLabel("Password").fill("nope");
  await page.getByRole("button", { name: "Open Trailroom" }).click();
  await expect(page).toHaveURL(/\/gate\?error=1$/);
  await expect(page.getByRole("alert")).toContainText("didn’t match");
});

test("right password lands on /", async ({ page, context }) => {
  await page.goto("/gate");
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open Trailroom" }).click();
  await expect(page).toHaveURL(/\/$/);
  // The catalogue replaced the Phase 0 placeholder heading.
  await expect(
    page.getByRole("heading", { name: "Try something on" }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "trailroom_gate",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
});

test("GET /api/anything without the cookie is 401 JSON", async ({
  request,
}) => {
  const res = await request.get("/api/anything", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toEqual({ error: "gate_required" });
});

test("/api/internal/ping is not redirected to /gate", async ({ request }) => {
  const res = await request.get("/api/internal/ping", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ error: "no credentials" });
});

test("a forged cookie does not pass", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "trailroom_gate",
      value: "99999999999.deadbeef",
      url: "http://localhost:3101",
    },
  ]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/gate$/);
});
