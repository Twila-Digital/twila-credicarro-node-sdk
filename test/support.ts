import { http, HttpResponse } from 'msw';
import type { setupServer } from 'msw/node';
import { CredicarroClient, type CredicarroResilienceOptions } from '../src';

// Sem "/" final de propósito — regressão do bug de resolução de URI relativa (RFC 3986 §5.3).
export const BASE_URL = 'http://localhost/integration';

export const CLIENT_ID = 'client-id-de-teste';
export const CLIENT_SECRET = 'client-secret-de-teste';
export const UUID = 'bea8d060-f93d-48eb-b6c4-45f64483cdd9';

export function tokenResponse(token = 'token-de-teste', lifetimeSeconds = 3600): Record<string, unknown> {
  return {
    token_de_acesso: token,
    expira_em_segundos: lifetimeSeconds,
    expira_em: new Date(Date.now() + (lifetimeSeconds - 60) * 1000).toISOString(),
    tipo_de_token: 'Bearer',
    escopo: 'credicarro.integration.access/full',
  };
}

export function newClient(resilience: Partial<CredicarroResilienceOptions> = {}): CredicarroClient {
  return new CredicarroClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    baseUrl: BASE_URL,
    resilience: { totalTimeoutMs: 5000, attemptTimeoutMs: 2000, retryBaseDelayMs: 1, ...resilience },
  });
}

export function stubToken(server: ReturnType<typeof setupServer>, token = 'token-de-teste'): void {
  server.use(http.post(`${BASE_URL}/v1/authentication/accesstoken`, () => HttpResponse.json(tokenResponse(token))));
}

export function problem(status: number, tipo: string, titulo: string, detalhe = 'detalhe do erro', campo?: string) {
  return HttpResponse.json({ tipo, titulo, status, detalhe, ...(campo ? { campo } : {}) }, { status });
}

export const PAGE = { tem_proximo: true, tem_anterior: false, numero: 1, tamanho: 10, total: 25 };

export const SIMULATION_OPTION_WIRE = {
  id_simulacao: UUID,
  valor_solicitado: 40000,
  prazo: 36,
  valor_parcela: 2042.42,
  valor_tac: 1500,
  valor_boleto: 3.5,
  valor_seguro: 0,
  valor_iof: 872,
  percentual_iof: 1.92,
  valor_credito_total: 42722,
  valor_divida_total: 73527.12,
  percentual_cet_mensal: 3.62,
  percentual_cet_anual: 53.25,
  percentual_juros_mensal: 3.29,
  percentual_juros_anual: 47.53,
  valor_retencao_diaria_aproximado: 12.5,
};

export const V2_PROPOSAL_WIRE = {
  id_proposta: UUID,
  numero: 171020250001,
  id_simulacao: '123e4567-e89b-12d3-a456-426614174000',
  enum_status: 2,
  status: 'APROVADA',
  tipo: 'Refinancing',
  data_criacao: '2026-10-12T14:05:08.984-03:00',
  motivo_recusa: null,
  link_biometria: 'https://onboarding.exemplo.com/sessao/abc123',
  comprador: {
    cpf: '12345678909',
    enum_biometria: 3,
    biometria: 'APROVADA',
    status_ativo: {
      enum_etapa: 7,
      etapa: 'CORRECAO_DOCUMENTOS',
      enum_situacao: 4,
      situacao: 'PENDENTE_CORRECAO',
      enum_responsavel_acao: 2,
      responsavel_acao: 'INTEGRADOR',
    },
    etapas_concluidas: [{ enum_etapa: 4, etapa: 'ANALISE_BIOMETRIA', data: '2026-10-12T14:20:00-03:00' }],
    documentos: [
      { enum_tipo: 1, tipo: 'CNH', enum_status: 2, status: 'INVALIDO', motivo: 'Documento ilegível' },
      { enum_tipo: 5, tipo: 'COMPROVANTE_RESIDENCIA', enum_status: 1, status: 'VALIDO' },
    ],
  },
  loja: {
    cnpj: '11222333000181',
    status_ativo: {
      enum_etapa: 6,
      etapa: 'ENVIO_DOCUMENTOS',
      enum_situacao: 1,
      situacao: 'AGUARDANDO_ENVIO',
      enum_responsavel_acao: 2,
      responsavel_acao: 'INTEGRADOR',
    },
    etapas_concluidas: [],
    documentos: [
      { enum_tipo: 8, tipo: 'LAUDO_ECV', enum_status: 5, status: 'PENDENTE' },
      { enum_tipo: 6, tipo: 'DOCUMENTO_VEICULO', enum_status: 1, status: 'VALIDO' },
    ],
  },
};
