type Fetch = typeof fetch;

export interface LocalModelStatus {
  status: 'ready' | 'missing_model' | 'unavailable';
  provider: 'ollama';
  url: string;
  model: string;
  installedModels: string[];
  error?: string;
}

export interface LocalModelResponse {
  provider: 'ollama';
  model: string;
  text: string;
  done: boolean;
  timings: {
    totalDurationNanoseconds: number | null;
    loadDurationNanoseconds: number | null;
    promptTokens: number | null;
    responseTokens: number | null;
  };
}

export class LocalModelClient {
  private readonly apiUrl: string;

  constructor(
    apiUrl: string,
    private readonly model: string,
    private readonly fetcher: Fetch = fetch
  ) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
  }

  async health(): Promise<LocalModelStatus> {
    try {
      const response = await this.fetcher(`${this.apiUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
      const body = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      const installedModels = (body.models || [])
        .map(item => item.name || item.model || '')
        .filter(Boolean);
      return {
        status: installedModels.includes(this.model) ? 'ready' : 'missing_model',
        provider: 'ollama',
        url: this.apiUrl,
        model: this.model,
        installedModels
      };
    } catch (error) {
      return {
        status: 'unavailable',
        provider: 'ollama',
        url: this.apiUrl,
        model: this.model,
        installedModels: [],
        error: error instanceof Error ? error.message : 'Local model service is unavailable.'
      };
    }
  }

  async respond(system: string, context: Record<string, unknown>): Promise<LocalModelResponse> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(240_000),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(context) }
          ],
          options: { temperature: 0.2, num_ctx: 4096 }
        })
      });
    } catch (error) {
      throw httpError(503, `Local Qwen connection failed: ${error instanceof Error ? error.message : 'Ollama is unavailable.'}`);
    }

    const body = await response.json() as {
      model?: string;
      message?: { content?: string };
      done?: boolean;
      error?: string;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    if (!response.ok) throw httpError(502, `Local Qwen request failed (${response.status}): ${body.error || 'Unknown error'}`);
    const text = String(body.message?.content || '').trim();
    if (!text) throw httpError(502, 'Local Qwen returned an empty response.');

    return {
      provider: 'ollama',
      model: body.model || this.model,
      text,
      done: body.done === true,
      timings: {
        totalDurationNanoseconds: finiteNumber(body.total_duration),
        loadDurationNanoseconds: finiteNumber(body.load_duration),
        promptTokens: finiteNumber(body.prompt_eval_count),
        responseTokens: finiteNumber(body.eval_count)
      }
    };
  }
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
