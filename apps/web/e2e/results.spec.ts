import {
  card,
  exhaustBudget,
  expect,
  listDocs,
  setScript,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";

const twice = (pose: string) => ({
  pose,
  outcome: "blocked" as const,
  times: 2,
});

test("partial set: three images, the three-of-four line, no broken tile", async ({
  page,
}) => {
  setScript([twice("walking")]);
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);

  await expect(page.getByTestId("partial-line")).toHaveText(
    "Three of four poses are shown. One could not be rendered well enough to show.",
  );
  await expect(page.getByTestId("pose-thumb")).toHaveCount(3);
  await expect(page.locator("img[data-render]")).toHaveCount(4); // hero + three
  for (const img of await page.locator("img[data-render]").all()) {
    await expect(img).toBeVisible();
    expect(
      await img.evaluate((e) => (e as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(100);
  }
  await expect(
    page.locator("[data-testid=pose-thumb][data-pose=walking]"),
  ).toHaveCount(0);
});

test("failed set: honest failure with retry, a different photo, and three alternatives", async ({
  page,
}) => {
  setScript([twice("walking"), twice("seated")]);
  await tryOnFromScratch(page, "Knit button vest");
  const failedUrl = page.url();

  const screen = page.getByTestId("honest-failure");
  await expect(screen).toHaveAttribute("data-kind", "render_failed", {
    timeout: 30_000,
  });
  await expect(screen.getByRole("heading", { level: 1 })).toContainText(
    "did not come out well enough to show",
  );
  await expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    screen.getByRole("link", { name: "Use a different photo" }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", { name: "Closest three we can render" }),
  ).toBeVisible();
  await expect(screen.getByTestId("item-card")).toHaveCount(3);
  // No image from the failed set is shown.
  await expect(page.locator("img[data-render]")).toHaveCount(0);

  // One tap into an alternative starts that item's flow (consent and photo are on file).
  await screen
    .getByTestId("item-card")
    .first()
    .getByRole("button", { name: "Try it on" })
    .click();
  await expect(page).not.toHaveURL(failedUrl);
  await expect(page).toHaveURL(/\/try-on\//);
});

test("try again re-posts and lands on a fresh job", async ({ page }) => {
  setScript([twice("walking"), twice("seated")]);
  await tryOnFromScratch(page, "Knit button vest");
  const screen = page.getByTestId("honest-failure");
  await expect(screen).toHaveAttribute("data-kind", "render_failed", {
    timeout: 30_000,
  });
  const failedUrl = page.url();
  await screen.getByRole("button", { name: "Try again" }).click();
  await expect(page).not.toHaveURL(failedUrl);
  await waitForResult(page); // the script's failures are used up, so this one renders
});

test("unready item: honest failure without any upload asked for", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/"))
      requests.push(`${r.method()} ${u.pathname}`);
  });

  await page.goto("/");
  await card(page, "Cropped leather jacket")
    .getByRole("button", { name: "Try it on" })
    .click();

  await expect(page).toHaveURL(/\/item\/jacket\/unavailable$/);
  const screen = page.getByTestId("honest-failure");
  await expect(screen).toHaveAttribute("data-kind", "not_ready");
  await expect(screen).toContainText("We can't render this one honestly");
  await expect(screen).toContainText("folded over an arm");
  await expect(screen).toContainText(
    "We'd rather say so than show you a guess",
  );
  await expect(screen.getByTestId("item-card")).toHaveCount(3);
  await expect(page.locator("input[type=file]")).toHaveCount(0);

  expect(
    requests.filter((r) => /\/api\/(photo|try-on|consent)/.test(r)),
  ).toEqual([]);
  expect(await listDocs("spendLog")).toHaveLength(0);
});

test("unready item for a user who already has consent and a photo", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);

  const tryOnCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/try-on")
      tryOnCalls.push(r.method());
  });
  const spendBefore = (await listDocs("spendLog")).length;
  await page.goto("/");
  await card(page, "Cropped leather jacket")
    .getByRole("button", { name: "Try it on" })
    .click();
  await expect(page.getByTestId("honest-failure")).toHaveAttribute(
    "data-kind",
    "not_ready",
  );
  expect(tryOnCalls).toEqual([]);
  expect((await listDocs("spendLog")).length).toBe(spendBefore);
});

test("capacity: the budget message and exactly one action, no retry", async ({
  page,
}) => {
  await exhaustBudget();
  await tryOnFromScratch(page, "Knit button vest");

  const screen = page.getByTestId("honest-failure");
  await expect(screen).toHaveAttribute("data-kind", "capacity", {
    timeout: 30_000,
  });
  await expect(screen).toContainText("Today's render budget is used up");
  await expect(screen).toContainText("Come back tomorrow");
  await expect(screen.getByRole("link")).toHaveCount(1);
  await expect(
    screen.getByRole("link", { name: "Back to the pieces" }),
  ).toBeVisible();
  await expect(screen.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /try again/i })).toHaveCount(0);

  // No auto-retry: nothing changes.
  const url = page.url();
  await page.waitForTimeout(3000);
  expect(page.url()).toBe(url);
  await expect(screen).toHaveAttribute("data-kind", "capacity");
});

test("daily limit: a guest's third start shows its own message, one way back, no retry", async ({
  page,
}) => {
  const always = (pose: string) => ({ pose, outcome: "blocked" as const });
  setScript(["front", "three-quarter", "walking", "seated"].map(always));
  await tryOnFromScratch(page, "Knit button vest");
  const screen = page.getByTestId("honest-failure");
  await expect(screen).toHaveAttribute("data-kind", "render_failed", {
    timeout: 30_000,
  });
  await screen.getByRole("button", { name: "Try again" }).click(); // second (and last) start
  await expect(screen).toHaveAttribute("data-kind", "render_failed", {
    timeout: 30_000,
  });
  await screen.getByRole("button", { name: "Try again" }).click(); // third
  await expect(page).toHaveURL(/\/limit$/);
  const limit = page.getByTestId("honest-failure");
  await expect(limit).toHaveAttribute("data-kind", "daily_limit");
  await expect(limit).toContainText("Today's try-ons are used up");
  await expect(limit.getByRole("link")).toHaveCount(1);
  await expect(limit.getByRole("button")).toHaveCount(0);
});
