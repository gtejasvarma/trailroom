"use client";
import { useEffect, useId, useRef } from "react";
import { h2 } from "../../lib/ui";

/**
 * An accessible bottom sheet on a native modal <dialog>: the browser traps focus and makes the
 * page inert; Escape and a click on the backdrop close it; Tab wraps inside it.
 */
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

function trapTab(e: React.KeyboardEvent<HTMLDialogElement>) {
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Sheet({
  open,
  title,
  subtitle,
  aside,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  /** With `aside`: the line under the title, beside the picture. */
  subtitle?: React.ReactNode;
  /**
   * A picture shown beside the title: 80 px wide on a phone sheet, a 300 px column on a desktop
   * modal (the sheet becomes a centred two-column dialog from 768px).
   */
  aside?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={trapTab}
      onClick={(e) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (e.target === ref.current) onClose();
      }}
      className={`sheet m-0 mx-auto mt-auto w-full rounded-t-lg border-0 bg-canvas text-ink shadow-8 ${
        aside
          ? "max-w-[480px] overflow-hidden p-6 md:my-auto md:max-w-[760px] md:rounded-lg md:p-0"
          : "max-w-[480px] p-6"
      }`}
    >
      {aside ? (
        <div className="grid grid-cols-[80px_1fr] gap-x-3 md:grid-cols-[300px_1fr] md:gap-x-0">
          <div className="overflow-hidden rounded-md md:row-span-2 md:rounded-none">
            {aside}
          </div>
          <div className="min-w-0 md:px-8 md:pt-8">
            <h2
              id={titleId}
              className="text-[19px] leading-[25px] font-semibold tracking-[-0.01em] text-ink md:text-[24px] md:leading-8"
            >
              {title}
            </h2>
            <p className="mt-[5px] text-[14px] leading-5 text-ink-700">
              {subtitle}
            </p>
          </div>
          <div className="col-span-2 mt-4 md:col-span-1 md:px-8 md:pb-8">
            {children}
          </div>
        </div>
      ) : (
        <>
          <h2 id={titleId} className={h2}>
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
