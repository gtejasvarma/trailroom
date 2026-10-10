"use client";
// "How your photos are handled": the Details sheet. One component, opened from the upload screens'
// Details link, from You and Studio, and from the account menu.
import { copy } from "../lib/copy";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export function PrivacySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} title={copy.privacy.title} onClose={onClose}>
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
      <Button onClick={onClose} size="md" className="mt-4 w-full">
        {copy.privacy.done}
      </Button>
    </Sheet>
  );
}
