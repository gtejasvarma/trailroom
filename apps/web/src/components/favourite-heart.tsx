"use client";
// The heart on an image: one tap saves the piece to Favourites, a tap on a filled heart takes it
// out again (or, when other lists hold it too, opens the list sheet). The button sits on the
// photograph, so it is a white disc with the ink heart: never the accent, which is not allowed
// beside a garment.
import { useEffect, useRef, useState } from "react";
import { copy } from "../lib/copy";
import { useFavourite } from "./save-to-list";
import { HeartIcon } from "./ui/icons";

export function FavouriteHeart({
  itemId,
  className = "",
}: {
  itemId: string;
  className?: string;
}) {
  const { saved, toggle } = useFavourite(itemId);
  // The glyph pops once when the person saves; never on unsave and never on first paint.
  const [pop, setPop] = useState(0);
  const was = useRef(saved);
  const byTap = useRef(false);
  useEffect(() => {
    if (saved && !was.current && byTap.current) setPop((n) => n + 1);
    was.current = saved;
    byTap.current = false;
  }, [saved]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        byTap.current = true;
        toggle();
      }}
      aria-label={saved ? copy.card.savedFavourite : copy.card.saveFavourite}
      data-testid="heart"
      data-saved={saved ? "true" : "false"}
      className={`absolute z-10 grid size-11 place-items-center rounded-full bg-canvas/90 text-ink shadow-1 transition-transform duration-150 ease-brand active:scale-[.97] motion-reduce:transition-none ${className}`}
    >
      <span key={pop} className={pop > 0 ? "heart-pop block" : "block"}>
        <HeartIcon filled={saved} />
      </span>
    </button>
  );
}
