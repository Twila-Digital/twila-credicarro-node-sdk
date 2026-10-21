import { describe, expect, it } from 'vitest';
import { AccessTokenProviderImpl } from '../../src/internal/auth/accessTokenProvider';
import type { TokenApiClient } from '../../src/internal/auth/tokenApiClient';
import type { GenerateAccessTokenResponseWire } from '../../src/internal/generated/auth';

class FakeTokenApiClient implements TokenApiClient {
  calls = 0;
  constructor(private readonly responder: (call: number) => Promise<GenerateAccessTokenResponseWire> | GenerateAccessTokenResponseWire) {}

  async generate(): Promise<GenerateAccessTokenResponseWire> {
    this.calls += 1;
    return this.responder(this.calls);
  }
}

describe('AccessTokenProvider', () => {
  it('caches the token until expira_em and renews it afterwards', async () => {
    let now = 1_000_000;
    const api = new FakeTokenApiClient((call) => ({
      token_de_acesso: `token-${call}`,
      expira_em: new Date(now + 3_540_000).toISOString(),
    }));
    const provider = new AccessTokenProviderImpl(api, () => now);

    expect(await provider.getToken()).toBe('token-1');
    now += 3_000_000;
    expect(await provider.getToken()).toBe('token-1');
    expect(api.calls).toBe(1);

    now += 600_000; // passou de expira_em
    expect(await provider.getToken()).toBe('token-2');
    expect(api.calls).toBe(2);
  });

  it('falls back to now + expira_em_segundos - 60s when expira_em is missing', async () => {
    let now = 5_000_000;
    const api = new FakeTokenApiClient((call) => ({ token_de_acesso: `token-${call}`, expira_em_segundos: 3600 }));
    const provider = new AccessTokenProviderImpl(api, () => now);

    await provider.getToken();
    now += 3_539_000; // ainda dentro de 3600s - 60s
    await provider.getToken();
    expect(api.calls).toBe(1);

    now += 2_000; // ultrapassou 3540s
    await provider.getToken();
    expect(api.calls).toBe(2);
  });

  it('renews only once for concurrent callers (single-flight)', async () => {
    const api = new FakeTokenApiClient(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { token_de_acesso: 'token-unico', expira_em: new Date(Date.now() + 600_000).toISOString() };
    });
    const provider = new AccessTokenProviderImpl(api);

    const tokens = await Promise.all([provider.getToken(), provider.getToken(), provider.getToken()]);

    expect(tokens).toEqual(['token-unico', 'token-unico', 'token-unico']);
    expect(api.calls).toBe(1);
  });

  it('invalidate only drops the cache if the rejected token is still the current one', async () => {
    const api = new FakeTokenApiClient((call) => ({
      token_de_acesso: `token-${call}`,
      expira_em: new Date(Date.now() + 600_000).toISOString(),
    }));
    const provider = new AccessTokenProviderImpl(api);

    expect(await provider.getToken()).toBe('token-1');

    provider.invalidate('token-antigo-ja-substituido');
    expect(await provider.getToken()).toBe('token-1');
    expect(api.calls).toBe(1);

    provider.invalidate('token-1');
    expect(await provider.getToken()).toBe('token-2');
    expect(api.calls).toBe(2);
  });

  it('does not cache a failed renewal', async () => {
    const api = new FakeTokenApiClient((call) => {
      if (call === 1) throw new Error('falha');
      return { token_de_acesso: 'token-ok', expira_em: new Date(Date.now() + 600_000).toISOString() };
    });
    const provider = new AccessTokenProviderImpl(api);

    await expect(provider.getToken()).rejects.toThrow('falha');
    expect(await provider.getToken()).toBe('token-ok');
  });
});
