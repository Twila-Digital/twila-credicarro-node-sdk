export interface ApiResponse {
  statusCode: number;
  /** Corpo já interpretado como JSON (`undefined` se vazio ou inválido). */
  body: unknown;
  /** Corpo bruto da resposta. */
  rawBody: string;
  headers: Record<string, string | undefined>;
}

export function parseBody(rawBody: string): unknown {
  if (rawBody.length === 0) return undefined;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
}
