export interface PaginaWire {
  tem_proximo: boolean;
  tem_anterior: boolean;
  numero: number;
  tamanho: number;
  total: number;
}

export interface PagedResultWire<T> {
  itens: T[];
  pagina: PaginaWire;
}
