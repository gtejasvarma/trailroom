"use client";
// The public unsubscribe page's one control. It sends the token it was given and shows the same
// words whatever the token was: nothing here depends on, or reveals, whether the token is real.
import { useState } from "react";
import { copy } from "../lib/copy";
import { Brand } from "./vote-page";
import { Button } from "./ui/button";

type State = "idle" | "working" | "done" | "failed" | "limited";

export function UnsubscribeForm({
  token,
  canSwitchBack,
}: {
  token: string;
  /** The server can send email, so the You screen has a switch to point at. Same for every token. */
  canSwitchBack: boolean;
}) {
  const [state, setState] = useState<State>("idle");

  async function stop() {
    setState("working");
    try {
      const res = await fetch(`/api/unsubscribe/${encodeURIComponent(token)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      setState(res.ok ? "done" : res.status === 429 ? "limited" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-5 pb-10 md:px-8 md:pt-9">
      <Brand />
      <div className="mt-6" data-testid="unsubscribe">
        <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
          {copy.unsubscribe.title}
        </h1>
        {state === "done" ? (
          <p
            role="status"
            data-testid="unsubscribe-done"
            className="text-[15px] leading-[22px] text-ink-700"
          >
            {copy.unsubscribe.done}
          </p>
        ) : (
          <>
            <p className="mb-5 text-[15px] leading-[22px] text-ink-700">
              {canSwitchBack
                ? copy.unsubscribe.body
                : copy.unsubscribe.bodyPlain}
            </p>
            <Button
              size="lg"
              onClick={stop}
              disabled={state === "working"}
              data-testid="unsubscribe-button"
            >
              {state === "working"
                ? copy.unsubscribe.working
                : copy.unsubscribe.button}
            </Button>
            {state === "failed" || state === "limited" ? (
              <p
                role="alert"
                className="mt-3 text-[14px] leading-5 text-danger"
              >
                {state === "limited"
                  ? copy.unsubscribe.tooMany
                  : copy.unsubscribe.failed}
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
