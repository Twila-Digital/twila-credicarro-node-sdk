import type {
  CreateCustomerRequestWire,
  CustomerAddressWire,
  ProfessionalDataWire,
  UpsertCustomerAddressRequestWire,
  UpsertCustomerRequestWire,
  UpsertProfessionalDataRequestWire,
} from '../generated/customer';
import type {
  CreateCustomerRequest,
  CustomerAddress,
  ProfessionalData,
  UpsertCustomerRequest,
} from '../../customers/types';
import { toIsoString } from '../util/date';

export function addressToWire(address: CustomerAddress): CustomerAddressWire {
  return {
    rua: address.street,
    numero: address.number,
    complemento: address.complement,
    bairro: address.neighborhood,
    cidade: address.city,
    estado: address.state,
    cep: address.postalCode,
  };
}

export function professionalDataToWire(data: ProfessionalData): ProfessionalDataWire {
  return { tipoOcupacao: data.occupation, renda: data.monthlyIncome };
}

export function createCustomerRequestToWire(request: CreateCustomerRequest): CreateCustomerRequestWire {
  return {
    cpf: request.cpf,
    nome: request.firstName,
    sobrenome: request.lastName,
    email: request.email,
    celular: request.phoneNumber,
    dataDeNascimento: toIsoString(request.dateOfBirth),
  };
}

export function upsertCustomerRequestToWire(request: UpsertCustomerRequest): UpsertCustomerRequestWire {
  return {
    ...createCustomerRequestToWire(request),
    endereco: addressToWire(request.address),
    dadosProfissionais: professionalDataToWire(request.professionalData),
  };
}

export function upsertAddressRequestToWire(cpf: string, address: CustomerAddress): UpsertCustomerAddressRequestWire {
  return { cpf, endereco: addressToWire(address) };
}

export function upsertProfessionalDataRequestToWire(cpf: string, data: ProfessionalData): UpsertProfessionalDataRequestWire {
  return { cpf, ...professionalDataToWire(data) };
}
