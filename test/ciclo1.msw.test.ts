import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CredicarroApiError,
  CredicarroRateLimitError,
  CredicarroTimeoutError,
  DocumentFile,
  DocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  ProposalParticipant,
  parseWebhookEventUnverified,
} from '../src';
import { enumFromName } from '../src/internal/util/enumMapping';
import { BASE_URL, CLIENT_ID, CLIENT_SECRET, UUID, V2_PROPOSAL_WIRE, newClient, stubToken, tokenResponse } from './support';

const server = setupServer();
const directory = mkdtempSync(join(tmpdir(), 'credicarro-ciclo1-'));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  rmSync(directory, { recursive: true, force: true });
});

const proposalPath = `${BASE_URL}/v1/proposal/${UUID}`;
const summaryWire = {
  id_proposta: UUID,
  numero: 1,
  id_simulacao: UUID,
  tipo: 'Financing',
  status: 'Approved',
  comprador: { cpf: '123.456.789-01' },
  vendedor: { cpf: '987.654.321-00' },
  data_criacao: '2026-10-12T14:05:08.984-03:00',
};

describe('redirects are not followed', () => {
  it('a 3xx on an API call becomes CredicarroApiError and the Location is never requested', async () => {
    stubToken(server);
    let followed = 0;

    server.use(
      http.get(proposalPath, () => new HttpResponse(null, { status: 302, headers: { Location: 'http://localhost/outro-host/x' } })),
      http.get('http://localhost/outro-host/x', () => {
        followed += 1;
        return HttpResponse.json(summaryWire);
      }),
    );

    const error = await newClient().v1.proposals.get(UUID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect((error as CredicarroApiError).statusCode).toBe(302);
    expect(followed).toBe(0);
  });

  it('a 3xx on the token endpoint is not followed (credentials never leave the host)', async () => {
    let followed = 0;

    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => new HttpResponse(null, { status: 307, headers: { Location: 'http://localhost/capturar' } })),
      http.post('http://localhost/capturar', () => {
        followed += 1;
        return HttpResponse.json(tokenResponse());
      }),
    );

    const error = await newClient().v1.proposals.get(UUID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect(followed).toBe(0);
  });
});

describe('Retry-After', () => {
  it('a Retry-After larger than the remaining budget is not awaited: RateLimit with retryAfterMs right away', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(proposalPath, () => {
        attempts += 1;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '3600' } });
      }),
    );

    const started = Date.now();
    const error = await newClient().v1.proposals.get(UUID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroRateLimitError);
    expect((error as CredicarroRateLimitError).retryAfterMs).toBe(3_600_000);
    expect(attempts).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('an absurd Retry-After is capped to 24 h before conversion', async () => {
    stubToken(server);

    server.use(http.get(proposalPath, () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '999999999999' } })));

    const error = (await newClient().v1.proposals.get(UUID).catch((e: unknown) => e)) as CredicarroRateLimitError;

    expect(error.retryAfterMs).toBe(86_400_000);
  });

  it.each(['abc', '-5', '0', 'Wed, 21 Oct 2015 07:28:00 GMT'])('an invalid, non-positive or past Retry-After (%s) is ignored and normal backoff is used', async (value) => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(proposalPath, () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 429, headers: { 'Retry-After': value } }) : HttpResponse.json(summaryWire);
      }),
    );

    await newClient().v1.proposals.get(UUID);

    expect(attempts).toBe(2);
  });

  it('an HTTP-date Retry-After within the budget is honored as a delay', async () => {
    stubToken(server);
    let attempts = 0;
    const date = new Date(Date.now() + 1500).toUTCString();

    server.use(
      http.get(proposalPath, () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 429, headers: { 'Retry-After': date } }) : HttpResponse.json(summaryWire);
      }),
    );

    const started = Date.now();
    await newClient().v1.proposals.get(UUID);

    expect(attempts).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
  });
});

describe('errors do not leak personal data', () => {
  async function apiError(): Promise<CredicarroApiError> {
    stubToken(server);
    server.use(
      http.get(proposalPath, () =>
        HttpResponse.json({ tipo: 'Cpf.CpfAlreadyAdded', titulo: 'Conflito', status: 409, detalhe: 'CPF 12345678909 já cadastrado' }, { status: 409 }),
      ),
    );
    return (await newClient().v1.proposals.get(UUID).catch((e: unknown) => e)) as CredicarroApiError;
  }

  it('rawBody and problemDetails are not enumerable but remain accessible', async () => {
    const error = await apiError();

    expect(Object.keys(error)).not.toContain('rawBody');
    expect(Object.keys(error)).not.toContain('problemDetails');
    expect(error.rawBody).toContain('12345678909');
    expect(error.detail).toContain('12345678909');
  });

  it('JSON.stringify and util.inspect omit detail and body', async () => {
    const error = await apiError();

    for (const text of [JSON.stringify(error), inspect(error, { depth: null, showHidden: true }), String(error), `${error.message}`]) {
      expect(text).not.toContain('12345678909');
    }
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ statusCode: 409, errorCode: 'Cpf.CpfAlreadyAdded', title: 'Conflito' });
  });
});

