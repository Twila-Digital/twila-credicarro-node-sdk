import type {
  ActionOwner,
  BiometryStatus,
  DepositAccountType,
  DocumentStatus,
  DocumentType,
  ProposalParticipant,
  ProposalStatus,
  ProposalStep,
  ProposalType,
  StepSituation,
} from './enums';
import type { DocumentFile } from './documentFile';

export interface CreateProposalRequest {
  cpf: string;
  simulationId: string;
}

/** Etapa em que o participante está agora, a situação dela e quem precisa agir. */
export interface ActiveStep {
  step: ProposalStep;
  stepRaw: number;
  stepName: string;
  situation: StepSituation;
  situationRaw: number;
  situationName: string;
  actionOwner: ActionOwner;
  actionOwnerRaw: number;
  actionOwnerName: string;
}

export interface CompletedStep {
  step: ProposalStep;
  stepRaw: number;
  stepName: string;
  /** Data da última passagem pela etapa (ISO-8601). */
  date?: string;
}

export interface ProposalDocument {
  type: DocumentType;
  typeRaw: number;
  typeName: string;
  status: DocumentStatus;
  statusRaw: number;
  statusName: string;
  /** Motivo da recusa do documento, quando houver. */
  reason?: string;
}

/** Retrato de um participante (comprador, vendedor ou loja) em `ProposalDetails` e no webhook v2. */
export interface ProposalParticipantState {
  /** CPF (comprador e vendedor) ou CNPJ (loja). */
  document: string;
  biometry?: BiometryStatus;
  biometryRaw?: number;
  biometryName?: string;
  activeStep?: ActiveStep;
  completedSteps: CompletedStep[];
  documents: ProposalDocument[];
}

/** Retrato atual da proposta (`GET v2/proposal/{id}`). */
export interface ProposalDetails {
  id: string;
  number: number;
  simulationId: string;
  status: ProposalStatus;
  statusRaw: number;
  statusName: string;
  type: ProposalType;
  createdAt: string;
  refusalReason?: string;
  biometryLink?: string;
  buyer?: ProposalParticipantState;
  seller?: ProposalParticipantState;
  store?: ProposalParticipantState;
}

/** Proposta na listagem e na consulta v1. */
export interface ProposalSummary {
  id: string;
  number: number;
  simulationId: string;
  type: ProposalType;
  status: ProposalStatus;
  statusName: string;
  buyerCpf: string;
  sellerCpf?: string;
  createdAt: string;
}

export interface VehicleDetails {
  renavam: string;
  chassis: string;
  licensePlate: string;
  color: string;
}

export interface DepositAccount {
  holderCpf: string;
  bankCode: string;
  branch: string;
  branchDigit: string;
  accountNumber: string;
  accountDigit: string;
  accountType: DepositAccountType;
}

export interface ProposalDocumentUpload {
  participant: ProposalParticipant;
  documentType: DocumentType;
  file: DocumentFile;
}

export enum PendingActionKind {
  SendDocuments = 1,
  CorrectDocuments = 2,
  SendVehicleDetails = 3,
  SendDepositAccount = 4,
}

/** Ação que o integrador precisa executar para a proposta avançar. */
export interface PendingAction {
  participant: ProposalParticipant;
  step: ProposalStep;
  kind: PendingActionKind;
  /** Tipos de documento a enviar (`SendDocuments`) ou reenviar (`CorrectDocuments`). */
  documentTypes: DocumentType[];
  /** Códigos brutos de documentTypes, na mesma ordem (preserva tipos que o SDK ainda não conhece). */
  documentTypesRaw: number[];
}
