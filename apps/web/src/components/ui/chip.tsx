// Small pills that sit on or beside a photograph: "On you" is the only one drawn over an image.
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
