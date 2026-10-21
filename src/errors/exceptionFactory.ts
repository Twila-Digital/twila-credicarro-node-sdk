import type { ApiResponse } from '../internal/http/apiResponse';
import { CredicarroApiError } from './CredicarroApiError';
import { CredicarroAuthenticationError } from './CredicarroAuthenticationError';
import { CredicarroBusinessRuleError } from './CredicarroBusinessRuleError';
import { CredicarroRateLimitError } from './CredicarroRateLimitError';
import { CredicarroValidationError } from './CredicarroValidationError';
import type { CredicarroError } from './CredicarroError';
import { parseProblemDetails, type ProblemDetails } from './problemDetails';

export function exceptionFromResponse(response: ApiResponse): CredicarroError {
  const problemDetails = parseProblemDetails(response.body);
  const message = buildErrorMessage(response.statusCode, problemDetails);
  const rawBody = response.rawBody && response.rawBody.length > 0 ? response.rawBody : undefined;

  switch (response.statusCode) {
    case 401:
      return new CredicarroAuthenticationError(message, undefined, problemDetails.type);
    case 400:
      return new CredicarroValidationError(message, problemDetails, rawBody);
    case 422:
      return new CredicarroBusinessRuleError(message, problemDetails, rawBody);
    case 429:
      return new CredicarroRateLimitError(message, problemDetails, retryAfterMs(response), rawBody);
    default:
      return new CredicarroApiError(message, response.statusCode, problemDetails, rawBody);
  }
}

/** Só status, `tipo` e `titulo`: o `detalhe` pode conter dados pessoais. */
export function buildErrorMessage(statusCode: number, problemDetails: ProblemDetails): string {
  if (statusCode === 401 && !problemDetails.type)
    return 'A API do Credicarro recusou o token de acesso (401). Verifique as credenciais.';

  const parts = [`A API do Credicarro respondeu ${statusCode}`];
  if (problemDetails.type) parts.push(` (${problemDetails.type})`);
  if (problemDetails.title) parts.push(`: ${problemDetails.title}`);

  return `${parts.join('')}.`;
}

/** Limite do `Retry-After` aceito: 24 h. Valores maiores são limitados antes de virar milissegundos. */
const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Interpreta `Retry-After` (segundos ou data HTTP). Valor inválido, zero, negativo ou no passado é ignorado
 * (`undefined`); valor absurdo é limitado a 24 h.
 */
export function retryAfterMs(response: Pick<ApiResponse, 'headers'>): number | undefined {
  const retryAfter = response.headers['retry-after']?.trim();
  if (!retryAfter) return undefined;

  let seconds: number;
  if (/^\d+(\.\d+)?$/.test(retryAfter)) {
    seconds = Number(retryAfter);
  } else {
    const date = Date.parse(retryAfter);
    if (Number.isNaN(date)) return undefined;
    seconds = (date - Date.now()) / 1000;
  }

  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;

  return Math.ceil(Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * 1000);
}
