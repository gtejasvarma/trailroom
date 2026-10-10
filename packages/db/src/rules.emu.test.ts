import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes, deleteObject } from "firebase/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
let env: RulesTestEnvironment;

const COLLECTIONS = [
  "consents",
  "photos",
  "jobs",
  "poseSets",
  "spend",
  "spendLog",
  "usage",
  "jobInternals",
  "follows",
];

beforeAll(async () => {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [fh, fp] = fsHost.split(":");
  const stHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
  const [sh, sp] = stHost.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-trailroom-rules",
    firestore: {
      rules: readFileSync(resolve(root, "firestore.rules"), "utf8"),
      host: fh,
      port: Number(fp),
    },
    storage: {
      rules: readFileSync(resolve(root, "storage.rules"), "utf8"),
      host: sh,
      port: Number(sp),
    },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "consents/alice"), { version: "v1" });
    await setDoc(doc(db, "photos/alice"), { defaultPhotoId: "p1" });
    await setDoc(doc(db, "photos/alice/items/p1"), { storagePath: "x" });
    await setDoc(doc(db, "jobs/j1"), { uid: "alice" });
    await setDoc(doc(db, "poseSets/alice_1_blouse"), { uid: "alice" });
    await setDoc(doc(db, "spend/2026-01-01"), { committedMicros: 0 });
    await setDoc(doc(db, "spendLog/l1"), { day: "2026-01-01" });
    await setDoc(doc(db, "usage/alice_2026-01-01"), {
      uid: "alice",
      starts: 1,
    });
    await setDoc(doc(db, "jobInternals/j1"), { failureDetail: "secret" });
    await setDoc(doc(db, "follows/alice"), { labels: ["marchand"] });
    await setDoc(doc(db, "jobs/j2"), { uid: "bob" });
    await setDoc(doc(db, "lists/l1"), { uid: "alice", name: "Wedding" });
    await setDoc(doc(db, "asks/a1"), { uid: "alice", tokenHash: "x" });
    await setDoc(doc(db, "asks/a1/votes/v1"), {
      itemId: "coat",
      voterUid: "bob",
    });
    await setDoc(doc(db, "inbox/bob/asks/a1"), { askerFirstName: "Maya" });
    await setDoc(doc(db, "purchases/alice_wool-car-coat"), {
      uid: "alice",
      itemId: "wool-car-coat",
      arrived: null,
    });
    // A real object, so a denied read is a permission error and not a not-found.
    await uploadBytes(
      ref(ctx.storage(), "photos/alice/p1.jpg"),
      new Uint8Array([1, 2, 3]),
    );
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const actors = () => ({
  owner: env.authenticatedContext("alice").firestore(),
  stranger: env.authenticatedContext("bob").firestore(),
  anon: env.unauthenticatedContext().firestore(),
});

describe("firestore rules: reads", () => {
  it.each([
    ["consents/alice"],
    ["jobs/j1"],
    ["poseSets/alice_1_blouse"],
    ["follows/alice"],
  ])("owner reads %s; stranger and anon cannot", async (path) => {
    const a = actors();
    await assertSucceeds(getDoc(doc(a.owner, path)));
    await assertFails(getDoc(doc(a.stranger, path)));
    await assertFails(getDoc(doc(a.anon, path)));
  });

  it.each([
    ["photos/alice"],
    ["spend/2026-01-01"],
    ["spendLog/l1"],
    ["usage/alice_2026-01-01"],
    ["jobInternals/j1"],
  ])("nobody reads %s", async (path) => {
    const a = actors();
    await assertFails(getDoc(doc(a.owner, path)));
    await assertFails(getDoc(doc(a.stranger, path)));
    await assertFails(getDoc(doc(a.anon, path)));
  });
});

