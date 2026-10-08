import type { Page } from "@playwright/test";
import {
  dismissSheet,
  expect,
  setScript,
  test,
  tryOnFromScratch,
  waitForResult,
} from "./helpers";

/** For every render image: its figure has the caption, and nothing carrying label text overlaps it. */
async function assertCaptions(page: Page) {
  const imgs = await page.locator("img[data-render]").all();
  expect(imgs.length).toBeGreaterThan(0);
  for (const img of imgs) {
    const figure = img.locator("xpath=ancestor::figure[1]");
    const caption = figure.locator("figcaption");
    await expect(caption).toContainText("AI-generated preview");
    await img.scrollIntoViewIfNeeded();
    const topmost = await img.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        ) === el
      );
    });
    expect(topmost, "the image is the topmost element at its centre").toBe(
      true,
    );
    const ib = (await img.boundingBox())!;
    const cb = (await caption.first().boundingBox())!;
    const intersects =
      ib.x < cb.x + cb.width &&
      cb.x < ib.x + ib.width &&
      ib.y < cb.y + cb.height &&
      cb.y < ib.y + ib.height;
    expect(intersects, "caption box must not intersect the image box").toBe(
      false,
    );
  }
  // And no element anywhere that carries label text sits over any render.
  const overlaps = await page.evaluate(() => {
    const out: string[] = [];
    const renders = [...document.querySelectorAll("img[data-render]")];
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? "")
        .join("");
      if (!/AI-generated/i.test(own)) continue;
      const r = el.getBoundingClientRect();
      for (const img of renders) {
        const i = img.getBoundingClientRect();
        if (
          r.left < i.right &&
          i.left < r.right &&
          r.top < i.bottom &&
          i.top < r.bottom
        ) {
          out.push(el.tagName);
        }
      }
    }
    return out;
  });
  expect(overlaps).toEqual([]);
}

test("AI caption sits beside every render, never over it (queue and result)", async ({
  page,
}) => {
  // The front pose renders at once; the rest wait, so the queue shows both states.
  setScript([
    { pose: "front", outcome: "ok" },
    { outcome: "ok", delayMs: 6000 },
  ]);
  await tryOnFromScratch(page, "Knit button vest");

  const front = page.locator("[data-testid=pose-tile][data-pose=front]");
  await expect(front).toHaveAttribute("data-state", "passed");
  await expect(front.locator("img[data-render]")).toBeVisible();
  await expect(
    page.locator("[data-testid=pose-tile][data-pose=seated]"),
  ).not.toHaveAttribute("data-state", "passed");
  await assertCaptions(page);

  await waitForResult(page);
  await expect(page.locator("img[data-render]")).toHaveCount(5);
  await expect(page.locator("img[data-hero]")).toBeVisible();
  await dismissSheet(page); // the account sheet
  await assertCaptions(page);

  // Directly under the hero: the AI caption, then the expectation line.
  const hero = page.getByTestId("hero");
  await expect(hero.locator("figcaption")).toHaveText(
    "AI-generated previewA preview, not a fitting — it can't tell you size or fit.",
  );
});
