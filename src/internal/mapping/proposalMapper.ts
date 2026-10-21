import type {
  ActiveStepWire,
  CompletedStepWire,
  CreateProposalRequestWire,
  DepositAccountRequestWire,
  DocumentUploadRequestWire,
  ProposalDetailsWire,
  ProposalDocumentWire,
  ProposalParticipantWire,
  ProposalSummaryWire,
  VehicleDetailRequestWire,
} from '../generated/proposal';
import {
  ACTION_OWNER_NAMES,
  ActionOwner,
  BIOMETRY_STATUS_NAMES,
  BiometryStatus,
  DEPOSIT_ACCOUNT_TYPE_WIRE,
  DOCUMENT_STATUS_NAMES,
  DOCUMENT_TYPE_NAMES,
  DocumentStatus,
  DocumentType,
  PROPOSAL_PARTICIPANT_WIRE,
  PROPOSAL_STATUS_NAMES,
  PROPOSAL_STEP_NAMES,
  PROPOSAL_TYPE_NAMES,
  ProposalStatus,
  ProposalStep,
  ProposalType,
  STEP_SITUATION_NAMES,
  StepSituation,
} from '../../proposals/enums';
import type {
  ActiveStep,
  CompletedStep,
  CreateProposalRequest,
  DepositAccount,
  ProposalDetails,
  ProposalDocument,
  ProposalDocumentUpload,
  ProposalParticipantState,
  ProposalSummary,
  VehicleDetails,
} from '../../proposals/types';
import { enumFromName, resolveEnum } from '../util/enumMapping';
import { protectPii } from '../util/pii';

export function createProposalRequestToWire(request: CreateProposalRequest): CreateProposalRequestWire {
  return { cpf: request.cpf, simulacaoId: request.simulationId };
}

export function vehicleDetailsToWire(details: VehicleDetails): VehicleDetailRequestWire {
  return { renavam: details.renavam, chassi: details.chassis, placa: details.licensePlate, cor: details.color };
}

export function depositAccountToWire(account: DepositAccount): DepositAccountRequestWire {
  return {
    cpfTitular: account.holderCpf,
    codigoBanco: account.bankCode,
    agencia: account.branch,
    digitoAgencia: account.branchDigit,
    conta: account.accountNumber,
    digitoConta: account.accountDigit,
    tipoConta: DEPOSIT_ACCOUNT_TYPE_WIRE[account.accountType] ?? '',
  };
}

export function documentUploadToWire(upload: ProposalDocumentUpload): DocumentUploadRequestWire {
  return {
    participante: PROPOSAL_PARTICIPANT_WIRE[upload.participant] ?? '',
    tipoDocumento: upload.documentType,
    nomeArquivo: upload.file.fileName,
    conteudoBase64: upload.file.base64Content,
  };
}

/** Consulta v1 / listagem: o `status` vem pelo nome em inglês. */
export function proposalSummaryToPublic(wire: ProposalSummaryWire): ProposalSummary {
  return protectPii({
    id: wire.id_proposta,
    number: wire.numero,
    simulationId: wire.id_simulacao,
    type: enumFromName(PROPOSAL_TYPE_NAMES, wire.tipo, ProposalType.Unknown),
    status: enumFromName(PROPOSAL_STATUS_NAMES, wire.status, ProposalStatus.Unknown),
    statusName: wire.status ?? '',
    buyerCpf: wire.comprador?.cpf ?? '',
    sellerCpf: wire.vendedor?.cpf ?? undefined,
    createdAt: wire.data_criacao,
  });
}

export function proposalDetailsToPublic(wire: ProposalDetailsWire): ProposalDetails {
  const status = resolveEnum(ProposalStatus, PROPOSAL_STATUS_NAMES, ProposalStatus.Unknown, wire.enum_status, wire.status);

  return protectPii({
    id: wire.id_proposta,
    number: wire.numero,
    simulationId: wire.id_simulacao,
    status: status.value,
    statusRaw: status.raw,
    statusName: status.name,
    type: enumFromName(PROPOSAL_TYPE_NAMES, wire.tipo, ProposalType.Unknown),
    createdAt: wire.data_criacao,
    refusalReason: wire.motivo_recusa ?? undefined,
    biometryLink: wire.link_biometria ?? undefined,
    buyer: wire.comprador ? participantToPublic(wire.comprador, wire.comprador.cpf) : undefined,
    seller: wire.vendedor ? participantToPublic(wire.vendedor, wire.vendedor.cpf) : undefined,
    store: wire.loja ? participantToPublic(wire.loja, wire.loja.cnpj, false) : undefined,
  });
}

/** `document` é o CPF (comprador/vendedor) ou o CNPJ (loja) — quem chama escolhe o campo certo. */
export function participantToPublic(
  wire: ProposalParticipantWire,
  document: string | undefined,
  includeBiometry = true,
): ProposalParticipantState {
  const hasBiometry = includeBiometry && (wire.enum_biometria !== undefined || wire.biometria !== undefined);
  const biometry = hasBiometry
    ? resolveEnum(BiometryStatus, BIOMETRY_STATUS_NAMES, BiometryStatus.Unknown, wire.enum_biometria, wire.biometria)
    : undefined;

  return protectPii({
    document: document ?? '',
    biometry: biometry?.value,
    biometryRaw: biometry?.raw,
    biometryName: biometry?.name,
    activeStep: wire.status_ativo ? activeStepToPublic(wire.status_ativo) : undefined,
    completedSteps: (wire.etapas_concluidas ?? []).map(completedStepToPublic),
    documents: (wire.documentos ?? []).map(documentToPublic),
  });
}

function activeStepToPublic(wire: ActiveStepWire): ActiveStep {
  const step = resolveEnum(ProposalStep, PROPOSAL_STEP_NAMES, ProposalStep.Unknown, wire.enum_etapa, wire.etapa);
  const situation = resolveEnum(StepSituation, STEP_SITUATION_NAMES, StepSituation.Unknown, wire.enum_situacao, wire.situacao);
  const owner = resolveEnum(ActionOwner, ACTION_OWNER_NAMES, ActionOwner.Unknown, wire.enum_responsavel_acao, wire.responsavel_acao);

  return {
    step: step.value,
    stepRaw: step.raw,
    stepName: step.name,
    situation: situation.value,
    situationRaw: situation.raw,
    situationName: situation.name,
    actionOwner: owner.value,
    actionOwnerRaw: owner.raw,
    actionOwnerName: owner.name,
  };
}

function completedStepToPublic(wire: CompletedStepWire): CompletedStep {
  const step = resolveEnum(ProposalStep, PROPOSAL_STEP_NAMES, ProposalStep.Unknown, wire.enum_etapa, wire.etapa);

  return { step: step.value, stepRaw: step.raw, stepName: step.name, date: wire.data ?? undefined };
}

function documentToPublic(wire: ProposalDocumentWire): ProposalDocument {
  const type = resolveEnum(DocumentType, DOCUMENT_TYPE_NAMES, DocumentType.Unknown, wire.enum_tipo, wire.tipo);
  const status = resolveEnum(DocumentStatus, DOCUMENT_STATUS_NAMES, DocumentStatus.Unknown, wire.enum_status, wire.status);

  return {
    type: type.value,
    typeRaw: type.raw,
    typeName: type.name,
    status: status.value,
    statusRaw: status.raw,
    statusName: status.name,
    reason: wire.motivo ?? undefined,
  };
}
