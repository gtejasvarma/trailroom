"use client";
// The line under every upload control: what adding a photo means, and the Details sheet that
// says what happens to it. Adding a photo is the consent, so the sentence must sit right here.
import { useState } from "react";
import { copy } from "../lib/copy";
import { PrivacySheet } from "./privacy-sheet";

export function ConsentLine({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const text = tone === "dark" ? "text-ink-400" : "text-ink-600";
  return (
    <div
      data-testid="consent-line"
      className={`text-[13px] leading-[18px] ${text}`}
    >
      <p className="mb-1.5">{copy.consentLine}</p>
      <p>
        {copy.privacy.line}{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline font-medium underline-offset-4 hover:underline ${
            tone === "dark" ? "text-canvas underline" : "text-accent"
          }`}
        >
          {copy.privacy.details}
        </button>
      </p>
      <PrivacySheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
