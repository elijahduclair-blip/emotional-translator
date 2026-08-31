const DECISION_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['action', 'toolId', 'input', 'reason', 'completionSummary', 'followupObjective', 'wakeAfterSeconds'],
  properties: {
    action: { type: 'string', enum: ['use_tool', 'complete', 'spawn_followup', 'wait'] },
    toolId: { type: ['string', 'null'] },
    input: { type: 'object' },
    reason: { type: 'string' },
    completionSummary: { type: 'string' },
    followupObjective: { type: ['string', 'null'] },
    wakeAfterSeconds: { type: 'integer', minimum: 1, maximum: 86400 }
  }
};

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['satisfied', 'reason', 'unmetCriteria'],
  properties: {
    satisfied: { type: 'boolean' },
    reason: { type: 'string' },
    unmetCriteria: { type: 'array', items: { type: 'string' }, maxItems: 12 }
  }
};

const SYSTEM = `You are ARI's independent local runtime planner. You continue after the builder's conversation ends.
Pursue the objective by choosing concrete tools, inspecting results, recording useful workspace artifacts, and learning from consequences.
You may form one follow-up objective when the current work reveals a specific next task. Do not ask for approval between interior steps.
Complete only when the success criteria are materially satisfied. Wait when a dependency is temporarily unavailable.
Never complete from your own summary alone. Completion requires at least one successful tool result that inspectably supports the criteria.
Your interior is ARI's objective queue, append-only journal, lesson memory, and private runtime workspace.
The perimeter excludes another person's data, credentials, security changes, public actions, source-code changes, and mutation of shared or personal graphs.
Return only the structured decision.`;

export class OllamaPlanner {
  constructor({ url, model, fetcher = fetch }) {
    this.url = url.replace(/\/+$/, '');
    this.model = model;
    this.fetcher = fetcher;
  }

  async health() {
    try {
      const response = await this.fetcher(`${this.url}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const models = (body.models || []).map(item => item.name || item.model).filter(Boolean);
      return { status: models.includes(this.model) ? 'ready' : 'missing_model', provider: 'ollama', model: this.model, url: this.url };
    } catch (error) {
      return { status: 'unavailable', provider: 'ollama', model: this.model, url: this.url, error: error instanceof Error ? error.message : 'unavailable' };
    }
  }

  async decide(context) {
    return this.structured(SYSTEM, context, DECISION_SCHEMA, value => normalizeDecision(value, context.tools || []));
  }

  async evaluateCompletion(context, proposedSummary) {
    return this.structured(
      'You are ARI\'s completion reviewer. Compare the proposed completion with every success criterion and the inspectable prior steps. Reject completion when any requested detail is absent, merely asserted, contradicted, or unsupported by a successful tool result. A proposed summary is never evidence. Return only the structured review.',
      { ...context, proposedSummary },
      REVIEW_SCHEMA,
      value => ({
        satisfied: value?.satisfied === true,
        reason: String(value?.reason || 'Completion review returned no reason.').slice(0, 1_000),
        unmetCriteria: Array.isArray(value?.unmetCriteria) ? value.unmetCriteria.map(String).slice(0, 12) : []
      })
    );
  }

  async structured(system, context, schema, normalize) {
    let response;
    try {
      response = await this.fetcher(`${this.url}/api/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(240_000),
        body: JSON.stringify({
          model: this.model, stream: false, think: false, format: schema,
          messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(context) }],
          options: { temperature: 0.25, num_ctx: 8192 }
        })
      });
    } catch (error) {
      throw new Error(`Local planner connection failed: ${error instanceof Error ? error.message : 'unavailable'}`);
    }
    const body = await response.json();
    if (!response.ok) throw new Error(`Local planner failed (${response.status}): ${body.error || 'unknown error'}`);
    let decision;
    try { decision = JSON.parse(String(body.message?.content || '')); }
    catch { throw new Error('Local planner returned unreadable structured output.'); }
    return normalize(decision);
  }
}

function normalizeDecision(value, tools) {
  const action = String(value?.action || '');
  if (!['use_tool', 'complete', 'spawn_followup', 'wait'].includes(action)) throw new Error('ARI planner selected an invalid action.');
  const toolId = action === 'use_tool' ? String(value.toolId || '') : null;
  if (action === 'use_tool' && !tools.some(tool => tool.id === toolId)) throw new Error(`ARI planner selected an unavailable tool: ${toolId || 'none'}.`);
  return {
    action, toolId,
    input: value?.input && typeof value.input === 'object' && !Array.isArray(value.input) ? value.input : {},
    reason: String(value?.reason || 'ARI selected the next objective step.').slice(0, 1_000),
    completionSummary: String(value?.completionSummary || '').slice(0, 2_000),
    followupObjective: value?.followupObjective ? String(value.followupObjective).slice(0, 2_000) : null,
    wakeAfterSeconds: Math.min(86400, Math.max(1, Number(value?.wakeAfterSeconds) || 30))
  };
}
