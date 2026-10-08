"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "../lib/copy";
import { routeForTryOn } from "../lib/flow";
import { alertStyle } from "../lib/ui";
import { Button, type ButtonSize } from "./ui/button";

/** The primary action on a card or product page. Routes by state; shows errors inline. */
export function TryOnButton({
  itemId,
  name,
  size = "lg",
  className = "",
}: {
  itemId: string;
  name: string;
  size?: ButtonSize;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      router.push(await routeForTryOn(itemId));
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.item.startError);
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={go}
        disabled={busy}
        size={size}
        className={`w-full ${className}`}
      >
        {copy.item.tryItOn}
        <span className="sr-only"> {name}</span>
      </Button>
      {error ? (
        <p role="alert" className={`mt-2 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
