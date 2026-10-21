import { inspect } from 'node:util';

// Campos com dados pessoais, financeiros ou segredos. Nos objetos devolvidos pelo SDK, `util.inspect` (console.log)
// mostra esses valores mascarados; as propriedades e o JSON continuam com os valores reais.
const CPF_KEYS = new Set(['cpf', 'buyerCpf', 'sellerCpf', 'customerCpf', 'holderCpf']);
const MASKED_KEYS = new Set([
  'document',
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'dateOfBirth',
  'monthlyIncome',
  'accountNumber',
  'accountDigit',
  'credential',
  'signingSecret',
  'clientSecret',
  'base64Content',
  'reason',
  'refusalReason',
  'biometryLink',
  'chassis',
  'renavam',
]);

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return '***';

  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function maskDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskDeep);
  if (value === null || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (CPF_KEYS.has(key)) result[key] = typeof inner === 'string' ? maskCpf(inner) : '***';
    else if (MASKED_KEYS.has(key)) result[key] = inner === undefined || inner === null ? inner : '***';
    else result[key] = maskDeep(inner);
  }
  return result;
}

/**
 * Faz `util.inspect` (console.log, logs) mostrar uma cópia mascarada. `toJSON`/`JSON.stringify` NÃO são alterados: levam os
 * valores reais, porque são usados para responder e persistir (filas, cache).
 */
export function protectPii<T extends object>(target: T): T {
  Object.defineProperty(target, inspect.custom, {
    value: (_depth: number, options: object) => inspect(maskDeep(target), options),
    enumerable: false,
    configurable: true,
  });
  return target;
}
