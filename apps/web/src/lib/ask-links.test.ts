import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAskLinks,
  noteSignedInAccount,
  recallAskLink,
  rememberAskLink,
} from "./ask-links";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeStorage() });
});
afterEach(() => vi.unstubAllGlobals());

describe("stored ask links", () => {
  it("are kept for the same account, a guest, and a guest becoming that account", () => {
    noteSignedInAccount("alice", false);
    rememberAskLink("a1", "https://x/ask/t");
    noteSignedInAccount("alice", false);
    noteSignedInAccount("some-guest", true);
    noteSignedInAccount(null, true);
    expect(recallAskLink("a1")).toBe("https://x/ask/t");
  });

  it("are cleared when a different account signs in", () => {
    noteSignedInAccount("alice", false);
    rememberAskLink("a1", "https://x/ask/t");
    noteSignedInAccount("bob", false);
    expect(recallAskLink("a1")).toBeNull();
    rememberAskLink("b1", "https://x/ask/u");
    noteSignedInAccount("bob", false);
    expect(recallAskLink("b1")).toBe("https://x/ask/u");
  });

  it("a first sign-in on a browser with links already stored keeps them", () => {
    rememberAskLink("a1", "https://x/ask/t");
    noteSignedInAccount("alice", false);
    expect(recallAskLink("a1")).toBe("https://x/ask/t");
    clearAskLinks();
    expect(recallAskLink("a1")).toBeNull();
  });
});
