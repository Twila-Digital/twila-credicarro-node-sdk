const { CredicarroClient, CredicarroEnvironment, CredicarroApiError } = require('@twila/credicarro');

async function main() {
  const clientId = process.env.CREDICARRO_CLIENT_ID;
  const clientSecret = process.env.CREDICARRO_CLIENT_SECRET;
  const storeCnpj = process.env.CREDICARRO_STORE_CNPJ;
  const licensePlate = process.env.CREDICARRO_LICENSE_PLATE;

  if (!clientId || !clientSecret || !storeCnpj || !licensePlate) {
    console.error(
      'Defina CREDICARRO_CLIENT_ID, CREDICARRO_CLIENT_SECRET, CREDICARRO_STORE_CNPJ e CREDICARRO_LICENSE_PLATE no ambiente antes de rodar este sample.',
    );
    process.exitCode = 1;
    return;
  }

  const client = new CredicarroClient({
    clientId,
    clientSecret,
    environment: CredicarroEnvironment.Staging,
  });

  try {
    const faixa = await client.simulations.getFinancingRange(licensePlate, storeCnpj);

    for (const opcao of faixa) {
      console.log(`${opcao.term} meses: entrada mínima de ${opcao.minimumDownPayment}`);
    }
  } catch (error) {
    if (error instanceof CredicarroApiError) {
      console.error(`${error.statusCode} ${error.errorCode}: ${error.message}`);
    } else {
      throw error;
    }
  }
}

main();
