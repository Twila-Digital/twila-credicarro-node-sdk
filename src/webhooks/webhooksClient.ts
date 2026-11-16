import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { addPaging, buildListPath, pagedToPublic } from '../internal/http/pagination';
import { QueryStringBuilder } from '../internal/http/queryString';
import type { PagedResultWire } from '../internal/generated/paged';
import type {
  CreateWebhookResponseWire,
  WebhookDeliveryChartPointWire,
  WebhookDeliveryWire,
  WebhookResendResponseWire,
  WebhookWire,
} from '../internal/generated/webhook';
import {
  addWebhookDeliveryFilter,
  createWebhookRequestToWire,
  createWebhookResultToPublic,
  updateWebhookRequestToWire,
  webhookDeliveryChartPointToPublic,
  webhookDeliveryToPublic,
  webhookResendResultToPublic,
  webhookToPublic,
} from '../internal/mapping/webhookMapper';
import type { ListRequest, PagedResult } from '../pagedResult';
import type {
  CreateWebhookRequest,
  CreateWebhookResult,
  ListWebhookDeliveriesRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryChartPoint,
  WebhookDeliveryChartRequest,
  WebhookResendResult,
} from './types';

/** O reenvio espera a resposta da URL do integrador (até 15 s do lado da Credicarro). */
const RESEND_ATTEMPT_TIMEOUT_MS = 30_000;

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

  /**
   * Histórico de envios, com o corpo enviado, a resposta da sua URL e o status HTTP (`GET v1/webhook/audit`).
   * Todos os filtros são opcionais; paginação explícita como em `list`.
   */
  listDeliveries(request?: ListWebhookDeliveriesRequest): Promise<PagedResult<WebhookDelivery>>;

  /**
   * Sucessos e erros por intervalo, no horário de Brasília (`GET v1/webhook/audit/chart`).
   * O período é obrigatório e pode ter até 31 dias.
   */
  getDeliveryChart(request: WebhookDeliveryChartRequest): Promise<WebhookDeliveryChartPoint[]>;

  /**
   * Reenvia um envio do histórico (`POST v1/webhook/audit/{id}/resend`). Uma única tentativa, sem retentativa
   * automática; chega à sua URL com uma `Idempotency-Key` nova (`{id_mensagem}:{id_webhook}:{id_tentativa}`).
   */
  resend(deliveryId: string): Promise<WebhookResendResult>;
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

  async listDeliveries(request?: ListWebhookDeliveriesRequest): Promise<PagedResult<WebhookDelivery>> {
    const path = addPaging(addWebhookDeliveryFilter(new QueryStringBuilder(), request), request).build('v1/webhook/audit');
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return pagedToPublic(response.body as PagedResultWire<WebhookDeliveryWire>, webhookDeliveryToPublic);
  }

  async getDeliveryChart(request: WebhookDeliveryChartRequest): Promise<WebhookDeliveryChartPoint[]> {
    if (request?.initialDate === undefined || request?.finalDate === undefined)
      throw new RangeError('initialDate e finalDate são obrigatórios no gráfico de envios.');

    const path = addWebhookDeliveryFilter(new QueryStringBuilder(), request).build('v1/webhook/audit/chart');
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return ((response.body as WebhookDeliveryChartPointWire[]) ?? []).map(webhookDeliveryChartPointToPublic);
  }

  async resend(deliveryId: string): Promise<WebhookResendResult> {
    const response = await this.executor.post(`v1/webhook/audit/${encodeURIComponent(deliveryId)}/resend`, undefined, {
      attemptTimeoutMs: RESEND_ATTEMPT_TIMEOUT_MS,
    });
    ApiRequestExecutor.ensureSuccess(response);

    return webhookResendResultToPublic(response.body as WebhookResendResponseWire);
  }
}
