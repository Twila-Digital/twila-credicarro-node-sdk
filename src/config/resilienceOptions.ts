export interface CredicarroResilienceOptions {
  totalTimeoutMs: number;
  attemptTimeoutMs: number;
  documentUploadAttemptTimeoutMs: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  circuitBreakerFailureRatio: number;
  circuitBreakerSamplingDurationMs: number;
  circuitBreakerMinimumThroughput: number;
  circuitBreakerBreakDurationMs: number;
  /** A documentação manda repetir `500` com a mesma `Idempotency-Key`; por isso o padrão é `true`. */
  retryOn500: boolean;
  disableAutomaticIdempotencyKey: boolean;
}

export const DEFAULT_RESILIENCE_OPTIONS: CredicarroResilienceOptions = {
  totalTimeoutMs: 30_000,
  attemptTimeoutMs: 10_000,
  documentUploadAttemptTimeoutMs: 60_000,
  maxRetryAttempts: 3,
  retryBaseDelayMs: 500,
  circuitBreakerFailureRatio: 0.5,
  circuitBreakerSamplingDurationMs: 30_000,
  circuitBreakerMinimumThroughput: 10,
  circuitBreakerBreakDurationMs: 15_000,
  retryOn500: true,
  disableAutomaticIdempotencyKey: false,
};

export function resolveResilienceOptions(overrides?: Partial<CredicarroResilienceOptions>): CredicarroResilienceOptions {
  return { ...DEFAULT_RESILIENCE_OPTIONS, ...overrides };
}
