import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CredicarroBusinessRuleError, CredicarroApiError, ProposalStatus, ProposalType } from '../../src';
import { BASE_URL, SIMULATION_OPTION_WIRE, UUID, newClient, problem, stubToken } from '../support';

const WITHOUT_CPF_OPTION_WIRE = {
  valor_solicitado: 31500,
  prazo: 24,
  valor_parcela: 2033.96,
  valor_tac: 1500,
  valor_boleto: 0,
  valor_seguro: 0,
  valor_iof: 934.29,
  percentual_iof: 3,
  valor_credito_total: 34084.29,
  valor_divida_total: 48815.04,
  percentual_cet_mensal: 3.62,
  percentual_cet_anual: 53.25,
  percentual_juros_mensal: 3.29,
  percentual_juros_anual: 47.53,
  valor_retencao_diaria_aproximado: 12.5,
  valor_entrada_minima: 13500,
};

const REFINANCING_WITHOUT_CPF_OPTION_WIRE = {
  valor_solicitado: 20000,
  prazo: 24,
  valor_parcela: 1100.5,
  valor_tac: 1500,
  valor_boleto: 0,
  valor_seguro: 0,
  valor_iof: 600.25,
  percentual_iof: 3,
  valor_credito_total: 22100.25,
  valor_divida_total: 26412,
  percentual_cet_mensal: 3.2,
  percentual_cet_anual: 46.1,
  percentual_juros_mensal: 2.8,
  percentual_juros_anual: 39.29,
  valor_retencao_diaria_aproximado: 12.5,
  valor_minimo_refinanciavel: 16000,
  valor_maximo_refinanciavel: 40000,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('V1Client (MSW)', () => {
  it('ranges use only placa (no cnpjLoja)', async () => {
    stubToken(server);
    const urls: string[] = [];

    server.use(
      http.get(`${BASE_URL}/v1/proposal/simulation/range/financing`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ opcoes_por_prazo: [{ prazo: 12, valor_minimo_entrada: 5000 }] });
      }),
      http.get(`${BASE_URL}/v1/proposal/simulation/range/refinancing`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ opcoes_por_prazo: [{ prazo: 6, valor_minimo_refinanciavel: 1, valor_maximo_refinanciavel: 2 }] });
      }),
    );

    const client = newClient();
    expect(await client.v1.simulations.getFinancingRange('ABC1D23')).toEqual([{ term: 12, minimumDownPayment: 5000 }]);
    expect(await client.v1.simulations.getRefinancingRange('ABC1D23')).toEqual([{ term: 6, minimumAmount: 1, maximumAmount: 2 }]);

    for (const url of urls) {
      expect(new URL(url).searchParams.get('placa')).toBe('ABC1D23');
      expect(new URL(url).searchParams.has('cnpjLoja')).toBe(false);
    }
  });

  it('simulation creation does not send cnpjLoja even if the object carries a storeCnpj', async () => {
    stubToken(server);
    const bodies: Record<string, unknown>[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/financing`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
      http.post(`${BASE_URL}/v1/proposal/simulation/refinancing`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ simulacoes: [SIMULATION_OPTION_WIRE] }, { status: 201 });
      }),
    );

    const client = newClient();
    const financing = {
      cpf: '12345678909',
      licensePlate: 'ABC1D23',
      vehicleAmount: 45000,
      downPayment: 5000,
      state: 'SP',
      isZeroKm: true,
      storeCnpj: '11222333000181',
    };
    const options = await client.v1.simulations.createFinancing(financing);
    await client.v1.simulations.createRefinancing({ cpf: '12345678909', licensePlate: 'ABC1D23', requestedAmount: 25000, ...{ storeCnpj: '11222333000181' } });

    expect(options[0]?.simulationId).toBe(UUID);
    expect(bodies[0]).toEqual({ cpf: '12345678909', placa: 'ABC1D23', valorVeiculo: 45000, valorEntrada: 5000, uf: 'SP', isVeiculoZeroKm: true });
    expect(bodies[1]).toEqual({ cpf: '12345678909', placa: 'ABC1D23', valorSolicitado: 25000 });
  });

  it('createFinancingWithoutCpf posts without Idempotency-Key, unwraps cotacoes and maps snake_case', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = 'unset';

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/financing/without-cpf`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ cotacoes: [WITHOUT_CPF_OPTION_WIRE] });
      }),
    );

    const options = await newClient().v1.simulations.createFinancingWithoutCpf({
      licensePlate: 'ABC1D23',
      vehicleAmount: 45000,
      downPayment: 13500,
      state: 'SP',
    });

    expect(body).toEqual({ placa: 'ABC1D23', valorVeiculo: 45000, valorEntrada: 13500, uf: 'SP' });
    expect(key).toBeNull();
    expect(options).toEqual([
      {
        requestedAmount: 31500,
        term: 24,
        installmentAmount: 2033.96,
        tacAmount: 1500,
        boletoAmount: 0,
        insuranceAmount: 0,
        iofAmount: 934.29,
        iofRate: 3,
        totalCreditAmount: 34084.29,
        totalDebtAmount: 48815.04,
        monthlyCet: 3.62,
        annualCet: 53.25,
        monthlyInterestRate: 3.29,
        annualInterestRate: 47.53,
        approximateDailyRetention: 12.5,
        minimumDownPayment: 13500,
      },
    ]);
    expect(options[0]).not.toHaveProperty('simulationId');
  });

  it('createFinancingWithoutCpf omits valorEntrada from the JSON when downPayment is not informed', async () => {
    stubToken(server);
    let raw = '';

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/financing/without-cpf`, async ({ request }) => {
        raw = await request.text();
        const withoutRetention: Record<string, unknown> = { ...WITHOUT_CPF_OPTION_WIRE };
        delete withoutRetention.valor_retencao_diaria_aproximado;
        return HttpResponse.json({ cotacoes: [withoutRetention] });
      }),
    );

    const options = await newClient().v1.simulations.createFinancingWithoutCpf({ licensePlate: 'ABC1D23', vehicleAmount: 45000, state: 'SP' });

    expect(JSON.parse(raw)).toEqual({ placa: 'ABC1D23', valorVeiculo: 45000, uf: 'SP' });
    expect(raw).not.toContain('valorEntrada');
    expect(options[0]?.approximateDailyRetention).toBeUndefined();
    expect(options[0]?.minimumDownPayment).toBe(13500);
  });

  it('createFinancingWithoutCpf maps 404 and 422 problems like the other routes', async () => {
    stubToken(server);
    let status = 404;

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/financing/without-cpf`, () =>
        status === 404
          ? problem(404, 'Fipe.VehiclePlateNotFound', 'Recurso não encontrado')
          : problem(422, 'Proposal.DownPaymentInvalid', 'Regra de negócio não atendida'),
      ),
    );

    const request = { licensePlate: 'ABC1D23', vehicleAmount: 45000, state: 'SP' };
    const notFound = await newClient().v1.simulations.createFinancingWithoutCpf(request).catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(CredicarroApiError);
    expect((notFound as CredicarroApiError).statusCode).toBe(404);
    expect((notFound as CredicarroApiError).errorCode).toBe('Fipe.VehiclePlateNotFound');

    status = 422;
    const rule = await newClient().v1.simulations.createFinancingWithoutCpf(request).catch((e: unknown) => e);
    expect(rule).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((rule as CredicarroBusinessRuleError).errorCode).toBe('Proposal.DownPaymentInvalid');
  });

  it('createRefinancingWithoutCpf posts without Idempotency-Key, unwraps cotacoes and maps snake_case', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = 'unset';

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/refinancing/without-cpf`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ cotacoes: [REFINANCING_WITHOUT_CPF_OPTION_WIRE] });
      }),
    );

    const options = await newClient().v1.simulations.createRefinancingWithoutCpf({
      licensePlate: 'ABC1D23',
      requestedAmount: 20000,
      state: 'SP',
    });

    expect(body).toEqual({ placa: 'ABC1D23', valorSolicitado: 20000, uf: 'SP' });
    expect(key).toBeNull();
    expect(options).toEqual([
      {
        requestedAmount: 20000,
        term: 24,
        installmentAmount: 1100.5,
        tacAmount: 1500,
        boletoAmount: 0,
        insuranceAmount: 0,
        iofAmount: 600.25,
        iofRate: 3,
        totalCreditAmount: 22100.25,
        totalDebtAmount: 26412,
        monthlyCet: 3.2,
        annualCet: 46.1,
        monthlyInterestRate: 2.8,
        annualInterestRate: 39.29,
        approximateDailyRetention: 12.5,
        minimumAmount: 16000,
        maximumAmount: 40000,
      },
    ]);
    expect(options[0]).not.toHaveProperty('simulationId');
  });

  it('createRefinancingWithoutCpf leaves approximateDailyRetention undefined when the API omits it', async () => {
    stubToken(server);

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/refinancing/without-cpf`, () => {
        const withoutRetention: Record<string, unknown> = { ...REFINANCING_WITHOUT_CPF_OPTION_WIRE };
        delete withoutRetention.valor_retencao_diaria_aproximado;
        return HttpResponse.json({ cotacoes: [withoutRetention] });
      }),
    );

    const options = await newClient().v1.simulations.createRefinancingWithoutCpf({ licensePlate: 'ABC1D23', requestedAmount: 20000, state: 'SP' });

    expect(options[0]?.approximateDailyRetention).toBeUndefined();
    expect(options[0]?.minimumAmount).toBe(16000);
    expect(options[0]?.maximumAmount).toBe(40000);
  });

  it('createRefinancingWithoutCpf maps 404 and 422 problems like the other routes', async () => {
    stubToken(server);
    let status = 404;

    server.use(
      http.post(`${BASE_URL}/v1/proposal/simulation/refinancing/without-cpf`, () =>
        status === 404
          ? problem(404, 'Fipe.VehiclePlateNotFound', 'Recurso não encontrado')
          : problem(422, 'Proposal.RequestAmountInvalid', 'Regra de negócio não atendida'),
      ),
    );

    const request = { licensePlate: 'ABC1D23', requestedAmount: 20000, state: 'SP' };
    const notFound = await newClient().v1.simulations.createRefinancingWithoutCpf(request).catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(CredicarroApiError);
    expect((notFound as CredicarroApiError).statusCode).toBe(404);
    expect((notFound as CredicarroApiError).errorCode).toBe('Fipe.VehiclePlateNotFound');

    status = 422;
    const rule = await newClient().v1.simulations.createRefinancingWithoutCpf(request).catch((e: unknown) => e);
    expect(rule).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((rule as CredicarroBusinessRuleError).errorCode).toBe('Proposal.RequestAmountInvalid');
  });

  it('proposals.create posts to v1/proposal with an automatic key and get maps a ProposalSummary', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v1/proposal`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ id_proposta: UUID }, { status: 201 });
      }),
      http.get(`${BASE_URL}/v1/proposal/${UUID}`, () =>
        HttpResponse.json({
          id_proposta: UUID,
          numero: 7,
          id_simulacao: UUID,
          tipo: 'Refinancing',
          status: 'Completed',
          comprador: { cpf: '123.456.789-01' },
          data_criacao: '2025-10-17T19:05:08.984Z',
        }),
      ),
    );

    const client = newClient();
    expect(await client.v1.proposals.create({ cpf: '12345678909', simulationId: UUID })).toBe(UUID);
    expect(body).toEqual({ cpf: '12345678909', simulacaoId: UUID });
    expect(key).toBeTruthy();

    const proposal = await client.v1.proposals.get(UUID);
    expect(proposal).toMatchObject({ id: UUID, number: 7, type: ProposalType.Refinancing, status: ProposalStatus.Completed, statusName: 'Completed', buyerCpf: '123.456.789-01' });
  });
});
