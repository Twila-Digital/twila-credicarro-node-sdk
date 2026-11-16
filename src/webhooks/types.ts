import { enumFromWireValue } from '../internal/util/enumMapping';
import type { ProposalEventReason, ProposalStatus } from '../proposals/enums';
import type { ProposalParticipantState } from '../proposals/types';

export enum WebhookType {
  Customer = 1,
  Simulation = 2,
  Proposal = 3,
  Unknown = -1,
}

export function webhookTypeFromWireValue(value: number): WebhookType {
  return enumFromWireValue(WebhookType, value, WebhookType.Unknown);
}

export const WEBHOOK_TYPE_NAMES: Readonly<Record<string, WebhookType>> = {
  Customer: WebhookType.Customer,
  Simulation: WebhookType.Simulation,
  Proposal: WebhookType.Proposal,
};

export enum WebhookAuthenticationType {
  None = 1,
  Basic = 2,
  Jwt = 3,
  Unknown = -1,
}

export function webhookAuthenticationTypeFromWireValue(value: number): WebhookAuthenticationType {
  return enumFromWireValue(WebhookAuthenticationType, value, WebhookAuthenticationType.Unknown);
}

export const WEBHOOK_AUTHENTICATION_TYPE_NAMES: Readonly<Record<string, WebhookAuthenticationType>> = {
  None: WebhookAuthenticationType.None,
  Basic: WebhookAuthenticationType.Basic,
  Jwt: WebhookAuthenticationType.Jwt,
};

export enum WebhookStatus {
  Active = 1,
  Inactive = 2,
  Unknown = -1,
}

export function webhookStatusFromWireValue(value: number): WebhookStatus {
  return enumFromWireValue(WebhookStatus, value, WebhookStatus.Unknown);
}

export const WEBHOOK_STATUS_NAMES: Readonly<Record<string, WebhookStatus>> = {
  Active: WebhookStatus.Active,
  Inactive: WebhookStatus.Inactive,
};

export interface Webhook {
  id: string;
  type: WebhookType;
  url: string;
  authenticationType: WebhookAuthenticationType;
  status: WebhookStatus;
}

export interface CreateWebhookRequest {
  type: WebhookType;
  /** URL HTTPS pública (sem localhost, IP privado, usuário/senha ou fragmento), até 2048 caracteres. */
  url: string;
  authenticationType: WebhookAuthenticationType;
  /** Obrigatória para Basic (Base64 de `usuario:senha`) e Jwt (o token). */
  credential?: string;
}

export interface CreateWebhookResult {
  webhookId: string;
  /** Devolvido só nesta resposta: guarde-o para validar `X-CrediCarro-Signature`. */
  signingSecret: string;
}

export interface UpdateWebhookRequest {
  type: WebhookType;
  url: string;
  /** Quando omitido, o webhook mantém o status atual. */
  status?: WebhookStatus;
}

/** Filtros do histórico e do gráfico de envios. Datas sem horário (`'2026-11-05'`) valem pelo dia inteiro. */
export interface WebhookDeliveryFilter {
  /** Início do período (`data_inicial`). `Date` é enviado em UTC. */
  initialDate?: string | Date;
  /** Fim do período (`data_final`). */
  finalDate?: string | Date;
  proposalId?: string;
  simulationId?: string;
  /** Número da proposta, até 50 caracteres. */
  proposalNumber?: string;
  /** Status HTTP devolvido pela sua URL (100 a 599). */
  statusCode?: number;
}

/** Filtros e paginação do histórico de envios (`GET v1/webhook/audit`). */
export interface ListWebhookDeliveriesRequest extends WebhookDeliveryFilter {
  page?: number;
  pageSize?: number;
}

/** Filtros do gráfico de envios: o período é obrigatório e pode ter até 31 dias. */
export interface WebhookDeliveryChartRequest extends WebhookDeliveryFilter {
  initialDate: string | Date;
  finalDate: string | Date;
}

/** Um envio de webhook registrado no histórico. */
export interface WebhookDelivery {
  /** `id_auditoria`: use em `resend` para reenviar. */
  id: string;
  webhookId?: string;
  type: WebhookType;
  /** Corpo enviado, como texto JSON. */
  request: string;
  /** Corpo devolvido pela sua URL; vazio quando não houve resposta. */
  response: string;
  /** Status HTTP devolvido pela sua URL; `undefined` quando não houve resposta (ex.: timeout). */
  statusCode?: number;
  createdAt: string;
}

/** Contagem de envios em um intervalo do gráfico (horário de Brasília). */
export interface WebhookDeliveryChartPoint {
  /** Início do intervalo: `"10m"` (10 minutos), `"14h"` (hora) ou `"05"` (dia), conforme o período. */
  label: string;
  successCount: number;
  errorCount: number;
}

/** Resultado imediato do reenvio. */
export interface WebhookResendResult {
  /** Status HTTP devolvido pela sua URL; `undefined` quando ela não respondeu. */
  statusCode?: number;
  response: string;
}

/** Notificação de proposta (payload v1: só id e status; payload v2: retrato completo). */
export interface ProposalWebhookEvent {
  proposalId: string;
  status: ProposalStatus;
  statusRaw: number;
  statusName: string;
  eventReason?: ProposalEventReason;
  eventReasonRaw?: string;
  refusalReason?: string;
  eventDate?: string;
  buyer?: ProposalParticipantState;
  seller?: ProposalParticipantState;
  store?: ProposalParticipantState;
  /** `true` no payload v2 (retrato completo). */
  isDetailed: boolean;
}

export interface WebhookVerificationOptions {
  /** Tolerância do timestamp nos dois sentidos, em milissegundos. Padrão: 5 minutos. */
  toleranceMs?: number;
  /** Relógio de referência (epoch em milissegundos). Padrão: `Date.now()`. Útil em testes. */
  nowMs?: number;
}
