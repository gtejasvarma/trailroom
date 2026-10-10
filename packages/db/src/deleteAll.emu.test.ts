import { beforeEach, describe, expect, it, vi } from "vitest";
import { firestore } from "./app";
import { clearFirestore } from "./emu-helpers";

// The collection-group query behind anonymiseVotesBy is the one most likely to fail (it needs an
// index). Make it fail and check nothing else was left live.
vi.mock("./asks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./asks")>()),
  anonymiseVotesBy: vi.fn().mockRejectedValue(new Error("index missing")),
}));

const { createAskFor } = await import("./asks");
const { createListFor } = await import("./lists");
const { deleteAllForUser } = await import("./users");

beforeEach(clearFirestore);

describe("deleteAllForUser", () => {
  it("removes asks and lists before the vote anonymisation, which runs last and throws", async () => {
    await createListFor("u1", "Wedding");
    await createAskFor({
      uid: "u1",
      askerFirstName: "Maya",
      listId: "l",
      listName: "x",
      question: null,
      itemIds: ["coat"],
      poseSetIds: {},
    });
    await expect(deleteAllForUser("u1")).rejects.toThrow("index missing");
    expect((await firestore().collection("asks").get()).size).toBe(0);
    expect((await firestore().collection("lists").get()).size).toBe(0);
  });
});
