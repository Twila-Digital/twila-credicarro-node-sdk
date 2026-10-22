import { describe, expect, it } from 'vitest';
import {
  isDocumentUploadPath,
  isRetrySafe,
  requiresAutomaticIdempotencyKey,
} from '../../src/internal/idempotency/idempotencyClassifier';

describe('requiresAutomaticIdempotencyKey', () => {
  it.each([
    'v1/customer',
    'v1/customer/address',
    'v1/customer/professional',
    'v1/proposal/simulation/financing',
    'v1/proposal/simulation/refinancing',
    'v2/proposal/simulation/financing',
    'v2/proposal/simulation/refinancing',
    'v1/proposal',
    'v2/proposal',
  ])('POST %s gets an automatic key', (path) => {
    expect(requiresAutomaticIdempotencyKey('POST', path)).toBe(true);
  });

  it('the document upload key is handled by the executor (always present), not by the automatic list', () => {
    expect(requiresAutomaticIdempotencyKey('POST', 'v2/proposal/abc/document')).toBe(false);
  });

  it('never generates a key automatically for v1/customer/unified', () => {
    expect(requiresAutomaticIdempotencyKey('POST', 'v1/customer/unified')).toBe(false);
  });

  it('does not generate a key for webhooks, vehicle-detail, deposit-account, token or GET', () => {
    expect(requiresAutomaticIdempotencyKey('POST', 'v1/webhook')).toBe(false);
    expect(requiresAutomaticIdempotencyKey('POST', 'v2/proposal/x/vehicle-detail')).toBe(false);
    expect(requiresAutomaticIdempotencyKey('POST', 'v2/proposal/x/deposit-account')).toBe(false);
    expect(requiresAutomaticIdempotencyKey('POST', 'v1/authentication/accesstoken')).toBe(false);
    expect(requiresAutomaticIdempotencyKey('GET', 'v1/proposal')).toBe(false);
  });

  it('recognizes the document upload path', () => {
    expect(isDocumentUploadPath('v2/proposal/abc/document')).toBe(true);
    expect(isDocumentUploadPath('v2/proposal/abc/vehicle-detail')).toBe(false);
  });
});

describe('isRetrySafe', () => {
  it('GET is always retry-safe', () => {
    expect(isRetrySafe('GET', 'v1/proposal?pagina_inicial=1&limite=10', false)).toBe(true);
  });

  it('the token request is retry-safe', () => {
    expect(isRetrySafe('POST', 'v1/authentication/accesstoken', false)).toBe(true);
  });

  it('POST is retry-safe only when an idempotency key is present', () => {
    expect(isRetrySafe('POST', 'v2/proposal', true)).toBe(true);
    expect(isRetrySafe('POST', 'v2/proposal', false)).toBe(false);
  });

  it('POST v1/customer/unified is retry-safe only with an explicit key', () => {
    expect(isRetrySafe('POST', 'v1/customer/unified', false)).toBe(false);
    expect(isRetrySafe('POST', 'v1/customer/unified', true)).toBe(true);
  });

  it('vehicle-detail and deposit-account have replacement semantics and are retry-safe', () => {
    expect(isRetrySafe('POST', 'v2/proposal/abc/vehicle-detail', false)).toBe(true);
    expect(isRetrySafe('POST', 'v2/proposal/abc/deposit-account', false)).toBe(true);
  });

  it('POST v1/webhook is not retry-safe', () => {
    expect(isRetrySafe('POST', 'v1/webhook', false)).toBe(false);
  });

  it('PUT and DELETE on a webhook are retry-safe, other PUTs are not', () => {
    expect(isRetrySafe('PUT', 'v1/webhook/abc', false)).toBe(true);
    expect(isRetrySafe('DELETE', 'v1/webhook/abc', false)).toBe(true);
    expect(isRetrySafe('PUT', 'v2/proposal/abc', false)).toBe(false);
  });
});