describe('responses mask personal data in util.inspect only; JSON carries the real values', () => {
  it('ProposalSummary', async () => {
    stubToken(server);
    server.use(http.get(proposalPath, () => HttpResponse.json(summaryWire)));

    const proposal = await newClient().v1.proposals.get(UUID);

    expect(proposal.buyerCpf).toBe('123.456.789-01');
    const shown = inspect(proposal, { depth: null });
    expect(shown).toContain('***.456.789-**');
    expect(shown).not.toContain('123.456.789-01');
    expect(shown).not.toContain('987.654.321-00');

    const json = JSON.stringify(proposal);
    expect(json).toContain('123.456.789-01');
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify({ ...proposal })));
    expect(JSON.parse(json)).toMatchObject({ id: UUID, buyerCpf: '123.456.789-01', sellerCpf: '987.654.321-00' });
  });

  it('ProposalDetails participants and the webhook event: inspect masked, JSON real and round-trippable', () => {
    const event = parseWebhookEventUnverified(JSON.stringify({ ...V2_PROPOSAL_WIRE, motivo_evento: 'DOCUMENTOS_ALTERADOS', vendedor: null }));

    for (const shown of [inspect(event, { depth: null }), inspect(event.buyer, { depth: null })]) {
      expect(shown).not.toContain('12345678909');
      expect(shown).not.toContain('Documento ilegível');
    }
    expect(event.buyer?.document).toBe('12345678909');

    const roundTrip = JSON.parse(JSON.stringify(event)) as typeof event;
    expect(roundTrip.buyer?.document).toBe('12345678909');
    expect(roundTrip.buyer?.documents[0]?.reason).toBe('Documento ilegível');
    expect(roundTrip.store?.document).toBe('11222333000181');
    expect(roundTrip.proposalId).toBe(event.proposalId);
  });

  it('Simulation keeps real values in JSON', async () => {
    stubToken(server);
    server.use(
      http.get(`${BASE_URL}/v1/proposal/simulation/${UUID}`, () =>
        HttpResponse.json({ id_simulacao: UUID, prazo: 12, tipo: 'Financing', cliente: { cpf: '123.456.789-01' }, veiculo: { chassi: '9BWZZZ377VT004251', renavam: '12345678900' }, data_criacao: '2026-01-01T00:00:00Z' }),
      ),
    );

    const simulation = await newClient().simulations.get(UUID);

    expect(inspect(simulation, { depth: null })).not.toContain('9BWZZZ377VT004251');
    expect(JSON.parse(JSON.stringify(simulation))).toMatchObject({ customerCpf: '123.456.789-01', vehicle: { chassis: '9BWZZZ377VT004251', renavam: '12345678900' } });
  });

  it('DocumentFile and CreateWebhookResult: inspect hides content and secret, JSON keeps them', async () => {
    const file = DocumentFile.fromBytes(Buffer.from('conteudo-sensivel-do-documento'), 'cnh.pdf');
    const content = file.base64Content;

    expect(inspect(file)).not.toContain(content);
    expect(JSON.parse(JSON.stringify(file))).toEqual({ fileName: 'cnh.pdf', base64Content: content });

    stubToken(server);
    server.use(http.post(`${BASE_URL}/v1/webhook`, () => HttpResponse.json({ id_webhook: UUID, segredo_assinatura: 'segredo-super-secreto' }, { status: 201 })));
    const created = await newClient().webhooks.create({ type: 3, url: 'https://parceiro.com.br/x', authenticationType: 1 });

    expect(created.signingSecret).toBe('segredo-super-secreto');
    expect(inspect(created)).not.toContain('segredo-super-secreto');
    expect(JSON.parse(JSON.stringify(created))).toEqual({ webhookId: UUID, signingSecret: 'segredo-super-secreto' });
  });
});

describe('the client never exposes secrets or the cached token', () => {
  it('JSON.stringify and util.inspect(depth null, showHidden) after a request show neither token nor secret', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => HttpResponse.json(tokenResponse('token-em-cache-xyz'))),
      http.get(proposalPath, () => HttpResponse.json(summaryWire)),
    );
    const client = newClient();
    await client.v1.proposals.get(UUID);

    for (const text of [JSON.stringify(client), inspect(client, { depth: null, showHidden: true })]) {
      expect(text).not.toContain('token-em-cache-xyz');
      expect(text).not.toContain(CLIENT_SECRET);
      expect(text).not.toContain(CLIENT_ID + CLIENT_SECRET);
    }
  });
});

