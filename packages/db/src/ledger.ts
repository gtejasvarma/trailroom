import { Timestamp } from "firebase-admin/firestore";
import {
  ReservationExistsError,
  SpendCeilingError,
  type Settle,
  type SettleInfo,
  usdToMicros,
  type Micros,
  type SpendLedger,
  type SpendMeta,
} from "@trailroom/render";
import { firestore } from "./app";

export interface SpendDayDoc {
  committedMicros: number;
  pendingMicros: number;
  ceilingMicros: number;
  updatedAt: Timestamp;
}

export interface SpendLogDoc {
  day: string;
  model: string | null;
  pose: string | null;
  jobId: string | null;
  attempt: number | null;
  estimateMicros: number;
  actualMicros: number | null;
  state: "reserved" | "settled";
  createdAt: Timestamp;
  settledAt: Timestamp | null;
  /** Logged for visibility only; the per-image price is flat, so these are not priced. */
  outputTokens?: number;
  thoughtTokens?: number;
  /** True when a stuck reservation was settled at its estimate by the reaper. */
  reaped?: boolean;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Every reserve and settle writes the same day document, so parallel poses contend on it. Left to
// Firestore alone, a burst of transactions can exhaust its retries and reject with ABORTED, which
// would surface as a failed pose that never reached the model. Two layers stop that: transactions
// from this process run one at a time, and contention from other instances is retried with
// backoff. A SpendCeilingError is a decision, not contention, and is never retried.
let tail: Promise<unknown> = Promise.resolve();
const CONTENTION_CODES = new Set([4, 10, 14]); // DEADLINE_EXCEEDED, ABORTED, UNAVAILABLE
const CONTENTION_RETRIES = 5;

function isContention(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "number" && CONTENTION_CODES.has(code);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isContention(err) || attempt >= CONTENTION_RETRIES) throw err;
      const backoffMs = 50 * 2 ** attempt + Math.floor(Math.random() * 50);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(() => withRetry(fn));
  tail = run.catch(() => undefined);
  return run;
}

/** Deterministic log id for a (jobId, pose, attempt) reservation, so retries find it. */
export function reservationIdFor(
  jobId: string,
  pose: string,
  attempt: number,
): string {
  return `${jobId}__${pose}__${attempt}`;
}

export class FirestoreDailyLedger implements SpendLedger {
  readonly ceilingMicros: Micros;

  constructor(
    ceilingUsd: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.ceilingMicros = usdToMicros(ceilingUsd);
  }

  private days = () => firestore().collection("spend");
  private log = () => firestore().collection("spendLog");

  /**
   * Holds the estimate. When meta has jobId+pose+attempt the log id is deterministic, and an
   * existing line means another call owns that attempt: rejects with ReservationExistsError so
   * the caller never calls the model twice. The transaction is the arbiter.
   */
  async reserve(estimateMicros: Micros, meta: SpendMeta = {}): Promise<Settle> {
    const { id, existing } = await this.reserveWithId(estimateMicros, meta);
    if (existing) throw new ReservationExistsError(id);
    return (actual, info) => this.settleReservation(id, actual, info);
  }

