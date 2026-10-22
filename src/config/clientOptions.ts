import { CredicarroConfigurationError } from '../errors/CredicarroConfigurationError';
import { CredicarroEnvironment, environmentBaseUrl } from './environment';
import { resolveResilienceOptions, type CredicarroResilienceOptions } from './resilienceOptions';

export interface CredicarroClientOptions {
  clientId: string;
  /** Nunca é registrado em log, mensagem de erro ou serialização do cliente. */
  clientSecret: string;
  /** Padrão: `CredicarroEnvironment.Production`. */
  environment?: CredicarroEnvironment;
  /** Sobrescreve a URL do ambiente. Precisa ser HTTPS (exceto `localhost`/`127.0.0.1`, para testes). */
  baseUrl?: string;
  resilience?: Partial<CredicarroResilienceOptions>;
}

export interface ResolvedCredicarroClientOptions {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  resilience: CredicarroResilienceOptions;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export function resolveClientOptions(options: CredicarroClientOptions): ResolvedCredicarroClientOptions {
  validate(options);

  const resilience = resolveResilienceOptions(options.resilience);
  validateResilience(resilience);

  return { clientId: options.clientId, clientSecret: options.clientSecret, baseUrl: resolveBaseUrl(options), resilience };
}

function resolveBaseUrl(options: CredicarroClientOptions): string {
  const raw = options.baseUrl ?? environmentBaseUrl(options.environment ?? CredicarroEnvironment.Production);
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function validate(options: CredicarroClientOptions): void {
  if (isBlank(options.clientId)) throw new CredicarroConfigurationError('clientId é obrigatório.');
  if (isBlank(options.clientSecret)) throw new CredicarroConfigurationError('clientSecret é obrigatório.');

  if (options.baseUrl !== undefined) validateBaseUrl(options.baseUrl);
}

function validateBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new CredicarroConfigurationError('baseUrl, quando informada, deve ser uma URL absoluta válida.');
  }

  const isHttps = url.protocol === 'https:';
  const isLoopbackHttp = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);

  if (!isHttps && !isLoopbackHttp)
    throw new CredicarroConfigurationError('baseUrl deve usar HTTPS (HTTP só é aceito para localhost e 127.0.0.1).');
}

function validateResilience(resilience: CredicarroResilienceOptions): void {
  if (resilience.maxRetryAttempts < 1)
    throw new CredicarroConfigurationError('resilience.maxRetryAttempts deve ser maior ou igual a 1.');

  if (resilience.totalTimeoutMs <= 0) throw new CredicarroConfigurationError('resilience.totalTimeoutMs deve ser maior que zero.');

  if (resilience.attemptTimeoutMs <= 0)
    throw new CredicarroConfigurationError('resilience.attemptTimeoutMs deve ser maior que zero.');

  if (resilience.documentUploadAttemptTimeoutMs <= 0)
    throw new CredicarroConfigurationError('resilience.documentUploadAttemptTimeoutMs deve ser maior que zero.');

  if (resilience.attemptTimeoutMs > resilience.totalTimeoutMs)
    throw new CredicarroConfigurationError('resilience.attemptTimeoutMs não pode ser maior que resilience.totalTimeoutMs.');

  if (resilience.circuitBreakerFailureRatio <= 0 || resilience.circuitBreakerFailureRatio > 1)
    throw new CredicarroConfigurationError(
      'resilience.circuitBreakerFailureRatio deve estar entre 0 (exclusivo) e 1 (inclusivo).',
    );

  if (resilience.circuitBreakerMinimumThroughput < 2)
    throw new CredicarroConfigurationError('resilience.circuitBreakerMinimumThroughput deve ser maior ou igual a 2.');
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value === null || value.trim().length === 0;
}
