const AUTOMATIC_KEY_PATHS = new Set([
  'v1/customer',
  'v1/customer/address',
  'v1/customer/professional',
  'v1/proposal/simulation/financing',
  'v1/proposal/simulation/refinancing',
  'v2/proposal/simulation/financing',
  'v2/proposal/simulation/refinancing',
  'v1/proposal',
  'v2/proposal',
]);

const DOCUMENT_UPLOAD_PATH = /^v2\/proposal\/[^/]+\/document$/;
const REPLACEMENT_SEMANTICS_PATH = /^v2\/proposal\/[^/]+\/(vehicle-detail|deposit-account)$/;
const WEBHOOK_ITEM_PATH = /^v1\/webhook\/[^/]+$/;
const ACCESS_TOKEN_PATH = 'v1/authentication/accesstoken';

function normalize(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  return withoutQuery.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

export function isDocumentUploadPath(path: string): boolean {
  return DOCUMENT_UPLOAD_PATH.test(normalize(path));
}

/** `true` quando a rota deve receber uma `Idempotency-Key` gerada pelo SDK (a menos que o integrador a desligue). */
export function requiresAutomaticIdempotencyKey(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;

  return AUTOMATIC_KEY_PATHS.has(normalize(path));
}

/** Retry só é seguro em requisições idempotentes pelo contrato da API. */
export function isRetrySafe(method: string, path: string, hasIdempotencyKey: boolean): boolean {
  const upperMethod = method.toUpperCase();
  const normalized = normalize(path);

  if (upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS') return true;

  if (upperMethod === 'PUT' || upperMethod === 'DELETE') return WEBHOOK_ITEM_PATH.test(normalized);

  if (upperMethod !== 'POST') return false;

  if (normalized === ACCESS_TOKEN_PATH) return true;

  if (REPLACEMENT_SEMANTICS_PATH.test(normalized)) return true;

  return hasIdempotencyKey;
}
