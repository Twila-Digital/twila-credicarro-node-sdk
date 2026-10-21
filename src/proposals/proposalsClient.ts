import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { buildListPath, pagedToPublic } from '../internal/http/pagination';
import type { PagedResultWire } from '../internal/generated/paged';
import type { ProposalDetailsWire, ProposalIdResponseWire, ProposalSummaryWire } from '../internal/generated/proposal';
import {
  createProposalRequestToWire,
  depositAccountToWire,
  documentUploadToWire,
  proposalDetailsToPublic,
  proposalSummaryToPublic,
  vehicleDetailsToWire,
} from '../internal/mapping/proposalMapper';
import type { ListRequest, PagedResult } from '../pagedResult';
import { DepositAccountType, DocumentType, ProposalParticipant } from './enums';
import { validateDocumentFile } from './documentFile';
import type {
  CreateProposalRequest,
  DepositAccount,
  ProposalDetails,
  ProposalDocumentUpload,
  ProposalSummary,
  VehicleDetails,
} from './types';

export interface ProposalsClient {
  /** Cria a proposta a partir de uma simulação feita com `storeCnpj` (`POST v2/proposal`). Devolve o `id_proposta`. */
  create(request: CreateProposalRequest): Promise<string>;

  /** Retrato atual da proposta, com etapas e documentos de cada participante (`GET v2/proposal/{id}`). */
  get(proposalId: string): Promise<ProposalDetails>;

  /** Lista as propostas, com paginação explícita (`GET v1/proposal`). */
  list(request?: ListRequest): Promise<PagedResult<ProposalSummary>>;

  /** Inclui ou substitui os dados do veículo (`POST v2/proposal/{id}/vehicle-detail`, `204`). */
  sendVehicleDetails(proposalId: string, details: VehicleDetails): Promise<void>;

  /** Inclui ou substitui a conta de recebimento de um refinanciamento (`POST v2/proposal/{id}/deposit-account`, `204`). */
  sendDepositAccount(proposalId: string, account: DepositAccount): Promise<void>;

  /**
   * Envia um documento (`POST v2/proposal/{id}/document`, `204`). O header `Idempotency-Key` é obrigatório na API.
   *
   * Recomendado: gere e persista uma `idempotencyKey` por envio, e reaproveite-a ao repetir o MESMO envio. Use uma
   * chave NOVA ao reenviar o documento para correção. Sem `idempotencyKey`, o SDK gera uma por chamada e a repete
   * em todas as tentativas automáticas dessa chamada.
   */
  uploadDocument(proposalId: string, upload: ProposalDocumentUpload, idempotencyKey?: string): Promise<void>;
}

export class ProposalsClientImpl implements ProposalsClient {
  constructor(
    private readonly executor: ApiRequestExecutor,
    private readonly documentUploadAttemptTimeoutMs: number,
  ) {}

  async create(request: CreateProposalRequest): Promise<string> {
    const response = await this.executor.post('v2/proposal', createProposalRequestToWire(request));
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as ProposalIdResponseWire).id_proposta;
  }

  async get(proposalId: string): Promise<ProposalDetails> {
    const response = await this.executor.get(`v2/proposal/${encodeURIComponent(proposalId)}`);
    ApiRequestExecutor.ensureSuccess(response);

    return proposalDetailsToPublic(response.body as ProposalDetailsWire);
  }

  async list(request?: ListRequest): Promise<PagedResult<ProposalSummary>> {
    const response = await this.executor.get(buildListPath('v1/proposal', request));
    ApiRequestExecutor.ensureSuccess(response);

    return pagedToPublic(response.body as PagedResultWire<ProposalSummaryWire>, proposalSummaryToPublic);
  }

  async sendVehicleDetails(proposalId: string, details: VehicleDetails): Promise<void> {
    const response = await this.executor.post(
      `v2/proposal/${encodeURIComponent(proposalId)}/vehicle-detail`,
      vehicleDetailsToWire(details),
    );
    ApiRequestExecutor.ensureSuccess(response);
  }

  async sendDepositAccount(proposalId: string, account: DepositAccount): Promise<void> {
    if (account.accountType === DepositAccountType.Unknown)
      throw new RangeError('accountType deve ser Checking, Savings ou Payment.');

    const response = await this.executor.post(
      `v2/proposal/${encodeURIComponent(proposalId)}/deposit-account`,
      depositAccountToWire(account),
    );
    ApiRequestExecutor.ensureSuccess(response);
  }

  async uploadDocument(proposalId: string, upload: ProposalDocumentUpload, idempotencyKey?: string): Promise<void> {
    if (upload.participant === ProposalParticipant.Unknown || !(upload.participant in ProposalParticipant))
      throw new RangeError('participant deve ser Buyer, Seller ou Store.');

    if (upload.documentType === DocumentType.Unknown || !(upload.documentType in DocumentType))
      throw new RangeError('documentType deve ser um tipo de documento conhecido.');

    validateDocumentFile(upload.file);

    const response = await this.executor.post(
      `v2/proposal/${encodeURIComponent(proposalId)}/document`,
      documentUploadToWire(upload),
      { idempotencyKey, attemptTimeoutMs: this.documentUploadAttemptTimeoutMs },
    );
    ApiRequestExecutor.ensureSuccess(response);
  }
}
