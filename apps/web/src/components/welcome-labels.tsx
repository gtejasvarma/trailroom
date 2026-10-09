"use client";
// After a new account is made with no render yet (the upload-first path): pick three labels.
// Step 2 of the prototype's two post-signup steps; step 1 (email preferences) is not built, since
// no email is sent in V0. Stored through the follows API. Shown once: it is skipped when the
// person already follows three labels.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  labelAvatar,
  LABELS,
  itemsByLabel,
  catalogUrl,
} from "@trailroom/catalog";
import { apiFetch } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import { alertStyle } from "../lib/ui";
import { useMe } from "./me-provider";

const NEEDED = 3;

export function WelcomeLabels() {
  const router = useRouter();
  const { loaded, isGuest, follows, refresh } = useMe();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (isGuest) router.replace(paths.catalogue);
    else if (follows.size >= NEEDED) router.replace(paths.starters);
  }, [loaded, isGuest, follows, router]);

  const toggle = (slug: string) =>
    setPicked((p) =>
      p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug],
    );
  const left = Math.max(0, NEEDED - picked.length);

  async function done() {
    if (left > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const slug of picked) {
        if (!follows.has(slug)) {
          await apiFetch(`/api/follows/${slug}`, { method: "POST" });
        }
      }
      await refresh();
      router.push(paths.starters);
    } catch (e) {
      setError(messageOf(e) || copy.welcome.error);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 py-4 md:px-8 md:py-10">
      <h1 className="mb-2 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
        {copy.welcome.title}
      </h1>
      <p className="mb-[18px] text-[15px] leading-[22px] text-ink-700">
        {copy.welcome.sub}
      </p>
      <ul
        data-testid="label-picks"
        className="m-0 flex list-none flex-col gap-2.5 p-0"
      >
        {LABELS.filter((l) => itemsByLabel(l.slug).length > 0).map((label) => {
          const on = picked.includes(label.slug);
          const file = labelAvatar(label.slug);
          const focus = itemsByLabel(label.slug)[0]?.photos[0]?.focus;
          return (
            <li key={label.slug}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(label.slug)}
                className={`flex w-full items-center gap-3 rounded-[14px] bg-canvas px-3 py-2.5 text-left ${
                  on ? "border-2 border-ink" : "border border-line"
                }`}
              >
                <span className="block aspect-[3/4] w-12 flex-none overflow-hidden rounded-sm bg-surface">
                  {file ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={catalogUrl(file)}
                      alt=""
                      className="size-full object-cover"
                      style={{ objectPosition: focus }}
                    />
                  ) : null}
                </span>
                <span className="block flex-1">
                  <span className="block text-[15px] leading-5 font-semibold text-ink">
                    {label.name}
                  </span>
                  <span className="block text-[12px] leading-4 text-ink-600">
                    {label.meta} ·{" "}
                    {copy.welcome.pieces(itemsByLabel(label.slug).length)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-[26px] flex-none place-items-center rounded-full border text-[13px] font-semibold ${
                    on
                      ? "border-ink bg-ink text-canvas"
                      : "border-line bg-canvas text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void done()}
        disabled={left > 0 || busy}
        data-testid="labels-done"
        className="mt-[18px] inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-canvas disabled:bg-ink-500"
      >
        {busy
          ? copy.welcome.saving
          : left > 0
            ? copy.welcome.pickMore(left)
            : copy.welcome.done}
      </button>
    </div>
  );
}
