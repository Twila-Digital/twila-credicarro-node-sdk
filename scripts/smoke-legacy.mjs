import assert from 'node:assert';

import {
  CredicarroClient,
  CredicarroEnvironment,
  CredicarroConfigurationError,
  CredicarroWebhookSignatureError,
  ProposalStatus,
  DocumentFile,
  getPendingActions,
  parseWebhookEvent,
  computeWebhookSignature,
  verifyWebhookSignature,
} from '../dist/index.mjs';

function assertThrows(fn, expectedType, label) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof expectedType, `'${label}' lançou ${error.constructor.name}, esperava ${expectedType.name}`);
    return;
  }
  throw new Error(`esperava que '${label}' lançasse ${expectedType.name}, mas não lançou nada`);
}

const client = new CredicarroClient({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  environment: CredicarroEnvironment.Staging,
});

assert.strictEqual(typeof client.customers.upsert, 'function');
assert.strictEqual(typeof client.simulations.createFinancing, 'function');
assert.strictEqual(typeof client.proposals.uploadDocument, 'function');
assert.strictEqual(typeof client.webhooks.create, 'function');
assert.strictEqual(typeof client.v1.proposals.get, 'function');

assertThrows(() => new CredicarroClient({ clientId: '', clientSecret: 'x' }), CredicarroConfigurationError, 'clientId vazio');
assertThrows(
  () => new CredicarroClient({ clientId: 'a', clientSecret: 'b', baseUrl: 'http://exemplo.com.br' }),
  CredicarroConfigurationError,
  'baseUrl sem HTTPS',
);

assert.strictEqual(ProposalStatus.Approved, 2);

assert.strictEqual(DocumentFile.fromBytes(Buffer.from('abc'), 'a.pdf').base64Content, 'YWJj');

const secret = 'segredo-de-exemplo';
const timestamp = 1715792400;
const body = '{"id_proposta":"bea8d060-f93d-48eb-b6c4-45f64483cdd9","enum_status":2,"status":"Approved"}';
const expected = 'db66c554eb116ef2577deb63f72619793502a31520f622b2d59864b074eb8df2';

assert.strictEqual(computeWebhookSignature(secret, timestamp, body), expected);
assert.strictEqual(verifyWebhookSignature(body, `t=${timestamp},v1=${expected}`, secret, { nowMs: timestamp * 1000 }), true);

const event = parseWebhookEvent(body, `t=${timestamp},v1=${expected}`, secret, { nowMs: timestamp * 1000 });
assert.strictEqual(event.proposalId, 'bea8d060-f93d-48eb-b6c4-45f64483cdd9');
assert.strictEqual(event.status, ProposalStatus.Approved);
assert.deepStrictEqual(getPendingActions(event), []);

assertThrows(() => parseWebhookEvent(body, `t=${timestamp},v1=${'0'.repeat(64)}`, secret, { nowMs: timestamp * 1000 }), CredicarroWebhookSignatureError, 'assinatura inválida');

console.log(`OK — @twila/credicarro (dist/index.mjs) funcionando em Node ${process.version}`);
