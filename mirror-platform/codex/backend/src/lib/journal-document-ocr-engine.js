import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { createWorker, OEM } from 'tesseract.js';
import { finalizeJournalExtraction } from './journal-document-extraction.js';
import { JOURNAL_OCR_VERSION, MAX_JOURNAL_OCR_PAGES } from './journal-document-ocr-constants.js';

const TARGET_RENDER_SCALE = 2;
const MAX_RENDER_PIXELS = 12_000_000;
const require = createRequire(import.meta.url);
const englishDataPath = path.dirname(
  require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')
);

export async function runJournalOcrEngine(data, options = {}) {
  installPdfCanvasGlobals();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0
  });
  let pdf;
  let worker;
  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_JOURNAL_OCR_PAGES) {
      throw httpError(413, `Scanned journal PDFs may contain up to ${MAX_JOURNAL_OCR_PAGES} pages per OCR pass.`);
    }
    worker = await createWorker('eng', OEM.LSTM_ONLY, { langPath: englishDataPath, gzip: true });

    const units = [];
    const confidences = [];
    let blankPageCount = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: TARGET_RENDER_SCALE });
      const pixelCount = baseViewport.width * baseViewport.height;
      const scale = pixelCount > MAX_RENDER_PIXELS
        ? TARGET_RENDER_SCALE * Math.sqrt(MAX_RENDER_PIXELS / pixelCount)
        : TARGET_RENDER_SCALE;
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas.toBuffer('image/png'));
      const text = String(result?.data?.text || '').trim();
      const confidence = boundedConfidence(result?.data?.confidence);
      if (text) {
        confidences.push(confidence);
        units.push({
          index: units.length + 1,
          locator: {
            kind: 'page', page: pageNumber, label: `Page ${pageNumber}`,
            extraction: 'ocr', confidence
          },
          text
        });
      } else {
        blankPageCount += 1;
      }
      page.cleanup();
      if (typeof options.onPageComplete === 'function') {
        await options.onPageComplete({
          pageNumber, pageCount: pdf.numPages, recognizedPageCount: units.length, confidence
        });
      }
    }

    const averageConfidence = confidences.length
      ? Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 10) / 10
      : 0;
    const warnings = [];
    if (blankPageCount) warnings.push(`${blankPageCount} page${blankPageCount === 1 ? '' : 's'} contained no confidently recognized text.`);
    const finalized = finalizeJournalExtraction({
      units,
      warnings,
      emptyWarning: 'OCR completed, but no English text could be recognized. The scan may be unclear or use another language.'
    });
    if (!finalized.text) throw httpError(422, finalized.warnings.at(-1));
    return {
      version: JOURNAL_OCR_VERSION,
      pageCount: pdf.numPages,
      recognizedPageCount: units.length,
      averageConfidence,
      ...finalized
    };
  } catch (error) {
    if (error?.status) throw error;
    const message = error instanceof Error ? error.message : 'unknown OCR failure';
    throw httpError(422, `The scanned PDF could not be read by the private OCR engine: ${message}`);
  } finally {
    await worker?.terminate().catch(() => {});
    if (typeof pdf?.destroy === 'function') await pdf.destroy().catch(() => {});
    if (typeof loadingTask?.destroy === 'function') await loadingTask.destroy().catch(() => {});
  }
}

function installPdfCanvasGlobals() {
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
  if (!globalThis.ImageData) globalThis.ImageData = ImageData;
  if (!globalThis.Path2D) globalThis.Path2D = Path2D;
}

function boundedConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.max(0, Math.min(100, parsed)) * 10) / 10;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
