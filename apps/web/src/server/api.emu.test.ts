import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processPhoto } from "./photo";
import {
  deleteAllForUser,
  firestore as fsdb,
  recordConsent,
} from "@trailroom/db";
import {
  bucket,
  firestore,
  getConsent,
  getPhoto,
  getPhotoBytes,
} from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import { POST as consentPOST } from "../app/api/consent/route";
import { GET as meGET } from "../app/api/me/route";
import {
  DELETE as photoDELETE,
  POST as photoPOST,
} from "../app/api/photo/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { POST as attachPOST } from "../app/api/account/attach/route";
import { listObjects } from "../../../../packages/pipeline/src/testkit";
import {
  anonymousToken,
  consent,
  emailToken,
  image,
  photoForm,
  req,
  reset,
  uidOf,
  uploadOk,
} from "./testkit";

process.env.RENDER_PROVIDER = "fake";
process.env.ORCHESTRATOR = "inline";

beforeEach(reset);

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

describe("auth", () => {
  const cases: [string, (h: Record<string, string>) => Promise<Response>][] = [
    [
      "POST /api/consent",
      (h) => consentPOST(req("POST", "/api/consent", { headers: h, json: {} })),
    ],
    ["GET /api/me", (h) => meGET(req("GET", "/api/me", { headers: h }))],
    [
      "POST /api/photo",
      (h) => photoPOST(req("POST", "/api/photo", { headers: h })),
    ],
    [
      "DELETE /api/photo",
      (h) => photoDELETE(req("DELETE", "/api/photo", { headers: h })),
    ],
    [
      "POST /api/try-on",
      (h) =>
        tryOnPOST(
          req("POST", "/api/try-on", {
            headers: h,
            json: { itemId: "blouse" },
          }),
        ),
    ],
    [
      "GET /api/jobs/x",
      (h) =>
        jobGET(
          req("GET", "/api/jobs/x", { headers: h }),
          params({ jobId: "x" }),
        ),
    ],
    [
      "GET /api/renders/x/y",
      (h) =>
        renderGET(
          req("GET", "/api/renders/x/y", { headers: h }),
          params({ poseSetId: "x", pose: "y" }),
        ),
    ],
    [
      "POST /api/account/attach",
      (h) => attachPOST(req("POST", "/api/account/attach", { headers: h })),
    ],
  ];
  const headers: [string, Record<string, string>][] = [
    ["missing header", {}],
    ["malformed header", { authorization: "Token abc" }],
    ["garbage token", { authorization: "Bearer not.a.token" }],
  ];
  for (const [name, call] of cases)
    for (const [hn, h] of headers)
      it(`${name}: ${hn} is 401`, async () => {
        const res = await call(h);
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe("unauthorized");
        expect(typeof body.message).toBe("string");
      });
});

