export interface RangeFinancingResponseWire {
  opcoes_por_prazo: { prazo: number; valor_minimo_entrada: number }[];
}

export interface RangeRefinancingResponseWire {
  opcoes_por_prazo: { prazo: number; valor_minimo_refinanciavel: number; valor_maximo_refinanciavel: number }[];
}

/** Corpo de `POST v1/proposal/simulation/financing` (sem `cnpjLoja`) e de `v2` (com `cnpjLoja`). */
export interface CreateFinancingSimulationRequestWire {
  cpf: string;
  placa: string;
  valorVeiculo: number;
  valorEntrada: number;
  uf: string;
  isVeiculoZeroKm: boolean;
  cnpjLoja?: string;
}

/** Corpo de `POST v1/proposal/simulation/refinancing` (sem `cnpjLoja`) e de `v2` (com `cnpjLoja`). */
export interface CreateRefinancingSimulationRequestWire {
  cpf: string;
  placa: string;
  valorSolicitado: number;
  cnpjLoja?: string;
}

export interface SimulationOptionWire {
  id_simulacao: string;
  valor_solicitado: number;
  prazo: number;
  valor_parcela: number;
  valor_tac: number;
  valor_boleto: number;
  valor_seguro: number;
  valor_iof: number;
  percentual_iof: number;
  valor_credito_total: number;
  valor_divida_total: number;
  percentual_cet_mensal: number;
  percentual_cet_anual: number;
  percentual_juros_mensal: number;
  percentual_juros_anual: number;
  valor_retencao_diaria_aproximado?: number | null;
}

/** Corpo de `POST v1/proposal/simulation/financing/without-cpf`; `valorEntrada` é opcional. */
export interface CreateFinancingWithoutCpfRequestWire {
  placa: string;
  valorVeiculo: number;
  valorEntrada?: number;
  uf: string;
}

export interface FinancingWithoutCpfOptionWire {
  valor_solicitado: number;
  prazo: number;
  valor_parcela: number;
  valor_tac: number;
  valor_boleto: number;
  valor_seguro: number;
  valor_iof: number;
  percentual_iof: number;
  valor_credito_total: number;
  valor_divida_total: number;
  percentual_cet_mensal: number;
  percentual_cet_anual: number;
  percentual_juros_mensal: number;
  percentual_juros_anual: number;
  valor_retencao_diaria_aproximado?: number | null;
  valor_entrada_minima: number;
}

export interface FinancingWithoutCpfResponseWire {
  cotacoes: FinancingWithoutCpfOptionWire[];
}

/** Corpo de `POST v1/proposal/simulation/refinancing/without-cpf`; os três campos são obrigatórios. */
export interface CreateRefinancingWithoutCpfRequestWire {
  placa: string;
  valorSolicitado: number;
  uf: string;
}

export interface RefinancingWithoutCpfOptionWire {
  valor_solicitado: number;
  prazo: number;
  valor_parcela: number;
  valor_tac: number;
  valor_boleto: number;
  valor_seguro: number;
  valor_iof: number;
  percentual_iof: number;
  valor_credito_total: number;
  valor_divida_total: number;
  percentual_cet_mensal: number;
  percentual_cet_anual: number;
  percentual_juros_mensal: number;
  percentual_juros_anual: number;
  valor_retencao_diaria_aproximado?: number | null;
  valor_minimo_refinanciavel: number;
  valor_maximo_refinanciavel: number;
}

export interface RefinancingWithoutCpfResponseWire {
  cotacoes: RefinancingWithoutCpfOptionWire[];
}

export interface SimulationListResponseWire {
  simulacoes: SimulationOptionWire[];
}

export interface SimulationWire {
  id_simulacao: string;
  prazo: number;
  valor_parcela: number;
  valor_solicitado: number;
  valor_entrada: number;
  valor_bem: number;
  valor_tac: number;
  taxa_juros_negociada: number;
  valor_registro: number;
  uf: string;
  tipo: string;
  transacao?: { valor_total_credito: number; valor_total_debito: number };
  juros?: { percentual_juros_mensal: number; percentual_juros_anual: number };
  cet?: { percentual_mensal: number; percentual_anual: number };
  iof?: { valor: number; percentual: number };
  veiculo?: VehicleWire;
  cliente?: { cpf: string };
  data_criacao: string;
}

export interface VehicleWire {
  marca: string;
  modelo: string;
  versao: string;
  ano?: number | null;
  valor?: number | null;
  placa: string;
  veiculo_zero_km?: boolean | null;
  chassi: string;
  renavam: string;
  cor: string;
}
