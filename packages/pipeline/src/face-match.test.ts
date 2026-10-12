import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFaceMatchClient,
  DEFAULT_FACE_MATCH_MIN,
  faceMatchConfigFromEnv,
} from "./face-match";
import { startFakeFaceServer, type FakeFaceServer } from "./face-match-testkit";

const A = Buffer.from("person-bytes");
const B = Buffer.from("render-bytes");

let server: FakeFaceServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("faceMatchConfigFromEnv", () => {
  it("is off when the URL is absent or blank", () => {
    expect(faceMatchConfigFromEnv({})).toBeNull();
    expect(faceMatchConfigFromEnv({ FACE_MATCH_URL: "  " })).toBeNull();
  });
  it("reads the URL (no trailing slash) and the minimum, defaulting to 10%", () => {
    expect(
      faceMatchConfigFromEnv({ FACE_MATCH_URL: "https://x.run.app/" }),
    ).toEqual({
      url: "https://x.run.app",
      min: DEFAULT_FACE_MATCH_MIN,
    });
    expect(DEFAULT_FACE_MATCH_MIN).toBe(0.5);
    expect(
      faceMatchConfigFromEnv({
        FACE_MATCH_URL: "http://h",
        FACE_MATCH_MIN: "0.25",
      })!.min,
    ).toBe(0.25);
  });
  it("ignores a minimum that is not a number from 0 to 1", () => {
    for (const bad of ["abc", "-1", "2", ""]) {
      expect(
        faceMatchConfigFromEnv({
          FACE_MATCH_URL: "http://h",
          FACE_MATCH_MIN: bad,
        })!.min,
      ).toBe(0.5);
    }
  });
});

describe("createFaceMatchClient", () => {
  it("posts both images and reads the answer; no token to a local URL", async () => {
    server = await startFakeFaceServer();
    server.answer(() => ({ probability: 0.42 }));
    const match = createFaceMatchClient({ url: server.url + "/" });
    expect(await match(A, B)).toEqual({
      personFace: true,
      renderFace: true,
      distance: 0.6,
      probability: 0.42,
    });
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]!.person.equals(A)).toBe(true);
    expect(server.requests[0]!.render.equals(B)).toBe(true);
    expect(server.requests[0]!.authorization).toBeUndefined();
  });

  it("sends the injected token as a bearer, with the service URL as audience", async () => {
    server = await startFakeFaceServer();
    const getToken = vi.fn(async () => "id-token");
    await createFaceMatchClient({ url: server.url, getToken })(A, B);
    expect(getToken).toHaveBeenCalledWith(server.url);
    expect(server.requests[0]!.authorization).toBe("Bearer id-token");
  });

  it("reports a missing face as such", async () => {
    server = await startFakeFaceServer();
    server.answer(() => ({ renderFace: false }));
    const r = await createFaceMatchClient({ url: server.url })(A, B);
    expect(r).toMatchObject({
      personFace: true,
      renderFace: false,
      probability: null,
    });
  });

  it("retries once on a 5xx and then succeeds", async () => {
    server = await startFakeFaceServer();
    server.answer((_r, n) =>
      n === 1 ? { status: 503 } : { probability: 0.7 },
    );
    const r = await createFaceMatchClient({ url: server.url, retryDelayMs: 0 })(
      A,
      B,
    );
    expect(r.probability).toBe(0.7);
    expect(server.requests).toHaveLength(2);
  });

  it("gives up after one retry", async () => {
    server = await startFakeFaceServer();
    server.answer(() => ({ status: 500 }));
    await expect(
      createFaceMatchClient({ url: server.url, retryDelayMs: 0 })(A, B),
    ).rejects.toThrow(/500/);
    expect(server.requests).toHaveLength(2);
  });

  it("does not retry a 4xx", async () => {
    server = await startFakeFaceServer();
    server.answer(() => ({ status: 403 }));
    await expect(
      createFaceMatchClient({ url: server.url })(A, B),
    ).rejects.toThrow(/403/);
    expect(server.requests).toHaveLength(1);
  });

  it("times out a service that never answers, retrying once", async () => {
    server = await startFakeFaceServer();
    server.answer(() => ({ hang: true }));
    await expect(
      createFaceMatchClient({
        url: server.url,
        timeoutMs: 150,
        retryDelayMs: 0,
      })(A, B),
    ).rejects.toThrow();
    expect(server.requests).toHaveLength(2);
  });

  it("retries a network error", async () => {
    server = await startFakeFaceServer();
    const url = server.url;
    await server.close();
    server = undefined;
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      createFaceMatchClient({ url, fetchImpl, retryDelayMs: 0 })(A, B),
    ).rejects.toThrow("fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
