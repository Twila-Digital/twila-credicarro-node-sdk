import axios from 'axios';

/**
 * Falha de rede ou timeout de tentativa, já sem os dados da requisição.
 * O erro original do axios carrega `config` (corpo e headers, incluindo `clientSecret` e token), por isso nunca
 * é propagado: só o código da falha sobrevive.
 */
// Códigos que não indicam instabilidade de rede (resposta grande demais, cancelamento, URL inválida): não são repetidos
// e não contam para o circuit breaker.
const NON_TRANSIENT_CODES = new Set([
  'ERR_BAD_RESPONSE',
  'ERR_BAD_REQUEST',
  'ERR_CANCELED',
  'ERR_INVALID_URL',
  'ERR_FR_MAX_BODY_LENGTH_EXCEEDED',
  'ERR_FR_TOO_MANY_REDIRECTS',
]);

export class NetworkFailure extends Error {
  readonly code: string | undefined;
  readonly isTimeout: boolean;
  /** `false` para falhas que repetir não resolve (ex.: resposta acima do limite). */
  readonly isTransient: boolean;

  constructor(code: string | undefined, isTimeout: boolean) {
    super(code ? `Falha de rede (${code}).` : 'Falha de rede.');
    this.name = 'NetworkFailure';
    this.code = code;
    this.isTimeout = isTimeout;
    this.isTransient = code === undefined || !NON_TRANSIENT_CODES.has(code);
    Object.setPrototypeOf(this, NetworkFailure.prototype);
  }
}

export function toNetworkFailure(error: unknown): NetworkFailure | undefined {
  if (error instanceof NetworkFailure) return error;
  if (!axios.isAxiosError(error)) return undefined;

  const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  return new NetworkFailure(error.code, isTimeout);
}

export function isNetworkFailure(error: unknown): error is NetworkFailure {
  return error instanceof NetworkFailure;
}

/** Falha de rede que justifica nova tentativa e conta para o circuit breaker. */
export function isTransientNetworkFailure(error: unknown): error is NetworkFailure {
  return error instanceof NetworkFailure && error.isTransient;
}
