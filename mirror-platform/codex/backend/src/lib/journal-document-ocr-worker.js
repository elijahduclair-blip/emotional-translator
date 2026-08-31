import { parentPort, workerData } from 'node:worker_threads';
import { runJournalOcrEngine } from './journal-document-ocr-engine.js';

try {
  const result = await runJournalOcrEngine(Buffer.from(workerData.data), {
    onPageComplete(progress) {
      parentPort?.postMessage({ type: 'progress', progress });
    }
  });
  parentPort?.postMessage({ type: 'result', result });
} catch (error) {
  parentPort?.postMessage({
    type: 'error',
    status: Number(error?.status) || 422,
    message: String(error?.message || 'Private OCR failed.').slice(0, 500)
  });
}
