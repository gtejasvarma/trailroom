// Runs the follow loop's scheduled step once, by hand, against the EMULATORS only: the buffer
// fan-out (if ARRIVALS_BUFFER=on) and the email step (if EMAIL_TRANSPORT is not none). It is the
// local stand-in for the Cloud Scheduler call to /api/internal/purge, used by the e2e specs.
// Refuses to run against anything but the emulators.
import { resolveTarget } from "@trailroom/pipeline";

try {
  const t = resolveTarget(process.env);
  if (t.kind !== "emulator") throw new Error("emulators only");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
const { runArrivals } = await import("../apps/web/src/server/arrivals");
const { runEmail } = await import("../apps/web/src/server/email/run");
const { awaitInlineRuns } = await import("../apps/web/src/server/orchestrator");
const now = new Date();
const arrivals = await runArrivals(now);
await awaitInlineRuns();
const email = await runEmail(now, process.env.INTERNAL_AUDIENCE ?? "http://localhost:3101");
console.log(JSON.stringify({ arrivals, email }));
process.exit(0);
