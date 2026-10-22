import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CredicarroApiError, CredicarroValidationError, OccupationType, occupationTypeFromWireValue } from '../../src';
import { BASE_URL, UUID, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const personal = {
  cpf: '12345678909',
  firstName: 'Maria',
  lastName: 'Souza',
  email: 'maria.souza@exemplo.com.br',
  phoneNumber: '+55 (11) 99876-5432',
  dateOfBirth: '1990-05-20T00:00:00-03:00',
};

const address = {
  street: 'Av. Paulista',
  number: '1578',
  complement: 'Bloco B, Apto 1203',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01311000',
};

describe('CustomersClient (MSW)', () => {
  it('upsert posts the unified wire body without an Idempotency-Key and returns id_cliente', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = 'nao-chamou';

    server.use(
      http.post(`${BASE_URL}/v1/customer/unified`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ id_cliente: UUID });
      }),
    );

    const id = await newClient().customers.upsert({
      ...personal,
      address,
      professionalData: { occupation: OccupationType.Employee, monthlyIncome: 6500 },
    });

    expect(id).toBe(UUID);
    expect(key).toBeNull();
    expect(body).toEqual({
      cpf: '12345678909',
      nome: 'Maria',
      sobrenome: 'Souza',
      email: 'maria.souza@exemplo.com.br',
      celular: '+55 (11) 99876-5432',
      dataDeNascimento: '1990-05-20T00:00:00-03:00',
      endereco: {
        rua: 'Av. Paulista',
        numero: '1578',
        complemento: 'Bloco B, Apto 1203',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01311000',
      },
      dadosProfissionais: { tipoOcupacao: 3, renda: 6500 },
    });
  });

  it('serializes a Date of birth as ISO-8601', async () => {
    stubToken(server);
    let body: { dataDeNascimento?: string } = {};

    server.use(
      http.post(`${BASE_URL}/v1/customer`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ id_cliente: UUID });
      }),
    );

    await newClient().customers.create({ ...personal, dateOfBirth: new Date('1990-05-20T03:00:00.000Z') });

    expect(body.dataDeNascimento).toBe('1990-05-20T03:00:00.000Z');
  });

  it('create sends only the six personal fields plus an automatic key', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v1/customer`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ id_cliente: UUID });
      }),
    );

    const id = await newClient().customers.create(personal);

    expect(id).toBe(UUID);
    expect(key).toBeTruthy();
    expect(Object.keys(body as object).sort()).toEqual(['celular', 'cpf', 'dataDeNascimento', 'email', 'nome', 'sobrenome']);
  });

  it('upsertAddress posts cpf + endereco and accepts 202', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v1/customer/address`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse('Accepted', { status: 202 });
      }),
    );

    await newClient().customers.upsertAddress('12345678909', address);

    expect(body).toEqual({
      cpf: '12345678909',
      endereco: {
        rua: 'Av. Paulista',
        numero: '1578',
        complemento: 'Bloco B, Apto 1203',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01311000',
      },
    });
  });

  it('upsertAddress omits optional number and complement', async () => {
    stubToken(server);
    let body: { endereco?: Record<string, unknown> } = {};

    server.use(
      http.post(`${BASE_URL}/v1/customer/address`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return new HttpResponse(null, { status: 202 });
      }),
    );

    await newClient().customers.upsertAddress('12345678909', { street: 'Rua A', neighborhood: 'Centro', city: 'Porto Alegre', state: 'RS', postalCode: '90000-000' });

    expect(Object.keys(body.endereco ?? {}).sort()).toEqual(['bairro', 'cep', 'cidade', 'estado', 'rua']);
  });

  it('upsertProfessionalData posts cpf, tipoOcupacao and renda', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v1/customer/professional`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse('Accepted', { status: 202 });
      }),
    );

    await newClient().customers.upsertProfessionalData('12345678909', { occupation: OccupationType.BusinessOwner, monthlyIncome: 12000.5 });

    expect(body).toEqual({ cpf: '12345678909', tipoOcupacao: 7, renda: 12000.5 });
  });

  it('maps 409 Cpf.CpfAlreadyAdded to CredicarroApiError and 400 to CredicarroValidationError', async () => {
    stubToken(server);

    server.use(http.post(`${BASE_URL}/v1/customer`, () => problem(409, 'Cpf.CpfAlreadyAdded', 'Conflito')));
    const conflict = await newClient()
      .customers.create(personal)
      .catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(CredicarroApiError);
    expect((conflict as CredicarroApiError).errorCode).toBe('Cpf.CpfAlreadyAdded');

    server.use(http.post(`${BASE_URL}/v1/customer/address`, () => problem(400, 'Validation.ZipCode.Invalid', 'Requisição inválida', 'CEP inválido', 'endereco.cep')));
    const invalid = await newClient()
      .customers.upsertAddress('12345678909', address)
      .catch((e: unknown) => e);
    expect(invalid).toBeInstanceOf(CredicarroValidationError);
    expect((invalid as CredicarroValidationError).field).toBe('endereco.cep');
  });

  it('OccupationType falls back to Unknown', () => {
    expect(occupationTypeFromWireValue(5)).toBe(OccupationType.Unknown);
    expect(occupationTypeFromWireValue(6)).toBe(OccupationType.Freelancer);
  });
});
