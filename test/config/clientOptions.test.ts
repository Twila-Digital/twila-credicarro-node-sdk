import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { CredicarroClient, CredicarroConfigurationError, CredicarroEnvironment } from '../../src';
import { resolveClientOptions } from '../../src/config/clientOptions';
import { DEFAULT_RESILIENCE_OPTIONS } from '../../src/config/resilienceOptions';

const valid = { clientId: 'id', clientSecret: 'segredo-super-secreto' };

describe('CredicarroClient configuration', () => {
  it('requires clientId', () => {
    expect(() => new CredicarroClient({ clientId: '', clientSecret: 'secret' })).toThrow(CredicarroConfigurationError);
  });

  it('requires clientSecret', () => {
    expect(() => new CredicarroClient({ clientId: 'id', clientSecret: '  ' })).toThrow(CredicarroConfigurationError);
  });

  it('rejects an invalid baseUrl', () => {
    expect(() => new CredicarroClient({ ...valid, baseUrl: 'not-a-url' })).toThrow(CredicarroConfigurationError);
  });

  it('rejects a non-https baseUrl', () => {
    expect(() => new CredicarroClient({ ...valid, baseUrl: 'http://api.exemplo.com.br/integration' })).toThrow(
      /HTTPS/,
    );
  });

  it('accepts http only for localhost and 127.0.0.1', () => {
    expect(() => new CredicarroClient({ ...valid, baseUrl: 'http://localhost:5000/integration' })).not.toThrow();
    expect(() => new CredicarroClient({ ...valid, baseUrl: 'http://127.0.0.1/integration' })).not.toThrow();
  });

  it('uses the production URL by default and the staging URL when requested', () => {
    expect(resolveClientOptions(valid).baseUrl).toBe('https://api.credicarro.com.br/integration/');
    expect(resolveClientOptions({ ...valid, environment: CredicarroEnvironment.Staging }).baseUrl).toBe(
      'https://api.staging.credicarro.com.br/integration/',
    );
  });

  it('lets baseUrl override the environment and normalizes the trailing slash', () => {
    const resolved = resolveClientOptions({ ...valid, environment: CredicarroEnvironment.Staging, baseUrl: 'https://proxy.exemplo.com.br/x' });
    expect(resolved.baseUrl).toBe('https://proxy.exemplo.com.br/x/');
  });

  it('rejects attemptTimeoutMs greater than totalTimeoutMs', () => {
    expect(
      () => new CredicarroClient({ ...valid, resilience: { totalTimeoutMs: 1000, attemptTimeoutMs: 2000 } }),
    ).toThrow(CredicarroConfigurationError);
  });

  it('rejects maxRetryAttempts below 1', () => {
    expect(() => new CredicarroClient({ ...valid, resilience: { maxRetryAttempts: 0 } })).toThrow(CredicarroConfigurationError);
  });

  it('defaults match the contract (retryOn500 true, document upload attempt 60s)', () => {
    expect(DEFAULT_RESILIENCE_OPTIONS).toMatchObject({
      totalTimeoutMs: 30_000,
      attemptTimeoutMs: 10_000,
      documentUploadAttemptTimeoutMs: 60_000,
      maxRetryAttempts: 3,
      retryBaseDelayMs: 500,
      circuitBreakerFailureRatio: 0.5,
      circuitBreakerSamplingDurationMs: 30_000,
      circuitBreakerMinimumThroughput: 10,
      circuitBreakerBreakDurationMs: 15_000,
      retryOn500: true,
      disableAutomaticIdempotencyKey: false,
    });
  });

  it('builds successfully and exposes every resource', () => {
    const client = new CredicarroClient(valid);
    expect(client.customers).toBeDefined();
    expect(client.simulations).toBeDefined();
    expect(client.proposals).toBeDefined();
    expect(client.webhooks).toBeDefined();
    expect(client.v1.simulations).toBeDefined();
    expect(client.v1.proposals).toBeDefined();
  });

  it('never exposes clientSecret through logging or serialization', () => {
    const client = new CredicarroClient(valid);

    expect(inspect(client, { depth: 10, showHidden: true })).not.toContain(valid.clientSecret);
    expect(JSON.stringify(client)).not.toContain(valid.clientSecret);
    expect(String(client)).not.toContain(valid.clientSecret);
  });
});
