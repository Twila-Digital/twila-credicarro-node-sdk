import { beforeAll, describe, expect, it } from 'vitest';
import { documentFileFromBytes } from '../../src/proposals/documentFile';
import { buildListPath, pagedToPublic } from '../../src/internal/http/pagination';
import { QueryStringBuilder } from '../../src/internal/http/queryString';
import {
  addressToWire,
  createCustomerRequestToWire,
  professionalDataToWire,
  upsertAddressRequestToWire,
  upsertCustomerRequestToWire,
  upsertProfessionalDataRequestToWire,
} from '../../src/internal/mapping/customerMapper';
import {
  createProposalRequestToWire,
  depositAccountToWire,
  documentUploadToWire,
  proposalDetailsToPublic,
  proposalSummaryToPublic,
  vehicleDetailsToWire,
} from '../../src/internal/mapping/proposalMapper';
import {
  createFinancingRequestToWire,
  createRefinancingRequestToWire,
  financingRangeToPublic,
  refinancingRangeToPublic,
  simulationOptionToPublic,
  simulationToPublic,
} from '../../src/internal/mapping/simulationMapper';
import {
  createWebhookRequestToWire,
  createWebhookResultToPublic,
  updateWebhookRequestToWire,
  webhookToPublic,
} from '../../src/internal/mapping/webhookMapper';
import { DepositAccountType, DocumentType, ProposalParticipant } from '../../src/proposals/enums';
import { OccupationType } from '../../src/customers/types';
import { WebhookAuthenticationType, WebhookStatus, WebhookType } from '../../src/webhooks/types';
import {
  conformanceProblems,
  fetchOpenApi,
  fixtureFromSchema,
  headerParameterNames,
  operationOf,
  queryParameterNames,
  requestSchemaOf,
  resolveSchema,
  responseSchemaOf,
  strictReader,
  type OpenApiDocument,
  type Operation,
  type Schema,
} from './openApiSchemaFixture';

type Method = 'get' | 'post' | 'put' | 'delete';

const SDK_OPERATIONS: [Method, string][] = [
  ['post', '/v1/authentication/accesstoken'],
  ['post', '/v1/customer'],
  ['post', '/v1/customer/unified'],
  ['post', '/v1/customer/address'],
  ['post', '/v1/customer/professional'],
  ['get', '/v2/proposal/simulation/range/financing'],
  ['get', '/v2/proposal/simulation/range/refinancing'],
  ['post', '/v2/proposal/simulation/financing'],
  ['post', '/v2/proposal/simulation/refinancing'],
  ['get', '/v1/proposal/simulation/{simulacaoId}'],
  ['get', '/v1/proposal/simulation'],
  ['post', '/v2/proposal'],
  ['get', '/v2/proposal/{propostaId}'],
  ['get', '/v1/proposal'],
  ['post', '/v2/proposal/{propostaId}/vehicle-detail'],
  ['post', '/v2/proposal/{propostaId}/deposit-account'],
  ['post', '/v2/proposal/{propostaId}/document'],
  ['get', '/v1/proposal/simulation/range/financing'],
  ['get', '/v1/proposal/simulation/range/refinancing'],
  ['post', '/v1/proposal/simulation/financing'],
  ['post', '/v1/proposal/simulation/refinancing'],
  ['post', '/v1/proposal'],
  ['get', '/v1/proposal/{propostaId}'],
  ['post', '/v1/webhook'],
  ['get', '/v1/webhook'],
  ['put', '/v1/webhook/{webhookId}'],
  ['delete', '/v1/webhook/{webhookId}'],
];

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
  complement: 'Bloco B',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01311000',
};
const professional = { occupation: OccupationType.Employee, monthlyIncome: 6500 };

/** O JSON enviado não inclui `undefined`; reproduz isso antes de comparar com o schema. */
function onTheWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

let document: OpenApiDocument;

function operation(method: Method, path: string): Operation {
  const found = operationOf(document, method, path);
  if (!found) throw new Error(`Operação ${method.toUpperCase()} ${path} não encontrada no openapi.yaml.`);
  return found;
}

beforeAll(async () => {
  document = await fetchOpenApi();
});

