type Fetch = typeof fetch;

export class AriRuntimeClient {
  private readonly apiUrl: string;

  constructor(apiUrl: string, private readonly controlKey: string, private readonly fetcher: Fetch = fetch) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
  }

  async health(): Promise<Record<string, any>> {
    try {
      const response = await this.fetcher(`${this.apiUrl}/health`, { signal: AbortSignal.timeout(3_000) });
      return await readJson(response, 'Independent ARI runtime');
    } catch (error) {
      return { version: 'ari-independent-runtime.v1', status: 'unavailable', error: error instanceof Error ? error.message : 'ARI runtime is unavailable.' };
    }
  }

  async request(
    path: string,
    options: { method?: string; body?: Record<string, unknown>; ownerToken: string }
  ): Promise<{ status: number; body: Record<string, any> }> {
    if (!this.controlKey) return { status: 503, body: { error: 'ARI runtime control key is not configured.' } };
    try {
      const response = await this.fetcher(`${this.apiUrl}${path}`, {
        method: options.method || 'GET',
        headers: {
          authorization: `Bearer ${this.controlKey}`,
          'x-ari-owner': options.ownerToken,
          'content-type': 'application/json'
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(10_000)
      });
      return { status: response.status, body: await readJson(response, 'Independent ARI runtime') };
    } catch (error) {
      return { status: 503, body: { error: error instanceof Error ? error.message : 'ARI runtime is unavailable.' } };
    }
  }
}

async function readJson(response: Response, source: string) {
  const raw = await response.text();
  try { return JSON.parse(raw || '{}') as Record<string, any>; }
  catch { throw new Error(`${source} returned unreadable data (HTTP ${response.status}).`); }
}
