import { ActionOwner, DocumentStatus, ProposalParticipant, ProposalStep } from './enums';
import { PendingActionKind, type PendingAction, type ProposalDocument, type ProposalParticipantState } from './types';

/** Qualquer objeto com os participantes da proposta — `ProposalDetails` ou `ProposalWebhookEvent`. */
export interface ProposalParticipants {
  buyer?: ProposalParticipantState;
  seller?: ProposalParticipantState;
  store?: ProposalParticipantState;
}

/**
 * Lista o que o integrador precisa fazer agora. Considera só participantes cuja etapa ativa tem o
 * integrador como responsável (`ActionOwner.Integrator`):
 * etapa 6 → `SendDocuments` (documentos Pending); 7 → `CorrectDocuments` (documentos Invalid);
 * 8 → `SendVehicleDetails`; 5 → `SendDepositAccount`.
 */
export function getPendingActions(proposal: ProposalParticipants): PendingAction[] {
  const participants: [ProposalParticipant, ProposalParticipantState | undefined][] = [
    [ProposalParticipant.Buyer, proposal.buyer],
    [ProposalParticipant.Seller, proposal.seller],
    [ProposalParticipant.Store, proposal.store],
  ];

  const actions: PendingAction[] = [];

  for (const [participant, state] of participants) {
    const action = state ? actionFor(participant, state) : undefined;
    if (action) actions.push(action);
  }

  return actions;
}

function actionFor(participant: ProposalParticipant, state: ProposalParticipantState): PendingAction | undefined {
  const active = state.activeStep;
  if (!active || active.actionOwner !== ActionOwner.Integrator) return undefined;

  switch (active.step) {
    case ProposalStep.DocumentSubmission:
      return build(participant, active.step, PendingActionKind.SendDocuments, documentsWith(state, DocumentStatus.Pending));
    case ProposalStep.DocumentCorrection:
      return build(participant, active.step, PendingActionKind.CorrectDocuments, documentsWith(state, DocumentStatus.Invalid));
    case ProposalStep.VehicleDetails:
      return build(participant, active.step, PendingActionKind.SendVehicleDetails, []);
    case ProposalStep.DepositAccount:
      return build(participant, active.step, PendingActionKind.SendDepositAccount, []);
    default:
      return undefined;
  }
}

function documentsWith(state: ProposalParticipantState, status: DocumentStatus): ProposalDocument[] {
  return state.documents.filter((document) => document.status === status);
}

function build(
  participant: ProposalParticipant,
  step: ProposalStep,
  kind: PendingActionKind,
  documents: ProposalDocument[],
): PendingAction {
  return {
    participant,
    step,
    kind,
    documentTypes: documents.map((document) => document.type),
    documentTypesRaw: documents.map((document) => document.typeRaw),
  };
}
