import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { MirrorRuntime } from '../MirrorRuntime';
import { MirrorRuntimeService } from '../services/mirror-runtime.service';
import { createMirrorHttpServer } from '../http';

describe('Mirror Platform vertical slice', () => {
  it('asks ChromaBridge for a boundary-safe evaluation', async () => {
    const runtime = new MirrorRuntime({
      userId: 'test-user',
      enablePersistence: false,
      enableCodexGraphRead: false
    });

    await runtime.start();
    const result = await runtime.ask('Ember motion beside silver revision');
    await runtime.stop();

    expect(result.persisted).toBeNull();
    expect(result.evaluation.status).toBe('proposed');
    expect(result.evaluation.boundary.semanticMutationAllowed).toBe(false);
    expect(result.evaluation.climateSignals.map(signal => signal.family)).toEqual(['ember', 'silver']);
    expect(result.translation.climateName).toBe('Ember beside Silver');
  });

  it('connects HTTP ask to ChromaBridge evaluation and Codex save', async () => {
    let receivedEvaluation: Record<string, unknown> | undefined;
    const codex = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (request.url === '/api/v1/translate/graph-read') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          input: body.text,
          sourceLayer: 'approved_graph',
          matchedNodes: [{ id: 'rose', label: 'Rose', type: 'family', family: 'rose', hexColor: '#b85c7d' }],
          supportedRoutes: [{ id: 'rose-midnight', source: 'rose', target: 'midnight', weight: 2 }],
          colorClimateLanding: { id: 'midnight', label: 'Midnight', family: 'midnight', color: '#223a5e' },
          connectionStrength: 'medium',
          evidence: { nodeCount: 1, routeCount: 1, confidenceBasis: 'Stored graph route.' },
          boundary: 'This is a relational climate read, not a diagnosis or permanent identity claim.'
        }));
        return;
      }

      receivedEvaluation = body.evaluation;
      expect(body.graphRead.matchedNodeIds).toEqual(['rose']);
      expect(body.graphRead.supportedRouteIds).toEqual(['rose-midnight']);
      expect(body.graphRead.matchedNodes).toBeUndefined();
      expect(body.graphRead.supportedRoutes).toBeUndefined();
      expect(request.url).toBe('/api/v1/runtime/evaluations');
      expect(request.headers.authorization).toBe('Bearer test-service-token');
      expect(body.translation.source).toBe('codex_graph');
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        id: 'stored-1',
        evaluationId: body.evaluation.id,
        status: 'recorded',
        createdAt: '2026-07-31T00:00:00.000Z'
      }));
    });
    await listen(codex);
    const codexAddress = codex.address();
    if (!codexAddress || typeof codexAddress === 'string') throw new Error('Codex test server did not bind.');

    const service = new MirrorRuntimeService({
      userId: 'test-user',
      codexApiUrl: `http://127.0.0.1:${codexAddress.port}`,
      codexServiceToken: 'test-service-token'
    });
    await service.start();
    const mirror = createMirrorHttpServer(service);
    await listen(mirror);
    const mirrorAddress = mirror.address();
    if (!mirrorAddress || typeof mirrorAddress === 'string') throw new Error('Mirror test server did not bind.');

    try {
      const response = await fetch(`http://127.0.0.1:${mirrorAddress.port}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'Rose connection under midnight reflection' })
      });
      const result = await response.json() as {
        evaluation: { boundary: { semanticMutationAllowed: boolean } };
        translation: { source: string; climateName: string };
        persisted: { status: string };
      };

      expect(response.status).toBe(200);
      expect(result.persisted.status).toBe('recorded');
      expect(result.evaluation.boundary.semanticMutationAllowed).toBe(false);
      expect(result.translation.source).toBe('codex_graph');
      expect(result.translation.climateName).toBe('Midnight · midnight');
      expect(receivedEvaluation).toBeDefined();
    } finally {
      await close(mirror);
      await service.stop();
      await close(codex);
    }
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}
