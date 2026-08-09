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

export interface LocalStructuredModelResponse extends LocalModelResponse {
  value: Record<string, unknown>;
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

  async respond(system: string, context: Record<string, unknown>, modelOverride?: string): Promise<LocalModelResponse> {
    return this.chat(system, context, modelOverride);
  }

  async respondJson(
    system: string,
    context: Record<string, unknown>,
    schema: Record<string, unknown>,
    modelOverride?: string
  ): Promise<LocalStructuredModelResponse> {
    const response = await this.chat(system, context, modelOverride, schema, 0.35);
    let value: unknown;
    try {
      value = JSON.parse(response.text);
    } catch {
      throw httpError(502, 'Local Qwen returned invalid structured JSON.');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw httpError(502, 'Local Qwen structured output must be a JSON object.');
    }
    return { ...response, value: value as Record<string, unknown> };
  }

  private async chat(
    system: string,
    context: Record<string, unknown>,
    modelOverride?: string,
    format?: Record<string, unknown>,
    temperature = 0.2
  ): Promise<LocalModelResponse> {
    const requestedModel = modelOverride || this.model;
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(240_000),
        body: JSON.stringify({
          model: requestedModel,
          stream: false,
          think: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(context) }
          ],
          ...(format ? { format } : {}),
          options: { temperature, num_ctx: 4096 }
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
      model: body.model || requestedModel,
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
