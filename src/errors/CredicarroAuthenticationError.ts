import { CredicarroError } from './CredicarroError';

export class CredicarroAuthenticationError extends CredicarroError {
  /** Código estável (`tipo`) devolvido pela API, quando houver — ex.: `Integration.Authentication.InvalidCredentials`. */
  readonly errorCode?: string;

  constructor(message: string, cause?: unknown, errorCode?: string) {
    super(message, cause);
    this.errorCode = errorCode;
  }
}
