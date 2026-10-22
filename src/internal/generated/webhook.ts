import type { ProposalParticipantWire } from './proposal';

export interface CreateWebhookRequestWire {
  tipo: number;
  url: string;
  tipo_autenticacao: number;
  credencial?: string;
}

export interface CreateWebhookResponseWire {
  id_webhook: string;
  segredo_assinatura: string;
}

export interface UpdateWebhookRequestWire {
  tipo: number;
  url: string;
  status?: number;
}

export interface WebhookWire {
  id_webhook: string;
  tipo: string;
  url: string;
  tipo_autenticacao: string;
  status: string;
}

/** Payload enviado ao endpoint do integrador. O v1 só traz os três primeiros campos. */
export interface ProposalWebhookEventWire {
  id_proposta: string;
  enum_status?: number;
  status?: string;
  motivo_evento?: string | null;
  motivo_recusa?: string | null;
  data_evento?: string | null;
  comprador?: ProposalParticipantWire | null;
  vendedor?: ProposalParticipantWire | null;
  loja?: ProposalParticipantWire | null;
}
