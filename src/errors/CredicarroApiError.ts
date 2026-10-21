import { inspect } from 'node:util';
import { CredicarroError } from './CredicarroError';
import type { ProblemDetails, ProblemError } from './problemDetails';

/**
 * Erro devolvido pela API. A mensagem traz só o status, o `tipo` e o `titulo`: `detail`, `errors` e `rawBody`
 * ficam em propriedades porque podem conter dados pessoais.
 */
export class CredicarroApiError extends CredicarroError {
  readonly statusCode: number;
  /** Não enumerável: pode conter dados pessoais e não aparece em `JSON.stringify`, `console.log` nem logs estruturados. */
  declare readonly problemDetails: ProblemDetails;
  /** Corpo bruto da resposta (pode conter dados pessoais). Não enumerável, como `problemDetails`. */
  declare readonly rawBody?: string;

  constructor(message: string, statusCode: number, problemDetails: ProblemDetails, rawBody?: string) {
    super(message);
    this.statusCode = statusCode;
    Object.defineProperty(this, 'problemDetails', { value: problemDetails, enumerable: false });
    Object.defineProperty(this, 'rawBody', { value: rawBody, enumerable: false });
  }

  /** Só campos sem dados pessoais: status, código estável, título e campo. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      title: this.title,
      field: this.field,
    };
  }

  [inspect.custom](): string {
    return `${this.name}: ${this.message} ${inspect(this.toJSON(), { depth: 1 })}`;
  }

  /** Código estável do erro (`tipo`). */
  get errorCode(): string | undefined {
    return this.problemDetails.type;
  }

  get title(): string | undefined {
    return this.problemDetails.title;
  }

  get detail(): string | undefined {
    return this.problemDetails.detail;
  }

  get field(): string | undefined {
    return this.problemDetails.field;
  }

  get errors(): ProblemError[] | undefined {
    return this.problemDetails.errors;
  }
}
