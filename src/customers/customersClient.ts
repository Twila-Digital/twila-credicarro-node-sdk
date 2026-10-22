import { ApiRequestExecutor } from '../internal/http/apiRequestExecutor';
import type { CustomerIdResponseWire } from '../internal/generated/customer';
import {
  createCustomerRequestToWire,
  upsertAddressRequestToWire,
  upsertCustomerRequestToWire,
  upsertProfessionalDataRequestToWire,
} from '../internal/mapping/customerMapper';
import type { CreateCustomerRequest, CustomerAddress, ProfessionalData, UpsertCustomerRequest } from './types';

export interface CustomersClient {
  /**
   * Cria ou atualiza o cliente com dados pessoais, endereço e dados profissionais (`POST v1/customer/unified`).
   * Devolve o `id_cliente`.
   *
   * Atenção: sem `idempotencyKey` a rota faz upsert (CPF existente é atualizado). Com a chave ela só cria
   * (CPF existente → `409 Cpf.CpfAlreadyAdded`). Por isso o SDK NUNCA gera a chave automaticamente aqui — e,
   * sem a chave, a requisição não é repetida em caso de falha.
   */
  upsert(request: UpsertCustomerRequest, idempotencyKey?: string): Promise<string>;

  /** Cria só os dados pessoais (`POST v1/customer`). CPF, e-mail ou celular já cadastrados retornam `409`. */
  create(request: CreateCustomerRequest): Promise<string>;

  /** Cria ou atualiza o endereço de um cliente existente (`POST v1/customer/address`, `202`). */
  upsertAddress(cpf: string, address: CustomerAddress): Promise<void>;

  /** Cria ou atualiza ocupação e renda de um cliente existente (`POST v1/customer/professional`, `202`). */
  upsertProfessionalData(cpf: string, data: ProfessionalData): Promise<void>;
}

export class CustomersClientImpl implements CustomersClient {
  constructor(private readonly executor: ApiRequestExecutor) {}

  async upsert(request: UpsertCustomerRequest, idempotencyKey?: string): Promise<string> {
    const response = await this.executor.post('v1/customer/unified', upsertCustomerRequestToWire(request), { idempotencyKey });
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as CustomerIdResponseWire).id_cliente;
  }

  async create(request: CreateCustomerRequest): Promise<string> {
    const response = await this.executor.post('v1/customer', createCustomerRequestToWire(request));
    ApiRequestExecutor.ensureSuccess(response);

    return (response.body as CustomerIdResponseWire).id_cliente;
  }

  async upsertAddress(cpf: string, address: CustomerAddress): Promise<void> {
    const response = await this.executor.post('v1/customer/address', upsertAddressRequestToWire(cpf, address));
    ApiRequestExecutor.ensureSuccess(response);
  }

  async upsertProfessionalData(cpf: string, data: ProfessionalData): Promise<void> {
    const response = await this.executor.post('v1/customer/professional', upsertProfessionalDataRequestToWire(cpf, data));
    ApiRequestExecutor.ensureSuccess(response);
  }
}
