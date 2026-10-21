import { CredicarroApiError } from './CredicarroApiError';
import type { ProblemDetails } from './problemDetails';

/** `400` — dados inválidos (use `field`/`errors` para localizar o problema). */
export class CredicarroValidationError extends CredicarroApiError {
  constructor(message: string, problemDetails: ProblemDetails, rawBody?: string) {
    super(message, 400, problemDetails, rawBody);
  }
}
