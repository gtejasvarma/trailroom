// Lists: CRUD, every limit, ownership (another person gets 404 on every route), guests refused.
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LISTS, MAX_LIST_ITEMS, changeListFor } from "@trailroom/db";
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
  }[];

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

    expect((await get(t)).map((l) => l.name)).toEqual(["Work"]);
    expect((await del(t, list.id)).status).toBe(200);
    expect(await get(t)).toEqual([]);
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
    expect(await get(b)).toEqual([]);
    expect((await get(a)).map((l) => [l.name, l.itemIds])).toEqual([
      ["Private", [IDS[0]]],
    ]);
  });

  it("guests and callers with no token are refused", async () => {
    const g = await anonymousToken();
    for (const res of [
      await listsGET(req("GET", "/api/lists", { token: g })),
      await create(g, { name: "x" }),
      await patch(g, "x", { name: "y" }),
      await del(g, "x"),
    ]) {
      expect([res.status, (await res.json()).error]).toEqual([
        403,
        "account_required",
      ]);
    }
    expect((await listsGET(req("GET", "/api/lists"))).status).toBe(401);
    expect(
      (await listsPOST(req("POST", "/api/lists", { json: { name: "x" } })))
        .status,
    ).toBe(401);
  });
});
