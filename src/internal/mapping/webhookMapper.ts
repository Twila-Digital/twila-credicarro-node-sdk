import type {
  CreateWebhookRequestWire,
  CreateWebhookResponseWire,
  ProposalWebhookEventWire,
  UpdateWebhookRequestWire,
  WebhookDeliveryChartPointWire,
  WebhookDeliveryWire,
  WebhookResendResponseWire,
  WebhookWire,
} from '../generated/webhook';
import {
  PROPOSAL_EVENT_REASON_NAMES,
  PROPOSAL_STATUS_NAMES,
  ProposalEventReason,
  ProposalStatus,
} from '../../proposals/enums';
import {
  WEBHOOK_AUTHENTICATION_TYPE_NAMES,
  WEBHOOK_STATUS_NAMES,
  WEBHOOK_TYPE_NAMES,
  WebhookAuthenticationType,
  WebhookStatus,
  WebhookType,
  type CreateWebhookRequest,
  type CreateWebhookResult,
  type ProposalWebhookEvent,
  type UpdateWebhookRequest,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryChartPoint,
  type WebhookDeliveryFilter,
  type WebhookResendResult,
} from '../../webhooks/types';
import { QueryStringBuilder } from '../http/queryString';
import { toIsoString } from '../util/date';
import { enumFromName, resolveEnum } from '../util/enumMapping';
import { protectPii } from '../util/pii';
import { participantToPublic } from './proposalMapper';

export function createWebhookRequestToWire(request: CreateWebhookRequest): CreateWebhookRequestWire {
  return {
    tipo: request.type,
    url: request.url,
    tipo_autenticacao: request.authenticationType,
    credencial: request.credential,
  };
}

export function updateWebhookRequestToWire(request: UpdateWebhookRequest): UpdateWebhookRequestWire {
  return { tipo: request.type, url: request.url, status: request.status };
}

export function createWebhookResultToPublic(wire: CreateWebhookResponseWire): CreateWebhookResult {
  return protectPii({ webhookId: wire.id_webhook, signingSecret: wire.segredo_assinatura });
}

/** Na listagem, `tipo`, `tipo_autenticacao` e `status` chegam como texto (ex.: `Proposal`, `Basic`, `Active`). */
export function webhookToPublic(wire: WebhookWire): Webhook {
  return {
    id: wire.id_webhook,
    type: enumFromName(WEBHOOK_TYPE_NAMES, wire.tipo, WebhookType.Unknown),
    url: wire.url,
    authenticationType: enumFromName(WEBHOOK_AUTHENTICATION_TYPE_NAMES, wire.tipo_autenticacao, WebhookAuthenticationType.Unknown),
    status: enumFromName(WEBHOOK_STATUS_NAMES, wire.status, WebhookStatus.Unknown),
  };
}

/** Acrescenta os filtros do histórico/gráfico (`data_inicial`, `data_final`, `id_proposta`...) à query. */
export function addWebhookDeliveryFilter(query: QueryStringBuilder, filter: WebhookDeliveryFilter | undefined): QueryStringBuilder {
  return query
    .add('data_inicial', filter?.initialDate !== undefined ? toIsoString(filter.initialDate) : undefined)
    .add('data_final', filter?.finalDate !== undefined ? toIsoString(filter.finalDate) : undefined)
    .add('id_proposta', filter?.proposalId)
    .add('id_simulacao', filter?.simulationId)
    .add('numero_proposta', filter?.proposalNumber)
    .add('status_http', filter?.statusCode);
}

export function webhookDeliveryToPublic(wire: WebhookDeliveryWire): WebhookDelivery {
  return protectPii({
    id: wire.id_auditoria,
    webhookId: wire.id_webhook ?? undefined,
    type: enumFromName(WEBHOOK_TYPE_NAMES, wire.tipo, WebhookType.Unknown),
    request: wire.requisicao,
    response: wire.resposta ?? '',
    statusCode: wire.status_http ?? undefined,
    createdAt: wire.data_criacao,
  });
}

export function webhookDeliveryChartPointToPublic(wire: WebhookDeliveryChartPointWire): WebhookDeliveryChartPoint {
  return { label: wire.rotulo, successCount: wire.sucessos, errorCount: wire.erros };
}

export function webhookResendResultToPublic(wire: WebhookResendResponseWire): WebhookResendResult {
  return protectPii({ statusCode: wire.status_http ?? undefined, response: wire.resposta ?? '' });
}

/** Aceita o payload v2 (nomes em português, retrato completo) e o v1 (nomes em inglês, só id e status). */
export function proposalWebhookEventToPublic(wire: ProposalWebhookEventWire): ProposalWebhookEvent {
  const status = resolveEnum(ProposalStatus, PROPOSAL_STATUS_NAMES, ProposalStatus.Unknown, wire.enum_status, wire.status);
  const reasonName = typeof wire.motivo_evento === 'string' && wire.motivo_evento.length > 0 ? wire.motivo_evento : undefined;

  return protectPii({
    proposalId: wire.id_proposta,
    status: status.value,
    statusRaw: status.raw,
    statusName: status.name,
    eventReason: reasonName ? enumFromName(PROPOSAL_EVENT_REASON_NAMES, reasonName, ProposalEventReason.Unknown) : undefined,
    eventReasonRaw: reasonName,
    refusalReason: wire.motivo_recusa ?? undefined,
    eventDate: wire.data_evento ?? undefined,
    buyer: wire.comprador ? participantToPublic(wire.comprador, wire.comprador.cpf) : undefined,
    seller: wire.vendedor ? participantToPublic(wire.vendedor, wire.vendedor.cpf) : undefined,
    store: wire.loja ? participantToPublic(wire.loja, wire.loja.cnpj, false) : undefined,
    isDetailed: isDetailedPayload(wire),
  });
}

function isDetailedPayload(wire: ProposalWebhookEventWire): boolean {
  return (
    wire.motivo_evento !== undefined ||
    wire.data_evento !== undefined ||
    wire.comprador !== undefined ||
    wire.loja !== undefined ||
    wire.vendedor !== undefined
  );
}
