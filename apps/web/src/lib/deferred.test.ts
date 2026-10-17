import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "./deferred";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the undo window", () => {
  it("runs the action when the window ends, and not before", () => {
    const run = vi.fn();
    const d = createDeferred();
    d.start(5000, run);
    expect(d.pending).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(d.pending).toBe(false);
  });
  it("Undo cancels it: it never runs", () => {
    const run = vi.fn();
    const d = createDeferred();
    d.start(5000, run);
    vi.advanceTimersByTime(3000);
    expect(d.cancel()).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(run).not.toHaveBeenCalled();
    expect(d.pending).toBe(false);
    expect(d.cancel()).toBe(false);
  });
  it("leaving the screen runs it at once, once", () => {
    const run = vi.fn();
    const d = createDeferred();
    d.start(5000, run);
    vi.advanceTimersByTime(100);
    expect(d.flush()).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(d.flush()).toBe(false);
  });
  it("flushing with nothing pending does nothing", () => {
    expect(createDeferred().flush()).toBe(false);
  });
  it("cannot be undone after it has been sent", () => {
    const run = vi.fn();
    const d = createDeferred();
    d.start(1000, run);
    vi.advanceTimersByTime(1000);
    expect(d.cancel()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("starting a second one sends the first rather than dropping it", () => {
    const a = vi.fn();
    const b = vi.fn();
    const d = createDeferred();
    d.start(5000, a);
    d.start(5000, b);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
