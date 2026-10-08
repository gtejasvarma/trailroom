import type { NextConfig } from "next";

const config: NextConfig = {
  // No image optimizer: it would be a gate-exempt-by-default path to fetch images, and every
  // image here is already sized for the screen.
  images: { unoptimized: true },
  // Workspace packages ship TypeScript source (exports point at src/index.ts).
  transpilePackages: [
    "@trailroom/render",
    "@trailroom/render-eval",
    "@trailroom/db",
    "@trailroom/catalog",
    "@trailroom/pipeline",
  ],
  experimental: {
    // With middleware present, Next buffers request bodies up to this limit and silently
    // truncates beyond it (default 10 MB). Our upload limit is 10 MiB plus multipart framing, so
    // a near-limit photo would arrive cut short. 11 MB covers the limit and the framing; the
    // route's own byte counter still enforces 10 MiB. (Docs: proxyClientMaxBodySize.)
    proxyClientMaxBodySize: "11mb",
  },
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/storage",
    "@google-cloud/firestore",
    "@google-cloud/workflows",
    "google-auth-library",
    "sharp",
  ],
};

export default config;
