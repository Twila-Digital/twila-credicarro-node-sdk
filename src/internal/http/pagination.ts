import type { ListRequest, PagedResult } from '../../pagedResult';
import type { PagedResultWire } from '../generated/paged';
import { QueryStringBuilder } from './queryString';

const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

/** Valida `page` (>= 1) e `pageSize` (1 a 100) e devolve o caminho com `pagina_inicial` e `limite`. */
export function buildListPath(path: string, request: ListRequest | undefined): string {
  const page = request?.page ?? MIN_PAGE;
  const pageSize = request?.pageSize ?? 10;

  if (!Number.isInteger(page) || page < MIN_PAGE) throw new RangeError('page deve ser um inteiro maior ou igual a 1.');

  if (!Number.isInteger(pageSize) || pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE)
    throw new RangeError('pageSize deve ser um inteiro entre 1 e 100.');

  return new QueryStringBuilder().add('pagina_inicial', page).add('limite', pageSize).build(path);
}

export function pagedToPublic<TWire, TPublic>(wire: PagedResultWire<TWire>, map: (item: TWire) => TPublic): PagedResult<TPublic> {
  return {
    items: (wire.itens ?? []).map(map),
    page: wire.pagina?.numero ?? 1,
    pageSize: wire.pagina?.tamanho ?? 0,
    totalCount: wire.pagina?.total ?? 0,
    hasNext: wire.pagina?.tem_proximo ?? false,
    hasPrevious: wire.pagina?.tem_anterior ?? false,
  };
}
