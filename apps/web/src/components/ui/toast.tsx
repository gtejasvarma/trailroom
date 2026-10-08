"use client";
// A toast with an optional action: the prototype's say(toast, action, target).
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}
interface ToastState {
  message: string;
  action?: ToastAction;
  key: number;
}

const SHOW_MS = 3600;
const ToastContext = createContext<
  (message: string, action?: ToastAction) => void
>(() => {});

/** `say("Following MARCHAND.")` or `say("Ready", { label: "See it", href: "/try-on/x" })`. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const counter = useRef(0);

  const say = useCallback((message: string, action?: ToastAction) => {
    clearTimeout(timer.current);
    setToast({ message, action, key: ++counter.current });
    timer.current = setTimeout(() => setToast(null), SHOW_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => say, [say]);

  const act = toast?.action;
  const actionClass =
    "flex-none text-[14px] font-semibold text-canvas underline underline-offset-2";
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center md:bottom-7"
      >
        {toast ? (
          <div
            key={toast.key}
            data-testid="toast"
            className="toast pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-md bg-ink px-4 py-3 text-[14px] leading-5 text-canvas shadow-4"
          >
            <span className="flex-1">{toast.message}</span>
            {act?.href ? (
              <Link
                href={act.href}
                onClick={() => setToast(null)}
                className={actionClass}
              >
                {act.label}
              </Link>
            ) : act ? (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  act.onClick?.();
                }}
                className={actionClass}
              >
                {act.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
