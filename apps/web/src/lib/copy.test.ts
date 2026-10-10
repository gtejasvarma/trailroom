import { describe, expect, it } from "vitest";
import { CATALOG, findFitLanguage } from "@trailroom/catalog";
import { ERRORS } from "../server/errors";
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
      copy.result.addToList,
      copy.result.outfit,
      copy.queue.keepBrowsing,
      copy.failure.tryAgain,
    ]) {
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    }
  });
});

describe("counts in copy", () => {
  it("the account sheet states the real number of poses", () => {
    expect(copy.account.title("reveal", 4)).toBe(
      "4 poses are ready — create an account",
    );
    expect(copy.account.title("reveal", 3)).toBe(
      "3 poses are ready — create an account",
    );
    expect(copy.account.title("reveal", 1)).toBe(
      "1 pose is ready — create an account",
    );
    expect(copy.account.pending("reveal", 4)).toBe("Then your 4 poses open.");
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

describe("account sheet copy by reason (the prototype's gateCopy)", () => {
  const table: [string, string, string, string][] = [
    [
      "reveal",
      "4 poses are ready — create an account",
      "Yours to keep. An account is what saves them, and your photo, for next time.",
      "Then your 4 poses open.",
    ],
    [
      "list",
      "Create an account to save",
      "Lists and every try-on you make live in your account.",
      "Then you are back at the piece.",
    ],
    [
      "buy",
      "Create an account to buy",
      "So we can keep this try-on and bring you back to it.",
      "Then you are back at the piece.",
    ],
    [
      "picknext",
      "Your photo is in — create an account",
      "It saves your photo so you only ever do this once, and keeps every try-on you make.",
      "Then pick the first thing to see on yourself.",
    ],
  ];
  it.each(table)("%s", (reason, title, sub, pending) => {
    expect(copy.account.title(reason, 4)).toBe(title);
    expect(copy.account.sub(reason, 4)).toBe(sub);
    expect(copy.account.pending(reason, 4)).toBe(pending);
  });
  it("covers every reason the sheet can open with, and falls back to a plain default", () => {
    expect(copy.account.reasons).toEqual([
      "reveal",
      "list",
      "buy",
      "picknext",
      "signin",
    ]);
    expect(copy.account.title("signin", 4)).toBe("Create an account");
    expect(copy.account.sub("signin", 4)).toBe(
      "Your photos and try-ons stay with you.",
    );
  });
});

describe("no email in V0", () => {
  it("no user-facing string mentions email or e-mail (nothing is sent in V0)", () => {
    // There is no allowlist: V0 sends no email and promises none (CLAUDE.md, PRD 22.1 rows 3 and 10).
    for (const [path, text] of all) {
      expect(/e-?mail/i.test(text), `${path}: "${text}"`).toBe(false);
    }
    for (const [code, e] of Object.entries(ERRORS)) {
      expect(/e-?mail/i.test(e.message), `ERRORS.${code}`).toBe(false);
    }
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

describe("phase D copy: lists, asks and the vote page", () => {
  it("states what a link does in one plain sentence, and promises nothing it does not do", () => {
    expect(copy.share.sentence).toMatch(/^[^.]+\.[^.]+\.$/);
    expect(copy.share.sentence).toContain("Anyone with the link can see");
    expect(copy.share.sentence).toContain("switch the link off");
    // Copy link and Share are the only ways out; no pretend app buttons.
    expect(JSON.stringify(copy.share)).not.toMatch(/whatsapp|messages\b/i);
  });
  it("counts and names read as plain sentences", () => {
    expect(copy.lists.voteLine(1, "Wool car coat")).toBe(
      "1 vote · wool car coat ahead",
    );
    expect(copy.lists.voteLine(23, "")).toBe("23 votes");
    expect(copy.lists.count(0)).toBe("No lists yet");
    expect(copy.lists.count(2)).toBe("2 lists");
    expect(copy.lists.pieces(1)).toBe("1 piece");
    expect(copy.sent.rowVotes(1)).toBe("1 vote");
    expect(copy.sent.closes(1)).toBe("The link closes in 1 day.");
    expect(copy.vote.isAsking("Maya")).toBe(
      "Maya is asking. One tap, no sign-in.",
    );
    expect(copy.vote.thanks("Maya")).toBe("Thanks — Maya can see your vote");
    expect(copy.toasts.addedTo("Wedding")).toBe("Added to Wedding");
    expect(copy.vote.closedTitle).toBe("This link is no longer active");
  });
  it("the AI caption is the one string used beside every render", () => {
    expect(copy.result.aiCaption).toBe("AI-generated preview");
    expect(copy.vote.renderAlt("Coat", "Marchand")).toContain(
      "AI-generated preview",
    );
  });
});
