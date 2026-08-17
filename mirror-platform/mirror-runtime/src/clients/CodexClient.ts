import type { ChromaBridgeEvaluation } from '@mirror-platform/chromabridge-sdk';
import crypto from 'node:crypto';
import type { CodexGraphRead, EmotionalTranslation } from '../types';

const MAX_SAVE_PAYLOAD_BYTES = 32 * 1024;

export interface SavedEvaluation {
  id: string;
  evaluationId: string;
  status: 'recorded';
  createdAt: string;
}

type Fetch = typeof fetch;

export interface FeedbackReceiptInput {
  interactionId: string;
  issuedAt: string;
  input: string;
  canonicalEnglish: string;
  modelName: string;
  modelResponse: string;
  graphSource: string;
  learnedAlignmentStatus: string;
  contractVerified: boolean;
  relationalEvidence: {
    sourceLayer: string;
    matchedNodeCount: number;
    confirmedRouteCount: number;
    relationshipClaimsSupported: boolean;
  };
}

export class CodexClient {
  constructor(
    private readonly apiUrl: string,
    private readonly serviceToken: string,
    private readonly fetcher: Fetch = fetch
  ) {}

  createFeedbackReceipt(value: FeedbackReceiptInput) {
    if (!this.serviceToken) return null;
    const version = '1.0.0';
    const payload = JSON.stringify([
      version,
      value.interactionId,
      value.issuedAt,
      value.input,
      value.canonicalEnglish,
      value.modelName,
      value.modelResponse,
      value.graphSource,
      value.learnedAlignmentStatus,
      value.contractVerified === true,
      value.relationalEvidence.sourceLayer,
      value.relationalEvidence.matchedNodeCount,
      value.relationalEvidence.confirmedRouteCount,
      value.relationalEvidence.relationshipClaimsSupported === true
    ]);
    return {
      version,
      interactionId: value.interactionId,
      issuedAt: value.issuedAt,
      signature: crypto.createHmac('sha256', this.serviceToken).update(payload).digest('base64url')
    };
  }

  async translateGraph(text: string): Promise<CodexGraphRead> {
    const response = await this.fetcher(`${this.apiUrl}/api/v1/translate/graph-read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const body = await readJsonResponse(response, 'Codex graph translation') as CodexGraphRead & { error?: string };
    if (!response.ok) {
      throw new Error(`Codex graph translation failed (${response.status}): ${body.error || 'Unknown error'}`);
    }
    return body;
  }

  async translateBrailleMath(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = await this.requestJson('/api/v1/braille/math/translate', { method: 'POST', body: request });
    if (result.status >= 400) throw codexError('Braille translation', result);
    return result.body;
  }

  async requestJson(
    path: string,
    options: { method?: string; body?: Record<string, unknown>; userToken?: string } = {}
  ): Promise<{ status: number; body: Record<string, any> }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.userToken) headers.authorization = `Bearer ${options.userToken}`;
    const response = await this.fetcher(`${this.apiUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const body = await readJsonResponse(response, `Codex ${path}`);
    return { status: response.status, body };
  }

  async recordAnalyticsEvents(
    events: Array<Record<string, unknown>>,
    context: { visitorToken?: string; sessionToken?: string; userToken?: string } = {}
  ): Promise<void> {
    if (!this.serviceToken || !events.length) return;
    const response = await this.fetcher(`${this.apiUrl}/api/v1/analytics/events`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.serviceToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        events,
        visitorToken: context.visitorToken || null,
        sessionToken: context.sessionToken || null,
        userToken: context.userToken || null
      })
    });
    const body = await readJsonResponse(response, 'Codex analytics') as { error?: string };
    if (!response.ok) throw new Error(`Codex analytics failed (${response.status}): ${body.error || 'Unknown error'}`);
  }

  async getActiveConversationAdapter(): Promise<Record<string, any> | null> {
    if (!this.serviceToken) return null;
    const response = await this.fetcher(`${this.apiUrl}/api/v1/local-ai/training/active`, {
      headers: { authorization: `Bearer ${this.serviceToken}`, 'content-type': 'application/json' }
    });
    const body = await readJsonResponse(response, 'Codex active adapter') as { activeVersion?: Record<string, any> | null; error?: string };
    if (!response.ok) throw new Error(`Codex active adapter read failed (${response.status}): ${body.error || 'Unknown error'}`);
    return body.activeVersion || null;
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

    const body = await readJsonResponse(response, 'Codex save') as SavedEvaluation & { error?: string };
    if (!response.ok) {
      throw new Error(`Codex save failed (${response.status}): ${body.error || 'Unknown error'}`);
    }
    return body;
  }
}

function codexError(label: string, result: { status: number; body: Record<string, any> }) {
  return Object.assign(
    new Error(`${label} failed (${result.status}): ${result.body.error || 'Unknown error'}`),
    { status: result.status }
  );
}

async function readJsonResponse(response: Response, source: string): Promise<Record<string, any>> {
  const raw = await response.text();
  try {
    return JSON.parse(raw || '{}') as Record<string, any>;
  } catch {
    throw Object.assign(
      new Error(`${source} returned an unreadable response (HTTP ${response.status}).`),
      { status: 502 }
    );
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
