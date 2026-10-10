import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// A fixed non-default port keeps this from colliding with a developer's `next dev` on 3000.
export const E2E_PORT = 3101;
// A second server, with the "arrives on you" buffer and the log email transport switched on.
export const E2E_BUFFER_PORT = 3102;
export const E2E_PASSWORD = "e2e-password";

// Shared with the specs. The fake render provider re-reads the script file on every call, so a
// test rewrites it per scenario without restarting the server.
export const E2E_TMP = join(tmpdir(), "trailroom-e2e");
export const FAKE_SCRIPT_FILE = join(E2E_TMP, "fake-script.json");

const emulatorHost = (name: string, fallback: string) =>
  process.env[name] ?? fallback;

const serverEnv = {
  GATE_PASSWORD: E2E_PASSWORD,
  GATE_COOKIE_SECRET: "e2e-cookie-secret-not-for-production",
  // Never a real model call; the job runs in-process.
  RENDER_PROVIDER: "fake",
  ORCHESTRATOR: "inline",
  RENDER_FAKE_SCRIPT_FILE: FAKE_SCRIPT_FILE,
  NEXT_PUBLIC_USE_EMULATORS: "1",
  GOOGLE_CLOUD_PROJECT: "demo-trailroom",
  FIREBASE_AUTH_EMULATOR_HOST: emulatorHost(
    "FIREBASE_AUTH_EMULATOR_HOST",
    "127.0.0.1:9099",
  ),
  FIRESTORE_EMULATOR_HOST: emulatorHost(
    "FIRESTORE_EMULATOR_HOST",
    "127.0.0.1:8080",
  ),
  FIREBASE_STORAGE_EMULATOR_HOST: emulatorHost(
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "127.0.0.1:9199",
  ),
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The specs share one set of emulators and one fake-script file: strictly serial.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    // Baselines for the first screens (Phase A on): animations off, a small pixel tolerance for
    // anti-aliasing. Baselines are per platform, so regenerate them with --update-snapshots.
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFileName}/{arg}-{projectName}-{platform}{ext}",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    // A synthetic camera, granted without a prompt, so the in-page camera can be tested.
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /g-buffer\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "buffer",
      testMatch: /g-buffer\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${E2E_BUFFER_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npx next dev --port ${E2E_PORT}`,
      url: `http://localhost:${E2E_PORT}/gate`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      command: `npx next dev --port ${E2E_BUFFER_PORT}`,
      url: `http://localhost:${E2E_BUFFER_PORT}/gate`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...serverEnv,
        NEXT_DIST_DIR: ".next-buffer",
        ARRIVALS_BUFFER: "on",
        EMAIL_TRANSPORT: "log",
      },
    },
  ],
});
