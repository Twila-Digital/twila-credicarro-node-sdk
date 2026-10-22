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

/** Faixa de retorno de comissão configurada para a loja, por tipo de simulação. */
export interface CommissionReturn {
  type: 'Financing' | 'Refinancing';
  target: 'Store' | 'Organization';
  minimumReturn: number;
  maximumReturn: number;
  /** Indica se a loja aceita usar a taxa padrão (sem informar `commissionReturn`). */
  allowDefaultRate: boolean;
}

/** Simulação de financiamento (rotas v1 não usam `storeCnpj` nem `commissionReturn`). */
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
  /** Retorno de comissão, dentro da faixa configurada na loja. Opcional. */
  commissionReturn?: number;
}

export interface CreateRefinancingSimulationRequest {
  cpf: string;
  licensePlate: string;
  requestedAmount: number;
  storeCnpj: string;
  /** Retorno de comissão, dentro da faixa configurada na loja. Opcional. */
  commissionReturn?: number;
}

/** Corpos das rotas v1, que não selecionam a loja pelo CNPJ nem aceitam retorno de comissão. */
export type CreateFinancingSimulationRequestV1 = Omit<CreateFinancingSimulationRequest, 'storeCnpj' | 'commissionReturn'>;
export type CreateRefinancingSimulationRequestV1 = Omit<CreateRefinancingSimulationRequest, 'storeCnpj' | 'commissionReturn'>;

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
