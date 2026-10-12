import { describe, expect, it, vi } from "vitest";
import { faceMatchTokenProvider, isLocalUrl } from "./face-match-auth";

describe("faceMatchTokenProvider", () => {
  it("sends no token to a local URL", async () => {
    const auth = { getIdTokenClient: vi.fn() };
    const get = faceMatchTokenProvider(auth);
    expect(await get("http://127.0.0.1:8099")).toBeUndefined();
    expect(await get("http://localhost:8099")).toBeUndefined();
    expect(auth.getIdTokenClient).not.toHaveBeenCalled();
  });

  it("asks for an ID token whose audience is the service URL", async () => {
    const fetchIdToken = vi.fn(async () => "signed.id.token");
    const auth = {
      getIdTokenClient: vi.fn(async () => ({
        idTokenProvider: { fetchIdToken },
      })),
    };
    const url = "https://trailroom-face-match-abc-uc.a.run.app";
    expect(await faceMatchTokenProvider(auth)(url)).toBe("signed.id.token");
    expect(auth.getIdTokenClient).toHaveBeenCalledWith(url);
    expect(fetchIdToken).toHaveBeenCalledWith(url);
  });

  it("knows what is local", () => {
    expect(isLocalUrl("https://x.run.app")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
  });
});
