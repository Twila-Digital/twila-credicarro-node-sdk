import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import type { Readable } from 'node:stream';
import { protectPii } from '../internal/util/pii';

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 255;
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const READ_CHUNK_BYTES = 64 * 1024;

/**
 * Arquivo pronto para `proposals.uploadDocument`: nome sem caminho e conteúdo em Base64 puro (sem `data:`).
 * `util.inspect` não mostra o conteúdo; `JSON.stringify` o inclui (use para persistir).
 */
export interface DocumentFile {
  readonly fileName: string;
  readonly base64Content: string;
}

/** Cria um `DocumentFile` a partir dos bytes do arquivo (1 byte a 10 MiB; `.pdf`, `.jpg`, `.jpeg` ou `.png`). */
export function documentFileFromBytes(content: Buffer | Uint8Array, fileName: string): DocumentFile {
  validateFileName(fileName);

  if (content.byteLength === 0) throw new RangeError('O arquivo do documento está vazio.');
  if (content.byteLength > MAX_DOCUMENT_SIZE_BYTES) throw new RangeError('O arquivo do documento excede o limite de 10 MiB.');

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content.buffer, content.byteOffset, content.byteLength);

  return protectPii({ fileName, base64Content: buffer.toString('base64') });
}

/** Lê o stream em laço, interrompendo ao passar de 10 MiB, e cria o `DocumentFile`. */
export async function documentFileFromStream(stream: Readable, fileName: string): Promise<DocumentFile> {
  validateFileName(fileName);

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;

    if (size > MAX_DOCUMENT_SIZE_BYTES) {
      stream.destroy();
      throw new RangeError('O arquivo do documento excede o limite de 10 MiB.');
    }

    chunks.push(buffer);
  }

  return documentFileFromBytes(Buffer.concat(chunks), fileName);
}

/**
 * Lê o arquivo do disco em laço, com limite de 10 MiB + 1 byte (o tamanho informado pelo sistema de arquivos não é
 * confiável). `fileName` é opcional: o padrão é o nome do próprio arquivo.
 */
export async function documentFileFromPath(path: string, fileName?: string): Promise<DocumentFile> {
  const name = fileName ?? basename(path);
  validateFileName(name);

  const handle = await fs.open(path, 'r');
  try {
    const chunks: Buffer[] = [];
    let size = 0;

    for (;;) {
      const buffer = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, MAX_DOCUMENT_SIZE_BYTES + 1 - size));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;

      size += bytesRead;
      if (size > MAX_DOCUMENT_SIZE_BYTES) throw new RangeError('O arquivo do documento excede o limite de 10 MiB.');

      chunks.push(buffer.subarray(0, bytesRead));
    }

    return documentFileFromBytes(Buffer.concat(chunks), name);
  } finally {
    await handle.close();
  }
}

/** Atalhos agrupados: `DocumentFile.fromBytes`, `DocumentFile.fromStream` e `DocumentFile.fromFile`. */
export const DocumentFile = {
  fromBytes: documentFileFromBytes,
  fromStream: documentFileFromStream,
  fromFile: documentFileFromPath,
};

/** Revalida um `DocumentFile` montado à mão (objeto literal) antes de enviar. */
export function validateDocumentFile(file: DocumentFile): void {
  if (!file || typeof file !== 'object') throw new TypeError('file é obrigatório.');

  validateFileName(file.fileName);

  const content = file.base64Content;
  if (typeof content !== 'string' || content.length === 0) throw new RangeError('O arquivo do documento está vazio.');

  if (!BASE64_PATTERN.test(content) || content.length % 4 !== 0)
    throw new RangeError('base64Content deve ser Base64 puro, sem o prefixo "data:" nem quebras de linha.');

  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0;
  const decodedSize = (content.length / 4) * 3 - padding;
  if (decodedSize > MAX_DOCUMENT_SIZE_BYTES) throw new RangeError('O arquivo do documento excede o limite de 10 MiB.');
}

function validateFileName(fileName: string): void {
  if (typeof fileName !== 'string' || fileName.trim().length === 0) throw new RangeError('fileName é obrigatório.');

  if (fileName.length > MAX_FILE_NAME_LENGTH) throw new RangeError('fileName deve ter no máximo 255 caracteres.');

  if (/[\\/]/.test(fileName)) throw new RangeError('fileName deve ser só o nome do arquivo, sem caminho.');

  const lower = fileName.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension)))
    throw new RangeError('fileName deve ter a extensão .pdf, .jpg, .jpeg ou .png.');
}
