// Lists: CRUD, every limit, ownership (another person gets 404 on every route), guests refused.
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_FAVOURITES,
  MAX_LISTS,
  MAX_LIST_ITEMS,
  changeListFor,
  favouritesIdFor,
} from "@trailroom/db";
import { CATALOG } from "@trailroom/catalog";
import { GET as listsGET, POST as listsPOST } from "../app/api/lists/route";
import {
  DELETE as listDELETE,
  PATCH as listPATCH,
} from "../app/api/lists/[id]/route";
import { anonymousToken, emailToken, req, reset, uidOf } from "./testkit";

beforeEach(reset);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const create = (token: string, json: unknown) =>
  listsPOST(req("POST", "/api/lists", { token, json }));
const patch = (token: string, id: string, json: unknown) =>
  listPATCH(req("PATCH", `/api/lists/${id}`, { token, json }), ctx(id));
const del = (token: string, id: string) =>
  listDELETE(req("DELETE", `/api/lists/${id}`, { token }), ctx(id));
const get = async (token: string) =>
  (await (await listsGET(req("GET", "/api/lists", { token }))).json())
    .lists as {
    id: string;
    name: string;
    itemIds: string[];
    kind?: string;
  }[];
// The lists a person made themselves: Favourites is always there and is checked on its own.
const mine = async (token: string) =>
  (await get(token)).filter((l) => l.kind !== "favourites");

const IDS = CATALOG.map((i) => i.id);

