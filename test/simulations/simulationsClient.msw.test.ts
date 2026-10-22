import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CredicarroBusinessRuleError, SimulationType, simulationTypeFromWireValue } from '../../src';
import { BASE_URL, PAGE, SIMULATION_OPTION_WIRE, UUID, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const simulationWire = {
  id_simulacao: UUID,
  prazo: 24,
  valor_parcela: 2356,
  valor_solicitado: 37908,
  valor_entrada: 9786,
  valor_bem: 47694,
  valor_tac: 1500,
  taxa_juros_negociada: 2.79,
  valor_registro: 487,
  uf: 'SP',
  tipo: 'Refinancing',
  transacao: { valor_total_credito: 78495, valor_total_debito: 78000 },
  juros: { percentual_juros_mensal: 3.29, percentual_juros_anual: 39.48 },
  cet: { percentual_mensal: 3.62, percentual_anual: 43.44 },
  iof: { valor: 872, percentual: 1.92 },
  veiculo: {
    marca: 'Honda',
    modelo: 'Civic',
    versao: 'Turing',
    ano: 2024,
    valor: 124654,
    placa: 'MWO-3910',
    veiculo_zero_km: false,
    chassi: '1Y5Ye4U8kydsr4828',
    renavam: '70502561697',
    cor: 'Prata',
  },
  cliente: { cpf: '123.456.789-01' },
  data_criacao: '2025-10-17T19:05:08.984Z',
};

describe('SimulationsClient (MSW)', () => {
  it('getFinancingRange queries placa and cnpjLoja on the v2 route', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v2/proposal/simulation/range/financing`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ opcoes_por_prazo: [{ prazo: 12, valor_minimo_entrada: 5000 }, { prazo: 24, valor_minimo_entrada: 7000.5 }] });
      }),
    );

    const options = await newClient().simulations.getFinancingRange('ABC-1234', '11.222.333/0001-81');

    const search = new URL(url).searchParams;
    expect(search.get('placa')).toBe('ABC-1234');
    expect(search.get('cnpjLoja')).toBe('11.222.333/0001-81');
    expect(options).toEqual([
      { term: 12, minimumDownPayment: 5000 },
      { term: 24, minimumDownPayment: 7000.5 },
    ]);
  });

  it('getRefinancingRange maps minimum and maximum amounts', async () => {
    stubToken(server);

    server.use(
      http.get(`${BASE_URL}/v2/proposal/simulation/range/refinancing`, () =>
        HttpResponse.json({ opcoes_por_prazo: [{ prazo: 6, valor_minimo_refinanciavel: 12480, valor_maximo_refinanciavel: 35720 }] }),
      ),
    );

    const options = await newClient().simulations.getRefinancingRange('ABC1D23', '11222333000181');

    expect(options).toEqual([{ term: 6, minimumAmount: 12480, maximumAmount: 35720 }]);
  });

  it('createFinancing posts the v2 body (with cnpjLoja) and maps every option field', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/simulation/financing`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
    );

    const options = await newClient().simulations.createFinancing({
      cpf: '12345678909',
      licensePlate: 'ABC1D23',
      vehicleAmount: 45000,
      downPayment: 5000,
      state: 'SP',
      isZeroKm: false,
      storeCnpj: '11.222.333/0001-81',
    });

    expect(body).toEqual({
      cpf: '12345678909',
      placa: 'ABC1D23',
      valorVeiculo: 45000,
      valorEntrada: 5000,
      uf: 'SP',
      isVeiculoZeroKm: false,
      cnpjLoja: '11.222.333/0001-81',
    });
    expect(options).toEqual([
      {
        simulationId: UUID,
        requestedAmount: 40000,
        term: 36,
        installmentAmount: 2042.42,
        tacAmount: 1500,
        boletoAmount: 3.5,
        insuranceAmount: 0,
        iofAmount: 872,
        iofRate: 1.92,
        totalCreditAmount: 42722,
        totalDebtAmount: 73527.12,
        monthlyCet: 3.62,
        annualCet: 53.25,
        monthlyInterestRate: 3.29,
        annualInterestRate: 47.53,
        approximateDailyRetention: 12.5,
      },
    ]);
  });

  it('leaves approximateDailyRetention undefined when the API omits it', async () => {
    stubToken(server);
    const withoutRetention: Record<string, unknown> = { ...SIMULATION_OPTION_WIRE };
    delete withoutRetention.valor_retencao_diaria_aproximado;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/simulation/refinancing`, () =>
        HttpResponse.json({ simulacoes: [withoutRetention] }, { status: 201 }),
      ),
    );

    const [option] = await newClient().simulations.createRefinancing({
      cpf: '12345678909',
      licensePlate: 'ABC1D23',
      requestedAmount: 25000,
      storeCnpj: '11222333000181',
    });

    expect(option?.approximateDailyRetention).toBeUndefined();
  });

  it('createRefinancing posts valorSolicitado and cnpjLoja', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/simulation/refinancing`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
    );

    await newClient().simulations.createRefinancing({ cpf: '12345678909', licensePlate: 'ABC1D23', requestedAmount: 25000, storeCnpj: '11222333000181' });

    expect(body).toEqual({ cpf: '12345678909', placa: 'ABC1D23', valorSolicitado: 25000, cnpjLoja: '11222333000181' });
  });

  it('maps 422 Store.Integration.Intermediation to CredicarroBusinessRuleError', async () => {
    stubToken(server);

    server.use(
      http.get(`${BASE_URL}/v2/proposal/simulation/range/financing`, () =>
        problem(422, 'Store.Integration.Intermediation', 'Regra de negócio não atendida'),
      ),
    );

    const error = await newClient()
      .simulations.getFinancingRange('ABC1D23', '11222333000181')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((error as CredicarroBusinessRuleError).errorCode).toBe('Store.Integration.Intermediation');
  });

  it('get maps the full SimulationResponse', async () => {
    stubToken(server);

    server.use(http.get(`${BASE_URL}/v1/proposal/simulation/${UUID}`, () => HttpResponse.json(simulationWire)));

    const simulation = await newClient().simulations.get(UUID);

    expect(simulation).toEqual({
      simulationId: UUID,
      term: 24,
      installmentAmount: 2356,
      requestedAmount: 37908,
      downPayment: 9786,
      assetAmount: 47694,
      tacAmount: 1500,
      negotiatedInterestRate: 2.79,
      registrationAmount: 487,
      state: 'SP',
      type: SimulationType.Refinancing,
      transaction: { totalCredit: 78495, totalDebit: 78000 },
      interest: { monthlyRate: 3.29, annualRate: 39.48 },
      cet: { monthlyRate: 3.62, annualRate: 43.44 },
      iof: { amount: 872, rate: 1.92 },
      vehicle: {
        brand: 'Honda',
        model: 'Civic',
        version: 'Turing',
        year: 2024,
        value: 124654,
        licensePlate: 'MWO-3910',
        isZeroKm: false,
        chassis: '1Y5Ye4U8kydsr4828',
        renavam: '70502561697',
        color: 'Prata',
      },
      customerCpf: '123.456.789-01',
      createdAt: '2025-10-17T19:05:08.984Z',
    });
  });

  it('maps a simulation of an unknown type to SimulationType.Unknown and tolerates null vehicle fields', async () => {
    stubToken(server);

    server.use(
      http.get(`${BASE_URL}/v1/proposal/simulation/${UUID}`, () =>
        HttpResponse.json({ ...simulationWire, tipo: 'AlgoNovo', veiculo: { ...simulationWire.veiculo, ano: null, valor: null, veiculo_zero_km: null } }),
      ),
    );

    const simulation = await newClient().simulations.get(UUID);

    expect(simulation.type).toBe(SimulationType.Unknown);
    expect(simulation.vehicle?.year).toBeUndefined();
    expect(simulation.vehicle?.value).toBeUndefined();
    expect(simulation.vehicle?.isZeroKm).toBeUndefined();
  });

  it('list sends pagina_inicial/limite and maps the page', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/proposal/simulation`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ itens: [simulationWire], pagina: PAGE });
      }),
    );

    const page = await newClient().simulations.list({ page: 2, pageSize: 50 });

    const search = new URL(url).searchParams;
    expect(search.get('pagina_inicial')).toBe('2');
    expect(search.get('limite')).toBe('50');
    expect(page).toMatchObject({ page: 1, pageSize: 10, totalCount: 25, hasNext: true, hasPrevious: false });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.simulationId).toBe(UUID);
  });

  it('list uses page 1 and 10 items by default and validates the range on the client', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/proposal/simulation`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ itens: [], pagina: PAGE });
      }),
    );

    const client = newClient();
    await client.simulations.list();

    expect(new URL(url).searchParams.get('pagina_inicial')).toBe('1');
    expect(new URL(url).searchParams.get('limite')).toBe('10');

    await expect(client.simulations.list({ pageSize: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(client.simulations.list({ pageSize: 101 })).rejects.toBeInstanceOf(RangeError);
    await expect(client.simulations.list({ page: 0 })).rejects.toBeInstanceOf(RangeError);
  });

  it('SimulationType falls back to Unknown', () => {
    expect(simulationTypeFromWireValue(99)).toBe(SimulationType.Unknown);
  });
});
