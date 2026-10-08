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
  onClose,
  children,
}: {
  open: boolean;
  title: string;
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
      className="sheet m-0 mx-auto mt-auto w-full max-w-[480px] rounded-t-lg border-0 bg-canvas p-6 text-ink shadow-8"
    >
      <h2 id={titleId} className={h2}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}
