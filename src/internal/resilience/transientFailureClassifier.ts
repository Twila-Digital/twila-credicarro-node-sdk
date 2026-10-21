import type { ApiResponse } from '../http/apiResponse';
import type { CredicarroResilienceOptions } from '../../config/resilienceOptions';

const TRANSIENT_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

export function isTransientResponse(response: ApiResponse, options: CredicarroResilienceOptions): boolean {
  if (TRANSIENT_STATUS_CODES.has(response.statusCode)) return true;

  return response.statusCode === 500 && options.retryOn500;
}
