// Phase E: You (phone) and Studio (desktop), remove a try-on, Delete everything. At 390x844 and
// 1440x900. Review PNGs go to runs/phase-e/ (git-ignored).
import {
  dismissSheet,
  expect,
  listDocs,
  test,
  tryOnFromScratch,
  waitForGuestReady,
} from "./helpers";
import {
  SIZES,
  noHScroll,
  serious,
  settle,
  shot,
  signedInWithTryOns,
  tryOnItems,
} from "./e-helpers";

test.describe.configure({ timeout: 150_000 });

async function makeList(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Add to a list" }).click();
  const sheet = page.getByRole("dialog", { name: "Save to a list" });
  await sheet.getByTestId("new-list-name").fill(name);
  await sheet.getByRole("button", { name: "Create list and add" }).click();
  await expect(page.getByTestId("toast")).toContainText(`Created ${name}`);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
}

for (const size of SIZES) {
  const wide = size.width >= 768;
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`${wide ? "Studio" : "You"}: real counts, photos, following, Details, sign out`, async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["vest", "coat"]);
      await makeList(page, "Wedding");

      await page.goto(wide ? "/studio" : "/you");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: wide ? "Studio" : "You",
        }),
      ).toBeVisible();
      // The header block: who, and three real counts.
      await expect(page.getByTestId("you-account")).toHaveText(
        /^Signed in as .+\.$/,
      );
      await expect(page.getByTestId("stat-tryons")).toContainText("2");
      await expect(page.getByTestId("stat-tryons")).toContainText(
        "try-ons kept",
      );
      await expect(page.getByTestId("stat-week")).toContainText("2");
      await expect(page.getByTestId("stat-week")).toContainText("this week");
      await expect(page.getByTestId("stat-lists")).toContainText("1");
      await expect(page.getByTestId("stat-lists")).toContainText("lists");

      if (!wide) {
        // Your try-ons: the grid of kept ones, each opening its result.
        await expect(page.getByTestId("tryon-card")).toHaveCount(2);
        await expect(page.getByTestId("ai-caption")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Open your wool car coat try-on" }),
        ).toBeVisible();
      } else {
        // On a wide screen the grid has its own page.
        await expect(page.getByTestId("tryon-card")).toHaveCount(0);
      }

      // Your photos: the Full body row.
      await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
      if (wide) {
        await expect(page.getByTestId("manage-photo")).toHaveCount(1);
        await expect(
          page.getByText("Default", { exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Add a photo" }),
        ).toBeVisible();
      } else {
        await page.getByRole("button", { name: "Manage" }).click();
        await expect(page.getByTestId("manage-photo")).toHaveCount(1);
        await page.getByRole("button", { name: "Close" }).click();
      }

      // Not built, so not shown: no email section, no fit, no Face or Hand slots, no back office.
      for (const text of [
        /e-?mail/i,
        /stay in the loop/i,
        /your fit/i,
        /^face$/i,
        /^hand$/i,
        /run a label/i,
      ]) {
        await expect(page.getByText(text)).toHaveCount(0);
      }

      // Following: a toggle that persists.
      const ansel = page
        .getByTestId("following-row")
        .filter({ hasText: "ANSEL WARD" });
      await expect(ansel).toContainText("Not following");
      await ansel.getByRole("button", { name: "Follow ANSEL WARD" }).click();
      await expect(ansel).toContainText("Following");
      await expect(page.getByTestId("toast")).toContainText(
        "Following ANSEL WARD.",
      );
      await expect(
        ansel.getByRole("button", { name: /Following ANSEL WARD/ }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByTestId("following-row").filter({ hasText: "ANSEL WARD" }),
      ).toContainText("Following");

      await shot(page, wide ? "studio-desktop" : "you-phone", true);
      await expect(page).toHaveScreenshot(
        wide ? "studio-desktop.png" : "you-phone.png",
        {
          fullPage: true,
          mask: [
            page.locator("nextjs-portal"),
            page.getByTestId("toast"),
            page.getByTestId("you-account"),
          ],
        },
      );
      expect(await serious(page)).toEqual([]);

      // Details: the privacy row opens the sheet.
      await page.getByTestId("privacy-row").click();
      const details = page.getByRole("dialog", { name: "Your photos" });
      await expect(details).toBeVisible();
      await expect(details).toContainText("private to you");
      await expect(details).toContainText("not used to train models");
      await settle(page);
      expect(await serious(page)).toEqual([]);
      await details.getByRole("button", { name: "Done" }).click();
      await expect(details).toBeHidden();

      if (wide) {
        // The account menu: Studio, How your photos are handled, Sign out.
        await page.goto("/");
        await page.getByTestId("account-initial").click();
        const menu = page.getByTestId("account-menu");
        await expect(menu.getByRole("menuitem")).toHaveText([
          "Studio",
          "How your photos are handled",
          "Sign out",
        ]);
        await shot(page, "account-menu-desktop");
        expect(await serious(page)).toEqual([]);
        await menu.getByRole("menuitem", { name: "Studio" }).click();
        await expect(page).toHaveURL(/\/studio$/);
        await page.getByTestId("account-initial").click();
        await page
          .getByRole("menuitem", { name: "How your photos are handled" })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Your photos" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await page.getByTestId("account-initial").click();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("account-menu")).toHaveCount(0);
        await page.getByTestId("account-initial").click();
        await page.getByRole("menuitem", { name: "Sign out" }).click();
      } else {
        await page.getByRole("button", { name: "Sign out" }).click();
      }
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId("proof")).toBeVisible();
      await expect(page.getByTestId("account-initial")).toHaveCount(0);
    });

    test("a guest sees their photo, the invitation, Details and Delete everything, and no try-ons grid", async ({
      page,
    }) => {
      await tryOnFromScratch(page, "Knit button vest");
      await waitForGuestReady(page);
      await dismissSheet(page);
      await page.goto(wide ? "/studio" : "/you");
      await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeVisible();
      await expect(page.getByTestId("privacy-row")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Delete everything" }),
      ).toBeVisible();
      await expect(page.getByTestId("tryon-card")).toHaveCount(0);
      await expect(page.getByTestId("stat-tryons")).toHaveCount(0);
      await expect(page.getByTestId("following-list")).toHaveCount(0);
      await shot(page, wide ? "studio-guest-desktop" : "you-guest-phone", true);
      expect(await serious(page)).toEqual([]);
    });

    test("remove a try-on: the tile leaves, a toast says so, and it is gone after a reload and from Discover", async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["vest", "coat"]);
      await page.goto(wide ? "/you/try-ons" : "/you");
      await expect(page.getByTestId("tryon-card")).toHaveCount(2);
      await page
        .getByRole("button", { name: "Remove your wool car coat try-on" })
        .click();
      // No confirm dialog: the tile leaves at once and a toast says it was removed.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await expect(page.getByTestId("toast")).toContainText(
        "Removed your wool car coat try-on.",
      );
      expect(await tryOnItems(page)).toEqual(["vest"]);
      await page.reload();
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      expect(await tryOnItems(page)).toEqual(["vest"]);
      // Discover: the coat is no longer in its on-you state; the vest still is.
      await page.goto("/");
      await expect(page.getByTestId("item-card")).toHaveCount(12);
      await expect(page.locator("article[data-item=vest]")).toHaveAttribute(
        "data-on-you",
        "true",
      );
      await expect(page.locator("article[data-item=coat]")).not.toHaveAttribute(
        "data-on-you",
        "true",
      );
      // The set, its renders and its job are gone for real.
      const sets = (await listDocs("poseSets")) as { name: string }[];
      expect(sets).toHaveLength(1);
      expect(sets[0]!.name).toContain("_vest");
    });

    test("Delete everything: the result shows on the same screen, and the person is a new visitor", async ({
      page,
    }) => {
      await signedInWithTryOns(page, ["vest"]);
      await page.goto(wide ? "/studio" : "/you");
      await expect(page.getByTestId("photo-count")).toHaveText("1 photo");
      await page.getByRole("button", { name: "Delete everything" }).click();
      const deleted = page.getByTestId("deleted");
      await expect(deleted).toBeVisible();
      await expect(deleted).toContainText(
        "Your photos, try-ons, lists and asks are gone.",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Delete everything" }),
      ).toHaveCount(0);
      await expect(page).toHaveURL(/\/(you|studio)$/); // the same screen
      await shot(page, wide ? "deleted-desktop" : "deleted-phone");

      // Everything is gone server-side, the sign-in included.
      for (const c of ["poseSets", "jobs", "photos", "consents", "purchases"])
        expect(await listDocs(c), c).toEqual([]);

      // A new visitor: the proof slider is back, there is no photo, nobody is signed in.
      await page.goto("/");
      await expect(page.getByTestId("proof")).toBeVisible();
      await expect(page.getByTestId("account-initial")).toHaveCount(0);
      await page.goto("/you");
      await expect(page.getByTestId("stat-tryons")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeVisible();
      await expect(page.getByTestId("photo-count")).toHaveText(/No photos yet/);
    });
  });
}

test.describe("no horizontal scroll on You and the demo page at 360 to 430", () => {
  for (const width of [360, 390, 430]) {
    test(`${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await signedInWithTryOns(page, ["vest"]);
      await page.goto("/you");
      await expect(page.getByTestId("stat-tryons")).toBeVisible();
      await expect(page.getByTestId("tryon-card")).toHaveCount(1);
      await noHScroll(page);
      await page.getByRole("button", { name: "Manage" }).click();
      await noHScroll(page);
      await page.goto("/demo-checkout/vest");
      await expect(page.getByTestId("demo-body")).toBeVisible();
      await noHScroll(page);
    });
  }
});
