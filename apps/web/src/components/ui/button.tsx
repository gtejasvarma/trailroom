// Buttons, matching the prototype: pill shaped, a filled ink primary, an outlined secondary, and
// a quiet text button. Colours are Design.md tokens through the Tailwind theme.
import Link from "next/link";

export type ButtonVariant = "filled" | "outline" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium leading-none transition-transform duration-150 ease-brand active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed";
const variants: Record<ButtonVariant, string> = {
  filled:
    "bg-ink text-canvas active:bg-ink-800 disabled:bg-ink-500 font-semibold",
  outline: "border border-line bg-canvas text-ink disabled:text-ink-500",
  quiet: "bg-transparent text-accent hover:underline underline-offset-4",
};
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-6 text-[16px]",
};

export function buttonClass(
  variant: ButtonVariant = "filled",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: Common & React.ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
