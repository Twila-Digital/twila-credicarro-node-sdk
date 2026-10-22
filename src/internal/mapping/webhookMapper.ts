import type {
  CreateWebhookRequestWire,
  CreateWebhookResponseWire,
  ProposalWebhookEventWire,
  UpdateWebhookRequestWire,
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
} from '../../webhooks/types';
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
