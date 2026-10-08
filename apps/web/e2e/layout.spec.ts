import { expect, test } from "./helpers";
import { SCREENS } from "./screens";

// Design.md §12 widths, plus the smallest phone.
for (const width of [360, 375, 390, 430]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    for (const screen of SCREENS) {
      test(`${width}px: ${screen.name} has no horizontal scroll`, async ({
        page,
      }) => {
        await screen.go(page);
        const { scroll, client } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(scroll).toBeLessThanOrEqual(client);
      });
    }
  });
}
