// The twelve demo pieces, taken from the Trailroom design prototype. Labels, prices and stock
// lines are invented. Descriptions say fabric, cut and construction only: never where a piece
// falls on a body (CLAUDE.md hard rule).
import { LABELS } from "./labels";
import type { CatalogItem, Photo } from "./types";

export * from "./types";

const POSE_LABELS = ["Front", "Three-quarter", "Back", "Walking"];
const POSE_FOCUS = ["50% 26%", "50% 22%", "50% 28%", "50% 26%"];

/** Four label photographs: `<stem>-front`, `-three` (or `-three-quarter`), `-back`, `-walking`. */
function fourPhotos(
  stem: string,
  three = "three",
  focus = POSE_FOCUS,
): Photo[] {
  return [`front`, three, `back`, `walking`].map((suffix, i) => ({
    file: `${stem}-${suffix}.webp`,
    label: POSE_LABELS[i]!,
    focus: focus[i]!,
  }));
}

const one = (id: number, focus: string): Photo[] => [
  { file: `p${id}.jpg`, label: "Label’s photo", focus },
];

const slugOf = (name: string) => LABELS.find((l) => l.name === name)!.slug;

type Spec = Omit<CatalogItem, "labelSlug" | "renderImage" | "tryOn"> & {
  tryOn?: CatalogItem["tryOn"];
};

const finish = (s: Spec): CatalogItem => ({
  ...s,
  labelSlug: slugOf(s.label),
  renderImage: s.photos[0]!.file,
  tryOn: s.tryOn ?? "ready",
});

const OK = "Clear label photographs with the whole garment visible.";
const JEWELLERY_REASON = "We can’t show jewellery on a photo yet.";
const instock = { line: "In stock", low: false };

