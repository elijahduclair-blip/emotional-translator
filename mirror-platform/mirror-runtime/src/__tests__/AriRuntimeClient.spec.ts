import { describe, expect, it, vi } from 'vitest';
import { AriRuntimeClient } from '../clients/AriRuntimeClient';

describe('AriRuntimeClient', () => {
  it('reports the independent runtime health', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: 'ready', version: 'ari-independent-runtime.v1' }), { status: 200 }));
    const client = new AriRuntimeClient('http://ari.local/', 'secret', fetcher as typeof fetch);
    await expect(client.health()).resolves.toMatchObject({ status: 'ready' });
    expect(fetcher).toHaveBeenCalledWith('http://ari.local/health', expect.any(Object));
  });

  it('keeps control and owner identity in server-side headers', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer secret',
        'x-ari-owner': 'private-session-token'
      });
      return new Response(JSON.stringify({ objectives: [] }), { status: 200 });
    });
    const client = new AriRuntimeClient('http://ari.local', 'secret', fetcher as typeof fetch);
    await expect(client.request('/v1/objectives', { ownerToken: 'private-session-token' })).resolves.toMatchObject({ status: 200 });
  });
});
