// Phase G helpers: publish a piece the way the owner will (the script), and run the scheduled
// follow-loop step once. Both only ever touch the emulators.
import { execFileSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_TMP, FAKE_SCRIPT_FILE } from "../playwright.config";
import { PHOTO } from "./helpers";

const ROOT = join(fileURLToPath(import.meta.url), "../../../..");

let n = 0;
/** Publishes a ready top to a label through scripts/publish-piece.ts. Returns its id. */
export function publishViaScript(
  label: { slug: string; name: string } = {
    slug: "marchand",
    name: "MARCHAND",
  },
): { id: string; name: string } {
  const id = `e2e-shirt-${Date.now()}-${n++}`;
  const name = "Washed linen shirt";
  copyFileSync(PHOTO, join(E2E_TMP, `${id}.jpg`));
  const spec = join(E2E_TMP, `${id}.json`);
  writeFileSync(
    spec,
    JSON.stringify({
      id,
      name,
      label: label.name,
      labelSlug: label.slug,
      priceUsd: 140,
      shopCategory: "apparel",
      shelf: "New in",
      stock: { line: "In stock", low: false },
      pairsWith: [],
      photos: [{ path: `${id}.jpg`, label: "Front", focus: "50% 30%" }],
      description: "Washed linen with a camp collar and a straight cut.",
      category: "top",
      promptDescription: "washed linen camp-collar shirt",
      readiness: 88,
      readinessReasons: [
        "Clear label photographs with the whole garment visible.",
      ],
      tryOn: "ready",
    }),
  );
  execFileSync("npx", ["tsx", "scripts/publish-piece.ts", "--spec", spec], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: "pipe",
  });
  return { id, name };
}

/** One scheduled call's worth of the follow loop, with the buffer on and the fake model. */
export function runFollowLoopOnce(extra: Record<string, string> = {}): string {
  return execFileSync("npx", ["tsx", "scripts/follow-loop-once.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      GOOGLE_CLOUD_PROJECT: "demo-trailroom",
      RENDER_PROVIDER: "fake",
      ORCHESTRATOR: "inline",
      RENDER_FAKE_SCRIPT_FILE: FAKE_SCRIPT_FILE,
      ARRIVALS_BUFFER: "on",
      ...extra,
    },
    encoding: "utf8",
  });
}
