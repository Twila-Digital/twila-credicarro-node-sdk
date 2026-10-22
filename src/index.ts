import './internal/polyfills/abortController';

import { AccessTokenProviderImpl, type AccessTokenProvider } from './internal/auth/accessTokenProvider';
import { TokenApiClientImpl } from './internal/auth/tokenApiClient';
import { ApiRequestExecutor } from './internal/http/apiRequestExecutor';
import { ResiliencePipeline } from './internal/resilience/resiliencePipeline';
import { resolveClientOptions, type CredicarroClientOptions } from './config/clientOptions';
import { CustomersClientImpl, type CustomersClient } from './customers/customersClient';
import { SimulationsClientImpl, type SimulationsClient } from './simulations/simulationsClient';
import { ProposalsClientImpl, type ProposalsClient } from './proposals/proposalsClient';
import { WebhooksClientImpl, type WebhooksClient } from './webhooks/webhooksClient';
import { V1ClientImpl, type V1Client } from './v1/v1Client';

/**
 * Cliente da API de integração do Credicarro. Mantenha uma única instância (singleton) na aplicação: ela guarda
 * o token de acesso em cache e o estado do circuit breaker. O `clientSecret` não fica em nenhuma propriedade
 * do objeto e nunca aparece em log, mensagem de erro ou serialização.
 */
export class CredicarroClient {
  readonly customers: CustomersClient;
  readonly simulations: SimulationsClient;
  readonly proposals: ProposalsClient;
  readonly webhooks: WebhooksClient;
  /** Rotas v1 sem `cnpjLoja`. */
  readonly v1: V1Client;

  constructor(options: CredicarroClientOptions) {
    const resolved = resolveClientOptions(options);
    const credentials = { clientId: resolved.clientId, clientSecret: resolved.clientSecret };

    const tokenApiClient = new TokenApiClientImpl(
      resolved.baseUrl,
      resolved.resilience.attemptTimeoutMs,
      new ResiliencePipeline(resolved.resilience),
      () => credentials,
    );
    const tokenProvider: AccessTokenProvider = new AccessTokenProviderImpl(tokenApiClient);

    const executor = new ApiRequestExecutor(
      resolved.baseUrl,
      tokenProvider,
      resolved.resilience,
      new ResiliencePipeline(resolved.resilience),
    );

    this.customers = new CustomersClientImpl(executor);
    this.simulations = new SimulationsClientImpl(executor);
    this.proposals = new ProposalsClientImpl(executor, resolved.resilience.documentUploadAttemptTimeoutMs);
    this.webhooks = new WebhooksClientImpl(executor);
    this.v1 = new V1ClientImpl(executor);
  }
}

export { CredicarroEnvironment } from './config/environment';
export type { CredicarroClientOptions } from './config/clientOptions';
export type { CredicarroResilienceOptions } from './config/resilienceOptions';
export type { PagedResult, ListRequest } from './pagedResult';

export * from './errors';

export type { CustomersClient } from './customers/customersClient';
export {
  OccupationType,
  occupationTypeFromWireValue,
  type CustomerAddress,
  type ProfessionalData,
  type CreateCustomerRequest,
  type UpsertCustomerRequest,
} from './customers/types';

export type { SimulationsClient } from './simulations/simulationsClient';
export {
  SimulationType,
  simulationTypeFromWireValue,
  type FinancingRangeOption,
  type RefinancingRangeOption,
  type CreateFinancingSimulationRequest,
  type CreateRefinancingSimulationRequest,
  type CreateFinancingSimulationRequestV1,
  type CreateRefinancingSimulationRequestV1,
  type SimulationOption,
  type Simulation,
  type SimulationTransaction,
  type SimulationRates,
  type SimulationIof,
  type SimulationVehicle,
} from './simulations/types';

export type { ProposalsClient } from './proposals/proposalsClient';
export {
  ProposalStatus,
  proposalStatusFromWireValue,
  ProposalType,
  proposalTypeFromWireValue,
  ProposalStep,
  proposalStepFromWireValue,
  StepSituation,
  stepSituationFromWireValue,
  ActionOwner,
  actionOwnerFromWireValue,
  BiometryStatus,
  biometryStatusFromWireValue,
  DocumentStatus,
  documentStatusFromWireValue,
  DocumentType,
  documentTypeFromWireValue,
  ProposalParticipant,
  proposalParticipantFromWireValue,
  DepositAccountType,
  depositAccountTypeFromWireValue,
  ProposalEventReason,
  proposalEventReasonFromWireValue,
} from './proposals/enums';
export {
  PendingActionKind,
  type CreateProposalRequest,
  type ActiveStep,
  type CompletedStep,
  type ProposalDocument,
  type ProposalParticipantState,
  type ProposalDetails,
  type ProposalSummary,
  type VehicleDetails,
  type DepositAccount,
  type ProposalDocumentUpload,
  type PendingAction,
} from './proposals/types';
export { getPendingActions, type ProposalParticipants } from './proposals/pendingActions';
export {
  DocumentFile,
  documentFileFromBytes,
  documentFileFromStream,
  documentFileFromPath,
  MAX_DOCUMENT_SIZE_BYTES,
} from './proposals/documentFile';

export type { WebhooksClient } from './webhooks/webhooksClient';
export {
  WebhookType,
  webhookTypeFromWireValue,
  WebhookAuthenticationType,
  webhookAuthenticationTypeFromWireValue,
  WebhookStatus,
  webhookStatusFromWireValue,
  type Webhook,
  type CreateWebhookRequest,
  type CreateWebhookResult,
  type UpdateWebhookRequest,
  type ProposalWebhookEvent,
  type WebhookVerificationOptions,
} from './webhooks/types';
export {
  parseWebhookEvent,
  parseWebhookEventUnverified,
  verifyWebhookSignature,
  verifyWebhookAuthorization,
  computeWebhookSignature,
  CredicarroWebhookEvent,
} from './webhooks/webhookEvent';

export type { V1Client, V1SimulationsClient, V1ProposalsClient } from './v1/v1Client';
