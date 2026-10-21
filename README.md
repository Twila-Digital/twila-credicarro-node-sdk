<p align="center">
  <img src="https://raw.githubusercontent.com/Twila-Digital/twila-credicarro-node-sdk/production/assets/logo-light.svg" alt="Credicarro" width="180" style="max-width: 100%;">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/Twila-Digital/twila-credicarro-node-sdk"></a>
  <a href="https://github.com/Twila-Digital/twila-credicarro-node-sdk/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Twila-Digital/twila-credicarro-node-sdk/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/Twila-Digital/twila-credicarro-node-sdk/actions/workflows/quality.yml"><img alt="Quality" src="https://github.com/Twila-Digital/twila-credicarro-node-sdk/actions/workflows/quality.yml/badge.svg"></a>
  <a href="https://github.com/Twila-Digital/twila-credicarro-node-sdk/security/code-scanning"><img alt="Security" src="https://github.com/Twila-Digital/twila-credicarro-node-sdk/actions/workflows/security.yml/badge.svg"></a>
  <a href="https://codecov.io/gh/Twila-Digital/twila-credicarro-node-sdk"><img alt="Coverage" src="https://codecov.io/gh/Twila-Digital/twila-credicarro-node-sdk/branch/production/graph/badge.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/Node.js-14%2B-539E43">
</p>

# @twila/credicarro

SDK oficial em Node.js/TypeScript para a API de integração do Credicarro — financiamento e refinanciamento de veículos: cadastro do cliente, simulação, proposta, envio de documentos e webhooks.

> Uso restrito a server-side. O `clientSecret` nunca deve ser embarcado em um app mobile, SPA ou qualquer código que rode no navegador/dispositivo do usuário final.

## Compatibilidade

| Runtime | Versões aceitas |
| --- | --- |
| Node.js | 14 ou superior (suíte completa em CI no Node 22/24; smoke test do pacote publicado em Node 14 e 18) |

Publica **CommonJS** (`require`) e **ES Modules** (`import`) no mesmo pacote, com tipos TypeScript inclusos — funciona em projetos legados e modernos sem configuração extra.

## Instalação

```bash
npm install @twila/credicarro
```

## Quick start

```typescript
import { CredicarroClient, CredicarroEnvironment } from '@twila/credicarro';

const client = new CredicarroClient({
  clientId: '<seu-client-id>',
  clientSecret: '<seu-client-secret>',
  environment: CredicarroEnvironment.Staging, // padrão: Production
});
```

Equivalente em CommonJS:

```javascript
const { CredicarroClient, CredicarroEnvironment } = require('@twila/credicarro');
```

`CredicarroClient` deve ser reaproveitado como singleton na sua aplicação — ele mantém o cache do token de acesso (renovado automaticamente, com uma única renovação mesmo sob concorrência) e o estado do circuit breaker. O `clientSecret` não aparece em log, mensagem de erro nem na serialização do cliente.

| Ambiente | URL |
| --- | --- |
| Staging | `https://api.staging.credicarro.com.br/integration/` |
| Produção | `https://api.credicarro.com.br/integration/` |

`baseUrl` permite sobrescrever a URL, mas precisa ser HTTPS (HTTP só é aceito para `localhost` e `127.0.0.1`, em testes).

## Fluxo completo

### 1. Cadastrar o cliente

```typescript
import { OccupationType } from '@twila/credicarro';

const clienteId = await client.customers.upsert({
  cpf: '12345678909',
  firstName: 'Maria',
  lastName: 'Souza',
  email: 'maria.souza@exemplo.com.br',
  phoneNumber: '+55 (11) 99876-5432',
  dateOfBirth: '1990-05-20T00:00:00-03:00',
  address: {
    street: 'Av. Paulista',
    number: '1578',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01311000',
  },
  professionalData: { occupation: OccupationType.Employee, monthlyIncome: 6500 },
});
```

