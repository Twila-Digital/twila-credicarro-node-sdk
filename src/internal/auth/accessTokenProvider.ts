import type { TokenApiClient } from './tokenApiClient';

/** Sem `expira_em`: validade = max(expira_em_segundos / 2, expira_em_segundos − 60 s). */
const FALLBACK_MARGIN_MS = 60_000;

interface CachedToken {
  value: string;
  expiresAtEpochMs: number;
}

export interface AccessTokenProvider {
  getToken(): Promise<string>;
  /** Descarta o cache só se o token rejeitado ainda for o atual (outra requisição pode já tê-lo renovado). */
  invalidate(rejectedToken: string): void;
}

export class AccessTokenProviderImpl implements AccessTokenProvider {
  #cached: CachedToken | null = null;
  #refreshing: Promise<string> | null = null;
  readonly #tokenApiClient: TokenApiClient;
  readonly #now: () => number;

  constructor(tokenApiClient: TokenApiClient, now: () => number = Date.now) {
    this.#tokenApiClient = tokenApiClient;
    this.#now = now;
  }

  async getToken(): Promise<string> {
    const current = this.#cached;
    if (current && !this.#isExpired(current)) return current.value;

    if (this.#refreshing) return this.#refreshing;

    const refresh = this.#refresh();
    this.#refreshing = refresh;
    try {
      return await refresh;
    } finally {
      if (this.#refreshing === refresh) this.#refreshing = null;
    }
  }

  invalidate(rejectedToken: string): void {
    if (this.#cached?.value === rejectedToken) this.#cached = null;
  }

  async #refresh(): Promise<string> {
    const response = await this.#tokenApiClient.generate();
    const fresh: CachedToken = { value: response.token_de_acesso, expiresAtEpochMs: this.#expiresAt(response) };

    this.#cached = fresh;
    return fresh.value;
  }

  #expiresAt(response: { expira_em?: string; expira_em_segundos?: number }): number {
    const fromDate = response.expira_em ? Date.parse(response.expira_em) : Number.NaN;
    if (Number.isFinite(fromDate)) return fromDate;

    const seconds = Number(response.expira_em_segundos);
    const lifetimeMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;

    return this.#now() + Math.max(lifetimeMs / 2, lifetimeMs - FALLBACK_MARGIN_MS);
  }

  #isExpired(token: CachedToken): boolean {
    return this.#now() >= token.expiresAtEpochMs;
  }
}
