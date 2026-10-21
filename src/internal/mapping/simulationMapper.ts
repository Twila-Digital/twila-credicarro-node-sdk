import type {
  CreateFinancingSimulationRequestWire,
  CreateRefinancingSimulationRequestWire,
  RangeFinancingResponseWire,
  RangeRefinancingResponseWire,
  SimulationOptionWire,
  SimulationWire,
  VehicleWire,
} from '../generated/simulation';
import type {
  CreateFinancingSimulationRequest,
  CreateFinancingSimulationRequestV1,
  CreateRefinancingSimulationRequest,
  CreateRefinancingSimulationRequestV1,
  FinancingRangeOption,
  RefinancingRangeOption,
  Simulation,
  SimulationOption,
  SimulationVehicle,
} from '../../simulations/types';
import { SIMULATION_TYPE_NAMES, SimulationType } from '../../simulations/types';
import { enumFromName } from '../util/enumMapping';
import { protectPii } from '../util/pii';

export function financingRangeToPublic(wire: RangeFinancingResponseWire): FinancingRangeOption[] {
  return (wire.opcoes_por_prazo ?? []).map((option) => ({
    term: option.prazo,
    minimumDownPayment: option.valor_minimo_entrada,
  }));
}

export function refinancingRangeToPublic(wire: RangeRefinancingResponseWire): RefinancingRangeOption[] {
  return (wire.opcoes_por_prazo ?? []).map((option) => ({
    term: option.prazo,
    minimumAmount: option.valor_minimo_refinanciavel,
    maximumAmount: option.valor_maximo_refinanciavel,
  }));
}

export function createFinancingRequestToWire(
  request: CreateFinancingSimulationRequest | CreateFinancingSimulationRequestV1,
  includeStore: boolean,
): CreateFinancingSimulationRequestWire {
  return {
    cpf: request.cpf,
    placa: request.licensePlate,
    valorVeiculo: request.vehicleAmount,
    valorEntrada: request.downPayment,
    uf: request.state,
    isVeiculoZeroKm: request.isZeroKm,
    // As rotas v1 não aceitam `cnpjLoja` (corpo com propriedades extras é recusado).
    cnpjLoja: includeStore ? (request as CreateFinancingSimulationRequest).storeCnpj : undefined,
  };
}

export function createRefinancingRequestToWire(
  request: CreateRefinancingSimulationRequest | CreateRefinancingSimulationRequestV1,
  includeStore: boolean,
): CreateRefinancingSimulationRequestWire {
  return {
    cpf: request.cpf,
    placa: request.licensePlate,
    valorSolicitado: request.requestedAmount,
    cnpjLoja: includeStore ? (request as CreateRefinancingSimulationRequest).storeCnpj : undefined,
  };
}

export function simulationOptionToPublic(wire: SimulationOptionWire): SimulationOption {
  return {
    simulationId: wire.id_simulacao,
    requestedAmount: wire.valor_solicitado,
    term: wire.prazo,
    installmentAmount: wire.valor_parcela,
    tacAmount: wire.valor_tac,
    boletoAmount: wire.valor_boleto,
    insuranceAmount: wire.valor_seguro,
    iofAmount: wire.valor_iof,
    iofRate: wire.percentual_iof,
    totalCreditAmount: wire.valor_credito_total,
    totalDebtAmount: wire.valor_divida_total,
    monthlyCet: wire.percentual_cet_mensal,
    annualCet: wire.percentual_cet_anual,
    monthlyInterestRate: wire.percentual_juros_mensal,
    annualInterestRate: wire.percentual_juros_anual,
    approximateDailyRetention: wire.valor_retencao_diaria_aproximado ?? undefined,
  };
}

function vehicleToPublic(wire: VehicleWire): SimulationVehicle {
  return {
    brand: wire.marca,
    model: wire.modelo,
    version: wire.versao,
    year: wire.ano ?? undefined,
    value: wire.valor ?? undefined,
    licensePlate: wire.placa,
    isZeroKm: wire.veiculo_zero_km ?? undefined,
    chassis: wire.chassi,
    renavam: wire.renavam,
    color: wire.cor,
  };
}

export function simulationToPublic(wire: SimulationWire): Simulation {
  return protectPii({
    simulationId: wire.id_simulacao,
    term: wire.prazo,
    installmentAmount: wire.valor_parcela,
    requestedAmount: wire.valor_solicitado,
    downPayment: wire.valor_entrada,
    assetAmount: wire.valor_bem,
    tacAmount: wire.valor_tac,
    negotiatedInterestRate: wire.taxa_juros_negociada,
    registrationAmount: wire.valor_registro,
    state: wire.uf,
    type: enumFromName(SIMULATION_TYPE_NAMES, wire.tipo, SimulationType.Unknown),
    transaction: wire.transacao
      ? { totalCredit: wire.transacao.valor_total_credito, totalDebit: wire.transacao.valor_total_debito }
      : undefined,
    interest: wire.juros
      ? { monthlyRate: wire.juros.percentual_juros_mensal, annualRate: wire.juros.percentual_juros_anual }
      : undefined,
    cet: wire.cet ? { monthlyRate: wire.cet.percentual_mensal, annualRate: wire.cet.percentual_anual } : undefined,
    iof: wire.iof ? { amount: wire.iof.valor, rate: wire.iof.percentual } : undefined,
    vehicle: wire.veiculo ? vehicleToPublic(wire.veiculo) : undefined,
    customerCpf: wire.cliente?.cpf,
    createdAt: wire.data_criacao,
  });
}