describe('contrato contra o openapi.yaml público', () => {
  it.each(SDK_OPERATIONS)('%s %s existe no openapi.yaml', (method, path) => {
    expect(
      operationOf(document, method, path),
      `Operação ${method.toUpperCase()} ${path} não encontrada — o SDK e a API divergiram.`,
    ).toBeDefined();
  });

  it('as rotas autenticadas exigem bearerAuth e a de token não', () => {
    expect((operation('post', '/v1/authentication/accesstoken') as { security?: unknown[] }).security).toEqual([]);
    expect((operation('get', '/v2/proposal/{propostaId}') as { security?: unknown[] }).security).toEqual([{ bearerAuth: [] }]);
  });

  it('o servidor de produção e o de staging batem com as URLs do SDK', () => {
    const servers = (document as unknown as { servers: { url: string }[] }).servers.map((server) => server.url);
    expect(servers).toEqual(['https://api.staging.credicarro.com.br/integration', 'https://api.credicarro.com.br/integration']);
  });
});

describe('wire types de requisição só usam propriedades do schema e cobrem os campos obrigatórios', () => {
  const store = '11.222.333/0001-81';
  const financing = { cpf: '12345678909', licensePlate: 'ABC1D23', vehicleAmount: 45000, downPayment: 5000, state: 'SP', isZeroKm: false, storeCnpj: store };
  const refinancing = { cpf: '12345678909', licensePlate: 'ABC1D23', requestedAmount: 25000, storeCnpj: store };
  const proposal = { cpf: '12345678909', simulationId: '123e4567-e89b-12d3-a456-426614174000' };
  const file = documentFileFromBytes(Buffer.from('%PDF-1.7'), 'cnh.pdf');

  const cases: [string, Method, string, () => unknown][] = [
    ['token', 'post', '/v1/authentication/accesstoken', () => ({ clientId: 'id', clientSecret: 'segredo' })],
    ['customers.create', 'post', '/v1/customer', () => createCustomerRequestToWire(personal)],
    [
      'customers.upsert',
      'post',
      '/v1/customer/unified',
      () => upsertCustomerRequestToWire({ ...personal, address, professionalData: professional }),
    ],
    ['customers.upsertAddress', 'post', '/v1/customer/address', () => upsertAddressRequestToWire(personal.cpf, address)],
    [
      'customers.upsertProfessionalData',
      'post',
      '/v1/customer/professional',
      () => upsertProfessionalDataRequestToWire(personal.cpf, professional),
    ],
    ['simulations.createFinancing', 'post', '/v2/proposal/simulation/financing', () => createFinancingRequestToWire(financing, true)],
    ['simulations.createRefinancing', 'post', '/v2/proposal/simulation/refinancing', () => createRefinancingRequestToWire(refinancing, true)],
    ['v1.simulations.createFinancing', 'post', '/v1/proposal/simulation/financing', () => createFinancingRequestToWire(financing, false)],
    ['v1.simulations.createRefinancing', 'post', '/v1/proposal/simulation/refinancing', () => createRefinancingRequestToWire(refinancing, false)],
    ['proposals.create', 'post', '/v2/proposal', () => createProposalRequestToWire(proposal)],
    ['v1.proposals.create', 'post', '/v1/proposal', () => createProposalRequestToWire(proposal)],
    [
      'proposals.sendVehicleDetails',
      'post',
      '/v2/proposal/{propostaId}/vehicle-detail',
      () => vehicleDetailsToWire({ renavam: '12345678900', chassis: '9BWZZZ377VT004251', licensePlate: 'ABC1D23', color: 'PRATA' }),
    ],
    [
      'proposals.sendDepositAccount',
      'post',
      '/v2/proposal/{propostaId}/deposit-account',
      () =>
        depositAccountToWire({
          holderCpf: '12345678909',
          bankCode: '001',
          branch: '1234',
          branchDigit: '5',
          accountNumber: '123456',
          accountDigit: '7',
          accountType: DepositAccountType.Checking,
        }),
    ],
    [
      'proposals.uploadDocument',
      'post',
      '/v2/proposal/{propostaId}/document',
      () => documentUploadToWire({ participant: ProposalParticipant.Buyer, documentType: DocumentType.Cnh, file }),
    ],
    [
      'webhooks.create',
      'post',
      '/v1/webhook',
      () =>
        createWebhookRequestToWire({
          type: WebhookType.Proposal,
          url: 'https://parceiro.com.br/webhooks/credicarro',
          authenticationType: WebhookAuthenticationType.Basic,
          credential: 'dXN1YXJpbzpzZW5oYQ==',
        }),
    ],
    [
      'webhooks.update',
      'put',
      '/v1/webhook/{webhookId}',
      () => updateWebhookRequestToWire({ type: WebhookType.Proposal, url: 'https://parceiro.com.br/x', status: WebhookStatus.Active }),
    ],
  ];

  it.each(cases)('%s', (_name, method, path, build) => {
    const schema = requestSchemaOf(document, operation(method, path));

    expect(Object.keys(schema.properties ?? {}).length).toBeGreaterThan(0);
    expect(conformanceProblems(document, onTheWire(build()), schema)).toEqual([]);
  });

  it('os sub-objetos de endereço e dados profissionais batem com o schema do unified', () => {
    const schema = requestSchemaOf(document, operation('post', '/v1/customer/unified'));

    expect(conformanceProblems(document, onTheWire(addressToWire(address)), resolveSchema(document, schema.properties?.endereco))).toEqual([]);
    expect(
      conformanceProblems(document, onTheWire(professionalDataToWire(professional)), resolveSchema(document, schema.properties?.dadosProfissionais)),
    ).toEqual([]);
  });

  it('o envio de documento exige o header Idempotency-Key e os demais POSTs opcionais o aceitam', () => {
    const upload = operation('post', '/v2/proposal/{propostaId}/document');
    expect(headerParameterNames(document, upload)).toContain('Idempotency-Key');

    for (const [method, path] of [
      ['post', '/v1/customer'],
      ['post', '/v1/customer/unified'],
      ['post', '/v1/customer/address'],
      ['post', '/v1/customer/professional'],
      ['post', '/v1/proposal/simulation/financing'],
      ['post', '/v1/proposal/simulation/refinancing'],
      ['post', '/v2/proposal/simulation/financing'],
      ['post', '/v2/proposal/simulation/refinancing'],
      ['post', '/v1/proposal'],
      ['post', '/v2/proposal'],
    ] as [Method, string][]) {
      expect(headerParameterNames(document, operation(method, path)), `${path} deveria aceitar Idempotency-Key`).toContain('Idempotency-Key');
    }

    for (const [method, path] of [
      ['post', '/v1/webhook'],
      ['post', '/v2/proposal/{propostaId}/vehicle-detail'],
      ['post', '/v2/proposal/{propostaId}/deposit-account'],
    ] as [Method, string][]) {
      expect(headerParameterNames(document, operation(method, path)), `${path} não usa Idempotency-Key`).not.toContain('Idempotency-Key');
    }
  });

  it('os parâmetros de query usados pelo SDK existem nas operações', () => {
    const list = new URL(buildListPath('v1/proposal', { page: 1, pageSize: 10 }), 'https://x/').searchParams;
    for (const path of ['/v1/proposal', '/v1/proposal/simulation', '/v1/webhook']) {
      expect(queryParameterNames(document, operation('get', path))).toEqual(expect.arrayContaining([...list.keys()]));
    }

    const v2Range = new URL(new QueryStringBuilder().add('placa', 'X').add('cnpjLoja', 'Y').build('r'), 'https://x/').searchParams;
    for (const path of ['/v2/proposal/simulation/range/financing', '/v2/proposal/simulation/range/refinancing']) {
      expect(queryParameterNames(document, operation('get', path))).toEqual(expect.arrayContaining([...v2Range.keys()]));
    }

    for (const path of ['/v1/proposal/simulation/range/financing', '/v1/proposal/simulation/range/refinancing']) {
      expect(queryParameterNames(document, operation('get', path))).toEqual(['placa']);
    }
  });
});

