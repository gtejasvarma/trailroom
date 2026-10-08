"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { continueWithGoogle } from "../lib/account";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { alertStyle, body, btnLink, btnPrimary, h1, page } from "../lib/ui";

/** A guest's second item: guests get one try-on, so offer the account, then continue. */
export function SignupScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await continueWithGoogle();
      router.push(await startTryOnPath(itemId));
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <div className={`${page} max-w-[620px]`}>
      <h1 className={h1}>{copy.signup.title}</h1>
      <p className={`mt-2 ${body}`}>{copy.signup.body}</p>
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className={btnPrimary}
        >
          {copy.signup.google}
        </button>
        <Link href={paths.catalogue} className={btnLink}>
          {copy.signup.back}
        </Link>
      </div>
    </div>
  );
}
