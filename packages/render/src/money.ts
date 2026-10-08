// The ledger speaks integer micro-USD (1e-6 USD). Summing float dollars across thousands of calls
// drifts; integers do not. Prices in the table have at most 4 decimals and tokens x ($/MTok) is
// already micro-USD, so one rounding per call is the only approximation. `costUsd` on results
// stays a plain number, derived from the same integer so the two never disagree.
export type Micros = number;

export function usdToMicros(usd: number): Micros {
  return Math.round(usd * 1e6);
}

/** Rounds up: a reservation must never under-count the worst case. */
export function usdToMicrosCeil(usd: number): Micros {
  // Guard against 0.1 * 1e6 = 100000.00000000001 style noise before ceiling.
  return Math.ceil(Math.round(usd * 1e9) / 1e3);
}

export function microsToUsd(micros: Micros): number {
  return micros / 1e6;
}
