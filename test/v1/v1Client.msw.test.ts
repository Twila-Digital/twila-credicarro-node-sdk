import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ProposalStatus, ProposalType } from '../../src';
import { BASE_URL, SIMULATION_OPTION_WIRE, UUID, newClient, stubToken } from '../support';

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
