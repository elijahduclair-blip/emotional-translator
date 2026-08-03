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
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
