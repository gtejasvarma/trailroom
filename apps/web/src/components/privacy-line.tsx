"use client";
// The line under every upload control: what adding a photo means, and the Details sheet that
// says what happens to it. Adding a photo is the consent, so the sentence must sit right here.
import { useState } from "react";
import { copy } from "../lib/copy";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";

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
      <Sheet
        open={open}
        title={copy.privacy.title}
        onClose={() => setOpen(false)}
      >
        <div className="mt-3">
          {copy.privacy.rows.map(([glyph, text]) => (
            <div
              key={text}
              className="flex items-start gap-3 border-b border-line-soft py-2.5"
            >
              <span
                aria-hidden="true"
                className="grid size-7 flex-none place-items-center rounded-full bg-accent-tint text-[12px] text-accent"
              >
                {glyph}
              </span>
              <span className="flex-1 text-[14px] leading-5 text-ink-700">
                {text}
              </span>
            </div>
          ))}
        </div>
        <Button
          onClick={() => setOpen(false)}
          size="md"
          className="mt-4 w-full"
        >
          {copy.privacy.done}
        </Button>
      </Sheet>
    </div>
  );
}