describe("consent", () => {
  it("rejects wrong version, accepted false, missing age attestation", async () => {
    const t = await anonymousToken();
    const bad = [
      { version: "v0", ageAttested18: true, accepted: true },
      { version: CONSENT_VERSION, ageAttested18: true, accepted: false },
      { version: CONSENT_VERSION, accepted: true },
      { version: CONSENT_VERSION, ageAttested18: "true", accepted: true },
    ];
    for (const json of bad) {
      const res = await consentPOST(
        req("POST", "/api/consent", { token: t, json }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_consent");
    }
    expect(await getConsent(uidOf(t))).toBeNull();
  });

  it("records valid consent", async () => {
    const t = await anonymousToken();
    await consent(t);
    expect((await getConsent(uidOf(t)))?.version).toBe(CONSENT_VERSION);
  });
});

describe("photo", () => {
  const post = (t: string, body: BodyInit, headers?: Record<string, string>) =>
    photoPOST(req("POST", "/api/photo", { token: t, body, headers }));
  const nothingStored = async (t: string) => {
    expect(await listObjects("photos/")).toEqual([]);
    expect(await getPhoto(uidOf(t))).toBeNull();
  };

  it("without consent: 403 and nothing stored", async () => {
    const t = await anonymousToken();
    const res = await post(t, photoForm(await image(800, 1000)));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("consent_required");
    await nothingStored(t);
  });

  it("stores a stripped, oriented, bounded JPEG", async () => {
    const t = await anonymousToken();
    await consent(t);
    // 3000x2400 stored sideways (orientation 6): displayed 2400x3000, then capped to 1638x2048.
    const src = await sharp(await image(3000, 2400))
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 46/1 29/1" },
      })
      .jpeg()
      .toBuffer();
    const inMeta = await sharp(src).metadata();
    expect(inMeta.orientation).toBe(6);
    expect(inMeta.exif).toBeDefined();

    const res = await post(t, photoForm(src));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body.identityVersion).toBe(1);

    const stored = (await getPhotoBytes(uidOf(t)))!;
    expect(stored.contentType).toBe("image/jpeg");
    const m = await sharp(stored.data).metadata();
    expect(m.format).toBe("jpeg");
    expect(m.exif).toBeUndefined();
    expect(m.icc).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.orientation).toBeUndefined();
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(2048);
    // Orientation applied: portrait now, and the 2400:3000 ratio is kept to within a pixel.
    expect(m.height!).toBeGreaterThan(m.width!);
    expect(Math.abs(m.width! - (m.height! * 2400) / 3000)).toBeLessThanOrEqual(
      1,
    );
    expect([body.width, body.height]).toEqual([m.width, m.height]);
    const doc = (await getPhoto(uidOf(t)))!;
    expect(doc.isGuest).toBe(true);
    expect(doc.expiresAt).not.toBeNull();
  });

  it("never upscales", async () => {
    const t = await anonymousToken();
    await consent(t);
    const res = await post(t, photoForm(await image(800, 1000)));
    expect(await res.json()).toMatchObject({ width: 800, height: 1000 });
  });

  it("accepts a raw image body", async () => {
    const t = await anonymousToken();
    await consent(t);
    const res = await post(t, new Uint8Array(await image(800, 1000, "png")), {
      "content-type": "image/png",
    });
    expect(res.status).toBe(200);
  });

  const rejections: [string, string, () => Promise<FormData>][] = [
    [
      "not_an_image",
      "a text file named .jpg",
      async () =>
        photoForm(
          Buffer.from("hello there, not a picture"),
          "me.jpg",
          "image/jpeg",
        ),
    ],
    [
      "unsupported_type",
      "gif",
      async () =>
        photoForm(await image(800, 1000, "gif"), "me.gif", "image/gif"),
    ],
    [
      "unsupported_type",
      "tiff",
      async () =>
        photoForm(await image(800, 1000, "tiff"), "me.tif", "image/tiff"),
    ],
    [
      "too_large",
      "over 10 MB",
      async () => photoForm(Buffer.alloc(10 * 1024 * 1024 + 1, 1)),
    ],
    [
      "too_small",
      "short side 700",
      async () => photoForm(await image(700, 900)),
    ],
    ["bad_aspect", "too wide", async () => photoForm(await image(2000, 900))],
    ["bad_aspect", "too tall", async () => photoForm(await image(800, 2600))],
  ];
  for (const [code, name, make] of rejections)
    it(`${code}: ${name}; nothing stored`, async () => {
      const t = await anonymousToken();
      await consent(t);
      const res = await post(t, await make());
      expect((await res.json()).error).toBe(code);
      expect(res.status).toBeGreaterThanOrEqual(400);
      await nothingStored(t);
    });

  it("too_large is refused from Content-Length alone", async () => {
    const t = await anonymousToken();
    await consent(t);
    const res = await photoPOST(
      req("POST", "/api/photo", {
        token: t,
        body: "x",
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(50 * 1024 * 1024),
        },
      }),
    );
    expect((await res.json()).error).toBe("too_large");
  });

  it("a second upload increments identityVersion", async () => {
    const t = await anonymousToken();
    await consent(t);
    await uploadOk(t);
    const res = await post(t, photoForm(await image(900, 1200)));
    expect((await res.json()).identityVersion).toBe(2);
  });
});

