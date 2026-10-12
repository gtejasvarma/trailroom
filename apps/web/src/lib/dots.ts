/** The indices of the dots to draw: all of them up to five, else a window of five around `index`. */
export function dotWindow(index: number, n: number, size = 5): number[] {
  const start = n > size ? Math.max(0, Math.min(n - size, index - 2)) : 0;
  return Array.from({ length: Math.min(n, size) }, (_, i) => start + i);
}
