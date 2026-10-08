import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processPhoto } from "./photo";
import { deleteAllForUser, firestore as fsdb } from "@trailroom/db";
import {
  bucket,
  firestore,
  getConsent,
  getDefaultPhotoId,
  getPhoto,
  getPhotoBytes,
  listPhotos,
} from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import { GET as meGET } from "../app/api/me/route";
import {
  DELETE as photoDELETE,
  POST as photoPOST,
} from "../app/api/photo/route";
import { GET as photosGET } from "../app/api/photos/route";
import { DELETE as photoIdDELETE } from "../app/api/photos/[photoId]/route";
import { POST as defaultPOST } from "../app/api/photos/[photoId]/default/route";
import { GET as thumbGET } from "../app/api/photos/[photoId]/thumb/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { POST as attachPOST } from "../app/api/account/attach/route";
import { listObjects } from "../../../../packages/pipeline/src/testkit";
import {
  anonymousToken,
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
      "GET /api/photos",
      (h) => photosGET(req("GET", "/api/photos", { headers: h })),
    ],
    [
      "GET /api/photos/x/thumb",
      (h) =>
        thumbGET(
          req("GET", "/api/photos/x/thumb", { headers: h }),
          params({ photoId: "x" }),
        ),
    ],
    [
      "POST /api/photos/x/default",
      (h) =>
        defaultPOST(
          req("POST", "/api/photos/x/default", { headers: h }),
          params({ photoId: "x" }),
        ),
    ],
    [
      "DELETE /api/photos/x",
      (h) =>
        photoIdDELETE(
          req("DELETE", "/api/photos/x", { headers: h }),
          params({ photoId: "x" }),
        ),
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

describe("photo", () => {
  const post = (t: string, body: BodyInit, headers?: Record<string, string>) =>
    photoPOST(req("POST", "/api/photo", { token: t, body, headers }));
  const nothingStored = async (t: string) => {
    expect(await listObjects("photos/")).toEqual([]);
    expect(await listPhotos(uidOf(t))).toEqual([]);
    expect(await getConsent(uidOf(t))).toBeNull();
  };

  it("without the consent field: 403 consent_required and nothing stored", async () => {
    const t = await anonymousToken();
    const res = await post(
      t,
      photoForm(await image(800, 1000), "me.jpg", "image/jpeg", false),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("consent_required");
    await nothingStored(t);
  });

  it("with a different consent version: 403 and nothing stored", async () => {
    const t = await anonymousToken();
    const form = photoForm(
      await image(800, 1000),
      "me.jpg",
      "image/jpeg",
      false,
    );
    form.set("consent", "v0-old");
    const res = await post(t, form);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("consent_required");
    await nothingStored(t);
  });

  it("records the consent document at upload, no later than the photo", async () => {
    const t = await anonymousToken();
    const res = await post(t, photoForm(await image(800, 1000)));
    const { photoId } = await res.json();
    const c = (await getConsent(uidOf(t)))!;
    expect(c.version).toBe(CONSENT_VERSION);
    expect(c.ageAttested18).toBe(true);
    const photo = (await getPhoto(uidOf(t), photoId))!;
    expect(c.acceptedAt.toMillis()).toBeLessThanOrEqual(
      photo.createdAt.toMillis(),
    );
  });

  it("stores a stripped, oriented, bounded JPEG", async () => {
    const t = await anonymousToken();
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
    expect(body.isDefault).toBe(true);

    const stored = (await getPhotoBytes(uidOf(t), body.photoId))!;
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
    const doc = (await getPhoto(uidOf(t), body.photoId))!;
    expect(doc.isGuest).toBe(true);
    expect(doc.expiresAt).not.toBeNull();
  });

  it("never upscales", async () => {
    const t = await anonymousToken();
    const res = await post(t, photoForm(await image(800, 1000)));
    expect(await res.json()).toMatchObject({ width: 800, height: 1000 });
  });

  it("accepts a raw image body carrying the consent version in a header", async () => {
    const t = await anonymousToken();
    const res = await post(t, new Uint8Array(await image(800, 1000, "png")), {
      "content-type": "image/png",
      "x-consent-version": CONSENT_VERSION,
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
      const res = await post(t, await make());
      expect((await res.json()).error).toBe(code);
      expect(res.status).toBeGreaterThanOrEqual(400);
      await nothingStored(t);
    });

  it("too_large is refused from Content-Length alone", async () => {
    const t = await anonymousToken();
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

  it("adds up to 6 photos; the first is the default; the 7th is refused", async () => {
    const t = await anonymousToken();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await uploadOk(t, 800 + i, 1000));
    const list = await (
      await photosGET(req("GET", "/api/photos", { token: t }))
    ).json();
    expect(list.photos.map((p: { id: string }) => p.id)).toEqual(ids);
    expect(list.defaultPhotoId).toBe(ids[0]);
    expect(list.photos[0]).toMatchObject({
      isDefault: true,
      thumbUrl: `/api/photos/${ids[0]}/thumb`,
    });
    const res = await post(t, photoForm(await image(900, 1200)));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("photo_limit");
    expect(await listPhotos(uidOf(t))).toHaveLength(6);
    expect(await listObjects(`photos/${uidOf(t)}/`)).toHaveLength(6);
  });

  it("a second upload is allowed while a set is rendering", async () => {
    const t = await anonymousToken();
    const id = await uploadOk(t);
    await fsdb()
      .collection("poseSets")
      .doc(`${uidOf(t)}_${id}_blouse`)
      .set({ uid: uidOf(t), photoId: id, status: "rendering" });
    const res = await post(t, photoForm(await image(900, 1200)));
    expect(res.status).toBe(200);
  });
});

describe("photo library", () => {
  const call = (
    fn: (
      r: Request,
      c: { params: Promise<{ photoId: string }> },
    ) => Promise<Response>,
    method: string,
    t: string,
    id: string,
    suffix = "",
  ) =>
    fn(
      req(method, `/api/photos/${id}${suffix}`, { token: t }),
      params({ photoId: id }),
    );

  it("make default, and deleting the default promotes another", async () => {
    const t = await anonymousToken();
    const a = await uploadOk(t);
    const b = await uploadOk(t, 900, 1200);
    const c = await uploadOk(t, 1000, 1300);
    const res = await call(defaultPOST, "POST", t, b, "/default");
    expect(await res.json()).toEqual({ defaultPhotoId: b });
    expect((await call(photoIdDELETE, "DELETE", t, b)).status).toBe(200);
    expect(await getDefaultPhotoId(uidOf(t))).toBe(a);
    expect(await getPhotoBytes(uidOf(t), b)).toBeNull();
    expect((await call(photoIdDELETE, "DELETE", t, b)).status).toBe(404);
    expect((await call(defaultPOST, "POST", t, b, "/default")).status).toBe(
      404,
    );
    expect(await getPhotoBytes(uidOf(t), c)).not.toBeNull();
  });

  it("a photo an in-flight job is using cannot be deleted", async () => {
    const t = await anonymousToken();
    const a = await uploadOk(t);
    const b = await uploadOk(t, 900, 1200);
    await fsdb()
      .collection("poseSets")
      .doc(`${uidOf(t)}_${a}_blouse`)
      .set({ uid: uidOf(t), photoId: a, status: "rendering" });
    const res = await call(photoIdDELETE, "DELETE", t, a);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("photo_in_use");
    expect(await getPhotoBytes(uidOf(t), a)).not.toBeNull();
    expect((await call(photoIdDELETE, "DELETE", t, b)).status).toBe(200);
  });

  it("thumbnails are owner-only JPEGs with no metadata", async () => {
    const owner = await anonymousToken();
    const other = await anonymousToken();
    const src = await sharp(await image(1600, 2000))
      .withExif({
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 46/1 29/1" },
      })
      .jpeg()
      .toBuffer();
    const up = await photoPOST(
      req("POST", "/api/photo", { token: owner, body: photoForm(src) }),
    );
    const { photoId } = await up.json();
    const res = await call(thumbGET, "GET", owner, photoId, "/thumb");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const m = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(m.format).toBe("jpeg");
    expect(m.exif).toBeUndefined();
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(360);
    const stolen = await call(thumbGET, "GET", other, photoId, "/thumb");
    expect(stolen.status).toBe(404);
  });
});

describe("photo hardening", () => {
  it("a chunked body with no Content-Length over the limit is 413 and the reader stops early", async () => {
    const t = await anonymousToken();
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

  it("delete-everything racing the store: object and docs are removed", async () => {
    const t = await anonymousToken();
    const uid = uidOf(t);
    const user = { uid, isGuest: true };
    const res = await processPhoto(user, await image(800, 1000), {
      afterStore: () => deleteAllForUser(uid),
    });
    expect(res.status).toBe(403);
    expect(res.ok ? "" : res.body.error).toBe("consent_required");
    expect(await listObjects("photos/")).toEqual([]);
    expect(await listPhotos(uid)).toEqual([]);
  });
});

describe("me, delete and attach", () => {
  it("GET /api/me reflects state; DELETE removes consent, photo and docs", async () => {
    const a = await anonymousToken();
    const b = await anonymousToken();
    for (const t of [a, b]) {
      await uploadOk(t);
    }
    let me = await (await meGET(req("GET", "/api/me", { token: a }))).json();
    expect(me).toMatchObject({
      uid: uidOf(a),
      isGuest: true,
      consented: true,
      photoCount: 1,
      defaultPhotoId: expect.any(String),
      activePoseSets: [],
    });

    const del = await photoDELETE(req("DELETE", "/api/photo", { token: a }));
    expect(await del.json()).toEqual({ deleted: true });
    me = await (await meGET(req("GET", "/api/me", { token: a }))).json();
    expect(me).toMatchObject({
      consented: false,
      photoCount: 0,
      defaultPhotoId: null,
    });
    expect(await listPhotos(uidOf(a))).toEqual([]);
    expect(await listObjects(`photos/${uidOf(a)}/`)).toEqual([]);
    expect(await getConsent(uidOf(a))).toBeNull();
    // The other user is untouched.
    expect(await listObjects(`photos/${uidOf(b)}/`)).toHaveLength(1);
    expect(await getConsent(uidOf(b))).not.toBeNull();
    expect(await listPhotos(uidOf(b))).toHaveLength(1);
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
      .set({ isGuest: true, expiresAt: new Date(), defaultPhotoId: "p1" });
    await firestore()
      .collection("photos")
      .doc(uid)
      .collection("items")
      .doc("p1")
      .set({ isGuest: true, expiresAt: new Date() });
    const ok = await attachPOST(
      req("POST", "/api/account/attach", { token: t }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ isGuest: false });
    const doc = (await firestore().collection("photos").doc(uid).get()).data()!;
    expect(doc.isGuest).toBe(false);
    expect(doc.expiresAt).toBeNull();
    const item = (
      await firestore()
        .collection("photos")
        .doc(uid)
        .collection("items")
        .doc("p1")
        .get()
    ).data()!;
    expect(item.isGuest).toBe(false);
    void bucket;
  });
});
