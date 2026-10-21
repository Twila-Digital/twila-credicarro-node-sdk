export interface PagedResult<T> {
  items: T[];
  /** Página atual (`numero`). */
  page: number;
  /** Tamanho da página (`tamanho`). */
  pageSize: number;
  /** Total de itens encontrados (`total`). */
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Parâmetros de paginação (`pagina_inicial`, `limite`). Padrão: página 1, 10 itens (máximo 100). */
export interface ListRequest {
  page?: number;
  pageSize?: number;
}
