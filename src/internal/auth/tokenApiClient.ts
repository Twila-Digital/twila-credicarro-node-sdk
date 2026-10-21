import axios, { type AxiosInstance } from 'axios';
import { CredicarroAuthenticationError } from '../../errors/CredicarroAuthenticationError';
import { buildErrorMessage, exceptionFromResponse } from '../../errors/exceptionFactory';
import { parseProblemDetails } from '../../errors/problemDetails';
import { parseBody, type ApiResponse } from '../http/apiResponse';
import { toNetworkFailure } from '../http/networkFailure';
import type { ResiliencePipeline } from '../resilience/resiliencePipeline';
import type { GenerateAccessTokenRequestWire, GenerateAccessTokenResponseWire } from '../generated/auth';

export interface TokenApiClient {
  generate(): Promise<GenerateAccessTokenResponseWire>;
}

/**
 * Chama `POST v1/authentication/accesstoken`. As credenciais chegam por uma função para não ficarem como
 * propriedade do objeto (e, portanto, fora de `console.log`/`util.inspect`/`JSON.stringify`).
 */
export class TokenApiClientImpl implements TokenApiClient {
  private readonly http: AxiosInstance;

  constructor(
    baseUrl: string,
    private readonly attemptTimeoutMs: number,
    private readonly pipeline: ResiliencePipeline,
    private readonly credentials: () => GenerateAccessTokenRequestWire,
  ) {
    this.http = axios.create({
      baseURL: baseUrl,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
      // Sem redirecionamentos: as credenciais nunca seguem para outro host.
      maxRedirects: 0,
      maxContentLength: 1024 * 1024,
    });
  }

  async generate(): Promise<GenerateAccessTokenResponseWire> {
    // Gerar token é seguro de repetir: retry habilitado.
    const response = await this.pipeline.execute(true, (signal) => this.post(signal));

    if (response.statusCode === 400 || response.statusCode === 401) {
      const problem = parseProblemDetails(response.body);
      throw new CredicarroAuthenticationError(buildErrorMessage(response.statusCode, problem), undefined, problem.type);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) throw exceptionFromResponse(response);

    const result = response.body as GenerateAccessTokenResponseWire | undefined;
    if (!result || typeof result.token_de_acesso !== 'string' || result.token_de_acesso.length === 0)
      throw new CredicarroAuthenticationError('A API do Credicarro retornou uma resposta vazia ao gerar o token de acesso.');

    return result;
  }

  private async post(signal: AbortSignal): Promise<ApiResponse> {
    try {
      const raw = await this.http.post('v1/authentication/accesstoken', JSON.stringify(this.credentials()), {
        timeout: this.attemptTimeoutMs,
        signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });

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
