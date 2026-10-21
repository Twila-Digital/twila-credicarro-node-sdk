import { enumFromWireValue } from '../internal/util/enumMapping';

// Todos os enums têm o fallback `Unknown = -1`, e os tipos públicos guardam também o valor bruto recebido.

export enum ProposalStatus {
  Analysing = 1,
  Approved = 2,
  Refused = 3,
  Canceled = 4,
  ManualAnalysis = 5,
  Completed = 6,
  InNegotiation = 7,
  Expired = 8,
  Pending = 9,
  Unknown = -1,
}

export function proposalStatusFromWireValue(value: number): ProposalStatus {
  return enumFromWireValue(ProposalStatus, value, ProposalStatus.Unknown);
}

/** Nomes em português (consulta v2 e webhook v2) e em inglês (consulta v1 e webhook v1). */
export const PROPOSAL_STATUS_NAMES: Readonly<Record<string, ProposalStatus>> = {
  EM_ANALISE: ProposalStatus.Analysing,
  APROVADA: ProposalStatus.Approved,
  RECUSADA: ProposalStatus.Refused,
  CANCELADA: ProposalStatus.Canceled,
  ANALISE_MANUAL: ProposalStatus.ManualAnalysis,
  FINALIZADA: ProposalStatus.Completed,
  EM_NEGOCIACAO: ProposalStatus.InNegotiation,
  EXPIRADA: ProposalStatus.Expired,
  PENDENTE: ProposalStatus.Pending,
  Analysing: ProposalStatus.Analysing,
  Approved: ProposalStatus.Approved,
  Refused: ProposalStatus.Refused,
  Canceled: ProposalStatus.Canceled,
  ManualAnalysis: ProposalStatus.ManualAnalysis,
  Completed: ProposalStatus.Completed,
  InNegotiation: ProposalStatus.InNegotiation,
  Expired: ProposalStatus.Expired,
  Pending: ProposalStatus.Pending,
};

export enum ProposalType {
  Financing = 1,
  Refinancing = 2,
  Unknown = -1,
}

export function proposalTypeFromWireValue(value: number): ProposalType {
  return enumFromWireValue(ProposalType, value, ProposalType.Unknown);
}

export const PROPOSAL_TYPE_NAMES: Readonly<Record<string, ProposalType>> = {
  Financing: ProposalType.Financing,
  Refinancing: ProposalType.Refinancing,
};

export enum ProposalStep {
  Undefined = 0,
  ProposalCreated = 1,
  ProposalApproved = 2,
  SellerNotification = 3,
  BiometryAnalysis = 4,
  DepositAccount = 5,
  DocumentSubmission = 6,
  DocumentCorrection = 7,
  VehicleDetails = 8,
  Inspection = 9,
  Signature = 10,
  Payment = 11,
  ProposalCompleted = 12,
  Unknown = -1,
}

export function proposalStepFromWireValue(value: number): ProposalStep {
  return enumFromWireValue(ProposalStep, value, ProposalStep.Unknown);
}

export const PROPOSAL_STEP_NAMES: Readonly<Record<string, ProposalStep>> = {
  INDEFINIDO: ProposalStep.Undefined,
  PROPOSTA_CRIADA: ProposalStep.ProposalCreated,
  PROPOSTA_APROVADA: ProposalStep.ProposalApproved,
  NOTIFICACAO_VENDEDOR: ProposalStep.SellerNotification,
  ANALISE_BIOMETRIA: ProposalStep.BiometryAnalysis,
  CONTA_RECEBIMENTO: ProposalStep.DepositAccount,
  ENVIO_DOCUMENTOS: ProposalStep.DocumentSubmission,
  CORRECAO_DOCUMENTOS: ProposalStep.DocumentCorrection,
  DADOS_VEICULO: ProposalStep.VehicleDetails,
  VISTORIA: ProposalStep.Inspection,
  ASSINATURA: ProposalStep.Signature,
  PAGAMENTO: ProposalStep.Payment,
  PROPOSTA_FINALIZADA: ProposalStep.ProposalCompleted,
};

export enum StepSituation {
  AwaitingSubmission = 1,
  AwaitingCustomer = 2,
  Processing = 3,
  PendingCorrection = 4,
  Blocked = 5,
  Completed = 6,
  Canceled = 7,
  Unknown = -1,
}

export function stepSituationFromWireValue(value: number): StepSituation {
  return enumFromWireValue(StepSituation, value, StepSituation.Unknown);
}

export const STEP_SITUATION_NAMES: Readonly<Record<string, StepSituation>> = {
  AGUARDANDO_ENVIO: StepSituation.AwaitingSubmission,
  AGUARDANDO_CLIENTE: StepSituation.AwaitingCustomer,
  EM_PROCESSAMENTO: StepSituation.Processing,
  PENDENTE_CORRECAO: StepSituation.PendingCorrection,
  BLOQUEADA: StepSituation.Blocked,
  CONCLUIDA: StepSituation.Completed,
  CANCELADA: StepSituation.Canceled,
};

export enum ActionOwner {
  None = 0,
  Customer = 1,
  Integrator = 2,
  Credicarro = 3,
  Unknown = -1,
}

export function actionOwnerFromWireValue(value: number): ActionOwner {
  return enumFromWireValue(ActionOwner, value, ActionOwner.Unknown);
}

