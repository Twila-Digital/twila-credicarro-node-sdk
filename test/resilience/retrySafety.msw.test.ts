import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CredicarroApiError,
  CredicarroRateLimitError,
  CredicarroTimeoutError,
  DocumentFile,
  DocumentType,
  OccupationType,
  ProposalParticipant,
  WebhookAuthenticationType,
  WebhookType,
  type UpsertCustomerRequest,
} from '../../src';
import { BASE_URL, UUID, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const customer: UpsertCustomerRequest = {
  cpf: '12345678909',
  firstName: 'Maria',
  lastName: 'Souza',
  email: 'maria.souza@exemplo.com.br',
  phoneNumber: '+55 (11) 99876-5432',
  dateOfBirth: '1990-05-20T00:00:00-03:00',
  address: { street: 'Av. Paulista', number: '1578', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', postalCode: '01311000' },
  professionalData: { occupation: OccupationType.Employee, monthlyIncome: 6500 },
};

const pdf = () => DocumentFile.fromBytes(Buffer.from('%PDF-1.7 teste'), 'cnh-comprador.pdf');

describe('retry safety and idempotency keys (MSW)', () => {
  it('POST v1/customer/unified without a key is NOT retried and gets no automatic key', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/customer/unified`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(newClient().customers.upsert(customer)).rejects.toBeInstanceOf(CredicarroApiError);

    expect(keys).toEqual([null]);
  });

  it('POST v1/customer/unified with an explicit key is retried with that same key', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/customer/unified`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ id_cliente: UUID });
      }),
    );

    const id = await newClient().customers.upsert(customer, 'minha-chave-explicita');

    expect(id).toBe(UUID);
    expect(keys).toEqual(['minha-chave-explicita', 'minha-chave-explicita']);
  });

  it('rejects an invalid explicit idempotency key before sending anything', async () => {
    stubToken(server);

    await expect(newClient().customers.upsert(customer, 'x'.repeat(201))).rejects.toBeInstanceOf(RangeError);
    await expect(newClient().customers.upsert(customer, '')).rejects.toBeInstanceOf(RangeError);
  });

  it('POST v1/customer sends the same automatic key on every attempt', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/customer`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length < 3) return new HttpResponse(null, { status: 502 });
        return HttpResponse.json({ id_cliente: UUID });
      }),
    );

    await newClient().customers.create(customer);

    expect(keys).toHaveLength(3);
    expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1);
  });

  it('uses a different automatic key for each logical call', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v2/proposal`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json({ id_proposta: UUID }, { status: 201 });
      }),
    );

    const client = newClient();
    await client.proposals.create({ cpf: '12345678909', simulationId: UUID });
    await client.proposals.create({ cpf: '12345678909', simulationId: UUID });

    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('does not send an automatic key when disableAutomaticIdempotencyKey is set (and then does not retry)', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v2/proposal`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(
      newClient({ disableAutomaticIdempotencyKey: true }).proposals.create({ cpf: '12345678909', simulationId: UUID }),
    ).rejects.toBeInstanceOf(CredicarroApiError);

    expect(keys).toEqual([null]);
  });

  it('document upload reuses the same key across attempts (generated when not provided)', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return problem(502, 'Document.UploadFailed', 'Falha ao armazenar');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await newClient().proposals.uploadDocument(UUID, {
      participant: ProposalParticipant.Buyer,
      documentType: DocumentType.Cnh,
      file: pdf(),
    });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it('document upload uses the explicit key on every attempt and generates one even when automatic keys are disabled', async () => {
    stubToken(server);
    const keys: (string | null)[] = [];

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return new HttpResponse(null, { status: 503 });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const client = newClient({ disableAutomaticIdempotencyKey: true });
    const upload = { participant: ProposalParticipant.Store, documentType: DocumentType.EcvReport, file: pdf() };

    await client.proposals.uploadDocument(UUID, upload, 'envio-123-ecv');
    expect(keys).toEqual(['envio-123-ecv', 'envio-123-ecv']);

    keys.length = 0;
    await client.proposals.uploadDocument(UUID, upload);
    expect(keys[0]).toBeTruthy();
  });

  it('POST v1/webhook is NOT retried', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/webhook`, () => {
        attempts += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(
      newClient().webhooks.create({
        type: WebhookType.Proposal,
        url: 'https://parceiro.com.br/webhooks/credicarro',
        authenticationType: WebhookAuthenticationType.None,
      }),
    ).rejects.toBeInstanceOf(CredicarroApiError);

    expect(attempts).toBe(1);
  });

  it('a network failure on a non-retry-safe POST is not retried', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/webhook`, () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );

    await expect(
      newClient().webhooks.create({
        type: WebhookType.Proposal,
        url: 'https://parceiro.com.br/webhooks/credicarro',
        authenticationType: WebhookAuthenticationType.None,
      }),
    ).rejects.toBeInstanceOf(CredicarroTimeoutError);

    expect(attempts).toBe(1);
  });

  it('a network failure on a GET is retried', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.error();
        return HttpResponse.json({ id_proposta: UUID, numero: 1, id_simulacao: UUID, tipo: 'Financing', status: 'Approved', data_criacao: '2026-01-01T00:00:00Z' });
      }),
    );

    const proposal = await newClient().v1.proposals.get(UUID);

    expect(proposal.id).toBe(UUID);
    expect(attempts).toBe(2);
  });

  it('vehicle-detail and deposit-account (replacement semantics) are retried', async () => {
    stubToken(server);
    const attempts = { vehicle: 0, account: 0 };

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/vehicle-detail`, ({ request }) => {
        attempts.vehicle += 1;
        expect(request.headers.get('Idempotency-Key')).toBeNull();
        return attempts.vehicle === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 });
      }),
      http.post(`${BASE_URL}/v2/proposal/${UUID}/deposit-account`, () => {
        attempts.account += 1;
        return attempts.account === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 });
      }),
    );

    const client = newClient();
    await client.proposals.sendVehicleDetails(UUID, { renavam: '12345678900', chassis: '9BWZZZ377VT004251', licensePlate: 'ABC1D23', color: 'PRATA' });
    await client.proposals.sendDepositAccount(UUID, {
      holderCpf: '12345678909',
      bankCode: '001',
      branch: '1234',
      branchDigit: '5',
      accountNumber: '123456',
      accountDigit: '7',
      accountType: 1,
    });

    expect(attempts).toEqual({ vehicle: 2, account: 2 });
  });

  it('PUT and DELETE on a webhook are retried', async () => {
    stubToken(server);
    const attempts = { put: 0, del: 0 };

    server.use(
      http.put(`${BASE_URL}/v1/webhook/${UUID}`, () => {
        attempts.put += 1;
        return attempts.put === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${BASE_URL}/v1/webhook/${UUID}`, () => {
        attempts.del += 1;
        return attempts.del === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 });
      }),
    );

    const client = newClient();
    await client.webhooks.update(UUID, { type: WebhookType.Proposal, url: 'https://parceiro.com.br/webhooks/credicarro' });
    await client.webhooks.delete(UUID);

    expect(attempts).toEqual({ put: 2, del: 2 });
  });

  it('retries 500 by default (retryOn500 = true) and stops retrying when it is disabled', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () => {
        attempts += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(newClient().v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroApiError);
    expect(attempts).toBe(3);

    attempts = 0;
    await expect(newClient({ retryOn500: false }).v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroApiError);
    expect(attempts).toBe(1);
  });

  it('never retries other 4xx responses', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () => {
        attempts += 1;
        return problem(404, 'Proposal.Access.NotFound', 'Não encontrado');
      }),
    );

    await expect(newClient().v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroApiError);
    expect(attempts).toBe(1);
  });

  it('retries 408 and 429 (respecting Retry-After) and exposes retryAfterMs when giving up', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () => {
        attempts += 1;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0' } });
      }),
    );

    const error = await newClient({ maxRetryAttempts: 2 })
      .v1.proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(attempts).toBe(2);
    expect(error).toBeInstanceOf(CredicarroRateLimitError);
    expect((error as CredicarroRateLimitError).retryAfterMs).toBeUndefined(); // Retry-After: 0 é ignorado

    attempts = 0;
    server.use(
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () => {
        attempts += 1;
        if (attempts === 1) return new HttpResponse(null, { status: 408 });
        return HttpResponse.json({ id_proposta: UUID, numero: 1, id_simulacao: UUID, tipo: 'Financing', status: 'Approved', data_criacao: '2026-01-01T00:00:00Z' });
      }),
    );
    await newClient().v1.proposals.get(UUID);
    expect(attempts).toBe(2);
  });
});
