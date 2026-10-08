// Shared class strings. Every colour is a Design.md §11 token via the Tailwind theme.
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 text-[16px] font-medium transition-transform duration-150 ease-brand active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100";

/** One filled button per screen. */
export const btnPrimary = `${base} rounded-full bg-ink px-6 text-canvas shadow-1 active:bg-ink-800 disabled:bg-ink-500 disabled:shadow-none`;
export const btnSecondary = `${base} rounded-md border border-line bg-canvas px-6 text-ink disabled:text-ink-500`;
/** Tertiary: bare accent text. */
export const btnLink =
  "inline-flex min-h-11 items-center text-[16px] font-medium text-accent underline-offset-4 hover:underline";
export const btnIcon =
  "inline-flex size-12 items-center justify-center rounded-md border border-line bg-canvas text-ink disabled:text-ink-500";

export const page = "mx-auto w-full max-w-container px-4 py-6 md:px-8 md:py-10";
export const h1 =
  "text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]";
export const h2 =
  "text-[20px] leading-[26px] font-medium tracking-[-0.01em] text-ink md:text-[24px] md:leading-8";
export const body = "text-[16px] leading-6 text-ink-700";
export const small = "text-[14px] leading-5 text-ink-700";
export const caption = "text-[12px] leading-4 text-ink-600";
export const labelStyle =
  "text-[11px] leading-[14px] font-semibold uppercase tracking-[0.08em] text-ink-600";
export const alertStyle =
  "rounded-md bg-danger-bg px-4 py-3 text-[14px] leading-5 text-danger";
