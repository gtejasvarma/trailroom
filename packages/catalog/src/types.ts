export type Category = "top" | "bottom" | "dress" | "outerwear";
export type ShopCategory = "apparel" | "jewellery" | "accessories";
/** ready: we render it. not_yet: a kind of piece we have not built yet. cannot: this piece, honestly. */
export type TryOn = "ready" | "not_yet" | "cannot";

export interface Photo {
  /** File name under catalog/ in the bucket. */
  file: string;
  /** What the label's photograph shows: "Front", "Three-quarter", … */
  label: string;
  /** CSS object-position for cropping to a card. */
  focus: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  /** Invented label name (demo data). */
  label: string;
  labelSlug: string;
  priceUsd: number;
  shopCategory: ShopCategory;
  /** The line above a card: "New in", "From a label you follow", … */
  shelf: string;
  stock: { line: string; low: boolean };
  pairsWith: string[];
  /** The label's own photographs, 1 to 4. */
  photos: Photo[];
  /** Shopper-facing: fabric, cut and construction only. */
  description: string;
  /** The prompt's garment slot, or null for pieces we do not render. */
  category: Category | null;
  /** A short noun phrase that fills the prompt: "chambray wide-leg jumpsuit". */
  promptDescription: string;
  /** The single photo sent to the model (a file name under catalog/). */
  renderImage: string;
  /** 0-100: how reliably this garment renders. */
  readiness: number;
  readinessReasons: string[];
  tryOn: TryOn;
}
