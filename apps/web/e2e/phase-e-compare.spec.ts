// Phase E: Compare (wide screens only) and the tray. Desktop 1440x900; the phone check says the
// entry points are absent and the route explains itself. Review PNGs go to runs/phase-e/.
import { expect, setScript, test } from "./helpers";
import {
  noHScroll,
  serious,
  settle,
  shot,
  signedInWithTryOns,
  tryOnItems,
} from "./e-helpers";

test.describe.configure({ timeout: 240_000 });

const twice = (pose: string) => ({
  pose,
  outcome: "blocked" as const,
  times: 2,
});
const ids = (url: string) => new URL(url).searchParams.get("ids")!.split(",");

test.describe("desktop 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("pick, tray, C key, one pose across every column, a three-pose set, Add all to a list, remove, reload", async ({
    page,
  }) => {
    // The first piece loses its walking pose twice, so it ends with three poses.
    setScript([twice("walking")]);
    await signedInWithTryOns(page, ["vest", "coat", "slip", "suit"]);
    setScript([]);

    // From a product page in its on-you state: add to compare, and see it picked on the grid.
    await page.goto("/item/coat");
    const toggle = page.getByTestId("compare-toggle");
    await expect(toggle).toHaveText("Add to compare");
    await toggle.click();
    await expect(toggle).toHaveText("In compare");
    await expect(page.getByTestId("tray-count")).toHaveText("1 selected");
    await toggle.click();
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);

    await page.goto("/you/try-ons");
    await expect(page.getByTestId("tryon-card")).toHaveCount(4);
    expect(await tryOnItems(page)).toEqual(["suit", "slip", "coat", "vest"]);
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);
    const select = (n: number) => page.getByTestId("select-tryon").nth(n);

    // One picked: the tray asks for one more, and C does nothing yet.
    await select(0).click();
    await expect(page.getByTestId("tray-count")).toHaveText("1 selected");
    await expect(page.getByTestId("tray-hint")).toHaveText(
      "Pick one more to compare side by side",
    );
    await expect(page.getByTestId("tray-compare")).toBeDisabled();
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/you\/try-ons$/);

    // Two picked (the suit and the three-pose vest): the right hint, and the C key opens Compare.
    await select(3).click();
    await expect(page.getByTestId("tray-count")).toHaveText("2 selected");
    await expect(page.getByTestId("tray-hint")).toHaveText(
      "Same photo, same light — only the piece changes",
    );
    await expect(page.getByTestId("tray-item")).toHaveCount(2);
    await expect(page.getByTestId("tray-compare")).toHaveText("Compare 2");
    await shot(page, "your-tryons-desktop-tray");
    expect(await serious(page)).toEqual([]);
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/compare\?ids=/);
    expect(ids(page.url())).toHaveLength(2);

    // Two columns, same pose, the AI caption beside each, no fit lines.
    const columns = page.getByTestId("compare-column");
    await expect(columns).toHaveCount(2);
    await expect(columns.first().locator("img[data-render]")).toBeVisible();
    await expect(columns.nth(1).locator("img[data-render]")).toBeVisible();
    await expect(page.getByTestId("ai-caption")).toHaveCount(2);
    await expect(page.getByTestId("ai-caption").first()).toHaveText(
      "AI-generated preview",
    );
    await expect(columns.nth(0)).toHaveAttribute("data-pose", "front");
    await expect(columns.nth(1)).toHaveAttribute("data-pose", "front");
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);
    await shot(page, "compare-two-columns");
    await expect(page).toHaveScreenshot("compare-two-columns.png", {
      mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
    });
    expect(await serious(page)).toEqual([]);

    // The pose switcher changes every column together; a three-pose set says so, plainly.
    const pose = (name: string) =>
      page.getByRole("button", { name, exact: true });
    await pose("Seated").click();
    await expect(columns.nth(0)).toHaveAttribute("data-pose", "seated");
    await expect(columns.nth(1)).toHaveAttribute("data-pose", "seated");
    await pose("Walking").click();
    await expect(columns.nth(0)).toHaveAttribute("data-pose", "walking");
    await expect(columns.nth(0).locator("img[data-render]")).toBeVisible();
    await expect(columns.nth(1)).toHaveAttribute("data-pose", "");
    await expect(columns.nth(1).getByTestId("not-rendered")).toHaveText(
      "Not rendered in this pose",
    );
    await expect(columns.nth(1).locator("img")).toHaveCount(0);
    await expect(pose("Walking")).toHaveAttribute("aria-pressed", "true");
    await shot(page, "compare-three-pose-placeholder");
    await pose("Three-quarter").click();
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0)).toHaveAttribute("data-pose", "three-quarter");
    await expect(columns.nth(1)).toHaveAttribute("data-pose", "three-quarter");
    await pose("Front").click();

    // Add all to a list: the real list sheet, for both pieces.
    await page.getByTestId("add-all-to-list").click();
    const sheet = page.getByRole("dialog", { name: "Save to a list" });
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("new-list-name").fill("Side by side");
    await sheet.getByRole("button", { name: "Create list and add" }).click();
    await expect(page.getByTestId("toast")).toContainText(
      "Created Side by side",
    );
    await expect(sheet.getByTestId("list-choice")).toHaveAttribute(
      "data-in",
      "true",
    );
    await expect(sheet.getByTestId("list-choice")).toContainText("2 pieces");
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();

    // Buy from a column opens the buy sheet.
    await columns.first().getByTestId("compare-buy").click();
    const buy = page.getByRole("dialog", {
      name: /^Tailored linen suit, \$\d+$/,
    });
    await expect(buy).toBeVisible();
    await buy.getByRole("button", { name: "Keep looking" }).click();
    await expect(buy).toBeHidden();

    // Add to a list from one column.
    await columns.nth(1).getByTestId("compare-add-to-list").click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();

    // Reload: the selection survives, through the URL.
    const before = ids(page.url());
    await page.reload();
    await expect(columns).toHaveCount(2);
    expect(ids(page.url())).toEqual(before);

    // Remove a column: one left, the URL follows, and so does a reload.
    await columns.nth(1).getByTestId("remove-column").click();
    await expect(columns).toHaveCount(1);
    await expect.poll(() => ids(page.url()).length).toBe(1);
    await page.reload();
    await expect(columns).toHaveCount(1);
    await expect(columns.first()).toHaveAttribute("data-item", "suit");

    // Compare all: the four most recent.
    await page.goto("/you/try-ons");
    await page.getByTestId("compare-all").click();
    await expect(page).toHaveURL(/\/compare\?ids=/);
    expect(ids(page.url())).toHaveLength(4);
    await expect(columns).toHaveCount(4);
    for (let i = 0; i < 4; i++)
      await expect(columns.nth(i).locator("img[data-render]")).toBeVisible();
    await expect(page.getByText("Add another")).toHaveCount(0);
    await shot(page, "compare-four-columns");
    await expect(page).toHaveScreenshot("compare-four-columns.png", {
      mask: [page.locator("nextjs-portal"), page.getByTestId("toast")],
    });
    expect(await serious(page)).toEqual([]);
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      await noHScroll(page);
    }

    // Back from Compare, the tray still holds the selection.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/you/try-ons");
    await expect(page.getByTestId("compare-tray")).toHaveCount(0); // a reload starts a new tray
  });

  test("a guest has nothing to compare", async ({ page }) => {
    await page.goto("/compare?ids=a_b_c");
    await expect(page.getByTestId("compare-message")).toContainText(
      "Create an account to compare try-ons.",
    );
    await expect(page.getByTestId("compare-column")).toHaveCount(0);
  });
});

test.describe("phone 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no Compare entry points, and the route explains itself", async ({
    page,
  }) => {
    await signedInWithTryOns(page, ["vest", "coat"]);
    await expect(page.getByTestId("compare-toggle")).toHaveCount(0);
    await page.goto("/item/coat");
    await expect(page.getByTestId("see-poses")).toBeVisible();
    await expect(page.getByTestId("compare-toggle")).toHaveCount(0);
    await page.goto("/you/try-ons");
    await expect(page.getByTestId("tryon-card")).toHaveCount(2);
    await expect(page.getByTestId("select-tryon")).toHaveCount(0);
    await expect(page.getByTestId("compare-all")).toHaveCount(0);
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/you\/try-ons$/);

    await page.goto("/compare?ids=a_b_c,d_e_f");
    const msg = page.getByTestId("compare-message");
    await expect(msg).toContainText("Compare is on larger screens");
    await expect(msg).toContainText("Open Trailroom on a tablet or a computer");
    await expect(page.getByTestId("compare-column")).toHaveCount(0);
    await noHScroll(page);
    expect(await serious(page)).toEqual([]);
    await msg.getByRole("link", { name: "Back to your try-ons" }).click();
    await expect(page).toHaveURL(/\/you\/try-ons$/);
  });
});
