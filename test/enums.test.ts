import { describe, expect, it } from 'vitest';
import {
  ActionOwner,
  BiometryStatus,
  DepositAccountType,
  DocumentStatus,
  DocumentType,
  OccupationType,
  ProposalEventReason,
  ProposalParticipant,
  ProposalStatus,
  ProposalStep,
  ProposalType,
  SimulationType,
  StepSituation,
  WebhookAuthenticationType,
  WebhookStatus,
  WebhookType,
  actionOwnerFromWireValue,
  biometryStatusFromWireValue,
  depositAccountTypeFromWireValue,
  documentStatusFromWireValue,
  documentTypeFromWireValue,
  occupationTypeFromWireValue,
  proposalEventReasonFromWireValue,
  proposalParticipantFromWireValue,
  proposalStatusFromWireValue,
  proposalStepFromWireValue,
  proposalTypeFromWireValue,
  simulationTypeFromWireValue,
  stepSituationFromWireValue,
  webhookAuthenticationTypeFromWireValue,
  webhookStatusFromWireValue,
  webhookTypeFromWireValue,
} from '../src';

describe('enums follow the canonical contract', () => {
  it('has the documented numeric values', () => {
    expect(ProposalStatus).toMatchObject({ Analysing: 1, Approved: 2, Refused: 3, Canceled: 4, ManualAnalysis: 5, Completed: 6, InNegotiation: 7, Expired: 8, Pending: 9 });
    expect(ProposalStep).toMatchObject({ Undefined: 0, ProposalCreated: 1, ProposalApproved: 2, SellerNotification: 3, BiometryAnalysis: 4, DepositAccount: 5, DocumentSubmission: 6, DocumentCorrection: 7, VehicleDetails: 8, Inspection: 9, Signature: 10, Payment: 11, ProposalCompleted: 12 });
    expect(StepSituation).toMatchObject({ AwaitingSubmission: 1, AwaitingCustomer: 2, Processing: 3, PendingCorrection: 4, Blocked: 5, Completed: 6, Canceled: 7 });
    expect(ActionOwner).toMatchObject({ None: 0, Customer: 1, Integrator: 2, Credicarro: 3 });
    expect(BiometryStatus).toMatchObject({ NotStarted: 0, SessionCreated: 1, InAnalysis: 2, Approved: 3, Rejected: 4 });
    expect(DocumentStatus).toMatchObject({ Received: 0, Valid: 1, Invalid: 2, InAnalysis: 3, Deleted: 4, Pending: 5 });
    expect(DocumentType).toMatchObject({ Cnh: 1, Cpf: 2, Rg: 3, ProofOfIncome: 4, ProofOfAddress: 5, VehicleDocument: 6, DigitalCnh: 7, EcvReport: 8, InspectionReport: 9, CnpjCard: 11, Atpv: 57 });
    expect(OccupationType).toMatchObject({ Retired: 1, Pensioner: 2, Employee: 3, SelfEmployed: 4, Freelancer: 6, BusinessOwner: 7 });
    expect(WebhookType).toMatchObject({ Customer: 1, Simulation: 2, Proposal: 3 });
    expect(WebhookAuthenticationType).toMatchObject({ None: 1, Basic: 2, Jwt: 3 });
    expect(WebhookStatus).toMatchObject({ Active: 1, Inactive: 2 });
  });

  it.each([
    ['ProposalStatus', proposalStatusFromWireValue, ProposalStatus.Unknown],
    ['ProposalType', proposalTypeFromWireValue, ProposalType.Unknown],
    ['ProposalStep', proposalStepFromWireValue, ProposalStep.Unknown],
    ['StepSituation', stepSituationFromWireValue, StepSituation.Unknown],
    ['ActionOwner', actionOwnerFromWireValue, ActionOwner.Unknown],
    ['BiometryStatus', biometryStatusFromWireValue, BiometryStatus.Unknown],
    ['DocumentStatus', documentStatusFromWireValue, DocumentStatus.Unknown],
    ['DocumentType', documentTypeFromWireValue, DocumentType.Unknown],
    ['ProposalParticipant', proposalParticipantFromWireValue, ProposalParticipant.Unknown],
    ['DepositAccountType', depositAccountTypeFromWireValue, DepositAccountType.Unknown],
    ['ProposalEventReason', proposalEventReasonFromWireValue, ProposalEventReason.Unknown],
    ['SimulationType', simulationTypeFromWireValue, SimulationType.Unknown],
    ['OccupationType', occupationTypeFromWireValue, OccupationType.Unknown],
    ['WebhookType', webhookTypeFromWireValue, WebhookType.Unknown],
    ['WebhookAuthenticationType', webhookAuthenticationTypeFromWireValue, WebhookAuthenticationType.Unknown],
    ['WebhookStatus', webhookStatusFromWireValue, WebhookStatus.Unknown],
  ])('%s falls back to Unknown (-1) for unrecognized values', (_name, fromWire, unknown) => {
    expect(unknown).toBe(-1);
    expect(fromWire(424242)).toBe(-1);
  });

  it('keeps recognized values, including the gaps in DocumentType and OccupationType', () => {
    expect(documentTypeFromWireValue(57)).toBe(DocumentType.Atpv);
    expect(documentTypeFromWireValue(10)).toBe(DocumentType.Unknown);
    expect(occupationTypeFromWireValue(5)).toBe(OccupationType.Unknown);
    expect(proposalStepFromWireValue(0)).toBe(ProposalStep.Undefined);
    expect(biometryStatusFromWireValue(0)).toBe(BiometryStatus.NotStarted);
  });
});
