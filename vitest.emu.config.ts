import { defineConfig } from "vitest/config";

// Emulator-backed tests: run via `npm run test:emu` (starts Auth/Firestore/Storage emulators).
export default defineConfig({
  test: {
    include: ["{apps,packages}/**/*.emu.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      GOOGLE_CLOUD_PROJECT: "demo-trailroom",
      GCLOUD_PROJECT: "demo-trailroom",
    },
  },
});
