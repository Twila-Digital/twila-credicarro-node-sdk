import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionOwner,
  BiometryStatus,
  CredicarroBusinessRuleError,
  DepositAccountType,
  DocumentFile,
  DocumentStatus,
  DocumentType,
  ProposalParticipant,
  ProposalStatus,
  ProposalStep,
  ProposalType,
  StepSituation,
} from '../../src';
import { BASE_URL, PAGE, UUID, V2_PROPOSAL_WIRE, newClient, problem, stubToken } from '../support';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ProposalsClient (MSW)', () => {
  it('create posts cpf + simulacaoId to v2 and returns id_proposta', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v2/proposal`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id_proposta: UUID }, { status: 201 });
      }),
    );

    const id = await newClient().proposals.create({ cpf: '12345678909', simulationId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(id).toBe(UUID);
    expect(body).toEqual({ cpf: '12345678909', simulacaoId: '123e4567-e89b-12d3-a456-426614174000' });
  });

  it('get maps the full ProposalV2Response (status, participants, steps, documents)', async () => {
    stubToken(server);

    server.use(http.get(`${BASE_URL}/v2/proposal/${UUID}`, () => HttpResponse.json(V2_PROPOSAL_WIRE)));

    const proposal = await newClient().proposals.get(UUID);

    expect(proposal).toMatchObject({
      id: UUID,
      number: 171020250001,
      simulationId: '123e4567-e89b-12d3-a456-426614174000',
      status: ProposalStatus.Approved,
      statusRaw: 2,
      statusName: 'APROVADA',
      type: ProposalType.Refinancing,
      createdAt: '2026-10-12T14:05:08.984-03:00',
      biometryLink: 'https://onboarding.exemplo.com/sessao/abc123',
    });
    expect(proposal.refusalReason).toBeUndefined();
    expect(proposal.seller).toBeUndefined();

    expect(proposal.buyer).toEqual({
      document: '12345678909',
      biometry: BiometryStatus.Approved,
      biometryRaw: 3,
      biometryName: 'APROVADA',
      activeStep: {
        step: ProposalStep.DocumentCorrection,
        stepRaw: 7,
        stepName: 'CORRECAO_DOCUMENTOS',
        situation: StepSituation.PendingCorrection,
        situationRaw: 4,
        situationName: 'PENDENTE_CORRECAO',
        actionOwner: ActionOwner.Integrator,
        actionOwnerRaw: 2,
        actionOwnerName: 'INTEGRADOR',
      },
      completedSteps: [{ step: ProposalStep.BiometryAnalysis, stepRaw: 4, stepName: 'ANALISE_BIOMETRIA', date: '2026-10-12T14:20:00-03:00' }],
      documents: [
        { type: DocumentType.Cnh, typeRaw: 1, typeName: 'CNH', status: DocumentStatus.Invalid, statusRaw: 2, statusName: 'INVALIDO', reason: 'Documento ilegível' },
        { type: DocumentType.ProofOfAddress, typeRaw: 5, typeName: 'COMPROVANTE_RESIDENCIA', status: DocumentStatus.Valid, statusRaw: 1, statusName: 'VALIDO', reason: undefined },
      ],
    });

    expect(proposal.store?.document).toBe('11222333000181');
    expect(proposal.store?.biometry).toBeUndefined();
    expect(proposal.store?.documents.map((d) => d.status)).toEqual([DocumentStatus.Pending, DocumentStatus.Valid]);
  });

  it('get preserves the raw value of unknown enum codes', async () => {
    stubToken(server);

    server.use(
      http.get(`${BASE_URL}/v2/proposal/${UUID}`, () =>
        HttpResponse.json({
          ...V2_PROPOSAL_WIRE,
          enum_status: 77,
          status: 'NOVO_STATUS',
          tipo: 'Leasing',
          comprador: {
            cpf: '12345678909',
            enum_biometria: 9,
            biometria: 'NOVA',
            status_ativo: { enum_etapa: 99, etapa: 'ETAPA_NOVA', enum_situacao: 99, situacao: 'X', enum_responsavel_acao: 99, responsavel_acao: 'Y' },
            etapas_concluidas: [],
            documentos: [{ enum_tipo: 123, tipo: 'NOVO_DOC', enum_status: 88, status: 'NOVO' }],
          },
        }),
      ),
    );

    const proposal = await newClient().proposals.get(UUID);

    expect(proposal.status).toBe(ProposalStatus.Unknown);
    expect(proposal.statusRaw).toBe(77);
    expect(proposal.statusName).toBe('NOVO_STATUS');
    expect(proposal.type).toBe(ProposalType.Unknown);
    expect(proposal.buyer?.biometry).toBe(BiometryStatus.Unknown);
    expect(proposal.buyer?.biometryRaw).toBe(9);
    expect(proposal.buyer?.activeStep).toMatchObject({ step: ProposalStep.Unknown, stepRaw: 99, situation: StepSituation.Unknown, actionOwner: ActionOwner.Unknown });
    expect(proposal.buyer?.documents[0]).toMatchObject({ type: DocumentType.Unknown, typeRaw: 123, typeName: 'NOVO_DOC', status: DocumentStatus.Unknown, statusRaw: 88 });
  });

  it('get surfaces 422 Proposal.Access.NotIntegrationV2 as a business rule error', async () => {
    stubToken(server);

    server.use(http.get(`${BASE_URL}/v2/proposal/${UUID}`, () => problem(422, 'Proposal.Access.NotIntegrationV2', 'Regra de negócio não atendida')));

    const error = await newClient()
      .proposals.get(UUID)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((error as CredicarroBusinessRuleError).errorCode).toBe('Proposal.Access.NotIntegrationV2');
  });

  it('list maps ProposalResponse items (status by English name)', async () => {
    stubToken(server);
    let url = '';

    server.use(
      http.get(`${BASE_URL}/v1/proposal`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          itens: [
            {
              id_proposta: UUID,
              numero: 171020250001,
              id_simulacao: '123e4567-e89b-12d3-a456-426614174000',
              tipo: 'Financing',
              status: 'InNegotiation',
              comprador: { cpf: '123.456.789-01' },
              vendedor: { cpf: '987.654.321-00' },
              data_criacao: '2025-10-17T19:05:08.984Z',
            },
            {
              id_proposta: UUID,
              numero: 2,
              id_simulacao: UUID,
              tipo: 'Refinancing',
              status: 'Whatever',
              comprador: { cpf: '123.456.789-01' },
              data_criacao: '2025-10-18T19:05:08.984Z',
            },
          ],
          pagina: PAGE,
        });
      }),
    );

    const page = await newClient().proposals.list({ page: 3, pageSize: 5 });

    const search = new URL(url).searchParams;
    expect(search.get('pagina_inicial')).toBe('3');
    expect(search.get('limite')).toBe('5');
    expect(page.totalCount).toBe(25);
    expect(page.items[0]).toEqual({
      id: UUID,
      number: 171020250001,
      simulationId: '123e4567-e89b-12d3-a456-426614174000',
      type: ProposalType.Financing,
      status: ProposalStatus.InNegotiation,
      statusName: 'InNegotiation',
      buyerCpf: '123.456.789-01',
      sellerCpf: '987.654.321-00',
      createdAt: '2025-10-17T19:05:08.984Z',
    });
    expect(page.items[1]?.status).toBe(ProposalStatus.Unknown);
    expect(page.items[1]?.sellerCpf).toBeUndefined();
  });

  it('sendVehicleDetails maps to renavam/chassi/placa/cor (204)', async () => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/vehicle-detail`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await newClient().proposals.sendVehicleDetails(UUID, { renavam: '12345678900', chassis: '9BWZZZ377VT004251', licensePlate: 'ABC1D23', color: 'PRATA' });

    expect(body).toEqual({ renavam: '12345678900', chassi: '9BWZZZ377VT004251', placa: 'ABC1D23', cor: 'PRATA' });
  });

  it.each([
    [DepositAccountType.Checking, 'CORRENTE'],
    [DepositAccountType.Savings, 'POUPANCA'],
    [DepositAccountType.Payment, 'PAGAMENTO'],
  ])('sendDepositAccount maps account type %s to %s', async (accountType, wire) => {
    stubToken(server);
    let body: unknown;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/deposit-account`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await newClient().proposals.sendDepositAccount(UUID, {
      holderCpf: '12345678909',
      bankCode: '001',
      branch: '1234',
      branchDigit: '5',
      accountNumber: '123456',
      accountDigit: '7',
      accountType,
    });

    expect(body).toEqual({
      cpfTitular: '12345678909',
      codigoBanco: '001',
      agencia: '1234',
      digitoAgencia: '5',
      conta: '123456',
      digitoConta: '7',
      tipoConta: wire,
    });
  });

  it('sendDepositAccount rejects an unknown account type locally', async () => {
    await expect(
      newClient().proposals.sendDepositAccount(UUID, {
        holderCpf: '1',
        bankCode: '001',
        branch: '1',
        branchDigit: '1',
        accountNumber: '1',
        accountDigit: '1',
        accountType: DepositAccountType.Unknown,
      }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('uploadDocument posts the document wire body with the Idempotency-Key header', async () => {
    stubToken(server);
    let body: unknown;
    let key: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const file = DocumentFile.fromBytes(Buffer.from('%PDF-1.7 conteudo'), 'cnh-comprador.pdf');
    await newClient().proposals.uploadDocument(UUID, { participant: ProposalParticipant.Buyer, documentType: DocumentType.Cnh, file }, 'doc-7f3c2a10-comprador-cnh');

    expect(key).toBe('doc-7f3c2a10-comprador-cnh');
    expect(body).toEqual({
      participante: 'COMPRADOR',
      tipoDocumento: 1,
      nomeArquivo: 'cnh-comprador.pdf',
      conteudoBase64: Buffer.from('%PDF-1.7 conteudo').toString('base64'),
    });
  });

  it.each([
    [ProposalParticipant.Seller, 'VENDEDOR'],
    [ProposalParticipant.Store, 'LOJA'],
  ])('uploadDocument maps participant %s to %s', async (participant, wire) => {
    stubToken(server);
    let body: { participante?: string } = {};

    server.use(
      http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await newClient().proposals.uploadDocument(UUID, {
      participant,
      documentType: DocumentType.VehicleDocument,
      file: DocumentFile.fromBytes(Buffer.from([1, 2, 3]), 'crlv.png'),
    });

    expect(body.participante).toBe(wire);
  });

  it('uploadDocument validates participant, type and file before sending', async () => {
    const client = newClient();
    const file = DocumentFile.fromBytes(Buffer.from('x'), 'a.pdf');

    await expect(client.proposals.uploadDocument(UUID, { participant: ProposalParticipant.Unknown, documentType: DocumentType.Cnh, file })).rejects.toBeInstanceOf(RangeError);
    await expect(client.proposals.uploadDocument(UUID, { participant: ProposalParticipant.Buyer, documentType: DocumentType.Unknown, file })).rejects.toBeInstanceOf(RangeError);
    await expect(
      client.proposals.uploadDocument(UUID, { participant: ProposalParticipant.Buyer, documentType: DocumentType.Cnh, file: { fileName: 'a.exe', base64Content: 'AAAA' } }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('uploadDocument surfaces 422 Document.InvalidProposalStage as a business rule error', async () => {
    stubToken(server);

    server.use(http.post(`${BASE_URL}/v2/proposal/${UUID}/document`, () => problem(422, 'Document.InvalidProposalStage', 'Regra de negócio não atendida')));

    const error = await newClient()
      .proposals.uploadDocument(UUID, {
        participant: ProposalParticipant.Buyer,
        documentType: DocumentType.Cnh,
        file: DocumentFile.fromBytes(Buffer.from('x'), 'a.pdf'),
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CredicarroBusinessRuleError);
    expect((error as CredicarroBusinessRuleError).errorCode).toBe('Document.InvalidProposalStage');
  });
});