> **Atenção:** `customers.upsert` (`POST v1/customer/unified`) **cria ou atualiza** o cliente porque o SDK **não** envia `Idempotency-Key` nessa rota. Com a chave, a rota só cria (CPF existente → `409 Cpf.CpfAlreadyAdded`). Por isso o SDK nunca gera a chave automaticamente aqui — e, sem ela, a requisição **não é repetida** em caso de falha. Se quiser repetição segura e criação apenas, passe uma chave explícita: `client.customers.upsert(request, 'minha-chave')`.

### 2. Simular

```typescript
const lojaCnpj = '11.222.333/0001-81';

const faixa = await client.simulations.getFinancingRange('ABC1D23', lojaCnpj);

const opcoes = await client.simulations.createFinancing({
  cpf: '12345678909',
  licensePlate: 'ABC1D23',
  vehicleAmount: 45000,
  downPayment: 5000,
  state: 'SP',
  isZeroKm: false,
  storeCnpj: lojaCnpj,
});

for (const opcao of opcoes) console.log(`${opcao.term}x de ${opcao.installmentAmount} (CET ${opcao.monthlyCet}% a.m.)`);
```

Para refinanciamento: `getRefinancingRange` e `createRefinancing({ cpf, licensePlate, requestedAmount, storeCnpj })`.

### 3. Criar a proposta e acompanhar

```typescript
const propostaId = await client.proposals.create({ cpf: '12345678909', simulationId: opcoes[0].simulationId });

const proposta = await client.proposals.get(propostaId);
console.log(proposta.statusName, proposta.biometryLink);
```

### 4. Descobrir o que o integrador precisa fazer

```typescript
import { getPendingActions, PendingActionKind } from '@twila/credicarro';

for (const acao of getPendingActions(proposta)) {
  switch (acao.kind) {
    case PendingActionKind.SendDocuments: // etapa ENVIO_DOCUMENTOS: documentos Pending
    case PendingActionKind.CorrectDocuments: // etapa CORRECAO_DOCUMENTOS: documentos Invalid
      console.log(acao.participant, acao.documentTypes);
      break;
    case PendingActionKind.SendVehicleDetails: // etapa DADOS_VEICULO
    case PendingActionKind.SendDepositAccount: // etapa CONTA_RECEBIMENTO (refinanciamento)
      break;
  }
}
```

`getPendingActions` considera só os participantes (comprador, vendedor, loja) cuja etapa ativa tem o **integrador** como responsável. Funciona também com o evento do webhook v2.

### 5. Enviar documentos e dados

```typescript
import { DocumentFile, DocumentType, ProposalParticipant } from '@twila/credicarro';

const arquivo = await DocumentFile.fromFile('./cnh-comprador.pdf'); // ou fromBytes / fromStream

await client.proposals.uploadDocument(
  propostaId,
  { participant: ProposalParticipant.Buyer, documentType: DocumentType.Cnh, file: arquivo },
  'chave-persistida-deste-envio',
);

await client.proposals.sendVehicleDetails(propostaId, {
  renavam: '12345678900',
  chassis: '9BWZZZ377VT004251',
  licensePlate: 'ABC1D23',
  color: 'PRATA',
});
```

`DocumentFile` valida o arquivo antes de enviar: nome sem caminho com até 255 caracteres, extensão `.pdf`, `.jpg`, `.jpeg` ou `.png`, de 1 byte a 10 MiB, Base64 puro (sem `data:`).

`Idempotency-Key` do envio de documento é **obrigatória** na API. Persista uma chave por envio e reaproveite-a para repetir o **mesmo** envio; use uma chave **nova** ao reenviar o documento para correção. Sem `idempotencyKey`, o SDK gera uma por chamada e usa a mesma em todas as tentativas automáticas daquela chamada.

Para refinanciamento, a conta de recebimento: `client.proposals.sendDepositAccount(propostaId, { holderCpf, bankCode, branch, branchDigit, accountNumber, accountDigit, accountType: DepositAccountType.Checking })`.

## Clientes por recurso

