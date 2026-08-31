import { describe, expect, it } from 'vitest';
import { CodexClient, compactGraphRead } from '../clients/CodexClient';
import type { CodexGraphRead, EmotionalTranslation } from '../types';

function graphRead(): CodexGraphRead {
  return {
    input: 'Amber Glow beside uncertainty',
    sourceLayer: 'chromabridge_knowledge',
    matchedNodes: Array.from({ length: 12 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
      type: 'bridge',
      family: 'amber',
      hexColor: '#b87830'
    })),
    supportedRoutes: Array.from({ length: 24 }, (_, index) => ({
      id: `route-${index}`,
      source: `node-${index % 12}`,
      target: `target-${index}`,
      type: 'parent',
      weight: 1
    })),
    colorClimateLanding: {
      id: 'amber',
      label: 'Amber',
      family: 'ember',
      color: '#b87830'
    },
    connectionStrength: 'strong',
    evidence: {
      nodeCount: 12,
      routeCount: 24,
      confidenceBasis: 'Imported knowledge evidence.',
      sourceDocuments: ['Color Nodes.pdf']
    },
    knowledgeLayer: {
      source: 'chromabridge_pdf_knowledge',
      consulted: true,
      nodeCount: 12,
      routeCount: 24,
      truncated: true,
      sourceDocuments: ['Color Nodes.pdf']
    },
    boundary: 'This is a relational climate read, not a diagnosis or permanent identity claim.'
  };
}

describe('CodexClient compact persistence', () => {
  it('reports a readable boundary error when Codex returns non-JSON text', async () => {
    const client = new CodexClient('http://codex.test', 'service-token', async () =>
      new Response('temporary upstream error', { status: 502, headers: { 'content-type': 'text/plain' } })
    );
    await expect(client.requestJson('/api/v1/test')).rejects.toThrow(
      'Codex /api/v1/test returned an unreadable response (HTTP 502).'
    );
  });

  it('retries one transient network failure for an explicitly idempotent request', async () => {
    let attempts = 0;
    const client = new CodexClient('http://codex.test', 'service-token', async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ document: { id: 'journal-1' }, idempotent: false }), {
        status: 201, headers: { 'content-type': 'application/json' }
      });
    });

    const result = await client.requestJson('/api/v1/conversation-memory/documents', {
      method: 'POST', body: { fileName: 'journal.pdf' }, retryNetworkFailures: true
    });

    expect(attempts).toBe(2);
    expect(result.status).toBe(201);
    expect(result.body.document.id).toBe('journal-1');
  });

  it('reads the active conversational adapter only with the runtime service token', async () => {
    let authorization = '';
    const client = new CodexClient('http://codex.test', 'service-token', async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>)?.authorization || '');
      return new Response(JSON.stringify({ activeVersion: { id: 'v1', status: 'active', ollamaModelName: 'mirror-qwen3-v1' } }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    });
    const active = await client.getActiveConversationAdapter();
    expect(authorization).toBe('Bearer service-token');
    expect(active?.ollamaModelName).toBe('mirror-qwen3-v1');
  });

  it('records only content-free analytics metadata through the runtime service boundary', async () => {
    let request: Record<string, any> = {};
    let authorization = '';
    const client = new CodexClient('http://codex.test', 'service-token', async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>)?.authorization || '');
      request = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ recorded: 1, contentStored: false }), {
        status: 201, headers: { 'content-type': 'application/json' }
      });
    });
    await client.recordAnalyticsEvents([
      { eventType: 'page_view', room: 'analytics', success: true }
    ], { visitorToken: '11111111-1111-4111-8111-111111111111', sessionToken: '22222222-2222-4222-8222-222222222222' });

    expect(authorization).toBe('Bearer service-token');
    expect(request.events).toEqual([{ eventType: 'page_view', room: 'analytics', success: true }]);
    expect(request).not.toHaveProperty('input');
    expect(request).not.toHaveProperty('message');
  });

  it('keeps only graph evidence references for runtime memory', () => {
    const compact = compactGraphRead(graphRead());

    expect(compact?.matchedNodeIds).toHaveLength(12);
    expect(compact?.supportedRouteIds).toHaveLength(24);
    expect(compact).not.toHaveProperty('matchedNodes');
    expect(compact).not.toHaveProperty('supportedRoutes');
    expect(compact).not.toHaveProperty('knowledgeLayer');
  });

  it('keeps the maximum expected save request below 32 KB', async () => {
    let requestBytes = 0;
    let savedGraphRead: Record<string, unknown> | null = null;
    const fetcher: typeof fetch = async (_url, init) => {
      const body = String(init?.body || '');
      requestBytes = Buffer.byteLength(body, 'utf8');
      savedGraphRead = JSON.parse(body).graphRead;
      return new Response(JSON.stringify({
        id: 'stored-1',
        evaluationId: 'evaluation-1',
        status: 'recorded',
        createdAt: '2026-07-31T00:00:00.000Z'
      }), { status: 201, headers: { 'content-type': 'application/json' } });
    };
    const client = new CodexClient('http://codex.test', 'service-token', fetcher);
    const read = graphRead();
    const translation: EmotionalTranslation = {
      source: 'codex_graph',
      climateName: 'Amber',
      primaryClimate: { id: 'amber', label: 'Amber', family: 'ember', color: '#b87830' },
      companionClimates: [],
      relationalRead: 'Amber pressure is moving beside uncertainty.',
      connectionStrength: 'strong',
      matchedNodes: read.matchedNodes,
      supportedRoutes: read.supportedRoutes,
      evidence: read.evidence,
      boundary: { chromaBridge: 'proposal only', codex: read.boundary }
    };

    await client.saveEvaluation({
      id: 'evaluation-1',
      kind: 'evaluated_observation',
      status: 'proposed',
      userId: 'test-user',
      input: read.input,
      fingerprint: 'fingerprint',
      climateSignals: [],
      evidence: { source: 'mirror_runtime_user_input' },
      boundary: { mode: 'proposal_only', semanticMutationAllowed: false }
    } as never, translation, read);

    expect(requestBytes).toBeLessThan(32 * 1024);
    expect(savedGraphRead).not.toHaveProperty('matchedNodes');
    expect(savedGraphRead).not.toHaveProperty('supportedRoutes');
  });
});
