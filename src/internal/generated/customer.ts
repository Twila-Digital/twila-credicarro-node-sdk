export interface CustomerAddressWire {
  rua: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface ProfessionalDataWire {
  tipoOcupacao: number;
  renda: number;
}

export interface CreateCustomerRequestWire {
  cpf: string;
  nome: string;
  sobrenome: string;
  email: string;
  celular: string;
  dataDeNascimento: string;
}

export interface UpsertCustomerRequestWire extends CreateCustomerRequestWire {
  endereco: CustomerAddressWire;
  dadosProfissionais: ProfessionalDataWire;
}

export interface UpsertCustomerAddressRequestWire {
  cpf: string;
  endereco: CustomerAddressWire;
}

export interface UpsertProfessionalDataRequestWire extends ProfessionalDataWire {
  cpf: string;
}

export interface CustomerIdResponseWire {
  id_cliente: string;
}
