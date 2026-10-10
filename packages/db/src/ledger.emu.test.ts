import { beforeEach, describe, expect, it } from "vitest";
import { ReservationExistsError, SpendCeilingError } from "@trailroom/render";
import { clearFirestore } from "./emu-helpers";
import { FirestoreDailyLedger } from "./ledger";
import { firestore } from "./app";

const T = (s: string) => () => new Date(s);
const TEN_CENTS = 100_000;

beforeEach(clearFirestore);

describe("FirestoreDailyLedger", () => {
  it("admits exactly ten of thirty concurrent $0.10 reserves against $1.00", async () => {
    const ledger = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        ledger.reserve(TEN_CENTS, { jobId: "j", pose: `p${i}`, attempt: 1 }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(10);
    expect(bad).toHaveLength(20);
    for (const r of bad) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
        SpendCeilingError,
      );
    }
    const day = await ledger.getDay("2026-03-01");
    expect(day!.committedMicros + day!.pendingMicros).toBeLessThanOrEqual(
      1_000_000,
    );
    expect(day!.pendingMicros).toBe(1_000_000);
    const logs = await firestore().collection("spendLog").get();
    expect(logs.size).toBe(10);
  });

  it("settle twice counts once", async () => {
    const ledger = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const settle = await ledger.reserve(TEN_CENTS, {
      jobId: "j",
      pose: "front",
      attempt: 1,
    });
    await settle(60_000);
    await settle(60_000);
    const day = await ledger.getDay("2026-03-01");
    expect(day!.committedMicros).toBe(60_000);
    expect(day!.pendingMicros).toBe(0);
  });

  it("settleReservation after a crash (new instance) counts once", async () => {
    const a = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const { id } = await a.reserveWithId(TEN_CENTS, {
      jobId: "j",
      pose: "front",
      attempt: 1,
    });
    const b = new FirestoreDailyLedger(1, T("2026-03-01T12:05:00Z"));
    const found = await b.findReservation("j", "front", 1);
    expect(found?.id).toBe(id);
    expect(found?.log.state).toBe("reserved");
    await b.settleReservation(id, 70_000);
    await b.settleReservation(id, 70_000);
    const day = await b.getDay("2026-03-01");
    expect(day!.committedMicros).toBe(70_000);
    expect(day!.pendingMicros).toBe(0);
  });

  it("re-reserving the same (jobId, pose, attempt) does not hold twice", async () => {
    const l = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const meta = { jobId: "j", pose: "front", attempt: 1 };
    const r1 = await l.reserveWithId(TEN_CENTS, meta);
    const r2 = await l.reserveWithId(TEN_CENTS, meta);
    expect(r1.existing).toBe(false);
    expect(r2.existing).toBe(true);
    expect((await l.getDay("2026-03-01"))!.pendingMicros).toBe(TEN_CENTS);
  });

  it("settles against the reservation day across UTC midnight", async () => {
    let now = new Date("2026-03-01T23:59:00Z");
    const l = new FirestoreDailyLedger(1, () => now);
    const settle = await l.reserve(TEN_CENTS, {
      jobId: "j",
      pose: "front",
      attempt: 1,
    });
    now = new Date("2026-03-02T00:01:00Z");
    await settle(80_000);
    const d1 = await l.getDay("2026-03-01");
    expect(d1!.committedMicros).toBe(80_000);
    expect(d1!.pendingMicros).toBe(0);
    expect(await l.getDay("2026-03-02")).toBeNull();
    const settle2 = await l.reserve(TEN_CENTS);
    const d2 = await l.getDay("2026-03-02");
    expect(d2!.committedMicros).toBe(0);
    expect(d2!.pendingMicros).toBe(TEN_CENTS);
    await settle2(1);
  });

  it("writes a spend log line per reservation with meta", async () => {
    const l = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const settle = await l.reserve(TEN_CENTS, {
      model: "nano-banana-2" as never,
      pose: "side",
      jobId: "job9",
      attempt: 2,
    });
    const found = await l.findReservation("job9", "side", 2);
    expect(found!.log).toMatchObject({
      day: "2026-03-01",
      model: "nano-banana-2",
      pose: "side",
      jobId: "job9",
      attempt: 2,
      estimateMicros: TEN_CENTS,
      actualMicros: null,
      state: "reserved",
    });
    await settle(50_000);
    const after = await l.findReservation("job9", "side", 2);
    expect(after!.log.state).toBe("settled");
    expect(after!.log.actualMicros).toBe(50_000);
    expect(after!.log.settledAt).not.toBeNull();
  });

  it("reserve() rejects with ReservationExistsError for a held (jobId, pose, attempt)", async () => {
    const l = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const meta = { jobId: "j", pose: "front", attempt: 1 };
    await l.reserve(TEN_CENTS, meta);
    await expect(l.reserve(TEN_CENTS, meta)).rejects.toBeInstanceOf(
      ReservationExistsError,
    );
    expect((await l.getDay("2026-03-01"))!.pendingMicros).toBe(TEN_CENTS);
  });

  it("records output and thought token counts on the log line", async () => {
    const l = new FirestoreDailyLedger(1, T("2026-03-01T12:00:00Z"));
    const meta = { jobId: "j", pose: "front", attempt: 1 };
    const settle = await l.reserve(TEN_CENTS, meta);
    await settle(50_000, { outputTokens: 1290, thoughtTokens: 5 });
    const found = await l.findReservation("j", "front", 1);
    expect(found!.log).toMatchObject({ outputTokens: 1290, thoughtTokens: 5 });
  });

  describe("reapStaleReservations", () => {
    it("settles old reserved lines at their estimate, leaves young ones, is idempotent", async () => {
      let now = new Date("2026-03-01T12:00:00Z");
      const l = new FirestoreDailyLedger(1, () => now);
      await l.reserve(TEN_CENTS, { jobId: "old", pose: "front", attempt: 1 });
      now = new Date("2026-03-01T12:19:00Z");
      await l.reserve(TEN_CENTS, { jobId: "new", pose: "front", attempt: 1 });
      now = new Date("2026-03-01T12:20:00Z");
      const fifteen = 15 * 60_000;
      expect(await l.reapStaleReservations(fifteen, now)).toBe(1);
      const old = await l.findReservation("old", "front", 1);
      expect(old!.log).toMatchObject({
        state: "settled",
        actualMicros: TEN_CENTS,
        reaped: true,
      });
      expect((await l.findReservation("new", "front", 1))!.log.state).toBe(
        "reserved",
      );
      const day = await l.getDay("2026-03-01");
      expect(day).toMatchObject({
        pendingMicros: TEN_CENTS,
        committedMicros: TEN_CENTS,
      });
      expect(await l.reapStaleReservations(fifteen, now)).toBe(0);
      expect(await l.getDay("2026-03-01")).toMatchObject({
        pendingMicros: TEN_CENTS,
        committedMicros: TEN_CENTS,
      });
    });
  });
});

