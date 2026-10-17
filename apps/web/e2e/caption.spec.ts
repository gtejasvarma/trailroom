import type { Page } from "@playwright/test";
import {
  expect,
  setScript,
  test,
  tryOnFromScratch,
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
});

test("on the result the AI label is beside the picture, never on it", async ({
  page,
}) => {
  await tryOnFromScratch(page, "Knit button vest");
  await waitForResult(page);
  const gallery = page.getByTestId("pose-gallery");
  const caption = page.getByTestId("ai-caption");
  await expect(caption).toHaveText(/AI-generated preview\.$/);
  const gb = (await gallery.boundingBox())!;
  const cb = (await caption.boundingBox())!;
  // Not inside the picture's box, whichever side of it the layout puts it on.
  const overlaps =
    cb.x < gb.x + gb.width &&
    gb.x < cb.x + cb.width &&
    cb.y < gb.y + gb.height &&
    gb.y < cb.y + cb.height;
  expect(overlaps).toBe(false);
  await noLabelOverRender(page);
  // Nothing is drawn on the image: no canvas, no text child, just the pictures.
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("img[data-hero]").first()).toBeVisible();
});