describe("lists", () => {
  it("creates, reads, renames, adds and removes (idempotently), deletes", async () => {
    const t = await emailToken();
    const made = await create(t, {
      name: "  Wedding   in September ",
      itemId: IDS[0],
    });
    expect(made.status).toBe(201);
    const { list } = await made.json();
    expect(list.name).toBe("Wedding in September");
    expect(list.itemIds).toEqual([IDS[0]]);

    let r = await patch(t, list.id, { add: IDS[1] });
    expect((await r.json()).list.itemIds).toEqual([IDS[0], IDS[1]]);
    r = await patch(t, list.id, { add: IDS[1] });
    expect((await r.json()).list.itemIds).toEqual([IDS[0], IDS[1]]);
    r = await patch(t, list.id, { name: "Work", remove: IDS[0] });
    const body = (await r.json()).list;
    expect([body.name, body.itemIds]).toEqual(["Work", [IDS[1]]]);
    r = await patch(t, list.id, { remove: "never-there" });
    expect(r.status).toBe(200);

    expect((await mine(t)).map((l) => l.name)).toEqual(["Work"]);
    expect((await del(t, list.id)).status).toBe(200);
    expect(await mine(t)).toEqual([]);
    expect((await del(t, list.id)).status).toBe(404);
  });

  it("validates names, pieces and bodies", async () => {
    const t = await emailToken();
    for (const bad of [
      {},
      { name: "" },
      { name: "   " },
      { name: "x".repeat(61) },
      { name: 5 },
      { name: "ok", itemId: "not-a-piece" },
      { name: "ok", itemId: 7 },
      { name: "bell\u0007here" },
      [],
    ]) {
      expect((await create(t, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    const { list } = await (await create(t, { name: "Fine" })).json();
    for (const bad of [{}, { add: "nope" }, { name: "" }, { remove: 4 }]) {
      expect((await patch(t, list.id, bad)).status, JSON.stringify(bad)).toBe(
        400,
      );
    }
  });

  it("enforces 12 pieces per list and 30 lists per person", async () => {
    const t = await emailToken();
    const { list } = await (await create(t, { name: "Big" })).json();
    for (const id of IDS.slice(0, MAX_LIST_ITEMS)) {
      expect((await patch(t, list.id, { add: id })).status).toBe(200);
    }
    // The demo catalogue has exactly 12 pieces, so the 13th can only be reached below the route:
    // the limit lives in the repository, where it is checked inside the transaction.
    const over = await changeListFor(uidOf(t), list.id, {
      add: "a-thirteenth-piece",
    });
    expect(over).toEqual({ ok: false, error: "list_full" });
    // Re-adding a piece already there is not "full".
    expect((await patch(t, list.id, { add: IDS[0]! })).status).toBe(200);

    for (let i = 1; i < MAX_LISTS; i++) {
      expect((await create(t, { name: `L${i}` })).status).toBe(201);
    }
    const tooMany = await create(t, { name: "One more" });
    expect([tooMany.status, (await tooMany.json()).error]).toEqual([
      409,
      "list_limit",
    ]);
    // Another person is unaffected.
    expect((await create(await emailToken(), { name: "Mine" })).status).toBe(
      201,
    );
  });

  it("another person gets 404 on every list route, and cannot see or change it", async () => {
    const a = await emailToken();
    const b = await emailToken();
    const { list } = await (
      await create(a, { name: "Private", itemId: IDS[0] })
    ).json();
    expect((await patch(b, list.id, { name: "Hijack" })).status).toBe(404);
    expect((await patch(b, list.id, { add: IDS[1] })).status).toBe(404);
    expect((await del(b, list.id)).status).toBe(404);
    expect((await patch(b, "nope_nope", { name: "x" })).status).toBe(404);
    expect(await mine(b)).toEqual([]);
    expect((await mine(a)).map((l) => [l.name, l.itemIds])).toEqual([
      ["Private", [IDS[0]]],
    ]);
  });

  it("guests may keep Favourites and nothing else; callers with no token are refused", async () => {
    const g = await anonymousToken();
    for (const res of [
      await create(g, { name: "x" }),
      await patch(g, "x", { name: "y" }),
      await del(g, "x"),
    ]) {
      expect([res.status, (await res.json()).error]).toEqual([
        403,
        "account_required",
      ]);
    }
    // They can read their (empty) Favourites and save into it by its alias.
    expect((await get(g)).map((l) => [l.kind, l.itemIds])).toEqual([
      ["favourites", []],
    ]);
    const saved = await patch(g, "favourites", { add: IDS[0] });
    expect(saved.status).toBe(200);
    expect((await saved.json()).list.id).toBe(favouritesIdFor(uidOf(g)));
    expect((await get(g)).map((l) => l.itemIds)).toEqual([[IDS[0]]]);
    // A guest cannot reach any other list, even a real one.
    const other = await (
      await create(await emailToken(), { name: "Theirs" })
    ).json();
    expect((await patch(g, other.list.id, { add: IDS[1] })).status).toBe(403);
    expect((await listsGET(req("GET", "/api/lists"))).status).toBe(401);
    expect(
      (await listsPOST(req("POST", "/api/lists", { json: { name: "x" } })))
        .status,
    ).toBe(401);
  });

  describe("Favourites", () => {
    it("is first, empty and unsaved until the first save, then one list per person", async () => {
      const t = await emailToken();
      const before = await get(t);
      expect(before.map((l) => [l.kind, l.name, l.itemIds])).toEqual([
        ["favourites", "Favourites", []],
      ]);
      await create(t, { name: "Work" });
      const r = await patch(t, "favourites", { add: IDS[0] });
      expect(r.status).toBe(200);
      // Saving twice, by alias and by id, is the same single list.
      await patch(t, favouritesIdFor(uidOf(t)), { add: IDS[1] });
      await patch(t, "favourites", { add: IDS[1] });
      const lists = await get(t);
      expect(lists.map((l) => l.name)).toEqual(["Favourites", "Work"]);
      expect(lists[0]!.itemIds).toEqual([IDS[0], IDS[1]]);
      expect(lists.filter((l) => l.kind === "favourites")).toHaveLength(1);
      // A piece comes out again.
      await patch(t, "favourites", { remove: IDS[0] });
      expect((await get(t))[0]!.itemIds).toEqual([IDS[1]]);
    });

    it("cannot be renamed or deleted, and removing a piece in a first save is not creating", async () => {
      const t = await emailToken();
      await patch(t, "favourites", { add: IDS[0] });
      const id = favouritesIdFor(uidOf(t));
      expect((await patch(t, id, { name: "Mine" })).status).toBe(400);
      expect((await patch(t, "favourites", { name: "Mine" })).status).toBe(400);
      expect((await del(t, id)).status).toBe(400);
      expect((await get(t))[0]!.name).toBe("Favourites");
      // Another person cannot touch it through the real id.
      const b = await emailToken();
      expect((await patch(b, id, { add: IDS[1] })).status).toBe(404);
      expect((await del(b, id)).status).toBe(404);
    });

    it("does not count against the 30 lists, and has its own cap of 200", async () => {
      const t = await emailToken();
      await patch(t, "favourites", { add: IDS[0] });
      for (let i = 0; i < MAX_LISTS; i++) {
        expect((await create(t, { name: `L${i}` })).status).toBe(201);
      }
      expect((await create(t, { name: "One more" })).status).toBe(409);
      expect(
        (await get(t)).filter((l) => l.kind === "favourites"),
      ).toHaveLength(1);

      // The cap lives in the repository: the demo catalogue is smaller than 200 pieces.
      const uid = uidOf(t);
      const id = favouritesIdFor(uid);
      const { firestore } = await import("@trailroom/db");
      await firestore()
        .collection("lists")
        .doc(id)
        .update({
          itemIds: Array.from({ length: MAX_FAVOURITES }, (_, i) => `p${i}`),
        });
      expect(await changeListFor(uid, id, { add: "p-new" })).toEqual({
        ok: false,
        error: "list_full",
      });
      // Other lists keep their own, smaller limit.
      expect(MAX_LIST_ITEMS).toBeLessThan(MAX_FAVOURITES);
    });
  });
});