describe("the separate ceiling for renders nobody asked for", () => {
  const at = T("2026-03-01T12:00:00Z");
  const meta = (i: number, unrequested: boolean) => ({
    jobId: "j",
    pose: `p${i}`,
    attempt: 1,
    unrequested,
  });

  it("stops unrequested reserves at its own ceiling and leaves the headroom to requested ones", async () => {
    // $1.00 a day in all; $0.30 of it may go on renders nobody asked for.
    const ledger = new FirestoreDailyLedger(1, at, 0.3);
    for (let i = 0; i < 3; i++) await ledger.reserve(TEN_CENTS, meta(i, true));
    await expect(ledger.reserve(TEN_CENTS, meta(3, true))).rejects.toThrow(
      /unrequested-render ceiling/,
    );
    // Requested renders still fit in the rest of the day.
    for (let i = 10; i < 17; i++)
      await ledger.reserve(TEN_CENTS, meta(i, false));
    // ...up to the daily cap, which holds for both kinds.
    await expect(
      ledger.reserve(TEN_CENTS, meta(20, false)),
    ).rejects.toBeInstanceOf(SpendCeilingError);
    const day = await ledger.getDay("2026-03-01");
    expect(day!.pendingMicros).toBe(1_000_000);
    expect(day!.unrequestedPendingMicros).toBe(300_000);
  });

  it("checks both ceilings in one transaction: a full day refuses an unrequested render with room under its own ceiling", async () => {
    const ledger = new FirestoreDailyLedger(0.2, at, 0.5); // clamped to the cap
    expect(ledger.unrequestedCeilingMicros).toBe(200_000);
    await ledger.reserve(TEN_CENTS, meta(1, false));
    await ledger.reserve(TEN_CENTS, meta(2, false));
    await expect(
      ledger.reserve(TEN_CENTS, meta(3, true)),
    ).rejects.toBeInstanceOf(SpendCeilingError);
  });

  it("refuses unrequested renders outright when no ceiling was given", async () => {
    const ledger = new FirestoreDailyLedger(1, at);
    await expect(
      ledger.reserve(TEN_CENTS, meta(1, true)),
    ).rejects.toBeInstanceOf(SpendCeilingError);
    await ledger.reserve(TEN_CENTS, meta(2, false));
  });

  it("settles an unrequested render against its own counter, once", async () => {
    const ledger = new FirestoreDailyLedger(1, at, 0.3);
    const settle = await ledger.reserve(TEN_CENTS, meta(1, true));
    await settle(60_000);
    await settle(60_000);
    const day = await ledger.getDay("2026-03-01");
    expect(day).toMatchObject({
      committedMicros: 60_000,
      pendingMicros: 0,
      unrequestedCommittedMicros: 60_000,
      unrequestedPendingMicros: 0,
    });
  });

  it("rendersThatFit reports the room under both ceilings", async () => {
    const ledger = new FirestoreDailyLedger(1, at, 0.3);
    expect(await ledger.rendersThatFit(TEN_CENTS, true)).toBe(3);
    expect(await ledger.rendersThatFit(TEN_CENTS, false)).toBe(10);
    await ledger.reserve(TEN_CENTS, meta(1, true));
    expect(await ledger.rendersThatFit(TEN_CENTS, true)).toBe(2);
    expect(await ledger.rendersThatFit(TEN_CENTS, false)).toBe(9);
  });
});