describe('os mappers de resposta só leem propriedades presentes no schema', () => {
  function readsOnlySchemaProperties<T>(schema: Schema, map: (wire: never) => T): void {
    const violations: string[] = [];
    const fixture = fixtureFromSchema(document, schema);

    expect(() => map(strictReader(fixture, violations) as never)).not.toThrow();
    expect(violations).toEqual([]);
  }

  const itemSchema = (method: Method, path: string, status = '200'): Schema => {
    const list = responseSchemaOf(document, operation(method, path), status);
    return resolveSchema(document, list.properties?.itens?.items);
  };

  it('GET v2 range financing / refinancing e as equivalentes v1', () => {
    for (const path of ['/v2/proposal/simulation/range/financing', '/v1/proposal/simulation/range/financing']) {
      readsOnlySchemaProperties(responseSchemaOf(document, operation('get', path), '200'), financingRangeToPublic);
    }
    for (const path of ['/v2/proposal/simulation/range/refinancing', '/v1/proposal/simulation/range/refinancing']) {
      readsOnlySchemaProperties(responseSchemaOf(document, operation('get', path), '200'), refinancingRangeToPublic);
    }
  });

  it('opções de simulação (v1 e v2)', () => {
    for (const path of ['/v2/proposal/simulation/financing', '/v2/proposal/simulation/refinancing', '/v1/proposal/simulation/financing', '/v1/proposal/simulation/refinancing']) {
      const list = responseSchemaOf(document, operation('post', path), '201');
      readsOnlySchemaProperties(resolveSchema(document, list.properties?.simulacoes?.items), simulationOptionToPublic);
    }
  });

  it('GET v1 simulation por id e listagem', () => {
    readsOnlySchemaProperties(responseSchemaOf(document, operation('get', '/v1/proposal/simulation/{simulacaoId}'), '200'), simulationToPublic);
    readsOnlySchemaProperties(itemSchema('get', '/v1/proposal/simulation'), simulationToPublic);
  });

  it('GET v2 proposal por id', () => {
    readsOnlySchemaProperties(responseSchemaOf(document, operation('get', '/v2/proposal/{propostaId}'), '200'), proposalDetailsToPublic);
  });

  it('GET v1 proposal por id e listagem', () => {
    readsOnlySchemaProperties(responseSchemaOf(document, operation('get', '/v1/proposal/{propostaId}'), '200'), proposalSummaryToPublic);
    readsOnlySchemaProperties(itemSchema('get', '/v1/proposal'), proposalSummaryToPublic);
  });

  it('webhooks: cadastro e listagem', () => {
    readsOnlySchemaProperties(responseSchemaOf(document, operation('post', '/v1/webhook'), '201'), createWebhookResultToPublic);
    readsOnlySchemaProperties(itemSchema('get', '/v1/webhook'), webhookToPublic);
  });

  it('paginação (itens + pagina)', () => {
    for (const path of ['/v1/proposal', '/v1/proposal/simulation', '/v1/webhook']) {
      readsOnlySchemaProperties(responseSchemaOf(document, operation('get', path), '200'), (wire: never) => pagedToPublic(wire, (item) => item));
    }
  });

  it('respostas com id (id_cliente, id_proposta) e token', () => {
    for (const path of ['/v1/customer', '/v1/customer/unified']) {
      expect(Object.keys(responseSchemaOf(document, operation('post', path), '200').properties ?? {})).toContain('id_cliente');
    }
    for (const path of ['/v1/proposal', '/v2/proposal']) {
      expect(Object.keys(responseSchemaOf(document, operation('post', path), '201').properties ?? {})).toContain('id_proposta');
    }

    const token = responseSchemaOf(document, operation('post', '/v1/authentication/accesstoken'), '200');
    expect(Object.keys(token.properties ?? {})).toEqual(expect.arrayContaining(['token_de_acesso', 'expira_em_segundos', 'expira_em']));
  });

  it('ProblemDetails tem os campos que o SDK interpreta', () => {
    const problem = resolveSchema(document, document.components.schemas.ProblemDetails);

    expect(Object.keys(problem.properties ?? {})).toEqual(expect.arrayContaining(['tipo', 'titulo', 'status', 'detalhe', 'campo', 'erros']));
    expect(Object.keys(resolveSchema(document, problem.properties?.erros?.items).properties ?? {}).sort()).toEqual(['campo', 'codigo', 'mensagem']);
  });
});
