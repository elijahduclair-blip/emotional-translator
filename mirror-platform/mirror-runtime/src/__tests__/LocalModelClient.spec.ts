import { describe, expect, it } from 'vitest';
import { LocalModelClient } from '../clients/LocalModelClient';

describe('LocalModelClient', () => {
  it('reports the configured model and returns an English local response', async () => {
    const requests: Array<{ url: string; body?: Record<string, any> }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/api/tags')) {
        return jsonResponse({ models: [{ name: 'qwen3:4b-instruct' }] });
      }
      return jsonResponse({
        model: 'qwen3:4b-instruct',
        message: { content: 'The climate is moving through reflection.' },
        done: true,
        total_duration: 1_200_000_000,
        load_duration: 10_000_000,
        prompt_eval_count: 42,
        eval_count: 8
      });
    };
    const client = new LocalModelClient('http://127.0.0.1:11434/', 'qwen3:4b-instruct', fetcher);

    const health = await client.health();
    const result = await client.respond('Reply in English.', { userEnglish: 'What is moving?' });

    expect(health.status).toBe('ready');
    expect(result.text).toBe('The climate is moving through reflection.');
    expect(result.model).toBe('qwen3:4b-instruct');
    expect(requests[1].url).toBe('http://127.0.0.1:11434/api/chat');
    expect(requests[1].body?.stream).toBe(false);
    expect(requests[1].body?.think).toBe(false);
    expect(requests[1].body?.options.num_ctx).toBe(8192);
    expect(requests[1].body?.messages[1].content).toContain('userEnglish');
  });

  it('reports an unavailable local server without claiming readiness', async () => {
    const client = new LocalModelClient('http://127.0.0.1:11434', 'qwen3:4b-instruct', async () => {
      throw new Error('connection refused');
    });
    const health = await client.health();
    expect(health.status).toBe('unavailable');
    expect(health.error).toContain('connection refused');
  });

  it('reports a readable boundary error when the local model returns non-JSON text', async () => {
    const client = new LocalModelClient('http://127.0.0.1:11434', 'qwen3:4b-instruct', async () =>
      new Response('<html>temporary upstream error</html>', { status: 502, headers: { 'content-type': 'text/html' } })
    );
    await expect(client.respond('System', { userEnglish: 'Hello' })).rejects.toThrow(
      'Local Qwen returned an unreadable response (HTTP 502).'
    );
  });

  it('can request a deployment-verified model override without changing the configured fallback', async () => {
    let requestedModel = '';
    const client = new LocalModelClient('http://127.0.0.1:11434', 'qwen3:4b-instruct', async (_input, init) => {
      requestedModel = JSON.parse(String(init?.body)).model;
      return jsonResponse({ model: requestedModel, message: { content: 'Validated adapter response.' }, done: true });
    });
    const result = await client.respond('System', { userEnglish: 'Hello' }, 'mirror-qwen3-4b-conversation-v1');
    expect(requestedModel).toBe('mirror-qwen3-4b-conversation-v1');
    expect(result.model).toBe('mirror-qwen3-4b-conversation-v1');
  });

  it('requests and strictly parses a schema-bound invention object', async () => {
    let requestBody: Record<string, any> = {};
    const client = new LocalModelClient('http://127.0.0.1:11434', 'qwen3:4b-instruct', async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        model: 'qwen3:4b-instruct',
        message: { content: JSON.stringify({
          source: 'pressure', target: 'reflection', relationshipType: 'moves_toward',
          evidence: 'The language places both labels in motion.',
          counterexample: 'Reject when reviewed uses consistently separate them.', confidence: 'low'
        }) },
        done: true
      });
    });
    const schema = { type: 'object', required: ['source', 'target'] };
    const result = await client.respondJson('Imagine one proposal.', { allowedLabels: ['pressure', 'reflection'] }, schema);
    expect(result.value.relationshipType).toBe('moves_toward');
    expect(requestBody.format).toEqual(schema);
    expect(requestBody.think).toBe(false);
    expect(requestBody.options.temperature).toBe(0.35);
  });

  it('rejects malformed structured output instead of guessing', async () => {
    const client = new LocalModelClient('http://127.0.0.1:11434', 'qwen3:4b-instruct', async () =>
      jsonResponse({ message: { content: 'source: pressure' }, done: true })
    );
    await expect(client.respondJson('System', {}, { type: 'object' })).rejects.toThrow('invalid structured JSON');
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
