import { CredicarroApiError } from './CredicarroApiError';
import type { ProblemDetails } from './problemDetails';

export class CredicarroRateLimitError extends CredicarroApiError {
  /** Espera sugerida pelo header `Retry-After`, em milissegundos. */
  readonly retryAfterMs?: number;

  constructor(message: string, problemDetails: ProblemDetails, retryAfterMs?: number, rawBody?: string) {
    super(message, 429, problemDetails, rawBody);
    this.retryAfterMs = retryAfterMs;
  }
}
