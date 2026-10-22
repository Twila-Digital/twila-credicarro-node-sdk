export interface ProblemError {
  code?: string;
  message?: string;
  field?: string;
}

/** `ProblemDetails` da API (campos em português), com fallback para `type`/`title`/`detail`. */
export interface ProblemDetails {
  /** Código estável do erro (`tipo`) — use-o no tratamento. */
  type?: string;
  title?: string;
  status?: number;
  /** Pode conter dados pessoais; não é incluído na mensagem da exceção. */
  detail?: string;
  field?: string;
  errors?: ProblemError[];
}

export function parseProblemDetails(body: unknown): ProblemDetails {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return {};

  const raw = body as Record<string, unknown>;

  return {
    type: firstString(raw.tipo, raw.type),
    title: firstString(raw.titulo, raw.title),
    status: typeof raw.status === 'number' ? raw.status : undefined,
    detail: firstString(raw.detalhe, raw.detail),
    field: typeof raw.campo === 'string' ? raw.campo : undefined,
    errors: parseErrors(raw.erros),
  };
}

function parseErrors(value: unknown): ProblemError[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      code: typeof item.codigo === 'string' ? item.codigo : undefined,
      message: typeof item.mensagem === 'string' ? item.mensagem : undefined,
      field: typeof item.campo === 'string' ? item.campo : undefined,
    }));
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}