export const ACTION_OWNER_NAMES: Readonly<Record<string, ActionOwner>> = {
  NENHUM: ActionOwner.None,
  CLIENTE: ActionOwner.Customer,
  INTEGRADOR: ActionOwner.Integrator,
  CREDICARRO: ActionOwner.Credicarro,
};

export enum BiometryStatus {
  NotStarted = 0,
  SessionCreated = 1,
  InAnalysis = 2,
  Approved = 3,
  Rejected = 4,
  Unknown = -1,
}

export function biometryStatusFromWireValue(value: number): BiometryStatus {
  return enumFromWireValue(BiometryStatus, value, BiometryStatus.Unknown);
}

export const BIOMETRY_STATUS_NAMES: Readonly<Record<string, BiometryStatus>> = {
  NAO_INICIADA: BiometryStatus.NotStarted,
  SESSAO_CRIADA: BiometryStatus.SessionCreated,
  EM_ANALISE: BiometryStatus.InAnalysis,
  APROVADA: BiometryStatus.Approved,
  REPROVADA: BiometryStatus.Rejected,
};

export enum DocumentStatus {
  Received = 0,
  Valid = 1,
  Invalid = 2,
  InAnalysis = 3,
  Deleted = 4,
  Pending = 5,
  Unknown = -1,
}

export function documentStatusFromWireValue(value: number): DocumentStatus {
  return enumFromWireValue(DocumentStatus, value, DocumentStatus.Unknown);
}

export const DOCUMENT_STATUS_NAMES: Readonly<Record<string, DocumentStatus>> = {
  RECEBIDO: DocumentStatus.Received,
  VALIDO: DocumentStatus.Valid,
  INVALIDO: DocumentStatus.Invalid,
  EM_ANALISE: DocumentStatus.InAnalysis,
  EXCLUIDO: DocumentStatus.Deleted,
  PENDENTE: DocumentStatus.Pending,
};

export enum DocumentType {
  Cnh = 1,
  Cpf = 2,
  Rg = 3,
  ProofOfIncome = 4,
  ProofOfAddress = 5,
  VehicleDocument = 6,
  DigitalCnh = 7,
  EcvReport = 8,
  InspectionReport = 9,
  CnpjCard = 11,
  Atpv = 57,
  Unknown = -1,
}

export function documentTypeFromWireValue(value: number): DocumentType {
  return enumFromWireValue(DocumentType, value, DocumentType.Unknown);
}

export const DOCUMENT_TYPE_NAMES: Readonly<Record<string, DocumentType>> = {
  CNH: DocumentType.Cnh,
  CPF: DocumentType.Cpf,
  RG: DocumentType.Rg,
  COMPROVANTE_RENDA: DocumentType.ProofOfIncome,
  COMPROVANTE_RESIDENCIA: DocumentType.ProofOfAddress,
  DOCUMENTO_VEICULO: DocumentType.VehicleDocument,
  CNH_DIGITAL: DocumentType.DigitalCnh,
  LAUDO_ECV: DocumentType.EcvReport,
  LAUDO_VISTORIA: DocumentType.InspectionReport,
  CARTAO_CNPJ: DocumentType.CnpjCard,
  ATPV: DocumentType.Atpv,
};

/** Participante dono do documento (`COMPRADOR`, `VENDEDOR`, `LOJA`). */
export enum ProposalParticipant {
  Buyer = 1,
  Seller = 2,
  Store = 3,
  Unknown = -1,
}

export function proposalParticipantFromWireValue(value: number): ProposalParticipant {
  return enumFromWireValue(ProposalParticipant, value, ProposalParticipant.Unknown);
}

export const PROPOSAL_PARTICIPANT_WIRE: Readonly<Record<number, string>> = {
  [ProposalParticipant.Buyer]: 'COMPRADOR',
  [ProposalParticipant.Seller]: 'VENDEDOR',
  [ProposalParticipant.Store]: 'LOJA',
};

/** Tipo da conta de recebimento (`CORRENTE`, `POUPANCA`, `PAGAMENTO`). */
export enum DepositAccountType {
  Checking = 1,
  Savings = 2,
  Payment = 3,
  Unknown = -1,
}

export function depositAccountTypeFromWireValue(value: number): DepositAccountType {
  return enumFromWireValue(DepositAccountType, value, DepositAccountType.Unknown);
}

export const DEPOSIT_ACCOUNT_TYPE_WIRE: Readonly<Record<number, string>> = {
  [DepositAccountType.Checking]: 'CORRENTE',
  [DepositAccountType.Savings]: 'POUPANCA',
  [DepositAccountType.Payment]: 'PAGAMENTO',
};

/** O que disparou a notificação do webhook v2 (`motivo_evento`). */
export enum ProposalEventReason {
  StatusChanged = 1,
  StepsChanged = 2,
  DocumentsChanged = 3,
  Unknown = -1,
}

export function proposalEventReasonFromWireValue(value: number): ProposalEventReason {
  return enumFromWireValue(ProposalEventReason, value, ProposalEventReason.Unknown);
}

export const PROPOSAL_EVENT_REASON_NAMES: Readonly<Record<string, ProposalEventReason>> = {
  STATUS_ALTERADO: ProposalEventReason.StatusChanged,
  ETAPAS_ALTERADAS: ProposalEventReason.StepsChanged,
  DOCUMENTOS_ALTERADOS: ProposalEventReason.DocumentsChanged,
};
