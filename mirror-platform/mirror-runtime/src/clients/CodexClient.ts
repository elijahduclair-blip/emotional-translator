import type { ChromaBridgeEvaluation } from '@mirror-platform/chromabridge-sdk';
import type { CodexGraphRead, EmotionalTranslation } from '../types';

const MAX_SAVE_PAYLOAD_BYTES = 32 * 1024;

export interface SavedEvaluation {
  id: string;
  evaluationId: string;
  status: 'recorded';
  createdAt: string;
}

type Fetch = typeof fetch;

export class CodexClient {
  constructor(
    private readonly apiUrl: string,
    private readonly serviceToken: string,
    private readonly fetcher: Fetch = fetch
  ) {}

  async translateGraph(text: string): Promise<CodexGraphRead> {
    const response = await this.fetcher(`${this.apiUrl}/api/v1/translate/graph-read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const body = await response.json() as CodexGraphRead & { error?: string };
    if (!response.ok) {
      throw new Error(`Codex graph translation failed (${response.status}): ${body.error || 'Unknown error'}`);
    }
    return body;
  }

  async saveEvaluation(
    evaluation: ChromaBridgeEvaluation,
    translation: EmotionalTranslation,
    graphRead: CodexGraphRead | null
  ): Promise<SavedEvaluation> {
    if (!this.serviceToken) {
      throw new Error('RUNTIME_SERVICE_TOKEN is required when persistence is enabled.');
    }

    const payload = JSON.stringify({
      evaluation,
      translation,
      graphRead: compactGraphRead(graphRead)
    });
    const payloadBytes = Buffer.byteLength(payload, 'utf8');
    if (payloadBytes > MAX_SAVE_PAYLOAD_BYTES) {
      throw new Error(`Compact Codex save payload exceeds 32 KB (${payloadBytes} bytes).`);
    }

    const response = await this.fetcher(`${this.apiUrl}/api/v1/runtime/evaluations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.serviceToken}`,
        'content-type': 'application/json'
      },
      body: payload
    });

    const body = await response.json() as SavedEvaluation & { error?: string };
    if (!response.ok) {
      throw new Error(`Codex save failed (${response.status}): ${body.error || 'Unknown error'}`);
    }
    return body;
  }
}

export function compactGraphRead(graphRead: CodexGraphRead | null) {
  if (!graphRead) return null;
  return {
    input: graphRead.input,
    sourceLayer: graphRead.sourceLayer,
    colorClimateLanding: graphRead.colorClimateLanding,
    connectionStrength: graphRead.connectionStrength,
    evidence: graphRead.evidence,
    boundary: graphRead.boundary,
    matchedNodeIds: graphRead.matchedNodes.map(node => node.id),
    supportedRouteIds: graphRead.supportedRoutes
      .map(route => typeof route.id === 'string' ? route.id : null)
      .filter((id): id is string => Boolean(id))
  };
}
