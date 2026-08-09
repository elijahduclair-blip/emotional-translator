import { describe, expect, it } from 'vitest';
import { AlignmentModelClient } from '../clients/AlignmentModelClient';

describe('AlignmentModelClient', () => {
  it('reports held-out learning evidence and returns only contract-verified output', async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ready', provider: 'transformers_peft', model: 'Qwen/Qwen3-0.6B',
          adapter: 'qwen3-0.6b-alignment-v2', device: 'cpu', learned: true,
          validation: { examples: 38, exactMatches: 38, jsonEquivalentMatches: 38 }
        });
      }
      return jsonResponse({
        engine: 'mirror_learned_alignment',
        model: { provider: 'transformers_peft', base: 'Qwen/Qwen3-0.6B', adapter: 'qwen3-0.6b-alignment-v2', local: true, learned: true },
        mode: 'authority_boundary',
        result: { sourceLayer: 'chromabridge_knowledge', semanticMutationAllowed: false },
        contractVerified: true,
        boundary: { semanticMutationAllowed: false, graphMutationAllowed: false, coordinateDistanceCreatesMeaning: false, reason: 'verified' }
      });
    };
    const client = new AlignmentModelClient('http://127.0.0.1:11435/', fetcher);

    const health = await client.health();
    const evaluation = await client.evaluate({ mode: 'authority_boundary', record: { name: 'Amber Glow' } });

    expect(health.status).toBe('ready');
    expect(health.validation?.exactMatches).toBe(38);
    expect(evaluation.contractVerified).toBe(true);
    expect(evaluation.boundary.semanticMutationAllowed).toBe(false);
    expect(requests[1]).toEqual({
      url: 'http://127.0.0.1:11435/v1/evaluate',
      body: { mode: 'authority_boundary', record: { name: 'Amber Glow' } }
    });
  });

  it('does not claim readiness when the learned adapter server is unreachable', async () => {
    const client = new AlignmentModelClient('http://127.0.0.1:11435', async () => {
      throw new Error('connection refused');
    });
    const health = await client.health();
    expect(health.status).toBe('unavailable');
    expect(health.error).toContain('connection refused');
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
