"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { CONSENT_VERSION } from "../lib/consent";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import {
  alertStyle,
  body,
  btnPrimary,
  btnSecondary,
  h1,
  page,
} from "../lib/ui";

/** Consent and age gate. A routed full screen. No file input exists on it. */
export function ConsentScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const ageId = useId();
  const agreeId = useId();
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await api.consent(CONSENT_VERSION);
      router.push(paths.photo(itemId));
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  const box = "mt-1 size-6 shrink-0 accent-accent";
  return (
    <div className={`${page} max-w-[620px]`}>
      <h1 className={h1}>{copy.consent.title}</h1>
      <p className={`mt-2 ${body}`}>{copy.consent.intro}</p>
      <ul className={`mt-4 list-disc space-y-2 pl-5 ${body}`}>
        {copy.consent.statements.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div className="mt-6 space-y-4">
        <div className="flex gap-3">
          <input
            id={ageId}
            type="checkbox"
            checked={age}
            onChange={(e) => setAge(e.target.checked)}
            className={box}
          />
          <label htmlFor={ageId} className={`${body} text-ink`}>
            {copy.consent.ageLabel}
          </label>
        </div>
        <div className="flex gap-3">
          <input
            id={agreeId}
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className={box}
          />
          <label htmlFor={agreeId} className={`${body} text-ink`}>
            {copy.consent.agreeLabel}
          </label>
        </div>
      </div>
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={accept}
          disabled={!age || !agree || busy}
          className={btnPrimary}
        >
          {copy.consent.accept}
        </button>
        <button
          type="button"
          onClick={() => router.push(paths.item(itemId))}
          disabled={busy}
          className={btnSecondary}
        >
          {copy.consent.decline}
        </button>
      </div>
    </div>
  );
}
