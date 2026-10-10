import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@trailroom/db";
import { requireUser, verifyGuestToken } from "./auth";
import { anonymousToken, emailToken, req, reset, uidOf } from "./testkit";

beforeEach(reset);

describe("ID tokens of deleted users", () => {
  it("are refused by requireUser once the user is deleted", async () => {
    const token = await emailToken();
    const ok = await requireUser(req("GET", "/x", { token }));
    expect(ok).toMatchObject({ uid: uidOf(token), isGuest: false });
    await auth().deleteUser(uidOf(token));
    const after = await requireUser(req("GET", "/x", { token }));
    expect(after).toBeInstanceOf(Response);
    expect((after as Response).status).toBe(401);
  });

  it("are refused by verifyGuestToken once the guest is deleted", async () => {
    const token = await anonymousToken();
    expect(await verifyGuestToken(token)).toBe(uidOf(token));
    await auth().deleteUser(uidOf(token));
    expect(await verifyGuestToken(token)).toBeNull();
  });
});
