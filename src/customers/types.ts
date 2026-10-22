import { enumFromWireValue } from '../internal/util/enumMapping';

export enum OccupationType {
  Retired = 1,
  Pensioner = 2,
  Employee = 3,
  SelfEmployed = 4,
  Freelancer = 6,
  BusinessOwner = 7,
  Unknown = -1,
}

export function occupationTypeFromWireValue(value: number): OccupationType {
  return enumFromWireValue(OccupationType, value, OccupationType.Unknown);
}

export interface CustomerAddress {
  street: string;
  number?: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  /** CEP com 8 dígitos, com ou sem hífen. */
  postalCode: string;
}

export interface ProfessionalData {
  occupation: OccupationType;
  /** Renda mensal, em reais. */
  monthlyIncome: number;
}

export interface CreateCustomerRequest {
  /** CPF com ou sem pontuação. */
  cpf: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Exatamente no formato `+55 (DD) 99999-9999`. */
  phoneNumber: string;
  /** ISO-8601 com offset (o cliente precisa ter entre 18 e 75 anos). */
  dateOfBirth: string | Date;
}

export interface UpsertCustomerRequest extends CreateCustomerRequest {
  address: CustomerAddress;
  professionalData: ProfessionalData;
}
