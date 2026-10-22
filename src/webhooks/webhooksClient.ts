import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { buildListPath, pagedToPublic } from '../internal/http/pagination';
import type { PagedResultWire } from '../internal/generated/paged';
import type { CreateWebhookResponseWire, WebhookWire } from '../internal/generated/webhook';
import {
  createWebhookRequestToWire,
  createWebhookResultToPublic,
  updateWebhookRequestToWire,
  webhookToPublic,
} from '../internal/mapping/webhookMapper';
import type { ListRequest, PagedResult } from '../pagedResult';
import type { CreateWebhookRequest, CreateWebhookResult, UpdateWebhookRequest, Webhook } from './types';

export interface WebhooksClient {
  /**
   * Cadastra um webhook (`POST v1/webhook`). O `signingSecret` só vem nesta resposta: guarde-o.
   * Esta rota não aceita `Idempotency-Key`, por isso a requisição não é repetida automaticamente.
   */
  create(request: CreateWebhookRequest): Promise<CreateWebhookResult>;

  /** Lista os webhooks do parceiro, com paginação explícita (`GET v1/webhook`). */
  list(request?: ListRequest): Promise<PagedResult<Webhook>>;

  /** Atualiza tipo, URL e status (`PUT v1/webhook/{id}`, `204`). A autenticação não pode ser alterada. */
  update(webhookId: string, request: UpdateWebhookRequest): Promise<void>;

  /** Exclui o webhook (`DELETE v1/webhook/{id}`, `204`). */
  delete(webhookId: string): Promise<void>;
}

export class WebhooksClientImpl implements WebhooksClient {
  constructor(private readonly executor: ApiRequestExecutor) {}

  async create(request: CreateWebhookRequest): Promise<CreateWebhookResult> {
    const response = await this.executor.post('v1/webhook', createWebhookRequestToWire(request));
    ApiRequestExecutor.ensureSuccess(response);

    return createWebhookResultToPublic(response.body as CreateWebhookResponseWire);
  }

  async list(request?: ListRequest): Promise<PagedResult<Webhook>> {
    const response = await this.executor.get(buildListPath('v1/webhook', request));
    ApiRequestExecutor.ensureSuccess(response);

    return pagedToPublic(response.body as PagedResultWire<WebhookWire>, webhookToPublic);
  }

  async update(webhookId: string, request: UpdateWebhookRequest): Promise<void> {
    const response = await this.executor.put(`v1/webhook/${encodeURIComponent(webhookId)}`, updateWebhookRequestToWire(request));
    ApiRequestExecutor.ensureSuccess(response);
  }

  async delete(webhookId: string): Promise<void> {
    const response = await this.executor.delete(`v1/webhook/${encodeURIComponent(webhookId)}`);
    ApiRequestExecutor.ensureSuccess(response);
  }
}
