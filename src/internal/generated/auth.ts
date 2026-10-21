export interface GenerateAccessTokenRequestWire {
  clientId: string;
  clientSecret: string;
}

export interface GenerateAccessTokenResponseWire {
  token_de_acesso: string;
  expira_em_segundos?: number;
  expira_em?: string;
  tipo_de_token?: string;
  escopo?: string;
}
