import { CredicarroApiError } from './CredicarroApiError';
import type { ProblemDetails } from './problemDetails';

/** `422` — regra de negócio não atendida (trate pelo `errorCode`). */
export class CredicarroBusinessRuleError extends CredicarroApiError {
  constructor(message: string, problemDetails: ProblemDetails, rawBody?: string) {
    super(message, 422, problemDetails, rawBody);
  }
}
