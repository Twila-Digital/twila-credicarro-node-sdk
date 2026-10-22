import { describe, expect, it } from 'vitest';
import {
  CredicarroApiError,
  CredicarroAuthenticationError,
  CredicarroBusinessRuleError,
  CredicarroError,
  CredicarroRateLimitError,
  CredicarroValidationError,
} from '../../src';
import { exceptionFromResponse } from '../../src/errors/exceptionFactory';
import type { ApiResponse } from '../../src/internal/http/apiResponse';

function responseOf(statusCode: number, body: unknown, headers: Record<string, string> = {}): ApiResponse {
  return {
    statusCode,
    body,
    rawBody: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  };
}

describe('exceptionFromResponse', () => {
  it('maps 422 to CredicarroBusinessRuleError with the stable code', () => {
    const error = exceptionFromResponse(
      responseOf(422, {
        tipo: 'Store.Integration.Intermediation',
        titulo: 'Regra de negócio não atendida',
        status: 422,
        detalhe: 'A loja possui contrato de intermediação e não é elegível para a integração.',
      }),
    );

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    const apiError = error as CredicarroBusinessRuleError;
    expect(apiError.statusCode).toBe(422);
    expect(apiError.errorCode).toBe('Store.Integration.Intermediation');
    expect(apiError.title).toBe('Regra de negócio não atendida');
    expect(apiError.detail).toContain('intermediação');
    expect(apiError.field).toBeUndefined();
  });

  it('maps 400 to CredicarroValidationError with field and errors', () => {
    const error = exceptionFromResponse(
      responseOf(400, {
        tipo: 'Validation.InvalidFormat',
        titulo: 'Requisição inválida',
        status: 400,
        detalhe: 'JSON inválido',
        campo: 'valorVeiculo',
        erros: [{ codigo: 'Validation.InvalidFormat', mensagem: "O valor informado para 'valorVeiculo' não é um número válido.", campo: 'valorVeiculo' }],
      }),
    );

    expect(error).toBeInstanceOf(CredicarroValidationError);
    const validation = error as CredicarroValidationError;
    expect(validation.field).toBe('valorVeiculo');
    expect(validation.errors).toEqual([
      { code: 'Validation.InvalidFormat', message: "O valor informado para 'valorVeiculo' não é um número válido.", field: 'valorVeiculo' },
    ]);
  });

  it('maps 401 without a body to CredicarroAuthenticationError', () => {
    const error = exceptionFromResponse(responseOf(401, undefined));

    expect(error).toBeInstanceOf(CredicarroAuthenticationError);
    expect(error.message).toContain('401');
  });

  it('maps 429 to CredicarroRateLimitError with retryAfterMs (seconds)', () => {
    const error = exceptionFromResponse(responseOf(429, undefined, { 'retry-after': '30' }));

    expect(error).toBeInstanceOf(CredicarroRateLimitError);
    expect((error as CredicarroRateLimitError).retryAfterMs).toBe(30_000);
  });

  it('parses Retry-After given as an HTTP date', () => {
    const date = new Date(Date.now() + 60_000).toUTCString();
    const error = exceptionFromResponse(responseOf(429, undefined, { 'retry-after': date })) as CredicarroRateLimitError;

    expect(error.retryAfterMs).toBeGreaterThan(50_000);
    expect(error.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('falls back to type/title/detail (standard Problem Details used by 500/502)', () => {
    const error = exceptionFromResponse(
      responseOf(500, { type: 'https://tools.ietf.org/html/rfc9110#section-15.6.1', title: 'Erro inesperado', status: 500, detail: 'falha interna' }),
    ) as CredicarroApiError;

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('https://tools.ietf.org/html/rfc9110#section-15.6.1');
    expect(error.title).toBe('Erro inesperado');
    expect(error.detail).toBe('falha interna');
  });

  it('keeps the message free of detail and raw body (they may contain personal data)', () => {
    const error = exceptionFromResponse(
      responseOf(409, { tipo: 'Cpf.CpfAlreadyAdded', titulo: 'Conflito', status: 409, detalhe: 'CPF 12345678909 já cadastrado' }),
    ) as CredicarroApiError;

    expect(error.message).toBe('A API do Credicarro respondeu 409 (Cpf.CpfAlreadyAdded): Conflito.');
    expect(error.message).not.toContain('12345678909');
    expect(error.detail).toContain('12345678909');
    expect(error.rawBody).toContain('12345678909');
  });

  it('tolerates an empty or non-JSON body', () => {
    const error = exceptionFromResponse(responseOf(502, '<html>Bad Gateway</html>')) as CredicarroApiError;

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect(error.statusCode).toBe(502);
    expect(error.errorCode).toBeUndefined();
    expect(error.rawBody).toContain('Bad Gateway');
  });

  it('every error is a CredicarroError with its class name', () => {
    const error = exceptionFromResponse(responseOf(422, { tipo: 'X', titulo: 'Y' }));

    expect(error).toBeInstanceOf(CredicarroError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CredicarroBusinessRuleError');
  });
});