export const ITEMS: CatalogItem[] = [
  finish({
    id: "jump",
    name: "Chambray wide-leg jumpsuit",
    label: "MARCHAND",
    priceUsd: 268,
    shopCategory: "apparel",
    shelf: "New in",
    stock: { line: "Only 2 left", low: true },
    pairsWith: ["hoops", "chain"],
    photos: fourPhotos("dress-2"),
    description: "Washed chambray with a gathered bust and a wide-leg cut.",
    category: "dress",
    promptDescription: "chambray wide-leg jumpsuit",
    readiness: 88,
    readinessReasons: [OK],
  }),
  finish({
    id: "maxi",
    name: "Tiered floral maxi",
    label: "ANSEL WARD",
    priceUsd: 295,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["hoops", "chain"],
    photos: fourPhotos("dress-3"),
    description:
      "Crinkle georgette, tiered from a button placket, flutter sleeve.",
    category: "dress",
    promptDescription: "tiered floral georgette maxi dress",
    readiness: 84,
    readinessReasons: [OK],
  }),
  finish({
    id: "coord",
    name: "Striped crochet co-ord",
    label: "LOAM STUDIO",
    priceUsd: 340,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["chain", "hoops"],
    photos: fourPhotos("dress-4"),
    description:
      "Open crochet stripe, wrap-tie waistcoat over a matching wide trouser.",
    category: "dress",
    promptDescription: "striped crochet waistcoat and wide trouser co-ord",
    readiness: 80,
    readinessReasons: [OK],
  }),
  finish({
    id: "vest",
    name: "Knit button vest",
    label: "MARCHAND",
    priceUsd: 158,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["coat", "hoops"],
    photos: fourPhotos("dress-5"),
    description:
      "Ribbed knit with an asymmetric button placket and a side tie.",
    category: "top",
    promptDescription: "ribbed knit button vest",
    readiness: 86,
    readinessReasons: [OK],
  }),
  finish({
    id: "coat",
    name: "Wool car coat",
    label: "ANSEL WARD",
    priceUsd: 328,
    shopCategory: "apparel",
    shelf: "New in",
    stock: { line: "Only 3 left", low: true },
    pairsWith: ["hoops", "chain"],
    photos: one(19299199, "50% 25%"),
    description: "Double-faced wool in a long, straight cut.",
    category: "outerwear",
    promptDescription: "double-faced wool car coat",
    readiness: 82,
    readinessReasons: [OK],
  }),
  finish({
    id: "slip",
    name: "Bias-cut slip dress",
    label: "MARCHAND",
    priceUsd: 245,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["coat", "hoops"],
    photos: one(18526354, "50% 35%"),
    description: "Bias-cut silk in a slip silhouette.",
    category: "dress",
    promptDescription: "bias-cut silk slip dress",
    readiness: 76,
    readinessReasons: [OK],
  }),
  finish({
    id: "suit",
    name: "Tailored linen suit",
    label: "LOAM STUDIO",
    priceUsd: 410,
    shopCategory: "apparel",
    shelf: "From a label you follow",
    stock: { line: "Only 2 left", low: true },
    pairsWith: ["chain", "hoops"],
    photos: one(8368060, "50% 35%"),
    description:
      "Washed Belgian linen with a dropped shoulder and a wide-leg trouser.",
    category: "dress",
    promptDescription: "washed linen jacket and wide trouser suit",
    readiness: 78,
    readinessReasons: [OK],
  }),
  finish({
    id: "hoops",
    name: "Sculpted hoops",
    label: "CYRA",
    priceUsd: 86,
    shopCategory: "jewellery",
    shelf: "Goes with the slip dress",
    stock: instock,
    pairsWith: ["chain", "coat"],
    photos: one(14411703, "50% 30%"),
    description: "42mm across, hollow brass so they stay light.",
    category: null,
    promptDescription: "sculpted brass hoop earrings",
    readiness: 0,
    readinessReasons: [JEWELLERY_REASON],
    tryOn: "not_yet",
  }),
  finish({
    id: "set",
    name: "White trouser set",
    label: "LOAM STUDIO",
    priceUsd: 298,
    shopCategory: "apparel",
    shelf: "Popular this month",
    stock: instock,
    pairsWith: ["hoops", "chain"],
    photos: one(10201379, "50% 40%"),
    description: "A square-cut jacket over a straight-leg trouser.",
    category: "dress",
    promptDescription: "white jacket and straight-leg trouser set",
    readiness: 80,
    readinessReasons: [OK],
  }),
  finish({
    id: "blouse",
    name: "Pink wrap top",
    label: "MARCHAND",
    priceUsd: 188,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["coat", "hoops"],
    photos: fourPhotos("wrap-top", "three-quarter", [
      "50% 32%",
      "50% 32%",
      "50% 32%",
      "50% 26%",
    ]),
    description: "Crepe wrap top, gathered through a cast brass ring.",
    category: "top",
    promptDescription: "pink crepe wrap top",
    readiness: 90,
    readinessReasons: [OK],
  }),
  finish({
    id: "chain",
    name: "Fine curb chain",
    label: "CYRA",
    priceUsd: 140,
    shopCategory: "jewellery",
    shelf: "Goes with the hoops",
    stock: instock,
    pairsWith: ["hoops", "slip"],
    photos: one(7615245, "50% 40%"),
    description: "A fine curb chain, 18 inches long.",
    category: null,
    promptDescription: "fine curb chain necklace",
    readiness: 0,
    readinessReasons: [JEWELLERY_REASON],
    tryOn: "not_yet",
  }),
  finish({
    id: "jacket",
    name: "Cropped leather jacket",
    label: "MARCHAND",
    priceUsd: 520,
    shopCategory: "apparel",
    shelf: "New in",
    stock: instock,
    pairsWith: ["slip", "hoops"],
    photos: one(2036102, "50% 40%"),
    description:
      "Lamb leather in a cropped cut. The label’s only photo has it folded over an arm.",
    category: "outerwear",
    promptDescription: "cropped lamb leather jacket",
    readiness: 42,
    readinessReasons: [
      "The label’s only photo has the jacket folded over an arm, so we can’t see its cut well enough to render it honestly.",
    ],
    tryOn: "cannot",
  }),
];
