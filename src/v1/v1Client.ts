import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { QueryStringBuilder } from '../internal/http/queryString';
import type { ProposalIdResponseWire, ProposalSummaryWire } from '../internal/generated/proposal';
import type {
  FinancingWithoutCpfResponseWire,
  RangeFinancingResponseWire,
  RangeRefinancingResponseWire,
  RefinancingWithoutCpfResponseWire,
  SimulationListResponseWire,
} from '../internal/generated/simulation';
import {
  createProposalRequestToWire,
  proposalSummaryToPublic,
} from '../internal/mapping/proposalMapper';
import {
  createFinancingRequestToWire,
  createFinancingWithoutCpfRequestToWire,
  createRefinancingRequestToWire,
  createRefinancingWithoutCpfRequestToWire,
  financingRangeToPublic,
  financingWithoutCpfOptionToPublic,
  refinancingRangeToPublic,
  refinancingWithoutCpfOptionToPublic,
  simulationOptionToPublic,
} from '../internal/mapping/simulationMapper';
import type { CreateProposalRequest, ProposalSummary } from '../proposals/types';
import type {
  CreateFinancingSimulationRequestV1,
  CreateFinancingWithoutCpfRequest,
  CreateRefinancingSimulationRequestV1,
  CreateRefinancingWithoutCpfRequest,
  FinancingRangeOption,
  FinancingWithoutCpfOption,
  RefinancingRangeOption,
  RefinancingWithoutCpfOption,
  SimulationOption,
} from '../simulations/types';

/** Simulações v1: a loja é inferida pelo parceiro, sem `cnpjLoja`. */
export interface V1SimulationsClient {
  getFinancingRange(licensePlate: string): Promise<FinancingRangeOption[]>;
  getRefinancingRange(licensePlate: string): Promise<RefinancingRangeOption[]>;
  createFinancing(request: CreateFinancingSimulationRequestV1): Promise<SimulationOption[]>;
  createRefinancing(request: CreateRefinancingSimulationRequestV1): Promise<SimulationOption[]>;
  /**
   * Simula um financiamento só com placa, valor do veículo e UF, sem CPF. Nada é gravado e as opções não têm
   * `simulationId`. Não usa `Idempotency-Key` e pode ser repetida com segurança.
   */
  createFinancingWithoutCpf(request: CreateFinancingWithoutCpfRequest): Promise<FinancingWithoutCpfOption[]>;
  /**
   * Simula um refinanciamento só com placa, valor solicitado e UF, sem CPF. Nada é gravado e as opções não têm
   * `simulationId`. Não usa `Idempotency-Key` e pode ser repetida com segurança.
   */
  createRefinancingWithoutCpf(request: CreateRefinancingWithoutCpfRequest): Promise<RefinancingWithoutCpfOption[]>;
}

/** Propostas v1 (`POST v1/proposal`, `GET v1/proposal/{id}`). */
export interface V1ProposalsClient {
  create(request: CreateProposalRequest): Promise<string>;
  get(proposalId: string): Promise<ProposalSummary>;
}

/** Rotas v1 que não usam `cnpjLoja`. Prefira as rotas v2 (`client.simulations`, `client.proposals`). */
export interface V1Client {
  readonly simulations: V1SimulationsClient;
  readonly proposals: V1ProposalsClient;
}

class V1SimulationsClientImpl implements V1SimulationsClient {
  constructor(private readonly executor: ApiRequestExecutor) {}

  async getFinancingRange(licensePlate: string): Promise<FinancingRangeOption[]> {
    const path = new QueryStringBuilder().add('placa', licensePlate).build('v1/proposal/simulation/range/financing');
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return financingRangeToPublic(response.body as RangeFinancingResponseWire);
  }

  async getRefinancingRange(licensePlate: string): Promise<RefinancingRangeOption[]> {
    const path = new QueryStringBuilder().add('placa', licensePlate).build('v1/proposal/simulation/range/refinancing');
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return refinancingRangeToPublic(response.body as RangeRefinancingResponseWire);
  }

  async createFinancing(request: CreateFinancingSimulationRequestV1): Promise<SimulationOption[]> {
    const response = await this.executor.post('v1/proposal/simulation/financing', createFinancingRequestToWire(request, false));
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as SimulationListResponseWire).simulacoes.map(simulationOptionToPublic);
  }

  async createRefinancing(request: CreateRefinancingSimulationRequestV1): Promise<SimulationOption[]> {
    const response = await this.executor.post(
      'v1/proposal/simulation/refinancing',
      createRefinancingRequestToWire(request, false),
    );
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as SimulationListResponseWire).simulacoes.map(simulationOptionToPublic);
  }

  async createFinancingWithoutCpf(request: CreateFinancingWithoutCpfRequest): Promise<FinancingWithoutCpfOption[]> {
    const response = await this.executor.post(
      'v1/proposal/simulation/financing/without-cpf',
      createFinancingWithoutCpfRequestToWire(request),
    );
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as FinancingWithoutCpfResponseWire).cotacoes.map(financingWithoutCpfOptionToPublic);
  }

  async createRefinancingWithoutCpf(request: CreateRefinancingWithoutCpfRequest): Promise<RefinancingWithoutCpfOption[]> {
    const response = await this.executor.post(
      'v1/proposal/simulation/refinancing/without-cpf',
      createRefinancingWithoutCpfRequestToWire(request),
    );
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as RefinancingWithoutCpfResponseWire).cotacoes.map(refinancingWithoutCpfOptionToPublic);
  }
}

class V1ProposalsClientImpl implements V1ProposalsClient {
  constructor(private readonly executor: ApiRequestExecutor) {}

  async create(request: CreateProposalRequest): Promise<string> {
    const response = await this.executor.post('v1/proposal', createProposalRequestToWire(request));
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as ProposalIdResponseWire).id_proposta;
  }

  async get(proposalId: string): Promise<ProposalSummary> {
    const response = await this.executor.get(`v1/proposal/${encodeURIComponent(proposalId)}`);
    ApiRequestExecutor.ensureSuccess(response);

    return proposalSummaryToPublic(response.body as ProposalSummaryWire);
  }
}

export class V1ClientImpl implements V1Client {
  readonly simulations: V1SimulationsClient;
  readonly proposals: V1ProposalsClient;

  constructor(executor: ApiRequestExecutor) {
    this.simulations = new V1SimulationsClientImpl(executor);
    this.proposals = new V1ProposalsClientImpl(executor);
  }
}
