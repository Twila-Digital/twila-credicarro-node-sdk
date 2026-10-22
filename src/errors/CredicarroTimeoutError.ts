import { CredicarroError } from './CredicarroError';

/** Timeout de tentativa ou total, falha de rede, ou circuit breaker aberto. */
export class CredicarroTimeoutError extends CredicarroError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}
