import { enumFromWireValue } from '../internal/util/enumMapping';

export enum SimulationType {
  Financing = 1,
  Refinancing = 2,
  AmountSimulation = 3,
  Unknown = -1,
}

export function simulationTypeFromWireValue(value: number): SimulationType {
  return enumFromWireValue(SimulationType, value, SimulationType.Unknown);
}

export const SIMULATION_TYPE_NAMES: Readonly<Record<string, SimulationType>> = {
  Financing: SimulationType.Financing,
  Refinancing: SimulationType.Refinancing,
  AmountSimulation: SimulationType.AmountSimulation,
};

export interface FinancingRangeOption {
  /** Prazo em meses. */
  term: number;
  minimumDownPayment: number;
}

export interface RefinancingRangeOption {
  term: number;
  minimumAmount: number;
  maximumAmount: number;
}

/** Simulação de financiamento (rotas v1 não usam `storeCnpj`). */
export interface CreateFinancingSimulationRequest {
  cpf: string;
  licensePlate: string;
  vehicleAmount: number;
  /** Informe zero quando não houver entrada; deve ser menor que o valor do veículo. */
  downPayment: number;
  /** UF do registro do veículo, com 2 letras. */
  state: string;
  isZeroKm: boolean;
  /** CNPJ da loja de integração (formatado ou só números). Obrigatório na rota v2. */
  storeCnpj: string;
}

export interface CreateRefinancingSimulationRequest {
  cpf: string;
  licensePlate: string;
  requestedAmount: number;
  storeCnpj: string;
}

/** Corpos das rotas v1, que não selecionam a loja pelo CNPJ. */
export type CreateFinancingSimulationRequestV1 = Omit<CreateFinancingSimulationRequest, 'storeCnpj'>;
export type CreateRefinancingSimulationRequestV1 = Omit<CreateRefinancingSimulationRequest, 'storeCnpj'>;

/**
 * Simulação de financiamento sem CPF (`POST v1/proposal/simulation/financing/without-cpf`).
 * Usa a loja de integração do parceiro; nada é gravado.
 */
export interface CreateFinancingWithoutCpfRequest {
  licensePlate: string;
  vehicleAmount: number;
  /** Opcional. Omitida, a API usa a entrada mínima da taxa da loja (e o campo não vai no JSON). */
  downPayment?: number;
  /** UF do registro do veículo, com 2 letras. */
  state: string;
}

/**
 * Simulação de refinanciamento sem CPF (`POST v1/proposal/simulation/refinancing/without-cpf`).
 * Usa a loja de integração do parceiro; nada é gravado. Todos os campos são obrigatórios.
 */
export interface CreateRefinancingWithoutCpfRequest {
  licensePlate: string;
  requestedAmount: number;
  /** UF do registro do veículo, com 2 letras. Define as taxas e o custo de registro. */
  state: string;
}

/** Uma opção de simulação, por prazo. Use `simulationId` para criar a proposta. */
export interface SimulationOption {
  simulationId: string;
  requestedAmount: number;
  term: number;
  installmentAmount: number;
  tacAmount: number;
  boletoAmount: number;
  insuranceAmount: number;
  iofAmount: number;
  iofRate: number;
  totalCreditAmount: number;
  totalDebtAmount: number;
  monthlyCet: number;
  annualCet: number;
  monthlyInterestRate: number;
  annualInterestRate: number;
  approximateDailyRetention?: number;
}

/** Uma opção da simulação sem CPF, por prazo. Não tem `simulationId`: não serve para criar proposta. */
export interface FinancingWithoutCpfOption {
  requestedAmount: number;
  term: number;
  installmentAmount: number;
  tacAmount: number;
  boletoAmount: number;
  insuranceAmount: number;
  iofAmount: number;
  iofRate: number;
  totalCreditAmount: number;
  totalDebtAmount: number;
  monthlyCet: number;
  annualCet: number;
  monthlyInterestRate: number;
  annualInterestRate: number;
  approximateDailyRetention?: number;
  minimumDownPayment: number;
}

/** Uma opção da simulação de refinanciamento sem CPF, por prazo. Não tem `simulationId`: não serve para criar proposta. */
export interface RefinancingWithoutCpfOption {
  requestedAmount: number;
  term: number;
  installmentAmount: number;
  tacAmount: number;
  boletoAmount: number;
  insuranceAmount: number;
  iofAmount: number;
  iofRate: number;
  totalCreditAmount: number;
  totalDebtAmount: number;
  monthlyCet: number;
  annualCet: number;
  monthlyInterestRate: number;
  annualInterestRate: number;
  approximateDailyRetention?: number;
  minimumAmount: number;
  maximumAmount: number;
}

export interface SimulationTransaction {
  totalCredit: number;
  totalDebit: number;
}

export interface SimulationRates {
  monthlyRate: number;
  annualRate: number;
}

export interface SimulationIof {
  amount: number;
  rate: number;
}

export interface SimulationVehicle {
  brand: string;
  model: string;
  version: string;
  year?: number;
  value?: number;
  licensePlate: string;
  isZeroKm?: boolean;
  chassis: string;
  renavam: string;
  color: string;
}

/** Simulação consultada (`GET v1/proposal/simulation/{id}` e listagem). */
export interface Simulation {
  simulationId: string;
  term: number;
  installmentAmount: number;
  requestedAmount: number;
  downPayment: number;
  assetAmount: number;
  tacAmount: number;
  negotiatedInterestRate: number;
  registrationAmount: number;
  state: string;
  type: SimulationType;
  transaction?: SimulationTransaction;
  interest?: SimulationRates;
  cet?: SimulationRates;
  iof?: SimulationIof;
  vehicle?: SimulationVehicle;
  customerCpf?: string;
  createdAt: string;
}
