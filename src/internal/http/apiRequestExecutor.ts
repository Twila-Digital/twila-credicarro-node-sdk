import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'node:crypto';
import type { AccessTokenProvider } from '../auth/accessTokenProvider';
import { isDocumentUploadPath, isRetrySafe, requiresAutomaticIdempotencyKey } from '../idempotency/idempotencyClassifier';
import { ResiliencePipeline } from '../resilience/resiliencePipeline';
import type { CredicarroResilienceOptions } from '../../config/resilienceOptions';
import { exceptionFromResponse } from '../../errors/exceptionFactory';
import { parseBody, type ApiResponse } from './apiResponse';
import { toNetworkFailure } from './networkFailure';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface PostOptions {
  /** Substitui o timeout de tentativa padrão (ex.: upload de documento). Também define o orçamento total (× tentativas). */
  attemptTimeoutMs?: number;
  /** `Idempotency-Key` informada pelo integrador; tem prioridade sobre a automática. */
  idempotencyKey?: string;
}

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
/** Limite da resposta aceita: 10 MiB. */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
/** Limite do corpo enviado: documento de 10 MiB em Base64 (~13,4 MB) mais o envelope JSON. */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

export function validateIdempotencyKey(key: string): void {
  if (typeof key !== 'string' || key.length < 1 || key.length > MAX_IDEMPOTENCY_KEY_LENGTH)
    throw new RangeError('idempotencyKey deve ter de 1 a 200 caracteres.');

  if (!PRINTABLE_ASCII.test(key) || key.trim().length === 0)
    throw new RangeError('idempotencyKey deve conter apenas caracteres ASCII imprimíveis e não pode ser só espaços.');
}

export class ApiRequestExecutor {
  private readonly http: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: AccessTokenProvider,
    private readonly resilienceOptions: CredicarroResilienceOptions,
    private readonly resilience: ResiliencePipeline,
  ) {
    this.http = axios.create({
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
      maxRedirects: 0,
      maxBodyLength: MAX_REQUEST_BYTES,
      maxContentLength: MAX_RESPONSE_BYTES,
    });
  }

  get(path: string): Promise<ApiResponse> {
    return this.send('GET', path, undefined, {});
  }

  post(path: string, body: unknown, options: PostOptions = {}): Promise<ApiResponse> {
    return this.send('POST', path, body, options);
  }

  put(path: string, body: unknown): Promise<ApiResponse> {
    return this.send('PUT', path, body, {});
  }

  delete(path: string): Promise<ApiResponse> {
    return this.send('DELETE', path, undefined, {});
  }

  static ensureSuccess(response: ApiResponse): void {
    if (response.statusCode < 200 || response.statusCode >= 300) throw exceptionFromResponse(response);
  }

  private async send(method: HttpMethod, path: string, body: unknown, options: PostOptions): Promise<ApiResponse> {
    const idempotencyKey = this.resolveIdempotencyKey(method, path, options.idempotencyKey);
    const attemptTimeoutMs = options.attemptTimeoutMs ?? this.resilienceOptions.attemptTimeoutMs;
    const retrySafe = isRetrySafe(method, path, idempotencyKey !== undefined);

    const totalTimeoutMs =
      options.attemptTimeoutMs !== undefined
        ? Math.max(this.resilienceOptions.totalTimeoutMs, attemptTimeoutMs * this.resilienceOptions.maxRetryAttempts)
        : this.resilienceOptions.totalTimeoutMs;

    const payload = body === undefined ? undefined : JSON.stringify(body);

    return this.resilience.execute(
      retrySafe,
      (signal) => this.sendWithAuth(method, path, payload, idempotencyKey, attemptTimeoutMs, signal),
      totalTimeoutMs,
    );
  }

  /** A chave é gerada uma única vez por chamada lógica e reaproveitada em todas as tentativas. */
  private resolveIdempotencyKey(method: HttpMethod, path: string, explicitKey: string | undefined): string | undefined {
    if (explicitKey !== undefined) {
      validateIdempotencyKey(explicitKey);
      return explicitKey;
    }

    if (method === 'POST' && isDocumentUploadPath(path)) return randomUUID();

    if (this.resilienceOptions.disableAutomaticIdempotencyKey) return undefined;

    return requiresAutomaticIdempotencyKey(method, path) ? randomUUID() : undefined;
  }

  private async sendWithAuth(
    method: HttpMethod,
    path: string,
    payload: string | undefined,
    idempotencyKey: string | undefined,
    attemptTimeoutMs: number,
    signal: AbortSignal,
  ): Promise<ApiResponse> {
    const token = await this.tokenProvider.getToken();
    const response = await this.sendOnce(method, path, payload, idempotencyKey, attemptTimeoutMs, token, signal);

    if (response.statusCode !== 401) return response;

    this.tokenProvider.invalidate(token);
    const newToken = await this.tokenProvider.getToken();
    const retried = await this.sendOnce(method, path, payload, idempotencyKey, attemptTimeoutMs, newToken, signal);

    if (retried.statusCode !== 401) return retried;

    throw exceptionFromResponse(retried);
  }

  private async sendOnce(
    method: HttpMethod,
    path: string,
    payload: string | undefined,
    idempotencyKey: string | undefined,
    attemptTimeoutMs: number,
    token: string,
    signal: AbortSignal,
  ): Promise<ApiResponse> {
    const url = new URL(path, this.baseUrl).toString();

    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    try {
      const raw = await this.http.request({ url, method, data: payload, headers, timeout: attemptTimeoutMs, signal });
      const rawBody = typeof raw.data === 'string' ? raw.data : '';

      return {
        statusCode: raw.status,
        body: parseBody(rawBody),
        rawBody,
        headers: raw.headers as Record<string, string>,
      };
    } catch (error) {
      throw toNetworkFailure(error) ?? error;
    }
  }
}
