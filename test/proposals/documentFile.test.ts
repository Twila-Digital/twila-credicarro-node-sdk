import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { DocumentFile, MAX_DOCUMENT_SIZE_BYTES } from '../../src';
import { validateDocumentFile } from '../../src/proposals/documentFile';

const directory = mkdtempSync(join(tmpdir(), 'credicarro-sdk-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('DocumentFile', () => {
  it('fromBytes encodes pure Base64', () => {
    const file = DocumentFile.fromBytes(Buffer.from('conteúdo'), 'Documento.PDF');

    expect(file).toEqual({ fileName: 'Documento.PDF', base64Content: Buffer.from('conteúdo').toString('base64') });
    expect(file.base64Content).not.toContain('data:');
  });

  it('accepts Uint8Array and the four allowed extensions (case-insensitive)', () => {
    for (const name of ['a.pdf', 'a.jpg', 'a.JPEG', 'a.png']) {
      expect(() => DocumentFile.fromBytes(new Uint8Array([1]), name)).not.toThrow();
    }
  });

  it('rejects names with a path, too long, empty or with a disallowed extension', () => {
    const content = Buffer.from('x');

    expect(() => DocumentFile.fromBytes(content, 'pasta/a.pdf')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(content, 'pasta\\a.pdf')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(content, `${'a'.repeat(252)}.pdf`)).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(content, '')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(content, 'a.gif')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(content, 'a.pdf.exe')).toThrow(RangeError);
  });

  it('accepts a name with exactly 255 characters', () => {
    expect(() => DocumentFile.fromBytes(Buffer.from('x'), `${'a'.repeat(251)}.pdf`)).not.toThrow();
  });

  it('rejects empty content and content above 10 MiB, accepting exactly 10 MiB', () => {
    expect(() => DocumentFile.fromBytes(Buffer.alloc(0), 'a.pdf')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES + 1), 'a.pdf')).toThrow(RangeError);
    expect(() => DocumentFile.fromBytes(Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES), 'a.pdf')).not.toThrow();
  });

  it('fromStream reads the whole stream', async () => {
    const stream = Readable.from([Buffer.from('parte-1,'), Buffer.from('parte-2')]);

    const file = await DocumentFile.fromStream(stream, 'a.png');

    expect(Buffer.from(file.base64Content, 'base64').toString('utf8')).toBe('parte-1,parte-2');
  });

  it('fromStream stops above 10 MiB', async () => {
    const stream = Readable.from([Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES), Buffer.alloc(1)]);

    await expect(DocumentFile.fromStream(stream, 'a.pdf')).rejects.toBeInstanceOf(RangeError);
  });

  it('fromFile reads from disk and defaults the name to the file name', async () => {
    const path = join(directory, 'laudo-ecv.pdf');
    writeFileSync(path, 'pdf-bytes');

    const file = await DocumentFile.fromFile(path);
    const renamed = await DocumentFile.fromFile(path, 'outro-nome.pdf');

    expect(file.fileName).toBe('laudo-ecv.pdf');
    expect(renamed.fileName).toBe('outro-nome.pdf');
    expect(Buffer.from(file.base64Content, 'base64').toString('utf8')).toBe('pdf-bytes');
  });

  it('validateDocumentFile rejects hand-made files with a data: prefix, line breaks or bad padding', () => {
    expect(() => validateDocumentFile({ fileName: 'a.pdf', base64Content: 'data:application/pdf;base64,AAAA' })).toThrow(RangeError);
    expect(() => validateDocumentFile({ fileName: 'a.pdf', base64Content: 'AAAA\nAAAA' })).toThrow(RangeError);
    expect(() => validateDocumentFile({ fileName: 'a.pdf', base64Content: 'AAA' })).toThrow(RangeError);
    expect(() => validateDocumentFile({ fileName: 'a.pdf', base64Content: '' })).toThrow(RangeError);
    expect(() => validateDocumentFile({ fileName: 'a.pdf', base64Content: 'AAAA' })).not.toThrow();
  });
});
