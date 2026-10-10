"use client";
// Whether the viewport is at least 768px wide (the wide layout). null until the browser has
// answered, so nothing flashes the wrong layout and server markup never disagrees.
import { useEffect, useState } from "react";
import { COMPARE_MIN_WIDTH } from "./compare-ids";

export function useWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia(`(min-width: ${COMPARE_MIN_WIDTH}px)`);
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}
