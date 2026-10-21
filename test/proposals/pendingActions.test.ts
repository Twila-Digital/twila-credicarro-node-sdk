import { describe, expect, it } from 'vitest';
import {
  ActionOwner,
  DocumentStatus,
  DocumentType,
  PendingActionKind,
  ProposalParticipant,
  ProposalStep,
  getPendingActions,
  parseWebhookEventUnverified,
  type ProposalParticipantState,
} from '../../src';
import { proposalDetailsToPublic } from '../../src/internal/mapping/proposalMapper';
import type { ProposalDetailsWire } from '../../src/internal/generated/proposal';
import { V2_PROPOSAL_WIRE } from '../support';

function participant(step: ProposalStep, owner: ActionOwner, documents: [DocumentType, DocumentStatus][] = []): ProposalParticipantState {
  return {
    document: '12345678909',
    completedSteps: [],
    activeStep: {
      step,
      stepRaw: step,
      stepName: '',
      situation: 1,
      situationRaw: 1,
      situationName: '',
      actionOwner: owner,
      actionOwnerRaw: owner,
      actionOwnerName: '',
    },
    documents: documents.map(([type, status]) => ({ type, typeRaw: type, typeName: '', status, statusRaw: status, statusName: '' })),
  };
}

describe('getPendingActions', () => {
  it('lists correction (Invalid docs) for the buyer and submission (Pending docs) for the store from a real detail response', () => {
    const details = proposalDetailsToPublic(V2_PROPOSAL_WIRE as unknown as ProposalDetailsWire);

    expect(getPendingActions(details)).toEqual([
      { participant: ProposalParticipant.Buyer, step: ProposalStep.DocumentCorrection, kind: PendingActionKind.CorrectDocuments, documentTypes: [DocumentType.Cnh], documentTypesRaw: [1] },
      { participant: ProposalParticipant.Store, step: ProposalStep.DocumentSubmission, kind: PendingActionKind.SendDocuments, documentTypes: [DocumentType.EcvReport], documentTypesRaw: [8] },
    ]);
  });

  it('maps step 8 to SendVehicleDetails and step 5 to SendDepositAccount', () => {
    const actions = getPendingActions({
      buyer: participant(ProposalStep.DepositAccount, ActionOwner.Integrator),
      store: participant(ProposalStep.VehicleDetails, ActionOwner.Integrator),
    });

    expect(actions).toEqual([
      { participant: ProposalParticipant.Buyer, step: ProposalStep.DepositAccount, kind: PendingActionKind.SendDepositAccount, documentTypes: [], documentTypesRaw: [] },
      { participant: ProposalParticipant.Store, step: ProposalStep.VehicleDetails, kind: PendingActionKind.SendVehicleDetails, documentTypes: [], documentTypesRaw: [] },
    ]);
  });

  it('ignores participants whose action owner is not the integrator', () => {
    const actions = getPendingActions({
      buyer: participant(ProposalStep.DocumentSubmission, ActionOwner.Customer, [[DocumentType.Cnh, DocumentStatus.Pending]]),
      seller: participant(ProposalStep.VehicleDetails, ActionOwner.Credicarro),
      store: participant(ProposalStep.Signature, ActionOwner.None),
    });

    expect(actions).toEqual([]);
  });

  it('ignores integrator steps that need no API action (e.g. biometry, payment) and missing active steps', () => {
    const noActive: ProposalParticipantState = { document: '1', completedSteps: [], documents: [] };

    expect(
      getPendingActions({
        buyer: participant(ProposalStep.BiometryAnalysis, ActionOwner.Integrator),
        seller: noActive,
        store: participant(ProposalStep.Payment, ActionOwner.Integrator),
      }),
    ).toEqual([]);
    expect(getPendingActions({})).toEqual([]);
  });

  it('only lists documents with the matching status', () => {
    const [action] = getPendingActions({
      buyer: participant(ProposalStep.DocumentSubmission, ActionOwner.Integrator, [
        [DocumentType.ProofOfIncome, DocumentStatus.Pending],
        [DocumentType.Cnh, DocumentStatus.Valid],
        [DocumentType.ProofOfAddress, DocumentStatus.Pending],
        [DocumentType.Atpv, DocumentStatus.Invalid],
      ]),
    });

    expect(action?.documentTypes).toEqual([DocumentType.ProofOfIncome, DocumentType.ProofOfAddress]);
  });

  it('works on a webhook v2 event', () => {
    const event = parseWebhookEventUnverified(JSON.stringify({ ...V2_PROPOSAL_WIRE, motivo_evento: 'DOCUMENTOS_ALTERADOS', data_evento: '2026-10-12T17:20:31.512+00:00', vendedor: null }));

    expect(getPendingActions(event).map((action) => action.kind)).toEqual([PendingActionKind.CorrectDocuments, PendingActionKind.SendDocuments]);
  });
});
