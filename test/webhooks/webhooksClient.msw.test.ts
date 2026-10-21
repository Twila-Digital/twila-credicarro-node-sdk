import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CredicarroBusinessRuleError,
  WebhookAuthenticationType,
  WebhookStatus,
  WebhookType,
  webhookAuthenticationTypeFromWireValue,
  webhookStatusFromWireValue,
  webhookTypeFromWireValue,
} from '../../src';
import { BASE_URL, PAGE, UUID, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('WebhooksClient (MSW)', () => {
  it('create posts tipo/url/tipo_autenticacao/credencial and returns id and signing secret', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v1/webhook`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id_webhook: UUID, segredo_assinatura: 'segredo-gerado' }, { status: 201 });
      }),
    );

    const result = await newClient().webhooks.create({
      type: WebhookType.Proposal,
      url: 'https://parceiro.com.br/webhooks/credicarro',
      authenticationType: WebhookAuthenticationType.Basic,
      credential: 'dXN1YXJpbzpzZW5oYQ==',
    });

    expect(result).toEqual({ webhookId: UUID, signingSecret: 'segredo-gerado' });
    expect(body).toEqual({
      tipo: 3,
      url: 'https://parceiro.com.br/webhooks/credicarro',
      tipo_autenticacao: 2,
      credencial: 'dXN1YXJpbzpzZW5oYQ==',
    });
  });

  it('create omits credencial when not provided', async () => {
    stubToken(server);
    let body: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE_URL}/v1/webhook`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ id_webhook: UUID, segredo_assinatura: 's' }, { status: 201 });
      }),
    );

    await newClient().webhooks.create({ type: WebhookType.Customer, url: 'https://parceiro.com.br/x', authenticationType: WebhookAuthenticationType.None });

    expect('credencial' in body).toBe(false);
  });

  it('create surfaces 422 Organization.Webhook.InvalidEndpoint', async () => {
    stubToken(server);

    server.use(http.post(`${BASE_URL}/v1/webhook`, () => problem(422, 'Organization.Webhook.InvalidEndpoint', 'Regra de negócio não atendida')));

    const error = await newClient()
      .webhooks.create({ type: WebhookType.Proposal, url: 'http://localhost', authenticationType: WebhookAuthenticationType.None })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((error as CredicarroBusinessRuleError).errorCode).toBe('Organization.Webhook.InvalidEndpoint');
  });

  it('list maps textual enums, paging and unknown values', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/webhook`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          itens: [
            { id_webhook: UUID, tipo: 'Proposal', url: 'https://parceiro.com.br/a', tipo_autenticacao: 'Basic', status: 'Active' },
            { id_webhook: UUID, tipo: 'Algo', url: 'https://parceiro.com.br/b', tipo_autenticacao: 'Jwt', status: 'Inactive' },
            { id_webhook: UUID, tipo: 'Customer', url: 'https://parceiro.com.br/c', tipo_autenticacao: 'Nova', status: 'Suspended' },
          ],
          pagina: PAGE,
        });
      }),
    );

    const page = await newClient().webhooks.list({ page: 2, pageSize: 20 });

    const search = new URL(url).searchParams;
    expect(search.get('pagina_inicial')).toBe('2');
    expect(search.get('limite')).toBe('20');
    expect(page.items.map((w) => [w.type, w.authenticationType, w.status])).toEqual([
      [WebhookType.Proposal, WebhookAuthenticationType.Basic, WebhookStatus.Active],
      [WebhookType.Unknown, WebhookAuthenticationType.Jwt, WebhookStatus.Inactive],
      [WebhookType.Customer, WebhookAuthenticationType.Unknown, WebhookStatus.Unknown],
    ]);
    expect(page.items[0]).toMatchObject({ id: UUID, url: 'https://parceiro.com.br/a' });
    expect(page.hasNext).toBe(true);
  });

  it('update sends tipo/url/status (204) and omits status when not provided', async () => {
    stubToken(server);
    const bodies: unknown[] = [];

    server.use(
      http.put(`${BASE_URL}/v1/webhook/${UUID}`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const client = newClient();
    await client.webhooks.update(UUID, { type: WebhookType.Proposal, url: 'https://parceiro.com.br/novo', status: WebhookStatus.Inactive });
    await client.webhooks.update(UUID, { type: WebhookType.Proposal, url: 'https://parceiro.com.br/novo' });

    expect(bodies).toEqual([
      { tipo: 3, url: 'https://parceiro.com.br/novo', status: 2 },
      { tipo: 3, url: 'https://parceiro.com.br/novo' },
    ]);
  });

  it('delete calls DELETE v1/webhook/{id} (204)', async () => {
    stubToken(server);
    let called = false;

    server.use(
      http.delete(`${BASE_URL}/v1/webhook/${UUID}`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await newClient().webhooks.delete(UUID);

    expect(called).toBe(true);
  });

  it('enums fall back to Unknown', () => {
    expect(webhookTypeFromWireValue(9)).toBe(WebhookType.Unknown);
    expect(webhookAuthenticationTypeFromWireValue(0)).toBe(WebhookAuthenticationType.Unknown);
    expect(webhookStatusFromWireValue(3)).toBe(WebhookStatus.Unknown);
    expect(webhookTypeFromWireValue(3)).toBe(WebhookType.Proposal);
  });
});
