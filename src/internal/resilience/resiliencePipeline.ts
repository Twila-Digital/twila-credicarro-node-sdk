import {
  DelegateBackoff,
  SamplingBreaker,
  TimeoutStrategy,
  circuitBreaker,
  handleWhen,
  isBrokenCircuitError,
  isTaskCancelledError,
  retry,
  timeout,
  wrap,
  type CircuitBreakerPolicy,
  type IRetryBackoffContext,
} from 'cockatiel';
import type { CredicarroResilienceOptions } from '../../config/resilienceOptions';
import { CredicarroTimeoutError } from '../../errors/CredicarroTimeoutError';
import { retryAfterMs } from '../../errors/exceptionFactory';
import type { ApiResponse } from '../http/apiResponse';
import { isNetworkFailure, isTransientNetworkFailure } from '../http/networkFailure';
import { isTransientResponse } from './transientFailureClassifier';

export class ResiliencePipeline {
  private readonly circuitBreakerPolicy: CircuitBreakerPolicy;

  constructor(private readonly options: CredicarroResilienceOptions) {
    const minimumRps = Math.max(1, options.circuitBreakerMinimumThroughput / (options.circuitBreakerSamplingDurationMs / 1000));

    const breakerBasePolicy = handleWhen(isTransientNetworkFailure).orWhenResult((result) =>
      isTransientResponse(result as ApiResponse, options),
    );

    this.circuitBreakerPolicy = circuitBreaker(breakerBasePolicy, {
      halfOpenAfter: options.circuitBreakerBreakDurationMs,
      breaker: new SamplingBreaker({
        threshold: options.circuitBreakerFailureRatio,
        duration: options.circuitBreakerSamplingDurationMs,
        minimumRps,
      }),
    });
  }

  /**
   * @param retrySafe só quando `true` há nova tentativa (falha de rede ou resposta transitória).
   * @param attempt recebe o `AbortSignal` do orçamento total: ao estourar, a requisição em andamento é cancelada.
   * @param totalTimeoutMs orçamento total da chamada (padrão: `totalTimeoutMs` configurado).
   */
  async execute(
    retrySafe: boolean,
    attempt: (signal: AbortSignal) => Promise<ApiResponse>,
    totalTimeoutMs?: number,
  ): Promise<ApiResponse> {
    const budgetMs = totalTimeoutMs ?? this.options.totalTimeoutMs;
    const deadline = Date.now() + budgetMs;
    const retryPolicy = this.buildRetryPolicy(retrySafe, deadline);
    const totalTimeoutPolicy = timeout(budgetMs, TimeoutStrategy.Aggressive);
    const pipeline = wrap(totalTimeoutPolicy, retryPolicy, this.circuitBreakerPolicy);

    try {
      return await pipeline.execute(({ signal }) => attempt(signal));
    } catch (error) {
      if (isBrokenCircuitError(error))
        throw new CredicarroTimeoutError(
          'O circuit breaker está aberto — chamadas recentes falharam de forma consistente.',
          error,
        );

      if (isTaskCancelledError(error))
        throw new CredicarroTimeoutError('A requisição excedeu o tempo limite configurado.', error);

      if (isNetworkFailure(error))
        throw new CredicarroTimeoutError(
          error.isTimeout
            ? 'Falha de rede ou timeout: a tentativa excedeu o tempo limite configurado.'
            : error.isTransient
              ? 'Falha de rede ou timeout ao chamar a API do Credicarro.'
              : 'Falha de rede ou resposta recusada (acima do limite ou inválida) ao chamar a API do Credicarro.',
          new Error(error.code ?? 'NETWORK_FAILURE'),
        );

      throw error;
    }
  }

  private buildRetryPolicy(retrySafe: boolean, deadline: number) {
    const remainingMs = () => Math.max(0, deadline - Date.now());

    // `Retry-After` maior que o orçamento restante: não espera, devolve a resposta (vira `CredicarroRateLimitError`).
    const shouldRetry = (response: ApiResponse): boolean => {
      if (!retrySafe || !isTransientResponse(response, this.options)) return false;

      const retryAfter = retryAfterMs(response);
      return retryAfter === undefined || retryAfter <= remainingMs();
    };

    const basePolicy = handleWhen((error) => retrySafe && isTransientNetworkFailure(error)).orWhenResult((result) =>
      shouldRetry(result as ApiResponse),
    );

    const baseDelayMs = this.options.retryBaseDelayMs;

    const backoff = new DelegateBackoff<IRetryBackoffContext<ApiResponse | unknown>>((context) => {
      const { result } = context;

      let delay: number | undefined;
      if ('value' in result) delay = retryAfterMs(result.value as ApiResponse);

      if (delay === undefined) {
        const exponential = baseDelayMs * 2 ** Math.max(0, context.attempt - 1);
        const jitterFactor = 0.5 + Math.random();
        delay = Math.round(exponential * jitterFactor);
      }

      return Math.min(delay, remainingMs());
    });

    return retry(basePolicy, { maxAttempts: Math.max(0, this.options.maxRetryAttempts - 1), backoff });
  }
}
