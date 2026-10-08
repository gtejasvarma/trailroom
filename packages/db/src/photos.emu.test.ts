import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "./emu-helpers";
import { firestore } from "./app";
import {
  addPhoto,
  countPhotos,
  deletePhoto,
  getDefaultPhotoId,
  listPhotos,
  PhotoLimitError,
  setDefaultPhoto,
} from "./photos";
import { deleteAllForUser, promoteGuest } from "./users";
import { MAX_PHOTOS } from "./types";

beforeEach(clearFirestore);

const add = (uid: string, isGuest = false, now = new Date()) =>
  addPhoto(uid, { width: 800, height: 1100, isGuest }, now);

describe("photos", () => {
  it("first photo is the default, labels count up, the 7th is refused", async () => {
    const first = await add("u1");
    expect(first.isDefault).toBe(true);
    expect(first.photo.label).toBe("Photo 1");
    const second = await add("u1");
    expect(second.isDefault).toBe(false);
    expect(second.photo.label).toBe("Photo 2");
    for (let i = 2; i < MAX_PHOTOS; i++) await add("u1");
    expect(await countPhotos("u1")).toBe(MAX_PHOTOS);
    await expect(add("u1")).rejects.toBeInstanceOf(PhotoLimitError);
    expect(await countPhotos("u1")).toBe(MAX_PHOTOS);
  });

  it("make default, and deleting the default promotes the oldest remaining", async () => {
    const a = await add("u1", false, new Date(1000));
    const b = await add("u1", false, new Date(2000));
    const c = await add("u1", false, new Date(3000));
    expect(await setDefaultPhoto("u1", c.photo.id)).toBe(true);
    expect(await setDefaultPhoto("u1", "nope")).toBe(false);
    expect(await getDefaultPhotoId("u1")).toBe(c.photo.id);
    expect(await deletePhoto("u1", c.photo.id)).toBe(true);
    expect(await getDefaultPhotoId("u1")).toBe(a.photo.id);
    expect(await deletePhoto("u1", c.photo.id)).toBe(false);
    await deletePhoto("u1", a.photo.id);
    expect(await getDefaultPhotoId("u1")).toBe(b.photo.id);
    await deletePhoto("u1", b.photo.id);
    expect(await getDefaultPhotoId("u1")).toBeNull();
    expect(
      (await firestore().collection("photos").doc("u1").get()).exists,
    ).toBe(false);
    expect(await listPhotos("u1")).toEqual([]);
  });

  it("promoteGuest covers every photo; deleteAllForUser removes them all", async () => {
    await add("g", true);
    await add("g", true);
    expect(await promoteGuest("g")).toBe(3); // parent + two photos
    for (const p of await listPhotos("g")) {
      expect(p.isGuest).toBe(false);
      expect(p.expiresAt).toBeNull();
    }
    await deleteAllForUser("g");
    expect(await listPhotos("g")).toEqual([]);
  });
});
