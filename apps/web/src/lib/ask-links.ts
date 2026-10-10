"use client";
// The raw link is shown to the asker once, when the ask is created, and the server keeps only its
// hash. So that "Copy link" keeps working on the device that made it, the link is remembered in
// this browser only (localStorage). It never reaches the server again, and another device sees
// "make a new link" instead. Every access is guarded: storage can be blocked or full.

const KEY = "trailroom_ask_links";

function read(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(KEY) ?? "{}",
    );
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function rememberAskLink(askId: string, url: string): void {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...read(), [askId]: url }),
    );
  } catch {
    // Not remembered: the Sent screen then offers a new link.
  }
}

export function recallAskLink(askId: string): string | null {
  return read()[askId] ?? null;
}

export function forgetAskLink(askId: string): void {
  try {
    const all = read();
    delete all[askId];
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Nothing to forget.
  }
}

export function clearAskLinks(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
