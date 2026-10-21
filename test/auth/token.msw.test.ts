import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CredicarroApiError, CredicarroAuthenticationError, CredicarroTimeoutError } from '../../src';
import { BASE_URL, CLIENT_ID, CLIENT_SECRET, UUID, newClient, problem, tokenResponse } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const proposalPath = `${BASE_URL}/v1/proposal/${UUID}`;
const proposalBody = {
  id_proposta: UUID,
  numero: 1,
  id_simulacao: UUID,
  tipo: 'Financing',
  status: 'Approved',
  comprador: { cpf: '12345678909' },
  data_criacao: '2026-10-12T14:05:08.984-03:00',
};

describe('authentication (MSW)', () => {
  it('sends clientId and clientSecret to the token endpoint and reuses the cached token', async () => {
    let tokenCalls = 0;
    let tokenBody: unknown;
    const authorizations: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, async ({ request }) => {
        tokenCalls += 1;
        tokenBody = await request.json();
        return HttpResponse.json(tokenResponse('token-1'));
      }),
      http.get(proposalPath, ({ request }) => {
        authorizations.push(request.headers.get('Authorization'));
        return HttpResponse.json(proposalBody);
      }),
    );

    const client = newClient();
    await client.v1.proposals.get(UUID);
    await client.v1.proposals.get(UUID);

    expect(tokenBody).toEqual({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
    expect(tokenCalls).toBe(1);
    expect(authorizations).toEqual(['Bearer token-1', 'Bearer token-1']);
  });

  it('renews an expired token on the next call', async () => {
    let tokenCalls = 0;

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => {
        tokenCalls += 1;
        return HttpResponse.json({ ...tokenResponse(`token-${tokenCalls}`), expira_em: new Date(Date.now() - 1000).toISOString() });
      }),
      http.get(proposalPath, () => HttpResponse.json(proposalBody)),
    );

    const client = newClient();
    await client.v1.proposals.get(UUID);
    await client.v1.proposals.get(UUID);

    expect(tokenCalls).toBe(2);
  });

  it('refreshes the token once on 401 (without body) then succeeds', async () => {
    let tokenCalls = 0;
    const authorizations: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => {
        tokenCalls += 1;
        return HttpResponse.json(tokenResponse(`token-${tokenCalls}`));
      }),
      http.get(proposalPath, ({ request }) => {
        authorizations.push(request.headers.get('Authorization'));
        if (authorizations.length === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json(proposalBody);
      }),
    );

    const proposal = await newClient().v1.proposals.get(UUID);

    expect(proposal.id).toBe(UUID);
    expect(tokenCalls).toBe(2);
    expect(authorizations).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it('gives up with CredicarroAuthenticationError when 401 repeats after the refresh', async () => {
    let calls = 0;

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => HttpResponse.json(tokenResponse())),
      http.get(proposalPath, () => {
        calls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(newClient().v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroAuthenticationError);
    expect(calls).toBe(2);
  });

  it('maps 401 Integration.Authentication.InvalidCredentials to CredicarroAuthenticationError without leaking the secret', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () =>
        problem(401, 'Integration.Authentication.InvalidCredentials', 'Credenciais inválidas', `clientId ${CLIENT_ID} inválido`),
      ),
    );

    const error = await newClient()
      .v1.proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroAuthenticationError);
    const authError = error as CredicarroAuthenticationError;
    expect(authError.errorCode).toBe('Integration.Authentication.InvalidCredentials');
    expect(authError.message).toContain('Integration.Authentication.InvalidCredentials');
    expect(authError.message).not.toContain(CLIENT_SECRET);
    expect(authError.message).not.toContain(CLIENT_ID);
  });

  it('maps 400 on the token endpoint to CredicarroAuthenticationError', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () =>
        problem(400, 'Validation.Field.Required', 'Requisição inválida', 'clientId é obrigatório', 'clientId'),
      ),
    );

    const error = await newClient()
      .v1.proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroAuthenticationError);
    expect((error as CredicarroAuthenticationError).errorCode).toBe('Validation.Field.Required');
  });

  it('retries the token request on a transient failure', async () => {
    let tokenCalls = 0;

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => {
        tokenCalls += 1;
        if (tokenCalls === 1) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(tokenResponse());
      }),
      http.get(proposalPath, () => HttpResponse.json(proposalBody)),
    );

    await newClient().v1.proposals.get(UUID);

    expect(tokenCalls).toBe(2);
  });

  it('surfaces a network failure as CredicarroTimeoutError whose cause carries no request data', async () => {
    server.use(http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => HttpResponse.error()));

    const error = await newClient({ maxRetryAttempts: 1 })
      .v1.proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroTimeoutError);
    expect(JSON.stringify(error)).not.toContain(CLIENT_SECRET);
    expect(String((error as CredicarroTimeoutError).cause)).not.toContain(CLIENT_SECRET);
  });

  it('keeps non-auth failures of the token endpoint as CredicarroApiError', async () => {
    server.use(http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => new HttpResponse(null, { status: 403 })));

    await expect(newClient().v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroApiError);
  });

  it.each([302, 500, 503])('maps status %i of the token endpoint to CredicarroApiError (not Authentication)', async (status) => {
    server.use(http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => new HttpResponse(null, { status, headers: { Location: 'http://localhost/x' } })));

    const error = await newClient({ maxRetryAttempts: 2 })
      .v1.proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect(error).not.toBeInstanceOf(CredicarroAuthenticationError);
    expect((error as CredicarroApiError).statusCode).toBe(status);
  });
});
