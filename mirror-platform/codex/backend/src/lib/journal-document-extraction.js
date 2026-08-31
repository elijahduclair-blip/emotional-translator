import crypto from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';

export const JOURNAL_EXTRACTION_VERSION = 'ari-journal-document.v1';
export const MAX_JOURNAL_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_JOURNAL_EXTRACTED_CODE_POINTS = 500_000;
export const JOURNAL_CHUNK_CODE_POINTS = 4_000;

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.jsonl', '.ndjson',
  '.yaml', '.yml', '.html', '.htm', '.xml', '.log', '.eml'
]);
const ZIP_EXTENSIONS = new Set(['.docx', '.pptx', '.xlsx', '.odt', '.ods', '.odp', '.epub']);
export const SUPPORTED_JOURNAL_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS, ...ZIP_EXTENSIONS, '.pdf', '.rtf'
]);

export async function extractJournalDocument(candidate) {
  const fileName = normalizeFileName(candidate?.fileName);
  const extension = path.extname(fileName).toLocaleLowerCase('en-US');
  if (!SUPPORTED_JOURNAL_EXTENSIONS.has(extension)) {
    throw httpError(415, `Unsupported journal file type ${extension || '(none)'}.`);
  }
  const data = decodeBase64(candidate?.dataBase64);
  if (data.length > MAX_JOURNAL_FILE_BYTES) {
    throw httpError(413, `Journal files must be ${MAX_JOURNAL_FILE_BYTES / 1024 / 1024} MB or smaller.`);
  }
  validateSignature(extension, data);

  const mediaType = normalizeMediaType(candidate?.mediaType, extension);
  const extracted = extension === '.pdf'
    ? await extractPdf(data)
    : extension === '.rtf'
      ? extractRtf(data)
      : TEXT_EXTENSIONS.has(extension)
        ? extractTextDocument(data, extension)
        : await extractZipDocument(data, extension);
  const finalized = finalizeJournalExtraction({
    units: extracted.units,
    warnings: extracted.warnings,
    emptyWarning: extension === '.pdf'
      ? 'No searchable text was found. The PDF may contain scanned images and requires OCR.'
      : 'No searchable text was found in this file.'
  });

  return {
    version: JOURNAL_EXTRACTION_VERSION,
    fileName,
    extension,
    mediaType,
    sizeBytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    data,
    status: finalized.text ? 'ready' : 'needs_ocr',
    ...finalized
  };
}

export function finalizeJournalExtraction({ units, warnings = [], emptyWarning = '' }) {
  const normalizedUnits = normalizeUnits(units);
  const text = normalizedUnits.map(unit => unit.text).filter(Boolean).join('\n\n').trim();
  const characterCount = [...text].length;
  if (characterCount > MAX_JOURNAL_EXTRACTED_CODE_POINTS) {
    throw httpError(413, `Extracted journal text must be ${MAX_JOURNAL_EXTRACTED_CODE_POINTS} Unicode code points or fewer.`);
  }
  const normalizedWarnings = [...new Set(warnings.filter(Boolean).map(value => String(value).trim()))].slice(0, 20);
  if (!text && emptyWarning) normalizedWarnings.push(emptyWarning);
  return {
    text,
    characterCount,
    unitCount: normalizedUnits.length,
    units: normalizedUnits.map(unit => ({
      index: unit.index,
      locator: unit.locator,
      characterCount: [...unit.text].length
    })),
    chunks: chunkUnits(normalizedUnits),
    warnings: normalizedWarnings
  };
}

function normalizeFileName(value) {
  const fileName = path.basename(String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '')).trim();
  if (!fileName || fileName.length > 180) throw httpError(400, 'A file name of 180 characters or fewer is required.');
  return fileName;
}

function decodeBase64(value) {
  const source = String(value || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!source || !/^[A-Za-z0-9+/]*={0,2}$/.test(source)) throw httpError(400, 'File data must be valid base64.');
  const data = Buffer.from(source, 'base64');
  if (!data.length) throw httpError(400, 'The selected file is empty.');
  const canonical = data.toString('base64').replace(/=+$/, '');
  if (canonical !== source.replace(/=+$/, '')) throw httpError(400, 'File data must be valid base64.');
  return data;
}

function validateSignature(extension, data) {
  if (extension === '.pdf' && data.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw httpError(422, 'The selected .pdf file does not contain a valid PDF header.');
  }
  if (ZIP_EXTENSIONS.has(extension) && data.subarray(0, 2).toString('ascii') !== 'PK') {
    throw httpError(422, `The selected ${extension} file is not a valid modern document archive.`);
  }
}

