"use client";
// The person's own photo, fetched with the ID token (like the renders) and shown back to them.
import { useEffect, useState } from "react";
import { apiRaw } from "../lib/api";

export function PhotoThumb({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    apiRaw(src)
      .then(async (r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        made = URL.createObjectURL(blob);
        setUrl({ src, url: made });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [src]);
  const ready = url?.src === src ? url.url : null;
  return ready ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ready} alt={alt} className={`object-cover ${className}`} />
  ) : (
    // While the bytes load: named like the image it stands in for, or hidden from assistive
    // tech when the image is decorative (empty alt). role="img" with no name is an error.
    <span
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      className={`block bg-surface ${className}`}
    />
  );
}
