import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { QueryStringBuilder } from '../internal/http/queryString';
import type { ProposalIdResponseWire, ProposalSummaryWire } from '../internal/generated/proposal';
import type {
  RangeFinancingResponseWire,
  RangeRefinancingResponseWire,
  SimulationListResponseWire,
} from '../internal/generated/simulation';
import {
  createProposalRequestToWire,
  proposalSummaryToPublic,
} from '../internal/mapping/proposalMapper';
import {
  createFinancingRequestToWire,
  createRefinancingRequestToWire,
  financingRangeToPublic,
  refinancingRangeToPublic,
  simulationOptionToPublic,
} from '../internal/mapping/simulationMapper';
import type { CreateProposalRequest, ProposalSummary } from '../proposals/types';
import type {
  CreateFinancingSimulationRequestV1,
  CreateRefinancingSimulationRequestV1,
  FinancingRangeOption,
  RefinancingRangeOption,
  SimulationOption,
} from '../simulations/types';

/** Simulações v1: a loja é inferida pelo parceiro, sem `cnpjLoja`. */
export interface V1SimulationsClient {
  getFinancingRange(licensePlate: string): Promise<FinancingRangeOption[]>;
  getRefinancingRange(licensePlate: string): Promise<RefinancingRangeOption[]>;
  createFinancing(request: CreateFinancingSimulationRequestV1): Promise<SimulationOption[]>;
  createRefinancing(request: CreateRefinancingSimulationRequestV1): Promise<SimulationOption[]>;
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
