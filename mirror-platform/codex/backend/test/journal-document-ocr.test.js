import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { JOURNAL_OCR_VERSION, ocrJournalPdf } from '../src/lib/journal-document-ocr.js';

test('reads an image-only PDF locally and preserves page-aware provenance', async () => {
  const canvas = createCanvas(1_000, 220);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.font = '48px Arial';
  context.fillText('ARI preserves page one.', 40, 125);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([500, 110]);
  const image = await pdf.embedPng(canvas.toBuffer('image/png'));
  page.drawImage(image, { x: 0, y: 0, width: 500, height: 110 });

  const result = await ocrJournalPdf(Buffer.from(await pdf.save()));
  assert.equal(result.version, JOURNAL_OCR_VERSION);
  assert.equal(result.pageCount, 1);
  assert.equal(result.recognizedPageCount, 1);
  assert.match(result.text, /ARI preserves page one/u);
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].locator.page, 1);
  assert.equal(result.chunks[0].locator.extraction, 'ocr');
  assert.ok(result.chunks[0].locator.confidence > 0);
});

test('rejects non-PDF bytes instead of inventing OCR output', async () => {
  await assert.rejects(
    ocrJournalPdf(Buffer.from('not a PDF')),
    error => error.status === 422 && /not a readable PDF/u.test(error.message)
  );
});