describe('explicit Idempotency-Key validation', () => {
  it.each([['   '], ['chave\ncom-quebra'], ['chave-com-acentuação-é'], ['\t'], ['x'.repeat(201)], ['']])('rejects %j before any request', async (key) => {
    let requests = 0;
    server.use(http.post(/.*/, () => { requests += 1; return HttpResponse.json({ id_cliente: UUID }); }));

    await expect(
      newClient().customers.upsert(
        {
          cpf: '12345678909', firstName: 'A', lastName: 'B', email: 'a@b.com', phoneNumber: '+55 (11) 99876-5432', dateOfBirth: '1990-05-20T00:00:00-03:00',
          address: { street: 'R', neighborhood: 'B', city: 'C', state: 'SP', postalCode: '01311000' },
          professionalData: { occupation: 3, monthlyIncome: 1 },
        },
        key,
      ),
    ).rejects.toBeInstanceOf(RangeError);
    expect(requests).toBe(0);
  });
});

describe('enum name lookup ignores inherited properties', () => {
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('%s maps to Unknown', (name) => {
    expect(enumFromName({ APROVADA: 2 }, name, -1)).toBe(-1);
  });
});

describe('time budget and limits', () => {
  it('the total timeout aborts the AbortSignal handed to the in-flight attempt and surfaces CredicarroTimeoutError', async () => {
    const { ResiliencePipeline } = await import('../src/internal/resilience/resiliencePipeline');
    const { resolveResilienceOptions } = await import('../src/config/resilienceOptions');
    const pipeline = new ResiliencePipeline(resolveResilienceOptions({ totalTimeoutMs: 100, attemptTimeoutMs: 100 }));
    let captured: AbortSignal | undefined;

    const error = await pipeline
      .execute(false, async (signal) => {
        captured = signal;
        await new Promise((resolve) => setTimeout(resolve, 600));
        return { statusCode: 200, body: undefined, rawBody: '', headers: {} };
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroTimeoutError);
    expect(captured?.aborted).toBe(true);
  });

  it('a slow response beyond the total timeout surfaces CredicarroTimeoutError through the client', async () => {
    stubToken(server);
    server.use(http.get(proposalPath, async () => { await delay(1000); return HttpResponse.json(summaryWire); }));

    const error = await newClient({ totalTimeoutMs: 150, attemptTimeoutMs: 150 }).v1.proposals.get(UUID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroTimeoutError);
  });

  it('the document upload budget is attempt x retries, not the (smaller) total timeout', async () => {
    stubToken(server);

    server.use(http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, async () => { await delay(300); return new HttpResponse(null, { status: 204 }); }));

    const client = newClient({ totalTimeoutMs: 100, attemptTimeoutMs: 100, documentUploadAttemptTimeoutMs: 1000, maxRetryAttempts: 3 });

    await expect(
      client.proposals.uploadDocument(UUID, {
        participant: ProposalParticipant.Buyer,
        documentType: DocumentType.Cnh,
        file: DocumentFile.fromBytes(Buffer.from('x'), 'a.pdf'),
      }),
    ).resolves.toBeUndefined();
  });

  it('a response above 10 MiB is refused without retry', async () => {
    stubToken(server);
    let attempts = 0;

    server.use(
      http.get(proposalPath, () => {
        attempts += 1;
        return new HttpResponse('x'.repeat(11 * 1024 * 1024), { headers: { 'Content-Type': 'text/plain' } });
      }),
    );

    await expect(newClient().v1.proposals.get(UUID)).rejects.toBeInstanceOf(CredicarroTimeoutError);
    expect(attempts).toBe(1);
  });

  it('a short token without expira_em lives max(half, life - 60 s)', async () => {
    const { AccessTokenProviderImpl } = await import('../src/internal/auth/accessTokenProvider');
    let now = 0;
    let calls = 0;
    const provider = new AccessTokenProviderImpl({ generate: async () => ({ token_de_acesso: `t${++calls}`, expira_em_segundos: 100 }) }, () => now);

    await provider.getToken();
    now = 49_000;
    await provider.getToken();
    expect(calls).toBe(1);
    now = 51_000;
    await provider.getToken();
    expect(calls).toBe(2);
  });
});

describe('DocumentFile.fromFile does not trust the reported size', () => {
  it('rejects a file above 10 MiB read in a loop and accepts exactly 10 MiB', async () => {
    const big = join(directory, 'grande.pdf');
    writeFileSync(big, Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES + 1));
    await expect(DocumentFile.fromFile(big)).rejects.toBeInstanceOf(RangeError);

    const exact = join(directory, 'exato.pdf');
    writeFileSync(exact, Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES));
    await expect(DocumentFile.fromFile(exact)).resolves.toMatchObject({ fileName: 'exato.pdf' });
  });
});

