// Test helper: the largest mean absolute difference over any block of two same-size raw images.
// A whole-image mean hides a small overlay (a caption strip barely moves it); a per-block max does
// not, because the blocks under the overlay change a lot.
export function maxBlockMeanDiff(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  channels: number,
  block = 16,
): number {
  if (a.length !== b.length || a.length !== width * height * channels) {
    throw new Error("images must be the same size");
  }
  let worst = 0;
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      let sum = 0;
      let n = 0;
      for (let y = by; y < Math.min(by + block, height); y++) {
        for (let x = bx; x < Math.min(bx + block, width); x++) {
          const o = (y * width + x) * channels;
          for (let c = 0; c < channels; c++) {
            sum += Math.abs(a[o + c]! - b[o + c]!);
            n++;
          }
        }
      }
      worst = Math.max(worst, sum / n);
    }
  }
  return worst;
}