describe("firestore rules: list queries on jobs", () => {
  it("a query constrained to the caller's uid succeeds", async () => {
    const a = actors();
    const snap = await assertSucceeds(
      getDocs(query(collection(a.owner, "jobs"), where("uid", "==", "alice"))),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(["j1"]);
  });
  it("an unconstrained query, or another uid's, is denied", async () => {
    const a = actors();
    await assertFails(getDocs(collection(a.owner, "jobs")));
    await assertFails(
      getDocs(query(collection(a.owner, "jobs"), where("uid", "==", "bob"))),
    );
    await assertFails(
      getDocs(query(collection(a.anon, "jobs"), where("uid", "==", "alice"))),
    );
  });
});

describe("firestore rules: no client writes", () => {
  const paths: Record<string, string> = {
    consents: "consents/alice",
    photos: "photos/alice",
    jobs: "jobs/j1",
    poseSets: "poseSets/alice_1_blouse",
    spend: "spend/2026-01-01",
    spendLog: "spendLog/l1",
    usage: "usage/alice_2026-01-01",
    jobInternals: "jobInternals/j1",
    follows: "follows/alice",
  };
  it.each(COLLECTIONS)("%s: create, update, delete all denied", async (c) => {
    const a = actors();
    for (const db of [a.owner, a.stranger, a.anon]) {
      await assertFails(
        setDoc(doc(db, `${c}/brand-new`), { uid: "alice", version: "v" }),
      );
      await assertFails(updateDoc(doc(db, paths[c]), { uid: "alice" }));
      await assertFails(deleteDoc(doc(db, paths[c])));
    }
  });
});

describe("photos subcollection", () => {
  it("a client reads and writes nothing under photos, not even its own", async () => {
    for (const ctx of [
      env.authenticatedContext("alice"),
      env.authenticatedContext("bob"),
      env.unauthenticatedContext(),
    ]) {
      const db = ctx.firestore();
      await assertFails(getDoc(doc(db, "photos/alice/items/p1")));
      await assertFails(getDocs(collection(db, "photos/alice/items")));
      await assertFails(
        setDoc(doc(db, "photos/alice/items/p2"), { storagePath: "y" }),
      );
      await assertFails(deleteDoc(doc(db, "photos/alice/items/p1")));
      await assertFails(
        updateDoc(doc(db, "photos/alice"), { defaultPhotoId: "p2" }),
      );
    }
  });
});

describe("phase D: lists, asks, votes and inbox are server-only", () => {
  const docs = ["lists/l1", "asks/a1", "asks/a1/votes/v1", "inbox/bob/asks/a1"];
  const lists = ["lists", "asks", "asks/a1/votes", "inbox/bob/asks"];
  it.each(docs)(
    "nobody reads or writes %s, not even its owner",
    async (path) => {
      const a = actors();
      for (const db of [a.owner, a.stranger, a.anon]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { uid: "alice" }));
        await assertFails(updateDoc(doc(db, path), { uid: "alice" }));
        await assertFails(deleteDoc(doc(db, path)));
      }
      // The inbox owner is bob, and still gets nothing.
      const bob = env.authenticatedContext("bob").firestore();
      await assertFails(getDoc(doc(bob, path)));
    },
  );
  it.each(lists)("nobody lists %s", async (path) => {
    const a = actors();
    for (const db of [a.owner, a.stranger, a.anon]) {
      await assertFails(getDocs(collection(db, path)));
      await assertFails(setDoc(doc(db, `${path}/brand-new`), { uid: "alice" }));
    }
  });
  it("a collection-group query over votes is denied", async () => {
    const a = actors();
    await assertFails(
      getDocs(
        query(
          collectionGroup(a.owner, "votes"),
          where("voterUid", "==", "alice"),
        ),
      ),
    );
  });
});

describe("phase E: purchases are server-only", () => {
  const path = "purchases/alice_wool-car-coat";
  it("nobody reads, writes or deletes a purchase, not even its owner", async () => {
    const a = actors();
    for (const db of [a.owner, a.stranger, a.anon]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { arrived: true }));
      await assertFails(updateDoc(doc(db, path), { arrived: true }));
      await assertFails(deleteDoc(doc(db, path)));
      await assertFails(
        setDoc(doc(db, "purchases/alice_new"), { uid: "alice" }),
      );
      await assertFails(getDocs(collection(db, "purchases")));
      await assertFails(
        getDocs(
          query(collection(db, "purchases"), where("uid", "==", "alice")),
        ),
      );
    }
  });
});

describe("storage rules", () => {
  it("denies every read and write for owner and stranger", async () => {
    for (const ctx of [
      env.authenticatedContext("alice"),
      env.authenticatedContext("bob"),
      env.unauthenticatedContext(),
    ]) {
      const st = ctx.storage();
      const r = ref(st, "photos/alice/p1.jpg");
      await expect(getBytes(r)).rejects.toMatchObject({
        code: "storage/unauthorized",
      });
      await assertFails(uploadBytes(r, new Uint8Array([1, 2, 3])));
      await assertFails(deleteObject(r));
      await assertFails(
        uploadBytes(ref(st, "renders/alice/x/front.jpg"), new Uint8Array([1])),
      );
      await assertFails(getBytes(ref(st, "renders/alice/x/front.jpg")));
    }
  });
});
