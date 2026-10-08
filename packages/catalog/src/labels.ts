// The five invented labels (demo data). Names are as the prototype writes them.
export interface Label {
  slug: string;
  name: string;
  /** "Independent · Paris" */
  meta: string;
}

export const LABELS: readonly Label[] = [
  { slug: "ansel-ward", name: "ANSEL WARD", meta: "Independent · London" },
  { slug: "marchand", name: "MARCHAND", meta: "Independent · Paris" },
  {
    slug: "loam-studio",
    name: "LOAM STUDIO",
    meta: "Independent · Los Angeles",
  },
  { slug: "cyra", name: "CYRA", meta: "Independent · Lisbon" },
  { slug: "fen-row", name: "FEN & ROW", meta: "Independent · Portland" },
];

export function getLabel(slug: string): Label | undefined {
  return LABELS.find((l) => l.slug === slug);
}
