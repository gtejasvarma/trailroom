import { describe, expect, it } from "vitest";
import { cleanQuestion, firstNameOf, originOf } from "./asks";
import { cleanName } from "./lists";

const BAD = [
  "\u0085", // C1 control
  "؜",
  "‎",
  "‏",
  "‪",
  "‫",
  "‬",
  "‭",
  "‮",
  "⁦",
  "⁧",
  "⁨",
  "⁩",
  " ",
  " ",
  "﻿",
];

describe("free text shown on the public page", () => {
  it("drops controls and bidi/format characters from every field", () => {
    for (const c of BAD) {
      expect(cleanQuestion(`Which${c}one`)).not.toMatch(/[\p{Cc}]/u);
      expect(cleanQuestion(`Which${c}one`)).not.toContain(c.trim() || "\u0000");
      expect(firstNameOf(`Ma${c}ya Lee`)).toBe("Maya");
      // Control characters refuse a list name outright; the rest are dropped from it.
      expect(cleanName(`Wed${c}ding`)).toBe(
        /\p{Cc}/u.test(c) ? null : "Wedding",
      );
    }
    expect(cleanQuestion("a‮b")).toBe("ab");
  });

  it("keeps ZWJ and ZWNJ, which emoji and several scripts need", () => {
    const family = "\u{1F469}‍\u{1F469}‍\u{1F467}";
    expect(cleanQuestion(`Pick ${family}`)).toBe(`Pick ${family}`);
    expect(firstNameOf("م‌ی Lee")).toBe("م‌ی");
    expect(cleanName("A‌b")).toBe("A‌b");
  });

  it("still strips <> from names and refuses controls in list names", () => {
    expect(firstNameOf("<b>Maya")).toBe("bMaya");
    expect(cleanName("a\u0007b")).toBeNull();
  });
});

describe("originOf", () => {
  const r = (h: Record<string, string>) =>
    new Request("https://0.0.0.0:8080/api/asks", { headers: h });
  const env = {
    INTERNAL_AUDIENCE: "https://app.example.com",
    PUBLIC_ORIGINS: "https://trailroom.ai, https://www.trailroom.ai",
  };

  it("accepts a forwarded host on the allowlist", () => {
    expect(
      originOf(
        r({
          "x-forwarded-host": "trailroom.ai",
          "x-forwarded-proto": "https",
        }),
        env,
      ),
    ).toBe("https://trailroom.ai");
    expect(
      originOf(
        r({
          "x-forwarded-host": "app.example.com",
          "x-forwarded-proto": "https",
        }),
        env,
      ),
    ).toBe("https://app.example.com");
  });

  it("falls back to INTERNAL_AUDIENCE for any other forwarded host or scheme", () => {
    expect(
      originOf(
        r({ "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" }),
        env,
      ),
    ).toBe("https://app.example.com");
    expect(
      originOf(
        r({
          "x-forwarded-host": "trailroom.ai",
          "x-forwarded-proto": "http",
        }),
        env,
      ),
    ).toBe("https://app.example.com");
    expect(originOf(r({ host: "evil.test" }), env)).toBe(
      "https://app.example.com",
    );
  });

  it("keeps trusting the headers when INTERNAL_AUDIENCE is unset", () => {
    expect(
      originOf(
        r({
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        }),
        {},
      ),
    ).toBe("http://localhost:3000");
  });
});
