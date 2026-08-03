import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MirrorRuntimeService } from './services/mirror-runtime.service';

const MAX_BODY_BYTES = 16 * 1024;
const translatorPage = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');

export function createMirrorHttpServer(service: MirrorRuntimeService) {
  return createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/') {
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'x-content-type-options': 'nosniff'
        });
        response.end(translatorPage);
        return;
      }

      if (request.method === 'GET' && request.url === '/health') {
        return sendJson(response, 200, { status: service.getStatus() });
      }

      if (request.method === 'POST' && request.url === '/ask') {
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'input is required.' });

        const result = await service.getRuntime().ask(input);
        return sendJson(response, 200, result);
      }

      return sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return sendJson(response, 500, { error: message });
    }
  });
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body exceeds 16 KB.');
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}