| Cliente | Métodos |
| --- | --- |
| `client.customers` | `upsert`, `create`, `upsertAddress`, `upsertProfessionalData` |
| `client.simulations` | `getFinancingRange`, `getRefinancingRange`, `createFinancing`, `createRefinancing`, `get`, `list` |
| `client.proposals` | `create`, `get`, `list`, `sendVehicleDetails`, `sendDepositAccount`, `uploadDocument` |
| `client.webhooks` | `create`, `list`, `update`, `delete` |
| `client.v1.simulations` | `getFinancingRange(placa)`, `getRefinancingRange(placa)`, `createFinancing`, `createRefinancing` (rotas v1, sem `storeCnpj`) |
| `client.v1.proposals` | `create`, `get` (rotas v1; `get` devolve `ProposalSummary`) |

Funções utilitárias: `getPendingActions`, `parseWebhookEvent`, `parseWebhookEventUnverified`, `verifyWebhookSignature`, `verifyWebhookAuthorization`, `computeWebhookSignature` (e o agrupamento `CredicarroWebhookEvent`), `DocumentFile`.

## Enums

Todos os enums têm o membro `Unknown = -1` para valores que o SDK ainda não conhece — um valor novo da API nunca quebra a desserialização. Os modelos preservam também o valor bruto (`statusRaw`, `statusName`, `stepRaw`, `typeRaw` etc.).

```typescript
if (proposta.status === ProposalStatus.Unknown) console.warn(`status novo: ${proposta.statusRaw} (${proposta.statusName})`);
```

## Paginação

`simulations.list`, `proposals.list` e `webhooks.list` retornam `PagedResult<T>` (`items`, `page`, `pageSize`, `totalCount`, `hasNext`, `hasPrevious`) — sem auto-paginação; você controla o avanço de página. `page` começa em 1 e `pageSize` vai de 1 a 100 (validado no cliente, com `RangeError`).

```typescript
const pagina = await client.proposals.list({ page: 1, pageSize: 20 });

if (pagina.hasNext) await client.proposals.list({ page: 2, pageSize: 20 });
```

## Resiliência, retry e idempotência

Timeout total de 30 s, timeout por tentativa de 10 s (60 s no envio de documento), até 3 tentativas com backoff exponencial e jitter, e circuit breaker (50% de falhas, janela de 30 s, mínimo de 10 chamadas, pausa de 15 s). Tudo configurável em `resilience`:

```typescript
const client = new CredicarroClient({
  clientId,
  clientSecret,
  resilience: { maxRetryAttempts: 4, attemptTimeoutMs: 8_000, retryOn500: true },
});
```

O SDK só **repete** o que é seguro repetir: `GET`; gerar token; `POST` com `Idempotency-Key`; `POST v2/proposal/{id}/vehicle-detail` e `deposit-account` (substituem o que foi enviado); `PUT`/`DELETE v1/webhook/{id}`. **Não** repete `POST v1/webhook` nem `POST v1/customer/unified` sem chave. Repete somente `408`, `429` (respeitando `Retry-After`), `500` (`retryOn500`, padrão `true`, como recomenda a documentação), `502`, `503`, `504`, falha de rede e timeout de tentativa — nunca outros `4xx`.

`Idempotency-Key` é gerada automaticamente (um UUID por chamada lógica, **o mesmo em todas as tentativas**) em `customers.create`, `upsertAddress`, `upsertProfessionalData`, `simulations.createFinancing/createRefinancing`, `proposals.create` e `proposals.uploadDocument` (e nas rotas v1 equivalentes). `resilience.disableAutomaticIdempotencyKey` desliga a geração automática (exceto no envio de documento, onde o header é obrigatório) — e, sem a chave, essas chamadas deixam de ser repetidas.

