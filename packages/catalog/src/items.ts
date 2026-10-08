export type Category = "top" | "bottom" | "dress" | "outerwear";

export interface Credit {
  title: string;
  author: string;
  licence: string;
  sourceUrl: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  /** Invented label name (demo data). */
  label: string;
  priceUsd: number;
  category: Category;
  /** Fills the prompt's garment slot. Taken verbatim from fixtures/manifest.json. */
  description: string;
  /** Public path under apps/web/public. */
  image: string;
  credit: Credit;
  /** 0-100: how reliably this garment renders. */
  readiness: number;
  readinessReasons: string[];
}

const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${file}`;

export const ITEMS: CatalogItem[] = [
  {
    id: "g-shell-jacket",
    name: "Hooded shell jacket",
    label: "Northfold",
    priceUsd: 148,
    category: "outerwear",
    description: "grey-green hooded technical shell jacket",
    image: "/catalog/commons-shell-jacket.jpg",
    credit: {
      title: "Windbreaker Jacket, Hood Outside Transparency.png",
      author: "Ingolfson",
      licence: "CC0",
      sourceUrl: commons("Windbreaker_Jacket,_Hood_Outside_Transparency.png"),
    },
    readiness: 86,
    readinessReasons: [
      "Clear flat-lay on a plain ground; hood, zip and cuffs are all visible.",
    ],
  },
  {
    id: "g-parka",
    name: "Fur-trimmed parka",
    label: "Alder & Vale",
    priceUsd: 220,
    category: "outerwear",
    description: "olive parka with a fur-trimmed hood",
    image: "/catalog/commons-parka.jpg",
    credit: {
      title: "DustyRoyParka.jpg",
      author: "Dusty Roy",
      licence: "Public domain",
      sourceUrl: commons("DustyRoyParka.jpg"),
    },
    readiness: 78,
    readinessReasons: [
      "Source image is low resolution (750 px); trim texture may soften.",
    ],
  },
  {
    id: "g-leather-coat",
    name: "Black leather coat",
    label: "Marrow Lane",
    priceUsd: 310,
    category: "outerwear",
    description: "black leather car coat",
    image: "/catalog/commons-leather-coat.jpg",
    credit: {
      title:
        "Black Leather Coat of Charles A. Lindbergh - DPLA - eec840e73527f044387d2568bbdb7f20 (page 1).jpg",
      author: "Spalding",
      licence: "Public domain",
      sourceUrl: commons(
        "Black_Leather_Coat_of_Charles_A._Lindbergh_-_DPLA_-_eec840e73527f044387d2568bbdb7f20_(page_1).jpg",
      ),
    },
    readiness: 42,
    readinessReasons: [
      "Black leather photographed flat: sheen and fine detail are lost against the dark ground, so renders cannot be checked reliably yet.",
    ],
  },
  {
    id: "g-denim-jacket",
    name: "Cropped denim jacket",
    label: "Fenwick Row",
    priceUsd: 96,
    category: "outerwear",
    description: "light acid-wash cropped denim jacket",
    image: "/catalog/commons-denim-jacket.jpg",
    credit: {
      title: "1980s blue denim jacket, Finland – 01.jpg",
      author: "Etelä-Karjalan museo",
      licence: "CC BY 4.0",
      sourceUrl: commons("1980s_blue_denim_jacket,_Finland_%E2%80%93_01.jpg"),
    },
    readiness: 74,
    readinessReasons: [
      "Shown on a dress form; source image is low resolution (757 px).",
    ],
  },
  {
    id: "g-elbow-sweater",
    name: "Knit sweater with elbow patches",
    label: "Halden & Pine",
    priceUsd: 84,
    category: "top",
    description: "brown knit crew-neck sweater with suede elbow patches",
    image: "/catalog/commons-elbow-sweater.jpg",
    credit: {
      title: "Polo Ralph Lauren Gun Patch Sweater (13973497074).jpg",
      author: "Robert Sheie",
      licence: "CC BY 2.0",
      sourceUrl: commons(
        "Polo_Ralph_Lauren_Gun_Patch_Sweater_(13973497074).jpg",
      ),
    },
    readiness: 90,
    readinessReasons: ["Clear, well-lit product shot with distinct texture."],
  },
];
