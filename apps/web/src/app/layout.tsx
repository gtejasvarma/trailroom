import type { Metadata, Viewport } from "next";
// Self-hosted Inter (Design.md §4): no font request to any other origin, at build or run time.
import "@fontsource-variable/inter";
import { copy } from "../lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.brand,
  description: copy.tagline,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
