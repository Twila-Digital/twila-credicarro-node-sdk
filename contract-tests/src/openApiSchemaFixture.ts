import { load } from 'js-yaml';

// O swagger de staging do Credicarro exige autenticação (401), então o contrato vem do openapi.yaml público da documentação.
const DEFAULT_OPENAPI_URL = 'https://documentacao.credicarro.com.br/openapi.yaml';

export type Schema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  enum?: unknown[];
  format?: string;
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema>; parameters: Record<string, Parameter>; responses: Record<string, unknown> };
}

export interface Parameter {
  $ref?: string;
  name: string;
  in: string;
  required?: boolean;
}

export interface Operation {
  parameters?: Parameter[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { $ref?: string; content?: Record<string, { schema?: Schema }> }>;
}

let cached: OpenApiDocument | undefined;

export async function fetchOpenApi(): Promise<OpenApiDocument> {
  if (cached) return cached;

  const url = process.env.CREDICARRO_CONTRACT_TESTS_OPENAPI_URL ?? DEFAULT_OPENAPI_URL;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) throw new Error(`Falha ao buscar o openapi.yaml (${url}): HTTP ${response.status}`);

  cached = load(await response.text()) as OpenApiDocument;
  return cached;
}

export function resolveRef<T>(document: OpenApiDocument, node: T & { $ref?: string }): T {
  if (!node || typeof node !== 'object' || typeof node.$ref !== 'string') return node;

  const segments = node.$ref.replace(/^#\//, '').split('/');
  let current: unknown = document;
  for (const segment of segments) current = (current as Record<string, unknown>)[segment];

  return resolveRef(document, current as T & { $ref?: string });
}

/** Resolve `$ref` e junta `allOf`, devolvendo um schema "achatado" no nível raiz. */
export function resolveSchema(document: OpenApiDocument, schema: Schema | undefined): Schema {
  if (!schema) return {};

  const resolved = resolveRef(document, schema);
  if (!resolved.allOf) return resolved;

  const merged: Schema = { ...resolved, properties: { ...resolved.properties }, required: [...(resolved.required ?? [])] };
  for (const part of resolved.allOf) {
    const resolvedPart = resolveSchema(document, part);
    merged.properties = { ...merged.properties, ...resolvedPart.properties };
    merged.required = [...(merged.required ?? []), ...(resolvedPart.required ?? [])];
    merged.type = merged.type ?? resolvedPart.type;
  }
  delete merged.allOf;

  return merged;
}

export function operationOf(document: OpenApiDocument, method: string, path: string): Operation | undefined {
  return document.paths[path]?.[method];
}

export function requestSchemaOf(document: OpenApiDocument, operation: Operation): Schema {
  return resolveSchema(document, operation.requestBody?.content?.['application/json']?.schema);
}

export function responseSchemaOf(document: OpenApiDocument, operation: Operation, status: string): Schema {
  const response = operation.responses?.[status];
  return resolveSchema(document, response?.content?.['application/json']?.schema);
}

export function queryParameterNames(document: OpenApiDocument, operation: Operation): string[] {
  return (operation.parameters ?? [])
    .map((parameter) => resolveRef(document, parameter))
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => parameter.name);
}

export function headerParameterNames(document: OpenApiDocument, operation: Operation): string[] {
  return (operation.parameters ?? [])
    .map((parameter) => resolveRef(document, parameter))
    .filter((parameter) => parameter.in === 'header')
    .map((parameter) => parameter.name);
}

/** Verifica um corpo de requisição: só propriedades do schema, e todas as obrigatórias presentes (recursivo). */
export function conformanceProblems(document: OpenApiDocument, value: unknown, schema: Schema, path = '$'): string[] {
  const resolved = resolveSchema(document, schema);
  const problems: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => problems.push(...conformanceProblems(document, item, resolved.items ?? {}, `${path}[${index}]`)));
    return problems;
  }

  if (value === null || typeof value !== 'object') return problems;

  const properties = resolved.properties ?? {};
  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!(key in properties)) problems.push(`${path}.${key} não existe no schema`);
    else problems.push(...conformanceProblems(document, record[key], properties[key] as Schema, `${path}.${key}`));
  }

  for (const required of resolved.required ?? []) {
    if (!(required in record)) problems.push(`${path}.${required} é obrigatório no schema e não está no wire type`);
  }

  return problems;
}

/** Gera um valor de exemplo a partir do schema, com todas as propriedades preenchidas. */
export function fixtureFromSchema(document: OpenApiDocument, schema: Schema | undefined): unknown {
  const resolved = resolveSchema(document, schema);

  if (resolved.enum && resolved.enum.length > 0) return resolved.enum[0];

  switch (resolved.type) {
    case 'array':
      return [fixtureFromSchema(document, resolved.items)];
    case 'integer':
      return 1;
    case 'number':
      return 1.5;
    case 'boolean':
      return true;
    case 'string':
      if (resolved.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      if (resolved.format === 'date-time') return '2026-10-12T14:05:08.984-03:00';
      return 'texto';
    default: {
      const result: Record<string, unknown> = {};
      for (const [key, property] of Object.entries(resolved.properties ?? {})) result[key] = fixtureFromSchema(document, property);
      return result;
    }
  }
}

/**
 * Embrulha um valor para registrar toda leitura de uma propriedade que NÃO existe no valor (que foi gerado só com
 * as propriedades do schema). Assim, um mapper que lê um campo fora do contrato é detectado.
 */
export function strictReader<T>(value: T, violations: string[], path = '$'): T {
  if (value === null || typeof value !== 'object') return value;

  return new Proxy(value as unknown as object, {
    get(target, property, receiver) {
      if (typeof property === 'symbol') return Reflect.get(target, property, receiver) as unknown;

      if (!(property in target)) violations.push(`${path}.${property} lido pelo SDK, mas ausente do schema`);

      const inner = Reflect.get(target, property, receiver) as unknown;
      return typeof inner === 'function' ? inner : strictReader(inner, violations, `${path}.${property}`);
    },
  }) as T;
}
