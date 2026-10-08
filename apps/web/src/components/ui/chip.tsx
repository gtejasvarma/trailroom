// Small pills that sit on or beside a photograph: "Model shot", "↔ 3 photos", the Demo marker.
// They are interface, never drawn into an image.
type Tone = "dark" | "light" | "accent";
const tones: Record<Tone, string> = {
  dark: "bg-ink/70 text-canvas",
  light: "bg-canvas/90 text-ink",
  accent: "bg-accent text-canvas",
};

export function Chip({
  tone = "dark",
  upper = false,
  className = "",
  ...rest
}: {
  tone?: Tone;
  /** Small caps style used by the "Model shot" and "On your photo" markers. */
  upper?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold ${
        upper ? "uppercase tracking-[0.06em]" : ""
      } ${tones[tone]} ${className}`}
      {...rest}
    />
  );
}

/** A filter chip (desktop category row). */
export function FilterChip({
  selected,
  className = "",
  ...rest
}: { selected: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-9 rounded-full border px-4 text-[14px] leading-none font-medium transition-colors duration-150 ease-brand ${
        selected
          ? "border-ink bg-ink text-canvas"
          : "border-line bg-canvas text-ink-700"
      } ${className}`}
      {...rest}
    />
  );
}
