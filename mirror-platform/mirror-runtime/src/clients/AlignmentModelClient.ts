type Fetch = typeof fetch;

export interface AlignmentModelStatus {
  status: 'ready' | 'unavailable';
  provider: 'transformers_peft';
  model: string;
  adapter: string;
  device: string;
  learned: boolean;
  validation?: {
    examples: number | null;
    exactMatches: number | null;
    jsonEquivalentMatches: number | null;
  };
  error?: string;
}

export interface AlignmentModelEvaluation {
  engine: 'mirror_learned_alignment';
  model: {
    provider: 'transformers_peft';
    base: string;
    adapter: string;
    local: true;
    learned: true;
  };
  mode: 'authority_boundary' | 'coordinate_evidence_boundary';
  result: Record<string, unknown>;
  contractVerified: true;
  boundary: {
    semanticMutationAllowed: false;
    graphMutationAllowed: false;
    coordinateDistanceCreatesMeaning: false;
    reason: string;
  };
}

export class AlignmentModelClient {
  private readonly apiUrl: string;

  constructor(apiUrl: string, private readonly fetcher: Fetch = fetch) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
  }

  async health(): Promise<AlignmentModelStatus> {
    try {
      const response = await this.fetcher(`${this.apiUrl}/health`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error(`Alignment model returned HTTP ${response.status}.`);
      return await response.json() as AlignmentModelStatus;
    } catch (error) {
      return {
        status: 'unavailable',
        provider: 'transformers_peft',
        model: 'Qwen/Qwen3-0.6B',
        adapter: 'qwen3-0.6b-alignment-v2',
        device: 'unknown',
        learned: true,
        error: error instanceof Error ? error.message : 'Learned alignment model is unavailable.'
      };
    }
  }

  async evaluate(request: Record<string, unknown>): Promise<AlignmentModelEvaluation> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}/v1/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(240_000),
        body: JSON.stringify(request)
      });
    } catch (error) {
      throw httpError(503, `Learned alignment connection failed: ${error instanceof Error ? error.message : 'service unavailable'}`);
    }
    const body = await response.json() as AlignmentModelEvaluation & { error?: string };
    if (!response.ok) throw httpError(response.status, body.error || `Learned alignment request failed (${response.status}).`);
    return body;
  }
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