  async reserveWithId(
    estimateMicros: Micros,
    meta: SpendMeta = {},
  ): Promise<{ id: string; existing: boolean }> {
    const now = this.now();
    const day = utcDay(now);
    const dayRef = this.days().doc(day);
    const deterministic =
      meta.jobId !== undefined &&
      meta.pose !== undefined &&
      meta.attempt !== undefined;
    const logRef = deterministic
      ? this.log().doc(reservationIdFor(meta.jobId!, meta.pose!, meta.attempt!))
      : this.log().doc();
    return exclusive(() =>
      firestore().runTransaction(async (tx) => {
        const [daySnap, logSnap] = await Promise.all([
          tx.get(dayRef),
          tx.get(logRef),
        ]);
        if (logSnap.exists) return { id: logRef.id, existing: true };
        const cur = daySnap.exists
          ? (daySnap.data() as SpendDayDoc)
          : { committedMicros: 0, pendingMicros: 0 };
        if (
          cur.committedMicros + cur.pendingMicros + estimateMicros >
          this.ceilingMicros
        ) {
          throw new SpendCeilingError(
            `spend ceiling $${(this.ceilingMicros / 1e6).toFixed(2)} reached for ${day}`,
          );
        }
        tx.set(dayRef, {
          committedMicros: cur.committedMicros,
          pendingMicros: cur.pendingMicros + estimateMicros,
          ceilingMicros: this.ceilingMicros,
          updatedAt: Timestamp.fromDate(now),
        } satisfies SpendDayDoc);
        tx.set(logRef, {
          day,
          model: meta.model ?? null,
          pose: meta.pose ?? null,
          jobId: meta.jobId ?? null,
          attempt: meta.attempt ?? null,
          estimateMicros,
          actualMicros: null,
          state: "reserved",
          createdAt: Timestamp.fromDate(now),
          settledAt: null,
        } satisfies SpendLogDoc);
        return { id: logRef.id, existing: false };
      }),
    );
  }

  /** Looks up a reservation by (jobId, pose, attempt) so a node retry can skip re-reserving. */
  async findReservation(
    jobId: string,
    pose: string,
    attempt: number,
  ): Promise<{ id: string; log: SpendLogDoc } | null> {
    const snap = await this.log()
      .doc(reservationIdFor(jobId, pose, attempt))
      .get();
    return snap.exists
      ? { id: snap.id, log: snap.data() as SpendLogDoc }
      : null;
  }

  /**
   * Moves the estimate out of pending and the actual into committed on the day the reservation
   * was made. Idempotent: keyed off the log line's state, so a second call changes nothing.
   */
  async settleReservation(
    id: string,
    actualMicros: Micros,
    info: SettleInfo & { reaped?: boolean } = {},
  ): Promise<void> {
    const logRef = this.log().doc(id);
    await exclusive(() =>
      firestore().runTransaction(async (tx) => {
        const logSnap = await tx.get(logRef);
        if (!logSnap.exists) throw new Error(`unknown reservation ${id}`);
        const log = logSnap.data() as SpendLogDoc;
        if (log.state === "settled") return;
        const dayRef = this.days().doc(log.day);
        const daySnap = await tx.get(dayRef);
        const day = daySnap.data() as SpendDayDoc;
        const now = Timestamp.fromDate(this.now());
        tx.update(dayRef, {
          pendingMicros: day.pendingMicros - log.estimateMicros,
          committedMicros: day.committedMicros + actualMicros,
          updatedAt: now,
        });
        tx.update(logRef, {
          state: "settled",
          actualMicros,
          settledAt: now,
          ...(info.outputTokens !== undefined
            ? { outputTokens: info.outputTokens }
            : {}),
          ...(info.thoughtTokens !== undefined
            ? { thoughtTokens: info.thoughtTokens }
            : {}),
          ...(info.reaped ? { reaped: true } : {}),
        });
      }),
    );
  }

  /**
   * Settles every still-reserved line older than `olderThanMs` at its estimate (conservative:
   * the call may have been billed), releasing pendingMicros into committedMicros. Idempotent.
   */
  async reapStaleReservations(
    olderThanMs: number,
    now: Date = this.now(),
  ): Promise<number> {
    const cutoff = Timestamp.fromMillis(now.getTime() - olderThanMs);
    let reaped = 0;
    for (;;) {
      const snap = await this.log()
        .where("state", "==", "reserved")
        .where("createdAt", "<", cutoff)
        .limit(200)
        .get();
      if (snap.empty) return reaped;
      for (const d of snap.docs) {
        const log = d.data() as SpendLogDoc;
        await this.settleReservation(d.id, log.estimateMicros, {
          reaped: true,
        });
        reaped++;
      }
    }
  }

  async getDay(day: string): Promise<SpendDayDoc | null> {
    const snap = await this.days().doc(day).get();
    return snap.exists ? (snap.data() as SpendDayDoc) : null;
  }
}
