import { describe, expect, it } from "vitest";
import { CATALOG, findFitLanguage } from "@trailroom/catalog";
import { copy, EXPECTATION_LINE } from "./copy";

// Every user-visible string in the product is in copy.ts, so linting it lints the product.
function strings(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === "string") out.push([path, value]);
  else if (typeof value === "function") {
    // Dynamic strings: call with plain strings and with numbers, so every branch reads as text.
    for (const args of [
      ["Sample piece", "Sample label", "Front"],
      [1, 4],
    ]) {
      out.push([
        `${path}()`,
        String((value as (...a: unknown[]) => unknown)(...args)),
      ]);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
}

const all: [string, string][] = [];
strings(copy, "copy", all);

// The one sentence that may mention fit: the expectation-setting caption (Design.md §8).
const ALLOWLIST = new Set([EXPECTATION_LINE]);

const BODY_JUDGEMENT: [string, RegExp][] = [
  ["flatter", /\bflatter/i],
  ["slim", /\bslim/i],
  ["hide", /\bhid(e|es|ing|den)\b/i],
  ["fix your", /\bfix(es|ing)? your\b/i],
  ["before/after", /\bbefore\s*(\/|and|&)\s*after\b/i],
  ["rate", /\brat(e|es|ed|ing|ings)\b/i],
  ["score", /\bscor(e|es|ed|ing)\b/i],
  ["perfect on you", /\bperfect on you\b/i],
];

describe("copy.ts lint", () => {
  it("walks a meaningful number of strings", () => {
    expect(all.length).toBeGreaterThan(80);
  });

  it("has no fit or size language, except the one allowlisted caption", () => {
    for (const [path, text] of all) {
      if (ALLOWLIST.has(text)) continue;
      expect(findFitLanguage(text), `${path}: "${text}"`).toBeNull();
    }
  });

  it("the allowlist is exactly one string and it really is the expectation caption", () => {
    expect(ALLOWLIST.size).toBe(1);
    expect(findFitLanguage(EXPECTATION_LINE)).not.toBeNull();
    expect(EXPECTATION_LINE).toBe(
      "A preview, not a fitting — it can't tell you size or fit.",
    );
    expect(copy.result.expectation).toBe(EXPECTATION_LINE);
    // It appears nowhere but under the result image.
    expect(all.filter(([, t]) => t === EXPECTATION_LINE)).toHaveLength(1);
  });

  it("has no body-judgement language", () => {
    for (const [path, text] of all) {
      for (const [name, re] of BODY_JUDGEMENT) {
        expect(re.test(text), `${path} matches "${name}": "${text}"`).toBe(
          false,
        );
      }
    }
  });

  it("has sentence-case buttons that name the outcome", () => {
    expect(copy.item.tryItOn).toBe("Try it on");
    expect(copy.photo.use).toBe("Use this photo");
    expect(copy.you.deleteAll).toBe("Delete everything");
    for (const label of [
      copy.item.tryItOn,
      copy.photo.use,
      copy.photo.chooseAnother,
      copy.photo.browse,
      copy.whichPhoto.confirm,
      copy.whichPhoto.different,
      copy.result.addAnother,
      copy.result.addToList,
      copy.failure.tryAgain,
    ]) {
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    }
  });
});

describe("counts in copy", () => {
  it("the account sheet title states the real number of poses", () => {
    expect(copy.account.title(4)).toBe("Four poses are ready");
    expect(copy.account.title(3)).toBe("Three poses are ready");
    expect(copy.account.title(1)).toBe("One pose is ready");
  });
  it("the render status names the real pose count and number ready", () => {
    expect(copy.status.rendering(2, 4)).toBe(
      "Rendering four poses. 2 of 4 ready.",
    );
    expect(copy.status.rendering(0, 12)).toBe(
      "Rendering 12 poses. 0 of 12 ready.",
    );
  });
});

describe("catalogue text shown in the UI", () => {
  it("names, labels and readiness reasons carry no fit or body-judgement language", () => {
    for (const item of CATALOG) {
      for (const text of [item.name, item.label, ...item.readinessReasons]) {
        expect(findFitLanguage(text), `${item.id}: ${text}`).toBeNull();
        for (const [name, re] of BODY_JUDGEMENT) {
          expect(re.test(text), `${item.id} matches ${name}: ${text}`).toBe(
            false,
          );
        }
      }
    }
  });
});