function normalizeMediaType(value, extension) {
  const supplied = String(value || '').trim().toLocaleLowerCase('en-US').slice(0, 120);
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  return ({
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown',
    '.csv': 'text/csv', '.tsv': 'text/tab-separated-values', '.json': 'application/json',
    '.jsonl': 'application/x-ndjson', '.ndjson': 'application/x-ndjson', '.yaml': 'application/yaml',
    '.yml': 'application/yaml', '.html': 'text/html', '.htm': 'text/html', '.xml': 'application/xml',
    '.log': 'text/plain', '.eml': 'message/rfc822', '.rtf': 'application/rtf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.odt': 'application/vnd.oasis.opendocument.text', '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation', '.epub': 'application/epub+zip'
  })[extension] || 'application/octet-stream';
}

async function extractPdf(data) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const pages = Array.isArray(result.pages) ? result.pages : [];
    const units = pages.length
      ? pages.map((page, index) => ({
          index: index + 1,
          locator: { kind: 'page', page: Number(page.num || index + 1), label: `Page ${Number(page.num || index + 1)}` },
          text: String(page.text || '')
        }))
      : [{ index: 1, locator: { kind: 'document', label: 'Document text' }, text: String(result.text || '') }];
    return { units, warnings: [] };
  } catch (error) {
    throw httpError(422, `The PDF could not be read: ${error instanceof Error ? error.message : 'invalid PDF'}`);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function extractTextDocument(data, extension) {
  const raw = decodeText(data);
  const text = ['.html', '.htm'].includes(extension)
    ? htmlToText(raw)
    : extension === '.xml'
      ? xmlToText(raw)
      : extension === '.json'
        ? prettyJson(raw)
        : raw;
  return { units: [{ index: 1, locator: { kind: 'document', label: 'Document text' }, text }], warnings: [] };
}

function extractRtf(data) {
  const raw = decodeText(data);
  const text = raw
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, value) => Buffer.from(value, 'hex').toString('latin1'))
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\u(-?\d+)\??/g, (_, value) => String.fromCodePoint((Number(value) + 65536) % 65536))
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/\\[{}\\]/g, match => match.slice(1))
    .replace(/[{}]/g, '');
  return { units: [{ index: 1, locator: { kind: 'document', label: 'Document text' }, text }], warnings: [] };
}

async function extractZipDocument(data, extension) {
  let zip;
  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: true, createFolders: false });
  } catch (error) {
    throw httpError(422, `The ${extension} file could not be opened: ${error instanceof Error ? error.message : 'invalid archive'}`);
  }
  if (extension === '.docx') return extractDocx(zip);
  if (extension === '.pptx') return extractPptx(zip);
  if (extension === '.xlsx') return extractXlsx(zip);
  if (['.odt', '.ods', '.odp'].includes(extension)) return extractOpenDocument(zip, extension);
  if (extension === '.epub') return extractEpub(zip);
  throw httpError(415, `Unsupported journal archive type ${extension}.`);
}

async function extractDocx(zip) {
  const names = Object.keys(zip.files)
    .filter(name => /^word\/(?:document|footnotes|endnotes|header\d+|footer\d+)\.xml$/i.test(name))
    .sort(documentPartOrder);
  if (!names.includes('word/document.xml')) throw httpError(422, 'The DOCX document body is missing.');
  const units = [];
  for (const name of names) {
    const xml = await zip.file(name)?.async('text');
    if (!xml) continue;
    const label = name === 'word/document.xml' ? 'Document body' : titleFromPart(name);
    units.push({ index: units.length + 1, locator: { kind: 'section', label }, text: wordXmlToText(xml) });
  }
  return { units, warnings: [] };
}

async function extractPptx(zip) {
  const names = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort(naturalCompare);
  if (!names.length) throw httpError(422, 'No presentation slides were found.');
  const units = [];
  for (const name of names) {
    const slide = Number(name.match(/slide(\d+)\.xml/i)?.[1] || units.length + 1);
    const xml = await zip.file(name)?.async('text');
    units.push({ index: units.length + 1, locator: { kind: 'slide', slide, label: `Slide ${slide}` }, text: drawingXmlToText(xml || '') });
  }
  return { units, warnings: [] };
}