Uma resposta `401` renova o token e repete a chamada **uma** vez. `Retry-After` (segundos ou data HTTP) é respeitado; valor inválido ou não positivo é ignorado, valor absurdo é limitado a 24 h e, se for maior que o orçamento restante, o SDK não espera: lança já `CredicarroRateLimitError` com `retryAfterMs`. O orçamento de tempo é o `totalTimeoutMs` (30 s) e, no envio de documento, tentativa × número de tentativas (padrão 180 s); ao estourar, a requisição em andamento é cancelada. Redirecionamentos (3xx) **não** são seguidos (viram `CredicarroApiError`) e respostas acima de 10 MiB são recusadas. `idempotencyKey` explícita: 1 a 200 caracteres ASCII imprimíveis (não só espaços), senão `RangeError` antes de qualquer requisição.

## Tratamento de erros

| Erro | Quando |
| --- | --- |
| `CredicarroConfigurationError` | Configuração inválida do `CredicarroClient` (credenciais ausentes, `baseUrl` sem HTTPS, resiliência inconsistente) |
| `CredicarroAuthenticationError` | Falha ao gerar o token (`401`/`400` do endpoint de token) ou `401` persistente depois da renovação |
| `CredicarroValidationError` | `400` — use `field` e `errors` |
| `CredicarroBusinessRuleError` | `422` — regra de negócio; trate pelo `errorCode` (ex.: `Store.Integration.Intermediation`) |
| `CredicarroRateLimitError` | `429`, com `retryAfterMs` |
| `CredicarroApiError` | Qualquer outro erro de API (`403`, `404`, `409`, `5xx`) — base de `Validation`, `BusinessRule` e `RateLimit` |
| `CredicarroTimeoutError` | Timeout (de tentativa ou total), falha de rede ou circuit breaker aberto |
| `CredicarroWebhookSignatureError` | Assinatura de webhook inválida/expirada ou corpo ilegível |

```typescript
import { CredicarroApiError, CredicarroBusinessRuleError } from '@twila/credicarro';

try {
  await client.proposals.create({ cpf, simulationId });
} catch (error) {
  if (error instanceof CredicarroBusinessRuleError && error.errorCode === 'Proposal.SimulationAlreadyExpired') {
    // refaça a simulação
  } else if (error instanceof CredicarroApiError) {
    console.log(error.statusCode, error.errorCode, error.field);
  }
}
```

`errorCode` é o `tipo` estável da API (ex.: `Validation.Cpf.Invalid`) — **use-o no seu tratamento**. A mensagem do erro traz só o status, o `tipo` e o título; `detail` e `rawBody` ficam em propriedades **não enumeráveis** (fora de `JSON.stringify`, `console.log` e logs estruturados) porque podem conter dados pessoais. Já `util.inspect`/`console.log` das respostas (propostas, simulações, eventos de webhook, `DocumentFile`, resultado do cadastro de webhook) mostram CPF como `***.456.789-**` e demais dados sensíveis como `***`. A máscara vale só para depuração e log: as propriedades e o `JSON.stringify`/`toJSON` (usados para responder, enfileirar e persistir) carregam os **valores reais**, então não registre o JSON das respostas em log. O erro continua sem `detail`/`rawBody` no `toJSON`. Objetos de requisição montados por você não são mascarados: não os registre em log. Também são aceitos os campos padrão `type`/`title`/`detail` (usados em alguns `500`/`502`), e um `401` sem corpo.

## Webhooks

Cadastre o webhook e **guarde o `signingSecret`** — ele só é devolvido nessa resposta:

```typescript
import { WebhookAuthenticationType, WebhookType } from '@twila/credicarro';

const { webhookId, signingSecret } = await client.webhooks.create({
  type: WebhookType.Proposal,
  url: 'https://parceiro.com.br/webhooks/credicarro',
  authenticationType: WebhookAuthenticationType.Basic,
  credential: Buffer.from('usuario:senha').toString('base64'),
});
```

Valide a notificação com o **corpo bruto** (antes de qualquer `JSON.parse`) e o header `X-CrediCarro-Signature`:

