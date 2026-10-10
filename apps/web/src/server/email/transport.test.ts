import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSentEmails,
  emailEnabled,
  emailTransport,
  sentEmails,
} from "./transport";
import { newArrivalsEmail, priceChangeEmail } from "./templates";

beforeEach(clearSentEmails);

describe("the email transport", () => {
  it("is `none` by default and by name, and can send nothing", async () => {
    for (const env of [
      {},
      { EMAIL_TRANSPORT: "none" },
      { EMAIL_TRANSPORT: "" },
    ]) {
      const t = emailTransport(env);
      expect(t.name).toBe("none");
      expect(t.canSend).toBe(false);
      expect(emailEnabled(env)).toBe(false);
      await expect(
        t.send({
          to: "a@b.c",
          subject: "s",
          text: "t",
          html: "h",
          unsubscribeUrl: "u",
        }),
      ).rejects.toThrow();
    }
    expect(sentEmails()).toHaveLength(0);
  });

  it("`log` keeps messages in an outbox, and is refused in production", async () => {
    const t = emailTransport({ EMAIL_TRANSPORT: "log", NODE_ENV: "test" });
    expect(emailEnabled({ EMAIL_TRANSPORT: "log", NODE_ENV: "test" })).toBe(
      true,
    );
    await t.send({
      to: "a@b.c",
      subject: "s",
      text: "t",
      html: "h",
      unsubscribeUrl: "u",
    });
    expect(sentEmails()).toHaveLength(1);
    expect(() =>
      emailTransport({ EMAIL_TRANSPORT: "log", NODE_ENV: "production" }),
    ).toThrow(/refused in production/);
    // A refused transport reports "cannot send", so the UI shows nothing.
    expect(
      emailEnabled({ EMAIL_TRANSPORT: "log", NODE_ENV: "production" }),
    ).toBe(false);
  });

  it("refuses a name it does not know", () => {
    expect(() => emailTransport({ EMAIL_TRANSPORT: "smtp" })).toThrow();
    expect(emailEnabled({ EMAIL_TRANSPORT: "smtp" })).toBe(false);
  });
});

describe("the messages", () => {
  const origin = "https://example.test";
  const unsub = `${origin}/unsubscribe/abc`;
  const pieces = [
    {
      id: "a",
      name: "Washed linen shirt",
      label: "LOAM STUDIO",
      priceUsd: 140,
    },
  ];

  it("carry absolute links, the unsubscribe link and no image of anyone", () => {
    const m = newArrivalsEmail("x@y.z", pieces, origin, unsub);
    const p = priceChangeEmail(
      "x@y.z",
      [
        {
          id: "a",
          name: "Washed linen shirt",
          oldPriceUsd: 140,
          newPriceUsd: 120,
        },
      ],
      origin,
      unsub,
    );
    for (const msg of [m, p]) {
      expect(msg.text).toContain(unsub);
      expect(msg.html).toContain(unsub);
      expect(msg.html).not.toMatch(/<img|background-image|url\(/i);
      for (const url of [...msg.html.matchAll(/href="([^"]+)"/g)].map(
        (x) => x[1]!,
      )) {
        expect(url).toMatch(/^https:\/\//);
      }
      expect(msg.text).not.toMatch(/\/api\/renders|poseSet/i);
    }
    expect(p.text).toContain("$120 (was $140)");
  });

  it("escape what they print and list at most six pieces, counting the rest", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `p${i}`,
      name: `<b>Piece ${i}</b>`,
      label: "L",
      priceUsd: 10,
    }));
    const m = newArrivalsEmail("x@y.z", many, origin, unsub);
    expect(m.html).not.toContain("<b>Piece");
    expect(m.text.match(/^- /gm)).toHaveLength(7);
    expect(m.text).toContain("and 3 more");
  });
});

describe("the subject line", () => {
  it("is one line whatever a piece or label is called", () => {
    const m = newArrivalsEmail(
      "a@b.test",
      [{ id: "x", name: "Coat", label: "LOAM\r\nBcc: x@y.test", priceUsd: 1 }],
      "https://trailroom.test",
      "https://trailroom.test/unsubscribe/t",
    );
    expect(m.subject).not.toMatch(/[\r\n\u2028\u2029]/);
    expect(m.subject).toContain("LOAM Bcc: x@y.test");
    const p = priceChangeEmail(
      "a@b.test",
      [{ id: "x", name: "Co\nat", oldPriceUsd: 2, newPriceUsd: 1 }],
      "https://trailroom.test",
      "https://trailroom.test/unsubscribe/t",
    );
    expect(p.subject).not.toMatch(/[\r\n]/);
  });
});
