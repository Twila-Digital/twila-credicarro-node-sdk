export enum CredicarroEnvironment {
  Staging = 'staging',
  Production = 'production',
}

const BASE_URLS: Record<CredicarroEnvironment, string> = {
  [CredicarroEnvironment.Staging]: 'https://api.staging.credicarro.com.br/integration/',
  [CredicarroEnvironment.Production]: 'https://api.credicarro.com.br/integration/',
};

export function environmentBaseUrl(environment: CredicarroEnvironment): string {
  return BASE_URLS[environment];
}