```typescript
import { parseWebhookEvent, verifyWebhookAuthorization, getPendingActions } from '@twila/credicarro';

const assinatura = req.header('X-CrediCarro-Signature') ?? ''; // header ausente = vazio = assinatura inválida
const evento = parseWebhookEvent(rawBody, assinatura, signingSecret); // lança CredicarroWebhookSignatureError se inválida

evento.proposalId;
evento.status; // ProposalStatus (aceita nomes em português do payload v2 e em inglês do v1)
evento.isDetailed; // true no payload v2 (retrato completo): buyer / store / seller
getPendingActions(evento);
```

A assinatura é `t={timestamp},v1={hex}`: HMAC-SHA256 de `"{t}.{corpo bruto}"` com o `signingSecret` em UTF-8, comparada em tempo constante, com tolerância de 5 minutos nos dois sentidos (`{ toleranceMs }` ajusta e precisa ser finito e >= 0; senão `RangeError`). O header e o segredo são **obrigatórios**: ausente ou vazio é sempre assinatura inválida (`CredicarroWebhookSignatureError`), e `t` ou `v1` repetidos no header invalidam a assinatura. O corpo precisa trazer um `id_proposta` UUID. Para ler um corpo **sem** verificar (apenas testes), use a função de nome explícito `parseWebhookEventUnverified(rawBody)` — nunca em endpoint público.

Para conferir a sua implementação, a documentação traz um vetor de teste: segredo `segredo-de-exemplo`, `t=1715792400` e o corpo `{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","enum_status":2,"status":"Approved"}` resultam em `v1=db66c554eb116ef2577deb63f72619793502a31520f622b2d59864b074eb8df2`.

Boas práticas: responda `401` se a assinatura for inválida, `2xx` rápido (limite de 15 s por entrega), processe de forma assíncrona e deduplique pelo header `Idempotency-Key` da notificação. `verifyWebhookAuthorization(recebido, esperado)` compara o header `Authorization` configurado no cadastro (Basic ou Jwt) em tempo constante. Veja o endpoint completo (segredo obrigatório, `Authorization`, deduplicação, 503 se não enfileirar) com Express e corpo bruto limitado a 1 MiB em [`samples/sample-webhook-express`](samples/sample-webhook-express/index.js).

## Samples

- `samples/sample-cjs` — CommonJS (`require`), consulta de faixa de financiamento
- `samples/sample-esm` — ES Modules (`import`), listagem de propostas e ações pendentes
- `samples/sample-webhook-express` — endpoint de webhook (Express) que valida a assinatura com o corpo bruto limitado a 1 MiB

## Qualidade, segurança e cobertura

- **Build** (`ci.yml`) — `tsc --noEmit`, lint e build dual CJS/ESM via `tsup` (alvo `node14`, com downlevel automático de sintaxe não suportada).
- **Test** (`ci.yml`) — suíte completa (vitest + MSW) em Node 22/24, que é o mínimo que o próprio vitest 5 exige (`^22.12.0 || ^24.0.0`) — não roda em Node 14/18. Job separado (`legacy-smoke`) valida o pacote já compilado (`dist/`) rodando de verdade em Node 14 e 18, sem depender do vitest.
- **Contract tests** (`contract-tests.yml`) — conferem os tipos do SDK contra o [`openapi.yaml` público](https://documentacao.credicarro.com.br/openapi.yaml) (o swagger de staging exige autenticação); rodam diariamente e antes de cada release.
- **Quality** (`quality.yml`) — análise estática via Codacy CLI, resultados publicados na aba **Security → Code scanning** do repositório.
- **Security** (`security.yml`) — [CodeQL](https://codeql.github.com/) para JavaScript/TypeScript, rodando a cada PR/push e semanalmente.
- **Coverage** — cobertura de testes coletada via `@vitest/coverage-v8` e publicada no [Codecov](https://codecov.io/gh/Twila-Digital/twila-credicarro-node-sdk).

## Documentação completa

[documentacao.credicarro.com.br](https://documentacao.credicarro.com.br) — referência de todos os endpoints, autenticação, erros, etapas e status, documentos e webhooks.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Código de conduta

Este projeto segue o [Código de Conduta](CODE_OF_CONDUCT.md).

## Licença

[MIT](LICENSE)
