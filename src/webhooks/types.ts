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
