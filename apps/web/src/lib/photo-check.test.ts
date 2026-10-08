import { describe, expect, it } from "vitest";
import {
  checkPhotoFacts,
  formatOfMime,
  MAX_INPUT_PIXELS,
  MAX_TALL_RATIO,
  MAX_UPLOAD_BYTES,
  MAX_WIDE_RATIO,
  MIN_SHORT_SIDE,
  type PhotoFacts,
  type PhotoRejection,
} from "./photo-check";
import { ERRORS } from "../server/errors";

// The browser's instant check and the server both call checkPhotoFacts, so this table is the
// contract for both. The emulator suite (api.emu.test.ts) runs the same rows through the server.
const TABLE: [string, PhotoFacts, PhotoRejection | null][] = [
  ["a normal portrait", { format: "jpeg", width: 800, height: 1100 }, null],
  ["png and webp are fine", { format: "png", width: 900, height: 1200 }, null],
  ["webp", { format: "webp", width: 900, height: 1200 }, null],
  [
    "exactly the short side",
    { format: "jpeg", width: MIN_SHORT_SIDE, height: 1024 },
    null,
  ],
  [
    "one pixel under",
    { format: "jpeg", width: MIN_SHORT_SIDE - 1, height: 1024 },
    "too_small",
  ],
  ["wide at the limit", { format: "jpeg", width: 1024, height: 768 }, null],
  [
    "wider than 4:3",
    { format: "jpeg", width: 2000, height: 900 },
    "bad_aspect",
  ],
  [
    "taller than 1:3",
    { format: "jpeg", width: 800, height: 2600 },
    "bad_aspect",
  ],
  ["tall at the limit", { format: "jpeg", width: 800, height: 2400 }, null],
  ["gif", { format: "gif", width: 800, height: 1000 }, "unsupported_type"],
  ["tiff", { format: "tiff", width: 800, height: 1000 }, "unsupported_type"],
  ["did not decode", { format: null, width: 0, height: 0 }, "not_an_image"],
  ["no size", { format: "jpeg", width: 0, height: 0 }, "not_an_image"],
  [
    "over 10 MB",
    { bytes: MAX_UPLOAD_BYTES + 1, format: "jpeg", width: 800, height: 1000 },
    "too_large",
  ],
  [
    "exactly 10 MB",
    { bytes: MAX_UPLOAD_BYTES, format: "jpeg", width: 800, height: 1000 },
    null,
  ],
  [
    "too many pixels",
    { format: "png", width: 12000, height: 12000 },
    "too_large",
  ],
  [
    "first failure wins: huge file that is also a gif",
    { bytes: MAX_UPLOAD_BYTES + 1, format: "gif", width: 800, height: 1000 },
    "too_large",
  ],
];

describe("checkPhotoFacts", () => {
  it.each(TABLE)("%s", (_name, facts, expected) => {
    expect(checkPhotoFacts(facts)).toBe(expected);
  });

  it("shares its constants with the server's rules", () => {
    expect(MIN_SHORT_SIDE).toBe(768);
    expect(MAX_WIDE_RATIO).toBeCloseTo(4 / 3);
    expect(MAX_TALL_RATIO).toBe(3);
    expect(MAX_INPUT_PIXELS).toBe(50_000_000);
  });

  it("every rejection has a specific server message to show", () => {
    for (const code of [
      "not_an_image",
      "unsupported_type",
      "too_large",
      "too_small",
      "bad_aspect",
    ] as const) {
      expect(ERRORS[code].message.length).toBeGreaterThan(20);
    }
  });
});

describe("formatOfMime", () => {
  it("maps mime types to decoder names", () => {
    expect(formatOfMime("image/jpeg")).toBe("jpeg");
    expect(formatOfMime("image/jpg")).toBe("jpeg");
    expect(formatOfMime("image/PNG")).toBe("png");
    expect(formatOfMime("image/heic")).toBe("heic");
    expect(formatOfMime("")).toBeNull();
    expect(formatOfMime("text/plain")).toBeNull();
  });
});
