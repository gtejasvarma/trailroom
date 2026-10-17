// An action that waits out an undo window. "Not for me" removes a try-on for real, but only when
// the window has passed; Undo cancels it, and leaving the screen sends it at once (so a removal
// is never lost and never takes longer than the window). Plain code with injected timers, so it
// can be tested without a browser.

export interface Deferred {
  /** True from `start` until it has run or been cancelled. */
  readonly pending: boolean;
  /** Runs `run` after `ms`, unless cancelled. Starting again flushes the earlier one first. */
  start: (ms: number, run: () => void | Promise<void>) => void;
  /** Cancels it: `run` never happens. Returns whether anything was pending. */
  cancel: () => boolean;
  /** Runs it now, if it is pending. Returns whether it did. */
  flush: () => boolean;
}

export function createDeferred(
  timers: {
    set: (f: () => void, ms: number) => unknown;
    clear: (t: unknown) => void;
  } = {
    set: (f, ms) => setTimeout(f, ms),
    clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  },
): Deferred {
  let timer: unknown = null;
  let task: (() => void | Promise<void>) | null = null;
  const fire = () => {
    const t = task;
    task = null;
    timer = null;
    if (t) void t();
  };
  const self: Deferred = {
    get pending() {
      return task !== null;
    },
    start(ms, run) {
      self.flush();
      task = run;
      timer = timers.set(fire, ms);
    },
    cancel() {
      if (!task) return false;
      timers.clear(timer);
      task = null;
      timer = null;
      return true;
    },
    flush() {
      if (!task) return false;
      timers.clear(timer);
      fire();
      return true;
    },
  };
  return self;
}
