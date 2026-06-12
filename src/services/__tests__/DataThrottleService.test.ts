import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataThrottleService } from "../DataThrottleService";

describe("DataThrottleService", () => {
  let onBatch: ReturnType<typeof vi.fn<(batch: Array<{ data: string }>) => void>>;
  let service: DataThrottleService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    onBatch = vi.fn();
    service = new DataThrottleService(onBatch);
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("delivers data immediately on push", () => {
    service.push("hello");

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch).toHaveBeenCalledWith([
      { data: "hello" },
    ]);
  });

  it("combines consecutive pushes into a single batch per push", () => {
    service.push("hello");
    service.push("world");

    // Each push triggers an immediate flush, so onBatch is called twice
    expect(onBatch).toHaveBeenCalledTimes(2);
    expect(onBatch).toHaveBeenNthCalledWith(1, [
      { data: "hello" },
    ]);
    expect(onBatch).toHaveBeenNthCalledWith(2, [
      { data: "world" },
    ]);
  });

  it("flush delivers buffered data immediately", () => {
    service.push("a");
    service.push("b");

    // Both pushes already flushed immediately; explicit flush finds empty buffer
    service.flush();

    expect(onBatch).toHaveBeenCalledTimes(2);
  });

  it("prevents further callbacks after dispose", () => {
    service.push("a");
    onBatch.mockClear();

    service.dispose();

    service.push("b");
    service.flush();

    expect(onBatch).not.toHaveBeenCalled();
  });

  it("does nothing when flushing empty buffers", () => {
    service.flush();

    expect(onBatch).not.toHaveBeenCalled();
  });
});
