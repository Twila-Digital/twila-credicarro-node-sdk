import { describe, expect, it } from 'vitest';
import {
  ActionOwner,
  BiometryStatus,
  CredicarroWebhookEvent,
  CredicarroWebhookSignatureError,
  DocumentStatus,
  ProposalEventReason,
  ProposalStatus,
  ProposalStep,
  computeWebhookSignature,
  parseWebhookEvent,
  parseWebhookEventUnverified,
  verifyWebhookAuthorization,
  verifyWebhookSignature,
} from '../../src';
import { V2_PROPOSAL_WIRE } from '../support';

// Vetor da documentação (webhooks/security.mdx).
const SECRET = 'segredo-de-exemplo';
const TIMESTAMP = 1715792400;
const BODY = '{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","enum_status":2,"status":"Approved"}';
const EXPECTED_V1 = 'db66c554eb116ef2577deb63f72619793502a31520f622b2d59864b074eb8df2';
const HEADER = `t=${TIMESTAMP},v1=${EXPECTED_V1}`;
const AT = { nowMs: TIMESTAMP * 1000 };

describe('signature (documentation test vector)', () => {
  it('computes the v1 value from the documentation', () => {
    expect(computeWebhookSignature(SECRET, TIMESTAMP, BODY)).toBe(EXPECTED_V1);
  });

  it('accepts the documentation header', () => {
    expect(verifyWebhookSignature(BODY, HEADER, SECRET, AT)).toBe(true);
  });

  it('accepts the body as bytes and an uppercase hex signature', () => {
    expect(verifyWebhookSignature(Buffer.from(BODY, 'utf8'), HEADER, SECRET, AT)).toBe(true);
    expect(verifyWebhookSignature(BODY, `t=${TIMESTAMP},v1=${EXPECTED_V1.toUpperCase()}`, SECRET, AT)).toBe(true);
  });

  it('accepts the header parts in any order and with extra spaces', () => {
    expect(verifyWebhookSignature(BODY, `v1=${EXPECTED_V1}, t=${TIMESTAMP}`, SECRET, AT)).toBe(true);
  });

  it('rejects a header with a duplicated t or v1', () => {
    expect(verifyWebhookSignature(BODY, `t=${TIMESTAMP},v1=${'0'.repeat(64)},v1=${EXPECTED_V1}`, SECRET, AT)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${TIMESTAMP},t=${TIMESTAMP + 1},v1=${EXPECTED_V1}`, SECRET, AT)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${TIMESTAMP + 1},t=${TIMESTAMP},v1=${EXPECTED_V1}`, SECRET, AT)).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('rejects an invalid tolerance (%s) instead of disabling the window', (toleranceMs) => {
    expect(() => verifyWebhookSignature(BODY, HEADER, SECRET, { ...AT, toleranceMs })).toThrow(RangeError);
    expect(() => parseWebhookEvent(BODY, HEADER, SECRET, { ...AT, toleranceMs })).toThrow(RangeError);
  });

  it('requires a UUID id_proposta', () => {
    expect(() => parseWebhookEventUnverified('{"id_proposta":"x","enum_status":2}')).toThrow(CredicarroWebhookSignatureError);
  });

  it('rejects a tampered body, a wrong secret and a wrong timestamp', () => {
    expect(verifyWebhookSignature(BODY.replace('Approved', 'Refused'), HEADER, SECRET, AT)).toBe(false);
    expect(verifyWebhookSignature(BODY, HEADER, 'outro-segredo', AT)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${TIMESTAMP + 1},v1=${EXPECTED_V1}`, SECRET, { nowMs: (TIMESTAMP + 1) * 1000 })).toBe(false);
  });

  it('rejects an empty or missing secret', () => {
    expect(verifyWebhookSignature(BODY, HEADER, '', AT)).toBe(false);
    expect(verifyWebhookSignature(BODY, HEADER, undefined as unknown as string, AT)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['without t', `v1=${EXPECTED_V1}`],
    ['without v1', `t=${TIMESTAMP}`],
    ['t not numeric', `t=abc,v1=${EXPECTED_V1}`],
    ['t with 11 digits', `t=17157924000,v1=${EXPECTED_V1}`],
    ['t negative', `t=-1715792400,v1=${EXPECTED_V1}`],
    ['t empty', `t=,v1=${EXPECTED_V1}`],
    ['v1 not hex', `t=${TIMESTAMP},v1=${'z'.repeat(64)}`],
    ['v1 too short', `t=${TIMESTAMP},v1=abcd`],
    ['part without =', `t=${TIMESTAMP},v1`],
    ['free text', 'não é um header válido'],
  ])('rejects an invalid header (%s)', (_label, header) => {
    expect(verifyWebhookSignature(BODY, header, SECRET, AT)).toBe(false);
  });

  it('applies the 5 minute tolerance in both directions', () => {
    const edge = 5 * 60 * 1000;

    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: TIMESTAMP * 1000 + edge })).toBe(true);
    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: TIMESTAMP * 1000 + edge + 1 })).toBe(false);
    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: TIMESTAMP * 1000 - edge })).toBe(true);
    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: TIMESTAMP * 1000 - edge - 1 })).toBe(false);
  });

  it('honors a custom tolerance', () => {
    const now = TIMESTAMP * 1000 + 60_000;

    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: now, toleranceMs: 30_000 })).toBe(false);
    expect(verifyWebhookSignature(BODY, HEADER, SECRET, { nowMs: now, toleranceMs: 120_000 })).toBe(true);
  });

  it('uses the current clock by default (a freshly signed event is accepted)', () => {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${computeWebhookSignature(SECRET, t, BODY)}`;

    expect(verifyWebhookSignature(BODY, header, SECRET)).toBe(true);
  });
});

describe('parseWebhookEvent', () => {
  it('parses a v1 payload with a valid signature', () => {
    const event = parseWebhookEvent(BODY, HEADER, SECRET, AT);

    expect(event).toEqual({
      proposalId: 'bea8d060-f93d-48eb-b6c4-45f64483cdd9',
      status: ProposalStatus.Approved,
      statusRaw: 2,
      statusName: 'Approved',
      eventReason: undefined,
      eventReasonRaw: undefined,
      refusalReason: undefined,
      eventDate: undefined,
      buyer: undefined,
      seller: undefined,
      store: undefined,
      isDetailed: false,
    });
  });

  it('parses without verification when neither header nor secret is provided', () => {
    expect(parseWebhookEventUnverified(BODY).status).toBe(ProposalStatus.Approved);
  });

  it('throws CredicarroWebhookSignatureError for an invalid signature, expired timestamp or empty secret', () => {
    expect(() => parseWebhookEvent(BODY, `t=${TIMESTAMP},v1=${'0'.repeat(64)}`, SECRET, AT)).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEvent(BODY, HEADER, SECRET, { nowMs: TIMESTAMP * 1000 + 10 * 60 * 1000 })).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEvent(BODY, HEADER, '', AT)).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEvent(BODY, HEADER, 'segredo-errado', AT)).toThrow(CredicarroWebhookSignatureError);
  });

  it('never skips verification when only one of header or secret is provided', () => {
    expect(() => parseWebhookEvent(BODY, HEADER, undefined as unknown as string, AT)).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEvent(BODY, undefined as unknown as string, SECRET, AT)).toThrow(CredicarroWebhookSignatureError);
  });

  it('does not leak the secret or the body in the error message', () => {
    const error = (() => {
      try {
        parseWebhookEvent(BODY, HEADER, 'segredo-errado-xyz', AT);
      } catch (e) {
        return e as Error;
      }
      return undefined;
    })();

    expect(error?.message).not.toContain('segredo-errado-xyz');
    expect(error?.message).not.toContain('bea8d060');
  });

  it('rejects a body that is not valid JSON or has no id_proposta', () => {
    expect(() => parseWebhookEventUnverified('')).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEventUnverified('não é json')).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEventUnverified('{"enum_status":2}')).toThrow(CredicarroWebhookSignatureError);
    expect(() => parseWebhookEventUnverified('null')).toThrow(CredicarroWebhookSignatureError);
  });

  it('falls back to Unknown for an unrecognized status, keeping the raw value and name', () => {
    const event = parseWebhookEventUnverified('{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","enum_status":9999,"status":"Algo novo"}');

    expect(event.status).toBe(ProposalStatus.Unknown);
    expect(event.statusRaw).toBe(9999);
    expect(event.statusName).toBe('Algo novo');
  });

  it('accepts a status given only by name, in Portuguese (v2) or English (v1)', () => {
    expect(parseWebhookEventUnverified('{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","status":"FINALIZADA"}')).toMatchObject({ status: ProposalStatus.Completed, statusRaw: ProposalStatus.Completed });
    expect(parseWebhookEventUnverified('{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","status":"Completed"}')).toMatchObject({ status: ProposalStatus.Completed, statusRaw: ProposalStatus.Completed });
    expect(parseWebhookEventUnverified('{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","status":"NOPE"}')).toMatchObject({ status: ProposalStatus.Unknown, statusRaw: -1 });
  });

  it.each([
    [1, 'Analysing', ProposalStatus.Analysing],
    [2, 'Approved', ProposalStatus.Approved],
    [3, 'Refused', ProposalStatus.Refused],
    [4, 'Canceled', ProposalStatus.Canceled],
    [5, 'ManualAnalysis', ProposalStatus.ManualAnalysis],
    [6, 'Completed', ProposalStatus.Completed],
    [7, 'InNegotiation', ProposalStatus.InNegotiation],
    [8, 'Expired', ProposalStatus.Expired],
    [9, 'Pending', ProposalStatus.Pending],
  ])('parses v1 status %i (%s)', (raw, name, expected) => {
    const event = parseWebhookEventUnverified(JSON.stringify({ id_proposta: 'bea8d060-f93d-48eb-b6c4-45f64483cdd9', enum_status: raw, status: name }));

    expect(event.status).toBe(expected);
    expect(event.isDetailed).toBe(false);
  });

  it('parses the v2 payload from the documentation (detailed snapshot)', () => {
    const payload = {
      ...V2_PROPOSAL_WIRE,
      motivo_evento: 'DOCUMENTOS_ALTERADOS',
      motivo_recusa: null,
      data_evento: '2026-10-12T17:20:31.512+00:00',
      vendedor: null,
    };
    const raw = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${computeWebhookSignature(SECRET, t, raw)}`;

    const event = parseWebhookEvent(raw, header, SECRET);

    expect(event).toMatchObject({
      proposalId: 'bea8d060-f93d-48eb-b6c4-45f64483cdd9',
      status: ProposalStatus.Approved,
      statusRaw: 2,
      statusName: 'APROVADA',
      eventReason: ProposalEventReason.DocumentsChanged,
      eventReasonRaw: 'DOCUMENTOS_ALTERADOS',
      eventDate: '2026-10-12T17:20:31.512+00:00',
      isDetailed: true,
    });
    expect(event.refusalReason).toBeUndefined();
    expect(event.seller).toBeUndefined();
    expect(event.buyer).toMatchObject({ document: '12345678909', biometry: BiometryStatus.Approved });
    expect(event.buyer?.activeStep).toMatchObject({ step: ProposalStep.DocumentCorrection, actionOwner: ActionOwner.Integrator });
    expect(event.buyer?.documents[0]).toMatchObject({ status: DocumentStatus.Invalid, reason: 'Documento ilegível' });
    expect(event.store?.document).toBe('11222333000181');
  });

  it.each([
    ['STATUS_ALTERADO', ProposalEventReason.StatusChanged],
    ['ETAPAS_ALTERADAS', ProposalEventReason.StepsChanged],
    ['DOCUMENTOS_ALTERADOS', ProposalEventReason.DocumentsChanged],
    ['NOVO_MOTIVO', ProposalEventReason.Unknown],
  ])('maps motivo_evento %s', (name, expected) => {
    const event = parseWebhookEventUnverified(JSON.stringify({ id_proposta: 'bea8d060-f93d-48eb-b6c4-45f64483cdd9', enum_status: 2, status: 'APROVADA', motivo_evento: name }));

    expect(event.eventReason).toBe(expected);
    expect(event.eventReasonRaw).toBe(name);
    expect(event.isDetailed).toBe(true);
  });

  it('exposes the same functions through CredicarroWebhookEvent', () => {
    expect(CredicarroWebhookEvent.parse(BODY, HEADER, SECRET, AT).proposalId).toBe('bea8d060-f93d-48eb-b6c4-45f64483cdd9');
    expect(CredicarroWebhookEvent.verifySignature(BODY, HEADER, SECRET, AT)).toBe(true);
    expect(CredicarroWebhookEvent.verifyAuthorization('Basic abc', 'Basic abc')).toBe(true);
  });
});

describe('verifyWebhookAuthorization', () => {
  it('compares equal headers', () => {
    expect(verifyWebhookAuthorization('Basic dXN1YXJpbzpzZW5oYQ==', 'Basic dXN1YXJpbzpzZW5oYQ==')).toBe(true);
    expect(verifyWebhookAuthorization('Bearer token', 'Bearer token')).toBe(true);
  });

  it('rejects different, missing or empty headers', () => {
    expect(verifyWebhookAuthorization('Bearer token', 'Bearer outro')).toBe(false);
    expect(verifyWebhookAuthorization('Bearer token', 'Bearer token-mais-longo')).toBe(false);
    expect(verifyWebhookAuthorization(undefined, 'Bearer token')).toBe(false);
    expect(verifyWebhookAuthorization('Bearer token', undefined)).toBe(false);
    expect(verifyWebhookAuthorization('', '')).toBe(false);
  });
});
