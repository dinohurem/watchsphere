/**
 * HTTP client for the WatchSphere bridge endpoints.
 *
 * Retries are bounded and only cover transport failures and 5xx: a 4xx means
 * the payload or the token is wrong, and repeating it would not help.
 */

import type { CapturedMessage } from './format.js';

export type BridgeState =
  | 'starting'
  | 'qr_required'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'logged_out';

export interface IngestResult {
  received: number;
  inserted: number;
  duplicates: number;
}

export interface HeartbeatPayload {
  state: BridgeState;
  phoneNumber?: string | null;
  groups?: string[];
  error?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  token: string;
  bridgeId: string;
  maxRetries?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly bridgeId: string;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.bridgeId = options.bridgeId;
    this.maxRetries = options.maxRetries ?? 4;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0) {
        await this.sleepImpl(Math.min(2 ** attempt * 1000, 30_000));
      }

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': this.token,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        // 5xx and 429 are worth another attempt; other 4xx are not.
        const retryable = response.status >= 500 || response.status === 429;
        const detail = await response.text().catch(() => '');
        const error = new ApiError(
          `POST ${path} failed: ${response.status} ${detail.slice(0, 200)}`,
          response.status,
          retryable
        );
        if (!retryable) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof ApiError && !error.retryable) throw error;
        lastError = error as Error;
      }
    }

    throw lastError ?? new Error(`POST ${path} failed`);
  }

  async sendMessages(messages: CapturedMessage[]): Promise<IngestResult> {
    return this.post<IngestResult>('/whatsapp-bridge/messages', {
      bridge_id: this.bridgeId,
      messages,
    });
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
    await this.post('/whatsapp-bridge/heartbeat', {
      bridge_id: this.bridgeId,
      state: payload.state,
      phone_number: payload.phoneNumber ?? null,
      groups: payload.groups ?? [],
      error: payload.error ?? null,
    });
  }
}
