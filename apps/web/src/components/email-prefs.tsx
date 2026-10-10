"use client";
// The two email switches. This component is only mounted when the server reports it can send
// email (me.emailEnabled), so with no transport configured nothing about email reaches a screen.
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { alertStyle } from "../lib/ui";
import type { EmailPrefsBody } from "../server/email/prefs";
import { useToast } from "./ui/toast";
import { SectionLabel } from "./you-parts";

const ROWS: {
  key: keyof EmailPrefsBody;
  label: string;
  meta: string;
}[] = [
  { key: "news", label: copy.email.newsLabel, meta: copy.email.newsMeta },
  { key: "price", label: copy.email.priceLabel, meta: copy.email.priceMeta },
];

export function EmailPrefs() {
  const say = useToast();
  const [prefs, setPrefs] = useState<EmailPrefsBody | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .emailPrefs()
      .then((p) => !cancelled && setPrefs(p))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: keyof EmailPrefsBody) {
    if (!prefs) return;
    const next = !prefs[key];
    setPrefs({ ...prefs, [key]: next });
    try {
      setPrefs(await api.setEmailPrefs({ [key]: next }));
      say(copy.email.saved);
    } catch {
      setPrefs(prefs);
      setFailed(true);
    }
  }

  if (!prefs && !failed) return null;
  return (
    <section
      className="mb-5"
      aria-labelledby="email-heading"
      data-testid="email-prefs"
    >
      <SectionLabel id="email-heading">{copy.email.prefsTitle}</SectionLabel>
      <p className="mb-2 text-[13px] leading-[18px] text-ink-700">
        {copy.email.prefsNote}
      </p>
      {failed ? (
        <p role="alert" className={`mb-2 ${alertStyle}`}>
          {copy.email.saveFailed}
        </p>
      ) : null}
      {prefs ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {ROWS.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[r.key]}
                data-testid={`email-${r.key}`}
                onClick={() => void toggle(r.key)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                  prefs[r.key] ? "border-2 border-accent" : "border-line"
                }`}
              >
                <span className="block flex-1">
                  <span className="block text-[15px] leading-5 font-medium text-ink">
                    {r.label}
                  </span>
                  <span className="block text-[12px] leading-4 text-ink-600">
                    {r.meta}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-6 flex-none place-items-center rounded-full text-[12px] font-semibold text-canvas ${
                    prefs[r.key] ? "bg-accent" : "border border-line"
                  }`}
                >
                  {prefs[r.key] ? "✓" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
