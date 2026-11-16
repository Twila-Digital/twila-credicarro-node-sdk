import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CredicarroApiError, CredicarroValidationError, WebhookType } from '../../src';
import { BASE_URL, PAGE, UUID, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const AUDIT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('WebhooksClient — histórico, gráfico e reenvio (MSW)', () => {
  it('listDeliveries sends filters and paging and maps each delivery', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/webhook/audit`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          itens: [
            {
              id_auditoria: AUDIT_ID,
              id_webhook: UUID,
              tipo: 'Proposal',
              requisicao: '{"id_proposta":"x"}',
              resposta: '{"recebido":true}',
              status_http: 200,
              data_criacao: '2026-11-05T14:32:10.123+00:00',
            },
            { id_auditoria: AUDIT_ID, id_webhook: null, tipo: 'Algo', requisicao: '{}', resposta: '', status_http: null, data_criacao: '2026-11-05T14:33:00Z' },
          ],
          pagina: PAGE,
        });
      }),
    );

    const page = await newClient().webhooks.listDeliveries({
      initialDate: '2026-11-01',
      finalDate: new Date('2026-11-05T23:59:59Z'),
      proposalId: UUID,
      proposalNumber: '12345',
      statusCode: 500,
      page: 2,
      pageSize: 50,
    });

    const search = new URL(url).searchParams;
    expect(Object.fromEntries(search)).toEqual({
      data_inicial: '2026-11-01',
      data_final: '2026-11-05T23:59:59.000Z',
      id_proposta: UUID,
      numero_proposta: '12345',
      status_http: '500',
      pagina_inicial: '2',
      limite: '50',
    });
    expect(page.items[0]).toEqual({
      id: AUDIT_ID,
      webhookId: UUID,
      type: WebhookType.Proposal,
      request: '{"id_proposta":"x"}',
      response: '{"recebido":true}',
      statusCode: 200,
      createdAt: '2026-11-05T14:32:10.123+00:00',
    });
    expect(page.items[1]).toMatchObject({ webhookId: undefined, type: WebhookType.Unknown, statusCode: undefined, response: '' });
    expect(page.totalCount).toBe(25);
  });

  it('listDeliveries without filters only sends the default paging', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/webhook/audit`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ itens: [], pagina: PAGE });
      }),
    );

    await newClient().webhooks.listDeliveries();

    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ pagina_inicial: '1', limite: '10' });
  });

  it('listDeliveries validates paging before calling the API', async () => {
    await expect(newClient().webhooks.listDeliveries({ pageSize: 101 })).rejects.toBeInstanceOf(RangeError);
  });

  it('getDeliveryChart sends the period and maps the points', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/webhook/audit/chart`, ({ request }) => {
        url = request.url;
        return HttpResponse.json([
          { rotulo: '04', sucessos: 42, erros: 0 },
          { rotulo: '05', sucessos: 38, erros: 3 },
        ]);
      }),
    );

    const points = await newClient().webhooks.getDeliveryChart({ initialDate: '2026-11-04', finalDate: '2026-11-05', statusCode: 200 });

    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ data_inicial: '2026-11-04', data_final: '2026-11-05', status_http: '200' });
    expect(points).toEqual([
      { label: '04', successCount: 42, errorCount: 0 },
      { label: '05', successCount: 38, errorCount: 3 },
    ]);
  });

  it('getDeliveryChart requires the period', async () => {
    await expect(
      newClient().webhooks.getDeliveryChart({ initialDate: '2026-11-04' } as never),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('getDeliveryChart surfaces 400 Organization.Webhook.Audit.DateRangeTooLarge', async () => {
    stubToken(server);

    server.use(http.get(`${BASE_URL}/v1/webhook/audit/chart`, () => problem(400, 'Organization.Webhook.Audit.DateRangeTooLarge', 'Requisição inválida')));

    const error = await newClient()
      .webhooks.getDeliveryChart({ initialDate: '2026-01-01', finalDate: '2026-03-01' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroValidationError);
    expect((error as CredicarroValidationError).errorCode).toBe('Organization.Webhook.Audit.DateRangeTooLarge');
  });

  it('resend posts without body and maps the immediate result', async () => {
    stubToken(server);
    let body = 'não lido';
    let idempotencyKey: string | null = 'não lido';

    server.use(
      http.post(`${BASE_URL}/v1/webhook/audit/${AUDIT_ID}/resend`, async ({ request }) => {
        body = await request.text();
        idempotencyKey = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ status_http: null, resposta: '' });
      }),
    );

    const result = await newClient().webhooks.resend(AUDIT_ID);

    expect(body).toBe('');
    expect(idempotencyKey).toBeNull();
    expect(result).toEqual({ statusCode: undefined, response: '' });
  });

  it('resend is not retried automatically on 503', async () => {
    stubToken(server);
    let calls = 0;

    server.use(
      http.post(`${BASE_URL}/v1/webhook/audit/${AUDIT_ID}/resend`, () => {
        calls += 1;
        return problem(503, 'Organization.Webhook.Resend.DependencyUnavailable', 'Serviço indisponível');
      }),
    );

    const error = await newClient().webhooks.resend(AUDIT_ID).catch((e: unknown) => e);

    expect(calls).toBe(1);
    expect(error).toBeInstanceOf(CredicarroApiError);
    expect((error as CredicarroApiError).errorCode).toBe('Organization.Webhook.Resend.DependencyUnavailable');
  });

  it('resend surfaces 404 Webhook.Audit.NotFound', async () => {
    stubToken(server);

    server.use(http.post(`${BASE_URL}/v1/webhook/audit/${AUDIT_ID}/resend`, () => problem(404, 'Webhook.Audit.NotFound', 'Recurso não encontrado')));

    const error = await newClient().webhooks.resend(AUDIT_ID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroApiError);
    expect((error as CredicarroApiError).errorCode).toBe('Webhook.Audit.NotFound');
  });
});
