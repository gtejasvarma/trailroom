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
