import { describe, expect, it } from "vitest";
import { arrivalsBufferOn } from "./follow-config";
import { cardState } from "./arrivals";

describe("ARRIVALS_BUFFER", () => {
  it("is off unless it says on, and a typo stops the app rather than switching it on", () => {
    expect(arrivalsBufferOn({})).toBe(false);
    expect(arrivalsBufferOn({ ARRIVALS_BUFFER: "off" })).toBe(false);
    expect(arrivalsBufferOn({ ARRIVALS_BUFFER: "on" })).toBe(true);
    expect(() => arrivalsBufferOn({ ARRIVALS_BUFFER: "yes" })).toThrow();
  });
});

describe("cardState", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const set = (status: string, poses: string[]) => ({ status, poses }) as never;
  it("shows a card only when its Front render finished", () => {
    expect(cardState(set("complete", ["front"]), now, now)).toBe("ready");
    expect(cardState(set("complete", ["walking"]), now, now)).toBe("failed");
    expect(cardState(set("rendering", []), now, now)).toBe("pending");
    expect(cardState(set("failed", []), now, now)).toBe("failed");
  });
  it("gives a card whose pose set never appeared half an hour", () => {
    expect(cardState(null, new Date(now.getTime() - 60_000), now)).toBe(
      "pending",
    );
    expect(cardState(null, new Date(now.getTime() - 31 * 60_000), now)).toBe(
      "failed",
    );
  });
});
