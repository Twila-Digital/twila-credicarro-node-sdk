export function enumFromWireValue<E extends Record<string, number | string>>(
  enumObject: E,
  value: number,
  unknownMember: E[keyof E],
): E[keyof E] {
  const isDefined = Object.values(enumObject).some((member) => typeof member === 'number' && member === value);
  return isDefined ? (value as E[keyof E]) : unknownMember;
}

export interface ResolvedEnum<T extends number> {
  /** Valor tipado; `Unknown` (-1) quando o SDK não conhece o valor recebido. */
  value: T;
  /** Valor numérico bruto recebido (ou -1 se a API não enviou nem o código nem um nome conhecido). */
  raw: number;
  /** Nome bruto recebido (vazio se ausente). */
  name: string;
}

/**
 * Resolve um par `enum_x` / `x` da API: o código numérico tem prioridade; sem ele, usa o nome.
 * Aceita nomes em português (payload v2) e em inglês (payload v1) quando o mapa de nomes os traz.
 */
export function resolveEnum<T extends number>(
  enumObject: Record<string, number | string>,
  names: Readonly<Record<string, T>>,
  unknownMember: T,
  rawValue: unknown,
  rawName: unknown,
): ResolvedEnum<T> {
  const name = typeof rawName === 'string' ? rawName : '';
  const hasRaw = typeof rawValue === 'number' && Number.isFinite(rawValue);

  const value = hasRaw
    ? (enumFromWireValue(enumObject, rawValue as number, unknownMember) as T)
    : enumFromName(names, name, unknownMember);

  const raw = hasRaw ? (rawValue as number) : value === unknownMember ? -1 : value;

  return { value, raw, name };
}

export function enumFromName<T extends number>(names: Readonly<Record<string, T>>, name: string | undefined, unknownMember: T): T {
  if (!name) return unknownMember;

  if (Object.prototype.hasOwnProperty.call(names, name)) return names[name] as T;

  const normalized = name.trim().toUpperCase();
  for (const key of Object.keys(names)) {
    if (key.toUpperCase() === normalized) return names[key] as T;
  }

  return unknownMember;
}
