# Contribuindo

## Pré-requisitos

- Node.js 22.12+ para rodar a suíte de testes (vitest 5 exige isso — ver abaixo)
- npm 9+

## Build e testes

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm test
```

O vitest 5 **não roda em Node 14/18** (exige `^22.12.0 || ^24.0.0 || >=26.0.0`) — a suíte completa só faz sentido em Node 22+. Para validar o piso legado (Node 14) que o pacote publicado promete suportar, rode o smoke test sem framework contra o build real:

```bash
npm run build
node scripts/smoke-legacy.cjs
node scripts/smoke-legacy.mjs
```

Troque o Node ativo (nvm, volta, etc.) para 14 ou 18 antes de rodar os dois comandos acima — essa é a validação que realmente importa para o piso mínimo, já que o vitest não consegue fazer isso por si.

Os contract tests (`contract-tests/`) baixam o `openapi.yaml` público da documentação (`https://documentacao.credicarro.com.br/openapi.yaml`; o swagger de staging exige autenticação) e conferem que os tipos de requisição e resposta do SDK só usam propriedades que existem no contrato. Eles precisam de rede e não rodam por padrão:

```bash
npm test --workspace=contract-tests
```

Para testar contra outro arquivo (por exemplo, uma alteração ainda não publicada da documentação), sirva-o por HTTP e aponte a variável `CREDICARRO_CONTRACT_TESTS_OPENAPI_URL`.

## Estrutura

- `src/` — API pública (`CredicarroClient` e clientes por recurso). Tipos de fio (`internal/generated`) e mapeamento (`internal/mapping`) são internos e não fazem parte da API pública.
- `test/` — testes unitários e de integração com [MSW](https://mswjs.io/) (nenhum acesso à rede real).
- `contract-tests/` — conferência contra o `openapi.yaml` público.
- `samples/` — exemplos em CommonJS, ES Modules e um endpoint de webhook com Express.

## Regras do SDK

- Mensagens de erro e textos em português do Brasil; nomes públicos em inglês e `camelCase`.
- `clientSecret` nunca pode aparecer em log, mensagem de erro, `toString` ou serialização.
- Nunca repita automaticamente uma requisição que não seja segura de repetir (ver `internal/idempotency/idempotencyClassifier.ts`). `POST v1/customer/unified` jamais recebe `Idempotency-Key` automática.
- Rota, campo ou código novo só entra se estiver no `openapi.yaml`/na documentação.

## Instalando a partir do código-fonte

Enquanto o pacote não é publicado no npm, use o protocolo `file:` apontando para este repositório:

```json
{
  "dependencies": {
    "@twila/credicarro": "file:../caminho/para/twila-credicarro-node-sdk"
  }
}
```

Ou empacote localmente e consuma o tarball:

```bash
npm pack
npm install /caminho/para/twila-credicarro-1.0.0.tgz
```

## Abrindo um PR

1. Crie uma branch a partir de `production`
2. Adicione testes para qualquer mudança de comportamento
3. Rode `npm run typecheck && npm run lint && npm test` localmente antes de abrir o PR
4. Abra o PR contra `production` — o CI roda build + testes automaticamente

## Release (publicação no npm)

O npm tem **Trusted Publishing (OIDC)** — o próprio `npm publish` troca o token OIDC do GitHub Actions por uma credencial de publish de curta duração, sem precisar de um token de longa duração guardado como secret. Exige **npm CLI ≥ 11.5.1** e **Node 24+** no job que publica — o pacote em si continua compatível com Node 14+ para quem instala. O workflow força `npm install -g npm@latest` antes do publish porque a versão de npm empacotada com o Node pode ficar abaixo de 11.5.1 dependendo da imagem do runner.

Antes do primeiro release, alguém com acesso à conta/organização do npm precisa configurar:

1. Criar o escopo/organização `@twila` no [npmjs.com](https://www.npmjs.com/) (se ainda não existir).
2. No pacote `@twila/credicarro` (ou já na criação, via **Settings → Trusted Publisher**), adicionar um Trusted Publisher:
   - **Repository owner:** `Twila-Digital`
   - **Repository:** `twila-credicarro-node-sdk`
   - **Workflow filename:** `release.yml`
   - **Environment:** `production`
3. No repositório do GitHub, criar o [environment](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment) `production` (Settings → Environments) com **Required reviewers** configurado. Nenhum secret de registry é necessário.

Com isso configurado, `git push --tags` numa tag `v*` (ex.: `v1.0.0`) dispara build → contract tests → **pausa esperando aprovação manual do `environment` `production`** → `npm publish` (Trusted Publishing) → GitHub Release.

> **Pacote novo, ainda sem nenhuma versão publicada?** O Trusted Publisher do npm pode ser configurado como "pending" antes do pacote existir — o primeiro `npm publish` via OIDC já cria o pacote.

## Reportando problemas

Abra uma [issue](https://github.com/Twila-Digital/twila-credicarro-node-sdk/issues) com passos para reproduzir, versão do pacote/Node e o comportamento esperado vs. observado. Nunca inclua `clientId`/`clientSecret` reais, tokens ou dados pessoais de clientes no relato.
