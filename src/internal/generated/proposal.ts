export interface CreateProposalRequestWire {
  cpf: string;
  simulacaoId: string;
}

export interface ProposalIdResponseWire {
  id_proposta: string;
}

export interface VehicleDetailRequestWire {
  renavam: string;
  chassi: string;
  placa: string;
  cor: string;
}

export interface DepositAccountRequestWire {
  cpfTitular: string;
  codigoBanco: string;
  agencia: string;
  digitoAgencia: string;
  conta: string;
  digitoConta: string;
  tipoConta: string;
}

export interface DocumentUploadRequestWire {
  participante: string;
  tipoDocumento: number;
  nomeArquivo: string;
  conteudoBase64: string;
}

export interface ProposalSummaryWire {
  id_proposta: string;
  numero: number;
  id_simulacao: string;
  tipo: string;
  status: string;
  comprador?: { cpf: string };
  vendedor?: { cpf: string } | null;
  data_criacao: string;
}

export interface ActiveStepWire {
  enum_etapa?: number;
  etapa?: string;
  enum_situacao?: number;
  situacao?: string;
  enum_responsavel_acao?: number;
  responsavel_acao?: string;
}

export interface CompletedStepWire {
  enum_etapa?: number;
  etapa?: string;
  data?: string;
}

export interface ProposalDocumentWire {
  enum_tipo?: number;
  tipo?: string;
  enum_status?: number;
  status?: string;
  motivo?: string | null;
}

export interface ProposalParticipantWire {
  /** Presente no comprador e no vendedor. */
  cpf?: string;
  /** Presente na loja. */
  cnpj?: string;
  enum_biometria?: number;
  biometria?: string;
  status_ativo?: ActiveStepWire | null;
  etapas_concluidas?: CompletedStepWire[] | null;
  documentos?: ProposalDocumentWire[] | null;
}

export interface ProposalDetailsWire {
  id_proposta: string;
  numero: number;
  id_simulacao: string;
  enum_status?: number;
  status?: string;
  tipo?: string;
  data_criacao: string;
  motivo_recusa?: string | null;
  link_biometria?: string | null;
  comprador?: ProposalParticipantWire | null;
  vendedor?: ProposalParticipantWire | null;
  loja?: ProposalParticipantWire | null;
}
