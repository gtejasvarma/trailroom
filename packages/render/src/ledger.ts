import { microsToUsd, usdToMicros, type Micros } from "./money";
import type { ModelKey } from "./models";

export class SpendCeilingError extends Error {}

/**
 * reserve() rejects with this when a deterministic (jobId, pose, attempt) reservation already
 * exists: another call owns that attempt, so this one must not call the model.
 */
export class ReservationExistsError extends Error {
  constructor(readonly reservationId: string) {
    super(`reservation ${reservationId} already exists`);
    this.name = "ReservationExistsError";
  }
}

/** What a spend-log line needs. All optional so the eval can pass nothing. */
export interface SpendMeta {
  model?: ModelKey;
  pose?: string;
  jobId?: string;
  attempt?: number;
  /**
   * True for a render the person did not ask for (the "arrives on you" buffer). A durable ledger
   * also holds these to a separate, lower ceiling, so they can never use the headroom that
   * requested try-ons need.
   */
  unrequested?: boolean;
}

/** Extra facts to keep on the spend-log line when settling. Logged, never priced. */
export interface SettleInfo {
  outputTokens?: number;
  thoughtTokens?: number;
}

export type Settle = (actualMicros: Micros, info?: SettleInfo) => Promise<void>;

/**
 * A spend budget a durable store can implement. reserve() rejects with SpendCeilingError when
 * committed + pending + estimate would exceed the ceiling (and with ReservationExistsError when a
 * deterministic reservation for the same attempt is already held); otherwise it holds the estimate and
 * returns a settle function. settle(actual) replaces the hold with the real cost and must be
 * idempotent (a retry after a crash must not double count). Amounts are integer micro-USD.
 */
export interface SpendLedger {
  reserve(estimateMicros: Micros, meta?: SpendMeta): Promise<Settle>;
}

/** In-memory ledger. Check-and-hold is synchronous inside reserve, so concurrency cannot overshoot. */
export class SpendMeter implements SpendLedger {
  private committed = 0;
  private pending = 0;
  readonly ceilingMicros: Micros;

  constructor(readonly ceilingUsd: number) {
    this.ceilingMicros = usdToMicros(ceilingUsd);
  }

  get spentUsd(): number {
    return microsToUsd(this.committed);
  }
  get spentMicros(): Micros {
    return this.committed;
  }
  get pendingMicros(): Micros {
    return this.pending;
  }

  async reserve(estimateMicros: Micros, _meta?: SpendMeta): Promise<Settle> {
    if (this.committed + this.pending + estimateMicros > this.ceilingMicros) {
      throw new SpendCeilingError(
        `spend ceiling $${this.ceilingUsd.toFixed(2)} reached ` +
          `(spent $${microsToUsd(this.committed).toFixed(2)}, ` +
          `in flight $${microsToUsd(this.pending).toFixed(2)})`,
      );
    }
    this.pending += estimateMicros;
    let settled = false;
    return async (actualMicros) => {
      if (settled) return;
      settled = true;
      this.pending -= estimateMicros;
      this.committed += actualMicros;
    };
  }
}
