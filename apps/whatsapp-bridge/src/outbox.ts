/**
 * Disk-backed outbox.
 *
 * A live capture is the only copy of a message that exists on our side — the
 * group it came from cannot be exported, so anything lost here is lost for
 * good. Captures are therefore written to disk before the network is involved,
 * and only dropped once the backend has accepted them.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { CapturedMessage } from './format.js';

export interface OutboxOptions {
  /** Hard cap on buffered messages, so a long backend outage cannot fill the disk. */
  maxSize?: number;
  onWarn?: (message: string) => void;
}

const DEFAULT_MAX_SIZE = 100_000;

export class Outbox {
  private readonly path: string;
  private readonly maxSize: number;
  private readonly onWarn: (message: string) => void;
  private pending: CapturedMessage[] = [];
  private knownIds = new Set<string>();

  constructor(path: string, options: OutboxOptions = {}) {
    this.path = path;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.onWarn = options.onWarn ?? (() => {});
  }

  /** Restore anything that outlived the last process. */
  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.pending = [];
        this.knownIds = new Set();
        return;
      }
      throw error;
    }

    this.pending = [];
    this.knownIds = new Set();
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed) as CapturedMessage;
        const dedupKey = this.dedupKey(message);
        if (this.knownIds.has(dedupKey)) continue;
        this.knownIds.add(dedupKey);
        this.pending.push(message);
      } catch {
        // A torn final line from an interrupted append. Skipping it loses at
        // most one capture; refusing to start would lose all of them.
        this.onWarn(`Skipping unparseable outbox line: ${trimmed.slice(0, 120)}`);
      }
    }
  }

  private dedupKey(message: CapturedMessage): string {
    return `${message.group_jid}:${message.message_id}`;
  }

  /** Buffer new captures, ignoring ones already queued. Returns the count added. */
  async add(messages: CapturedMessage[]): Promise<number> {
    const fresh = messages.filter((message) => !this.knownIds.has(this.dedupKey(message)));
    if (fresh.length === 0) return 0;

    for (const message of fresh) {
      this.knownIds.add(this.dedupKey(message));
      this.pending.push(message);
    }

    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, fresh.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8');

    if (this.pending.length > this.maxSize) {
      const overflow = this.pending.length - this.maxSize;
      const dropped = this.pending.splice(0, overflow);
      for (const message of dropped) {
        this.knownIds.delete(this.dedupKey(message));
      }
      this.onWarn(
        `Outbox exceeded ${this.maxSize} messages — dropped ${overflow} oldest capture(s). ` +
          'The backend has been unreachable for a long time.'
      );
      await this.rewrite();
    }

    return fresh.length;
  }

  /** Next batch to send, without removing it. */
  peek(limit: number): CapturedMessage[] {
    return this.pending.slice(0, limit);
  }

  /** Drop the first `count` messages once the backend has taken them. */
  async ack(count: number): Promise<void> {
    if (count <= 0) return;
    const acked = this.pending.splice(0, count);
    for (const message of acked) {
      this.knownIds.delete(this.dedupKey(message));
    }
    await this.rewrite();
  }

  size(): number {
    return this.pending.length;
  }

  /** Atomic rewrite: a crash mid-write must not truncate the queue. */
  private async rewrite(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    const body = this.pending.length > 0
      ? this.pending.map((m) => JSON.stringify(m)).join('\n') + '\n'
      : '';
    await writeFile(temporary, body, 'utf8');
    await rename(temporary, this.path);
  }
}
