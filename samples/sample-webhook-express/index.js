// Endpoint de webhook do Credicarro com Express (espelha o exemplo das skills).
//
// Pontos de atenção (veja https://documentacao.credicarro.com.br, "Verificação e segurança"):
//  - a assinatura é calculada sobre o corpo BRUTO: por isso usamos express.raw(), nunca express.json();
//  - o corpo é limitado a 1 MiB e a resposta 2xx deve ser rápida (limite de 15 segundos por entrega);
//  - o segredo é obrigatório (HMAC com chave vazia é forjável): sem ele a aplicação não sobe;
//  - assinatura/Authorization inválidos => 401; corpo ilegível => 400; falha ao enfileirar => 503 (a Credicarro repete);
//  - o header Idempotency-Key identifica a notificação ({id_mensagem}:{id_webhook}): use-o para deduplicar;
//  - nada de dados do evento em log: só o id da proposta e o tipo do erro.
const express = require('express');
const {
  CredicarroWebhookSignatureError,
  getPendingActions,
  parseWebhookEvent,
  verifyWebhookAuthorization,
  verifyWebhookSignature,
} = require('@twila/credicarro');

const signingSecret = process.env.CREDICARRO_WEBHOOK_SIGNING_SECRET;
if (!signingSecret) {
  console.error('Defina CREDICARRO_WEBHOOK_SIGNING_SECRET (o segredo_assinatura devolvido no cadastro do webhook).');
  process.exit(1);
}
// Valor completo esperado do header Authorization ("Basic ..." ou "Bearer ..."); defina se o webhook usa Basic/Jwt.
const expectedAuthorization = process.env.CREDICARRO_WEBHOOK_AUTHORIZATION;
const port = Number(process.env.PORT || 3000);

/** Deduplicação atômica em memória. Em produção: Redis `SET chave 1 NX EX <ttl>` (claim) e `DEL chave` (release). */
const seen = new Set();
const dedup = {
  claim: async (key) => {
    if (seen.has(key)) return false; // sem await entre checar e marcar: atômico no event loop
    seen.add(key);
    return true;
  },
  release: async (key) => {
    seen.delete(key);
  },
};

/** Fila em memória só para o exemplo: em produção use fila durável (SQS, RabbitMQ, tabela outbox). */
const jobs = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
      try {
        // Entregas chegam fora de ordem: no sistema real, consulte a proposta (client.proposals.get) para o estado mais recente.
        console.log(`proposta ${job.proposalId}: status ${job.statusName} (${job.statusRaw}) | ações pendentes: ${getPendingActions(job).length}`);
      } catch (error) {
        console.error(`falha ao processar webhook | Proposta: ${job.proposalId} | ${error && error.constructor ? error.constructor.name : 'Error'}`);
      }
    }
  } finally {
    draining = false;
  }
}

function enqueue(event) {
  jobs.push(event);
  void drain();
}

const app = express();

app.post('/webhooks/credicarro', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const raw = req.body;
  if (!Buffer.isBuffer(raw)) {
    res.sendStatus(401); // POST sem corpo
    return;
  }

  if (expectedAuthorization && !verifyWebhookAuthorization(req.get('Authorization'), expectedAuthorization)) {
    res.sendStatus(401);
    return;
  }

  const signature = req.get('X-CrediCarro-Signature') || '';
  if (!verifyWebhookSignature(raw, signature, signingSecret)) {
    res.sendStatus(401);
    return;
  }

  let event;
  try {
    // parseWebhookEvent verifica a assinatura de novo e lê o corpo (v1 ou v2). Falha de leitura: 400, repetir não adianta.
    event = parseWebhookEvent(raw, signature, signingSecret);
  } catch (error) {
    if (error instanceof CredicarroWebhookSignatureError) {
      res.sendStatus(400);
      return;
    }
    throw error;
  }

  const idempotencyKey = req.get('Idempotency-Key') || '';
  const first = idempotencyKey ? await dedup.claim(idempotencyKey) : true;
  if (!first) {
    res.sendStatus(200); // entrega repetida: já foi aceita
    return;
  }

  try {
    enqueue(event); // só responde 2xx depois de enfileirar
  } catch {
    if (idempotencyKey) await dedup.release(idempotencyKey);
    res.sendStatus(503); // a Credicarro repete a entrega
    return;
  }

  res.sendStatus(200); // responda 2xx rápido (limite de 15 s)
});

// Corpo acima de 1 MiB (413) e demais erros: nunca vazam detalhes.
app.use((error, _req, res, _next) => {
  res.sendStatus(error && error.status === 413 ? 413 : 400);
});

app.listen(port, () => console.log(`Webhook do Credicarro escutando em http://localhost:${port}/webhooks/credicarro`));
