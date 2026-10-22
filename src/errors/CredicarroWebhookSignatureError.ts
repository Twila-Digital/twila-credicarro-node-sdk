import { CredicarroError } from './CredicarroError';

export class CredicarroWebhookSignatureError extends CredicarroError {
  constructor(message: string) {
    super(message);
  }
}
