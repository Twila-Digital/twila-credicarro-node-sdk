/** Datas em ISO-8601: `Date` vira UTC (`...Z`); texto é enviado como veio. */
export function toIsoString(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}
