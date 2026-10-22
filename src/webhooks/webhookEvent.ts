import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { CredicarroWebhookSignatureError } from '../errors/CredicarroWebhookSignatureError';
import type { ProposalWebhookEventWire } from '../internal/generated/webhook';
import { proposalWebhookEventToPublic } from '../internal/mapping/webhookMapper';
import type { ProposalWebhookEvent, WebhookVerificationOptions } from './types';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;
const HMAC_ALGORITHM = 'sha256';
const TIMESTAMP_PATTERN = /^\d{1,10}$/;
const SIGNATURE_PATTERN = /^[0-9a-fA-F]{64}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type RawBody = string | Uint8Array;

/**
 * Verifica a assinatura (`X-CrediCarro-Signature`) e interpreta a notificação de proposta (payload v1 ou v2).
 *
 * O header e o segredo são obrigatórios: ausente, vazio ou inválido lança `CredicarroWebhookSignatureError` — a
 * verificação nunca é pulada. Para ler um corpo sem verificar (apenas testes), use `parseWebhookEventUnverified`.
 *
 * `rawBody` precisa ser o corpo EXATAMENTE como recebido, antes de qualquer `JSON.parse`.
 */
export function parseWebhookEvent(
  rawBody: RawBody,
  signatureHeader: string,
  signingSecret: string,
  options?: WebhookVerificationOptions,
): ProposalWebhookEvent {
  if (!verifyWebhookSignature(rawBody, signatureHeader, signingSecret, options))
    throw new CredicarroWebhookSignatureError(
      'A assinatura do webhook é inválida, o segredo está vazio ou o timestamp está fora da janela de tolerância.',
    );

  return parseBody(rawBody);
}

/** Lê a notificação SEM verificar a assinatura. Nunca use com requisições recebidas; é só para testes. */
export function parseWebhookEventUnverified(rawBody: RawBody): ProposalWebhookEvent {
  return parseBody(rawBody);
}

/**
 * Verifica `t={timestamp},v1={assinatura}` em tempo constante, com tolerância nos dois sentidos.
 * `toleranceMs` (e `nowMs`) precisam ser finitos e `toleranceMs >= 0`; senão lança `RangeError`.
 */
export function verifyWebhookSignature(
  rawBody: RawBody,
  signatureHeader: string,
  signingSecret: string,
  options?: WebhookVerificationOptions,
): boolean {
  const toleranceMs = options?.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  const nowMs = options?.nowMs ?? Date.now();

  if (!Number.isFinite(toleranceMs) || toleranceMs < 0) throw new RangeError('toleranceMs deve ser um número finito maior ou igual a 0.');
  if (!Number.isFinite(nowMs)) throw new RangeError('nowMs deve ser um número finito.');

  if (typeof signingSecret !== 'string' || signingSecret.length === 0) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  if (Math.abs(nowMs - Number(parsed.timestamp) * 1000) > toleranceMs) return false;

  const expected = signatureBytes(signingSecret, parsed.timestamp, rawBody);
  const received = Buffer.from(parsed.signature, 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Compara o header `Authorization` recebido com o esperado (Basic ou Bearer) pelo SHA-256 dos dois valores, em
 * tempo constante. Esperado ausente ou vazio nunca aceita.
 */
export function verifyWebhookAuthorization(receivedHeader: string | undefined, expectedHeader: string | undefined): boolean {
  if (!receivedHeader || !expectedHeader) return false;

  const received = createHash(HMAC_ALGORITHM).update(receivedHeader, 'utf8').digest();
  const expected = createHash(HMAC_ALGORITHM).update(expectedHeader, 'utf8').digest();

  return timingSafeEqual(received, expected);
}

/** Assinatura `v1` em hexadecimal minúsculo: HMAC-SHA256 de `"{t}.{corpo bruto}"` com o segredo em UTF-8. */
export function computeWebhookSignature(signingSecret: string, timestamp: number | string, rawBody: RawBody): string {
  return signatureBytes(signingSecret, String(timestamp), rawBody).toString('hex');
}

/** Agrupa as funções de webhook (`parse`, `parseUnverified`, `verifySignature`, `verifyAuthorization`). */
export const CredicarroWebhookEvent = {
  parse: parseWebhookEvent,
  parseUnverified: parseWebhookEventUnverified,
  verifySignature: verifyWebhookSignature,
  verifyAuthorization: verifyWebhookAuthorization,
};

function signatureBytes(signingSecret: string, timestamp: string, rawBody: RawBody): Buffer {
  return createHmac(HMAC_ALGORITHM, Buffer.from(signingSecret, 'utf8'))
    .update(`${timestamp}.`, 'utf8')
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest();
}

/** `t` ou `v1` ausente, malformado ou repetido invalida o header. */
function parseSignatureHeader(header: string): { timestamp: string; signature: string } | undefined {
  if (typeof header !== 'string' || header.length === 0) return undefined;

  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 0) return undefined;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === 't') {
      if (timestamp !== undefined || !TIMESTAMP_PATTERN.test(value)) return undefined;
      timestamp = value;
    } else if (key === 'v1') {
      if (signature !== undefined || !SIGNATURE_PATTERN.test(value)) return undefined;
      signature = value;
    }
  }

  if (timestamp === undefined || signature === undefined) return undefined;

  return { timestamp, signature };
}

function parseBody(rawBody: RawBody): ProposalWebhookEvent {
  const text = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf8');

  let wire: ProposalWebhookEventWire;
  try {
    wire = JSON.parse(text) as ProposalWebhookEventWire;
  } catch {
    throw new CredicarroWebhookSignatureError('O corpo do webhook está vazio ou não é um JSON válido.');
  }

  if (!wire || typeof wire !== 'object' || typeof wire.id_proposta !== 'string' || !UUID_PATTERN.test(wire.id_proposta))
    throw new CredicarroWebhookSignatureError('O corpo do webhook não traz um id_proposta (UUID) válido.');

  return proposalWebhookEventToPublic(wire);
}
