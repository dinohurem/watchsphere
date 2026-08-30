/**
 * Drains the outbox into the backend on a timer.
 *
 * Only acks what the backend confirmed, so a failure mid-drain leaves the
 * remaining captures on disk for the next tick.
 */

import type { ApiClient } from './api.js';
import type { Outbox } from './outbox.js';

export interface FlusherOptions {
  batchSize: number;
  intervalMs: number;
  onFlush?: (sent: number, inserted: number, remaining: number) => void;
  onError?: (error: Error) => void;
}

export class Flusher {
  private readonly outbox: Outbox;
  private readonly api: ApiClient;
  private readonly options: FlusherOptions;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  /** The flush currently in flight, so a caller can await it instead of racing it. */
  private inFlight: Promise<{ sent: number; inserted: number }> | null = null;

  constructor(outbox: Outbox, api: ApiClient, options: FlusherOptions) {
    this.outbox = outbox;
    this.api = api;
    this.options = options;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.options.intervalMs);
    // Never hold the process open just to run the next flush.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Send buffered captures until the outbox is empty.
   *
   * Guarded against overlap: a slow batch must not be joined by the next tick,
   * or the same messages would be in flight twice.
   */
  async flush(): Promise<{ sent: number; inserted: number }> {
    // Joining an in-flight flush rather than returning a no-op: a shutdown
    // flush that reports {0,0} while a batch is still in the air looks like a
    // failed delivery, and exiting on it would kill that request.
    if (this.inFlight) return this.inFlight;

    const run = this.runFlush();
    this.inFlight = run;
    try {
      return await run;
    } finally {
      this.inFlight = null;
    }
  }

  private async runFlush(): Promise<{ sent: number; inserted: number }> {
    if (this.running) return { sent: 0, inserted: 0 };
    this.running = true;

    let sent = 0;
    let inserted = 0;
    try {
      while (this.outbox.size() > 0) {
        const batch = this.outbox.peek(this.options.batchSize);
        if (batch.length === 0) break;

        const result = await this.api.sendMessages(batch);
        await this.outbox.ack(batch.length);

        sent += batch.length;
        inserted += result.inserted;
        this.options.onFlush?.(batch.length, result.inserted, this.outbox.size());
      }
    } catch (error) {
      // Nothing is acked on failure — the batch stays on disk and is retried.
      this.options.onError?.(error as Error);
    } finally {
      this.running = false;
    }

    return { sent, inserted };
  }
}
