"use client";
// Hands the pieces published after the static twelve to the browser's copy of the catalogue, so a
// screen that reads the catalogue (the label page, the feed) agrees with what the server rendered.
// The catalogue's registry is additive on the client: later calls (the arrivals shelf) add more.
import { registerPublishedItems, type CatalogItem } from "@trailroom/catalog";

export function PublishedCatalog({
  items,
  children,
}: {
  items: CatalogItem[];
  children: React.ReactNode;
}) {
  // Idempotent, and it must happen before the children render (also while hydrating).
  registerPublishedItems(items);
  return <>{children}</>;
}
