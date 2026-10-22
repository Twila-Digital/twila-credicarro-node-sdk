const express = require('express');
const { rateLimit } = require('express-rate-limit');
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
const expectedAuthorization = process.env.CREDICARRO_WEBHOOK_AUTHORIZATION;
const port = Number(process.env.PORT || 3000);

/** Deduplicação atômica em memória. Em produção: Redis `SET chave 1 NX EX <ttl>` (claim) e `DEL chave` (release). */
const seen = new Set();
const dedup = {
  claim: async (key) => {
    if (seen.has(key)) return false;
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

const webhookLimiter = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false });

app.post('/webhooks/credicarro', webhookLimiter, express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const raw = req.body;
  if (!Buffer.isBuffer(raw)) {
    res.sendStatus(401);
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
    res.sendStatus(200);
    return;
  }

  try {
    enqueue(event);
  } catch {
    if (idempotencyKey) await dedup.release(idempotencyKey);
    res.sendStatus(503);
    return;
  }

  res.sendStatus(200);
});

app.use((error, _req, res, _next) => {
  res.sendStatus(error && error.status === 413 ? 413 : 400);
});

app.listen(port, () => console.log(`Webhook do Credicarro escutando em http://localhost:${port}/webhooks/credicarro`));
