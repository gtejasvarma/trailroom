import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUY_ENABLED } from "./flags";

// Every component that renders a Buy control must sit behind BUY_ENABLED, so one switch hides
// them all and turning it back on restores them.
const SRC = join(fileURLToPath(import.meta.url), "../..");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
};

describe("the Buy switch", () => {
  it("is off, per Tejas, 2026-10-17", () => {
    expect(BUY_ENABLED).toBe(false);
  });
  it("guards every place that calls a buy action or draws a Buy button", () => {
    const BUY_CALL =
      /\bbuy\((item\.id|ids|winner\.id)\)|copy\.card\.buy|copy\.outfit\.buy\b|copy\.sent\.buy|copy\.result\.buy/;
    const offenders: string[] = [];
    let seen = 0;
    for (const f of walk(SRC)) {
      if (f.endsWith("buy-provider.tsx")) continue;
      const text = readFileSync(f, "utf8");
      if (!BUY_CALL.test(text)) continue;
      seen++;
      if (!text.includes("BUY_ENABLED")) offenders.push(f);
    }
    expect(seen).toBeGreaterThanOrEqual(6);
    expect(offenders).toEqual([]);
  });
});
