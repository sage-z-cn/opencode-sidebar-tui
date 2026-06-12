
export interface DataThrottleBatchItem {
  data: string;
}

export class DataThrottleService {
  private buffer: string[] = [];

  private timerId: ReturnType<typeof setTimeout> | null = null;

  private disposed = false;

  constructor(
    private readonly onBatch: (batch: Array<DataThrottleBatchItem>) => void,
  ) {}

  push(data: string): void {
    if (this.disposed) {
      return;
    }

    // Single-terminal model: the only terminal is always "focused",
    // so deliver data immediately rather than buffering for 16ms.
    // This eliminates input echo latency from the host.
    this.buffer.push(data);
    this.flush();
  }

  flush(): void {
    if (this.disposed) {
      return;
    }

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    const combined = this.buffer.join("");
    this.buffer = [];

    if (combined.length === 0) {
      return;
    }

    this.deliver([{ data: combined }]);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.buffer = [];

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleFlush(): void {
    if (this.timerId !== null) {
      return;
    }

    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.flush();
    }, 16);
  }

  private deliver(batch: DataThrottleBatchItem[]): void {
    if (this.disposed || batch.length === 0) {
      return;
    }

    this.onBatch(batch);
  }
}
