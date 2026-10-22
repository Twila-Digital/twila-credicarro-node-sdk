import { CredicarroClient, CredicarroEnvironment, CredicarroApiError, getPendingActions } from '@twila/credicarro';

async function main() {
  const clientId = process.env.CREDICARRO_CLIENT_ID;
  const clientSecret = process.env.CREDICARRO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Defina CREDICARRO_CLIENT_ID e CREDICARRO_CLIENT_SECRET no ambiente antes de rodar este sample.');
    process.exitCode = 1;
    return;
  }

  const client = new CredicarroClient({
    clientId,
    clientSecret,
    environment: CredicarroEnvironment.Staging,
  });

  try {
    const pagina = await client.proposals.list({ page: 1, pageSize: 10 });

    for (const resumo of pagina.items) {
      const proposta = await client.proposals.get(resumo.id);

      for (const acao of getPendingActions(proposta)) {
        console.log(`Proposta ${proposta.number}: ação pendente ${acao.kind} (etapa ${acao.step})`);
      }
    }
  } catch (error) {
    if (error instanceof CredicarroApiError) {
      console.error(`${error.statusCode} ${error.errorCode}: ${error.message}`);
    } else {
      throw error;
    }
  }
}

await main();
