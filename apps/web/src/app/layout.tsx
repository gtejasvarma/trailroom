import type { Metadata, Viewport } from "next";
import { copy } from "../lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.brand,
  description: copy.catalogue.intro,
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
