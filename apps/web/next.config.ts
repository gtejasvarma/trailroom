import type { NextConfig } from "next";

const config: NextConfig = {
  // A second dev server (the e2e run with the buffer switched on) needs its own build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
  // The public vote page is never indexed, cached or sent as a referrer (its URL is the secret).
  // Its API sets the same headers itself.
  async headers() {
    return [
      // Every path: no framing (clickjacking) and no content sniffing. The Google sign-in popup
      // is a separate window, not a frame, so it is unaffected.
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/unsubscribe/:token",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/ask/:token",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
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
