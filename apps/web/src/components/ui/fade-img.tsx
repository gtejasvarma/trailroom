"use client";
// An image that fades in once it has loaded, over whatever placeholder sits behind it. The
// placeholder has the right aspect already, so nothing shifts. An image that finished loading
// before React hydrated is caught by the ref check.
import { useCallback, useState } from "react";

export function FadeImg({
  className = "",
  onLoad,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={() => setLoaded(true)}
      className={`transition-opacity duration-200 ease-[var(--ease-out)] motion-reduce:transition-none ${
        loaded ? "opacity-100" : "opacity-0"
      } ${className}`}
      {...rest}
    />
  );
}
