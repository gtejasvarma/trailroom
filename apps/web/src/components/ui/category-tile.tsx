import { catalogUrl } from "@trailroom/catalog";

/** A square photo tile with its name beneath: the mobile "What are you looking for" row. */
export function CategoryTile({
  label,
  file,
  focus,
  selected,
  onClick,
}: {
  label: string;
  file: string;
  focus: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex-1 overflow-hidden rounded-md bg-canvas p-0 text-left ${
        selected ? "border-2 border-ink" : "border border-line"
      }`}
    >
      <span className="block aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalogUrl(file)}
          alt=""
          className="size-full object-cover"
          style={{ objectPosition: focus }}
        />
      </span>
      <span className="block px-2 py-2 text-[13px] leading-[18px] font-semibold text-ink">
        {label}
      </span>
    </button>
  );
}