describe("photo hardening", () => {
  it("a chunked body with no Content-Length over the limit is 413 and the reader stops early", async () => {
    const t = await anonymousToken();
    await consent(t);
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        if (pulled > 200) c.close();
        else c.enqueue(chunk);
      },
    });
    const res = await photoPOST(
      new Request("http://localhost/api/photo", {
        method: "POST",
        headers: { authorization: `Bearer ${t}`, "content-type": "image/jpeg" },
        body,
        // @ts-expect-error undici needs duplex for stream bodies
        duplex: "half",
      }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("too_large");
    // 10 MB limit: a handful of extra chunks may be pre-pulled, never the whole 200.
    expect(pulled).toBeLessThan(40);
    expect(await listObjects("photos/")).toEqual([]);
  });

  it("a decompression-bomb-shaped image (huge dimensions, tiny file) is rejected", async () => {
    const t = await anonymousToken();
    await consent(t);
    const bomb = await sharp({
      create: {
        width: 12000,
        height: 12000,
        channels: 3,
        background: { r: 9, g: 9, b: 9 },
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(2 * 1024 * 1024);
    const res = await photoPOST(
      req("POST", "/api/photo", {
        token: t,
        body: photoForm(bomb, "a.png", "image/png"),
      }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("too_large");
    expect(await listObjects("photos/")).toEqual([]);
  });

  it("consent withdrawn while the photo is being stored: object and doc are removed", async () => {
    const t = await anonymousToken();
    await consent(t);
    const uid = uidOf(t);
    const user = { uid, isGuest: true };
    const res = await processPhoto(user, await image(800, 1000), {
      afterStore: () => deleteAllForUser(uid),
    });
    expect(res.status).toBe(403);
    expect(res.ok ? "" : res.body.error).toBe("consent_required");
    expect(await listObjects("photos/")).toEqual([]);
    expect(await getPhoto(uid)).toBeNull();
  });

  it("a consent recorded under another version: /api/me says not consented, upload is 403", async () => {
    const t = await anonymousToken();
    await recordConsent(uidOf(t), "v0-old");
    const me = await (await meGET(req("GET", "/api/me", { token: t }))).json();
    expect(me.consented).toBe(false);
    const res = await photoPOST(
      req("POST", "/api/photo", {
        token: t,
        body: photoForm(await image(800, 1000)),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("consent_required");
  });

  it("upload while a set is rendering is 409 render_in_progress", async () => {
    const t = await anonymousToken();
    await consent(t);
    await uploadOk(t);
    await fsdb()
      .collection("poseSets")
      .doc(`${uidOf(t)}_1_blouse`)
      .set({ uid: uidOf(t), status: "rendering" });
    const res = await photoPOST(
      req("POST", "/api/photo", {
        token: t,
        body: photoForm(await image(900, 1200)),
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("render_in_progress");
    expect((await getPhoto(uidOf(t)))!.identityVersion).toBe(1);
  });
});

describe("me, delete and attach", () => {
  it("GET /api/me reflects state; DELETE removes consent, photo and docs", async () => {
    const a = await anonymousToken();
    const b = await anonymousToken();
    for (const t of [a, b]) {
      await consent(t);
      await uploadOk(t);
    }
    let me = await (await meGET(req("GET", "/api/me", { token: a }))).json();
    expect(me).toMatchObject({
      uid: uidOf(a),
      isGuest: true,
      consented: true,
      hasPhoto: true,
      identityVersion: 1,
      activePoseSets: [],
    });

    const del = await photoDELETE(req("DELETE", "/api/photo", { token: a }));
    expect(await del.json()).toEqual({ deleted: true });
    me = await (await meGET(req("GET", "/api/me", { token: a }))).json();
    expect(me).toMatchObject({ consented: false, hasPhoto: false });
    expect(await getPhotoBytes(uidOf(a))).toBeNull();
    expect(await getConsent(uidOf(a))).toBeNull();
    // The other user is untouched.
    expect(await getPhotoBytes(uidOf(b))).not.toBeNull();
    expect(await getConsent(uidOf(b))).not.toBeNull();
    expect(await getPhoto(uidOf(b))).not.toBeNull();
  });

  it("attach: anonymous token is 409; non-anonymous promotes records", async () => {
    const anon = await anonymousToken();
    const res = await attachPOST(
      req("POST", "/api/account/attach", { token: anon }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("still_guest");

    const t = await emailToken();
    const uid = uidOf(t);
    // Records created while the uid was a guest.
    await firestore()
      .collection("photos")
      .doc(uid)
      .set({ isGuest: true, expiresAt: new Date(), identityVersion: 1 });
    const ok = await attachPOST(
      req("POST", "/api/account/attach", { token: t }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ isGuest: false });
    const doc = (await firestore().collection("photos").doc(uid).get()).data()!;
    expect(doc.isGuest).toBe(false);
    expect(doc.expiresAt).toBeNull();
    void bucket;
  });
});
