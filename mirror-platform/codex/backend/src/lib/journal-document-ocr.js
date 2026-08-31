import { Worker } from 'node:worker_threads';
import {
  JOURNAL_OCR_VERSION,
  MAX_JOURNAL_OCR_PAGES
} from './journal-document-ocr-constants.js';

export { JOURNAL_OCR_VERSION, MAX_JOURNAL_OCR_PAGES };

export function ocrJournalPdf(data, options = {}) {
  if (!Buffer.isBuffer(data) || data.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return Promise.reject(httpError(422, 'The stored journal source is not a readable PDF.'));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./journal-document-ocr-worker.js', import.meta.url), {
      workerData: { data },
      execArgv: []
    });
    let settled = false;
    worker.on('message', message => {
      if (message?.type === 'progress') {
        if (typeof options.onPageComplete === 'function') {
          Promise.resolve(options.onPageComplete(message.progress)).catch(() => {});
        }
        return;
      }
      if (message?.type === 'result') {
        settled = true;
        resolve(message.result);
        void worker.terminate();
        return;
      }
      if (message?.type === 'error') {
        settled = true;
        reject(httpError(Number(message.status) || 422, String(message.message || 'Private OCR failed.')));
        void worker.terminate();
      }
    });
    worker.once('error', error => {
      if (settled) return;
      settled = true;
      reject(httpError(422, `The private OCR worker stopped unexpectedly: ${error.message}`));
    });
    worker.once('exit', code => {
      if (settled) return;
      settled = true;
      reject(httpError(422, `The private OCR worker stopped before finishing${code ? ` (exit ${code})` : ''}.`));
    });
  });
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