async function extractXlsx(zip) {
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('text');
  const sharedStrings = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(match => drawingXmlToText(match[1])) : [];
  const workbookXml = await zip.file('xl/workbook.xml')?.async('text');
  const sheetNames = workbookXml
    ? [...workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"[^>]*>/gi)].map(match => decodeXmlEntities(match[1]))
    : [];
  const names = Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort(naturalCompare);
  if (!names.length) throw httpError(422, 'No spreadsheet worksheets were found.');
  const units = [];
  for (const name of names) {
    const sheet = Number(name.match(/sheet(\d+)\.xml/i)?.[1] || units.length + 1);
    const xml = await zip.file(name)?.async('text');
    const label = sheetNames[sheet - 1] || `Sheet ${sheet}`;
    units.push({ index: units.length + 1, locator: { kind: 'sheet', sheet, label }, text: worksheetXmlToText(xml || '', sharedStrings) });
  }
  return { units, warnings: [] };
}

async function extractOpenDocument(zip, extension) {
  const xml = await zip.file('content.xml')?.async('text');
  if (!xml) throw httpError(422, 'The OpenDocument content is missing.');
  const kind = extension === '.odp' ? 'presentation' : extension === '.ods' ? 'spreadsheet' : 'document';
  return { units: [{ index: 1, locator: { kind, label: 'OpenDocument content' }, text: xmlToText(xml) }], warnings: [] };
}

async function extractEpub(zip) {
  const names = Object.keys(zip.files)
    .filter(name => /\.(?:xhtml|html|htm)$/i.test(name) && !/nav\.(?:xhtml|html)$/i.test(name))
    .sort(naturalCompare)
    .slice(0, 500);
  if (!names.length) throw httpError(422, 'No readable EPUB chapters were found.');
  const units = [];
  for (const name of names) {
    const html = await zip.file(name)?.async('text');
    units.push({ index: units.length + 1, locator: { kind: 'chapter', label: path.basename(name) }, text: htmlToText(html || '') });
  }
  return { units, warnings: [] };
}

function worksheetXmlToText(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const type = attributes.match(/\bt="([^"]+)"/i)?.[1] || '';
      const inline = body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i)?.[1];
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] || '';
      const value = type === 's' ? sharedStrings[Number(raw)] || ''
        : type === 'inlineStr' ? drawingXmlToText(inline || '')
          : type === 'b' ? (raw === '1' ? 'TRUE' : 'FALSE')
            : decodeXmlEntities(raw);
      cells.push(value);
    }
    rows.push(cells.join('\t'));
  }
  return rows.join('\n');
}

function wordXmlToText(xml) {
  return normalizeExtractedText(xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<[^>]+>/g, ''));
}

function drawingXmlToText(xml) {
  return normalizeExtractedText(xml
    .replace(/<a:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/a:p>/gi, '\n')
    .replace(/<[^>]+>/g, ''));
}

function xmlToText(xml) {
  return normalizeExtractedText(xml
    .replace(/<\/(?:text:p|text:h|table:table-row|office:presentation)>/gi, '\n')
    .replace(/<\/(?:table:table-cell)>/gi, '\t')
    .replace(/<[^>]+>/g, ''));
}

function htmlToText(html) {
  return normalizeExtractedText(String(html)
    .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>/gi, '')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, ''));
}

function prettyJson(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

function decodeText(data) {
  if (data.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) return data.subarray(2).toString('utf16le');
  if (data.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
    const swapped = Buffer.from(data.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2) [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
    return swapped.toString('utf16le');
  }
  return data.toString('utf8').replace(/^\uFEFF/, '');
}

function normalizeUnits(units) {
  return (Array.isArray(units) ? units : []).map((unit, index) => ({
    index: index + 1,
    locator: unit?.locator && typeof unit.locator === 'object' ? unit.locator : { kind: 'section', label: `Section ${index + 1}` },
    text: normalizeExtractedText(unit?.text)
  })).filter(unit => unit.text);
}

function normalizeExtractedText(value) {
  return decodeXmlEntities(String(value || ''))
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/[\t ]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => safeCodePoint(Number(decimal)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&amp;/gi, '&');
}

function safeCodePoint(value) {
  try { return String.fromCodePoint(value); } catch { return '\uFFFD'; }
}

function chunkUnits(units) {
  const chunks = [];
  for (const unit of units) {
    const points = [...unit.text];
    for (let start = 0; start < points.length; start += JOURNAL_CHUNK_CODE_POINTS) {
      const text = points.slice(start, start + JOURNAL_CHUNK_CODE_POINTS).join('').trim();
      if (!text) continue;
      chunks.push({ ordinal: chunks.length + 1, locator: unit.locator, content: text, characterCount: [...text].length });
    }
  }
  return chunks;
}

function naturalCompare(left, right) {
  return left.localeCompare(right, 'en-US', { numeric: true, sensitivity: 'base' });
}

function documentPartOrder(left, right) {
  if (left === 'word/document.xml') return -1;
  if (right === 'word/document.xml') return 1;
  return naturalCompare(left, right);
}

function titleFromPart(name) {
  return path.basename(name, '.xml').replace(/(\D)(\d+)/, '$1 $2').replace(/^./, value => value.toUpperCase());
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
