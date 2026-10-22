import { CredicarroError } from './CredicarroError';

export class CredicarroConfigurationError extends CredicarroError {
  constructor(message: string) {
    super(message);
  }
}
