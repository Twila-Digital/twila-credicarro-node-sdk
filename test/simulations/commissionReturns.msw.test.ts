import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CommissionReturnTarget, CredicarroBusinessRuleError, SimulationType } from '../../src';
import { BASE_URL, SIMULATION_OPTION_WIRE, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SimulationsClient — retorno de comissão (MSW)', () => {
  it('getCommissionReturns queries cnpjLoja and maps type, target and range', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v2/proposal/simulation/commission-returns`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          retornos_comissao: [
            { tipo: 'Financing', alvo: 'Store', retorno_minimo: 0, retorno_maximo: 4, permite_taxa_padrao: true },
            { tipo: 'Refinancing', alvo: 'Organization', retorno_minimo: 1, retorno_maximo: 3, permite_taxa_padrao: false },
            { tipo: 'Outro', alvo: 'Novo', retorno_minimo: 0, retorno_maximo: 0, permite_taxa_padrao: false },
          ],
        });
      }),
    );

    const returns = await newClient().simulations.getCommissionReturns('11.222.333/0001-81');

    expect(new URL(url).searchParams.get('cnpjLoja')).toBe('11.222.333/0001-81');
    expect(returns).toEqual([
      { type: SimulationType.Financing, target: CommissionReturnTarget.Store, minimumReturn: 0, maximumReturn: 4, allowsDefaultRate: true },
      { type: SimulationType.Refinancing, target: CommissionReturnTarget.Organization, minimumReturn: 1, maximumReturn: 3, allowsDefaultRate: false },
      { type: SimulationType.Unknown, target: CommissionReturnTarget.Unknown, minimumReturn: 0, maximumReturn: 0, allowsDefaultRate: false },
    ]);
  });

  it('getCommissionReturns returns an empty list when the store has none', async () => {
    stubToken(server);

    server.use(http.get(`${BASE_URL}/v2/proposal/simulation/commission-returns`, () => HttpResponse.json({ retornos_comissao: [] })));

    expect(await newClient().simulations.getCommissionReturns('11222333000181')).toEqual([]);
  });

  it('createFinancing and createRefinancing send retornoComissao when provided', async () => {
    stubToken(server);
    const bodies: Record<string, unknown>[] = [];

    server.use(
      http.post(`${BASE_URL}/v2/proposal/simulation/financing`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
      http.post(`${BASE_URL}/v2/proposal/simulation/refinancing`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
    );

    const client = newClient();
    await client.simulations.createFinancing({
      cpf: '12345678909',
      licensePlate: 'ABC1D23',
      vehicleAmount: 45000,
      downPayment: 5000,
      state: 'SP',
      isZeroKm: false,
      storeCnpj: '11222333000181',
      commissionReturn: 2,
    });
    await client.simulations.createRefinancing({ cpf: '12345678909', licensePlate: 'ABC1D23', requestedAmount: 25000, storeCnpj: '11222333000181', commissionReturn: 0 });
    await client.simulations.createRefinancing({ cpf: '12345678909', licensePlate: 'ABC1D23', requestedAmount: 25000, storeCnpj: '11222333000181' });

    expect(bodies[0]?.retornoComissao).toBe(2);
    expect(bodies[1]?.retornoComissao).toBe(0);
    expect('retornoComissao' in (bodies[2] ?? {})).toBe(false);
  });

  it('v1 routes never send retornoComissao', async () => {
    stubToken(server);
    let body: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/financing`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
    );

    const request = { cpf: '12345678909', licensePlate: 'ABC1D23', vehicleAmount: 45000, downPayment: 5000, state: 'SP', isZeroKm: false, commissionReturn: 2 };
    await newClient().v1.simulations.createFinancing(request);

    expect('retornoComissao' in body).toBe(false);
  });

  it('maps 422 Store.CommissionReturn.OutOfRange to CredicarroBusinessRuleError', async () => {
    stubToken(server);

    server.use(
      http.post(`${BASE_URL}/v2/proposal/simulation/financing`, () =>
        problem(422, 'Store.CommissionReturn.OutOfRange', 'Regra de negócio não atendida', 'O valor deve estar entre 0 e 4.'),
      ),
    );

    const error = await newClient()
      .simulations.createFinancing({
        cpf: '12345678909',
        licensePlate: 'ABC1D23',
        vehicleAmount: 45000,
        downPayment: 5000,
        state: 'SP',
        isZeroKm: false,
        storeCnpj: '11222333000181',
        commissionReturn: 9,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((error as CredicarroBusinessRuleError).errorCode).toBe('Store.CommissionReturn.OutOfRange');
  });
});
