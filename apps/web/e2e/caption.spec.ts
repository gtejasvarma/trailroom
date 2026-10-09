import type { Page } from "@playwright/test";
import {
  expect,
  setScript,
  test,
  tryOnFromScratch,
  waitForGuestReady,
  waitForResult,
} from "./helpers";

/** No element carrying the AI label text sits over any render: it is beside, never on, the image. */
async function noLabelOverRender(page: Page) {
  const hits = await page.evaluate(() => {
    const out: string[] = [];
    const renders = [...document.querySelectorAll("img[data-render]")];
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? "")
        .join("");
      if (!/AI-generated/i.test(own)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      for (const img of renders) {
        const i = img.getBoundingClientRect();
        if (
          r.left < i.right &&
          i.left < r.right &&
          r.top < i.bottom &&
          i.top < r.bottom
        )
          out.push(el.tagName);
      }
    }
    return out;
  });
  expect(hits).toEqual([]);
}

test("AI caption sits beside every queue tile, never over it", async ({
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
  const img = front.locator("img[data-render]");
  await expect(img).toBeVisible();
  await expect(front.locator("figcaption")).toContainText(
    "AI-generated preview",
  );
  const ib = (await img.boundingBox())!;
  const cb = (await front.locator("figcaption").boundingBox())!;
  expect(cb.y).toBeGreaterThanOrEqual(ib.y + ib.height - 1);
  await noLabelOverRender(page);

  // The guest-ready tiles carry it too.
  await waitForGuestReady(page);
  await expect(
    page.locator("[data-testid=pose-tile] figcaption").filter({
      hasText: "AI-generated preview",
    }),
  ).toHaveCount(4);
  await noLabelOverRender(page);
});

test("on the result the caption is directly under the gallery and does not overlap it", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  const gallery = page.getByTestId("pose-gallery");
  const caption = page.getByTestId("ai-caption");
  await expect(caption).toHaveText("AI-generated preview");
  const gb = (await gallery.boundingBox())!;
  const cb = (await caption.boundingBox())!;
  expect(cb.y).toBeGreaterThanOrEqual(gb.y + gb.height - 1);
  expect(cb.y - (gb.y + gb.height)).toBeLessThan(40);
  await noLabelOverRender(page);
  // Nothing is drawn on the image: the picture has no text child, only the chips beside it.
  await expect(page.locator("img[data-hero]").first()).toBeVisible();
});
