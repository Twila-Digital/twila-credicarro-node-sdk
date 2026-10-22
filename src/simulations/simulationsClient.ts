import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import { QueryStringBuilder } from '../internal/http/queryString';
import { buildListPath, pagedToPublic } from '../internal/http/pagination';
import type { PagedResultWire } from '../internal/generated/paged';
import type {
  RangeFinancingResponseWire,
  RangeRefinancingResponseWire,
  SimulationListResponseWire,
  SimulationWire,
  ListCommissionReturnsResponseWire,
} from '../internal/generated/simulation';
import {
  commissionReturnToPublic,
  createFinancingRequestToWire,
  createRefinancingRequestToWire,
  financingRangeToPublic,
  refinancingRangeToPublic,
  simulationOptionToPublic,
  simulationToPublic,
} from '../internal/mapping/simulationMapper';
import type { ListRequest, PagedResult } from '../pagedResult';
import type {
  CommissionReturn,
  CreateFinancingSimulationRequest,
  CreateRefinancingSimulationRequest,
  FinancingRangeOption,
  RefinancingRangeOption,
  Simulation,
  SimulationOption,
} from './types';

export interface SimulationsClient {
  /** Valor mínimo de entrada por prazo (`GET v2/proposal/simulation/range/financing`). */
  getFinancingRange(licensePlate: string, storeCnpj: string): Promise<FinancingRangeOption[]>;

  /** Faixa refinanciável por prazo (`GET v2/proposal/simulation/range/refinancing`). */
  getRefinancingRange(licensePlate: string, storeCnpj: string): Promise<RefinancingRangeOption[]>;

  /**
   * Retornos de comissão configurados para a loja, por tipo de simulação (`GET v2/proposal/simulation/commission-returns`).
   * Use um dos valores retornados em `commissionReturn` ao criar a simulação.
   */
  getCommissionReturns(storeCnpj: string): Promise<CommissionReturn[]>;

  /** Cria a simulação de financiamento (`POST v2/proposal/simulation/financing`); uma opção por prazo. */
  createFinancing(request: CreateFinancingSimulationRequest): Promise<SimulationOption[]>;

  /** Cria a simulação de refinanciamento (`POST v2/proposal/simulation/refinancing`); uma opção por prazo. */
  createRefinancing(request: CreateRefinancingSimulationRequest): Promise<SimulationOption[]>;

  /** Consulta uma simulação (`GET v1/proposal/simulation/{id}`). */
  get(simulationId: string): Promise<Simulation>;

  /** Lista as simulações, com paginação explícita (`GET v1/proposal/simulation`). */
  list(request?: ListRequest): Promise<PagedResult<Simulation>>;
}

export class SimulationsClientImpl implements SimulationsClient {
  constructor(private readonly executor: ApiRequestExecutor) {}

  async getFinancingRange(licensePlate: string, storeCnpj: string): Promise<FinancingRangeOption[]> {
    const path = rangePath('v2/proposal/simulation/range/financing', licensePlate, storeCnpj);
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return financingRangeToPublic(response.body as RangeFinancingResponseWire);
  }

  async getRefinancingRange(licensePlate: string, storeCnpj: string): Promise<RefinancingRangeOption[]> {
    const path = rangePath('v2/proposal/simulation/range/refinancing', licensePlate, storeCnpj);
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return refinancingRangeToPublic(response.body as RangeRefinancingResponseWire);
  }

  async getCommissionReturns(storeCnpj: string): Promise<CommissionReturn[]> {
    const path = new QueryStringBuilder().add('cnpjLoja', storeCnpj).build('v2/proposal/simulation/commission-returns');
    const response = await this.executor.get(path);
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as ListCommissionReturnsResponseWire).retornos_comissao.map(commissionReturnToPublic);
  }

  async createFinancing(request: CreateFinancingSimulationRequest): Promise<SimulationOption[]> {
    const response = await this.executor.post('v2/proposal/simulation/financing', createFinancingRequestToWire(request, true));
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as SimulationListResponseWire).simulacoes.map(simulationOptionToPublic);
  }

  async createRefinancing(request: CreateRefinancingSimulationRequest): Promise<SimulationOption[]> {
    const response = await this.executor.post(
      'v2/proposal/simulation/refinancing',
      createRefinancingRequestToWire(request, true),
    );
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as SimulationListResponseWire).simulacoes.map(simulationOptionToPublic);
  }

  async get(simulationId: string): Promise<Simulation> {
    const response = await this.executor.get(`v1/proposal/simulation/${encodeURIComponent(simulationId)}`);
    ApiRequestExecutor.ensureSuccess(response);

    return simulationToPublic(response.body as SimulationWire);
  }

  async list(request?: ListRequest): Promise<PagedResult<Simulation>> {
    const response = await this.executor.get(buildListPath('v1/proposal/simulation', request));
    ApiRequestExecutor.ensureSuccess(response);

    return pagedToPublic(response.body as PagedResultWire<SimulationWire>, simulationToPublic);
  }
}

function rangePath(path: string, licensePlate: string, storeCnpj: string): string {
  return new QueryStringBuilder().add('placa', licensePlate).add('cnpjLoja', storeCnpj).build(path);
}
