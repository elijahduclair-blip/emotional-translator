import { Constitution } from './subsystems/Constitution';
import { ConversationEngine } from './subsystems/ConversationEngine';
import { CapabilityRouter } from './subsystems/CapabilityRouter';
import { Planner } from './subsystems/Planner';
import { PersonalityEngine } from './subsystems/PersonalityEngine';
import { ReflectionEngine } from './subsystems/ReflectionEngine';
import { ChromaBridgeCapability } from './subsystems/ChromaBridgeCapability';
import {
  RuntimeStatus,
  MirrorRuntimeConfig,
  MirrorAskResult,
  CodexGraphRead,
  EmotionalTranslation
} from './types';
import { CodexClient } from './clients/CodexClient';
import { LocalModelClient, LocalModelStatus } from './clients/LocalModelClient';

const LOCAL_REASONING_SYSTEM = [
  'You are the local reasoning engine for Mirror Platform.',
  'Respond in clear English to the userEnglish field.',
  'Treat the user\'s language as part of the evolving Theory of Alignment and color-climate vocabulary when relevant.',
  'Use the supplied structural trace and relational evidence as context, but do not invent graph matches.',
  'Emotion is a moving climate rather than a fixed diagnosis or identity.',
  'Do not claim to mutate memory, graph data, governance state, or source code.'
].join(' ');

export class MirrorRuntime {
  private status: RuntimeStatus = 'idle';

  private constitution: Constitution;
  private conversationEngine: ConversationEngine;
  private capabilityRouter: CapabilityRouter;
  private planner: Planner;
  private personalityEngine: PersonalityEngine;
  private reflectionEngine: ReflectionEngine;
  private chromaBridge: ChromaBridgeCapability;
  private codexClient: CodexClient;
  private localModelClient: LocalModelClient;

  private userId: string;
  private config: MirrorRuntimeConfig;

  constructor(config: MirrorRuntimeConfig) {
    this.config = config;
    this.userId = config.userId;

    this.constitution = new Constitution(config.constitutionPath);
    this.conversationEngine = new ConversationEngine(this.userId);
    this.capabilityRouter = new CapabilityRouter();
    this.planner = new Planner();
    this.personalityEngine = new PersonalityEngine(this.userId);
    this.reflectionEngine = new ReflectionEngine();
    this.chromaBridge = new ChromaBridgeCapability();
    this.codexClient = new CodexClient(
      config.codexApiUrl || process.env.CODEX_API_URL || 'http://127.0.0.1:3000',
      config.codexServiceToken || process.env.RUNTIME_SERVICE_TOKEN || ''
    );
    this.localModelClient = new LocalModelClient(
      config.localModelUrl || process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434',
      config.localModelName || process.env.LOCAL_MODEL_NAME || 'qwen3:4b-instruct'
    );
  }

  async start(): Promise<void> {
    if (this.status !== 'idle') {
      throw new Error(`Cannot start: runtime is already ${this.status}`);
    }

    this.status = 'initializing';

    try {
      await this.constitution.initialize();
      await this.capabilityRouter.register(this.chromaBridge);
      await this.conversationEngine.start();
      await this.reflectionEngine.start();
      await this.personalityEngine.start();

      this.status = 'ready';
      console.log(`[MirrorRuntime] Ready. User: ${this.userId}`);
    } catch (error) {
      this.status = 'stopped';
      throw new Error(`Failed to start MirrorRuntime: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'idle') {
      return;
    }

    this.status = 'stopping';

    try {
      await this.reflectionEngine.stop();
      await this.conversationEngine.stop();
      await this.personalityEngine.stop();
      await this.constitution.teardown();

      this.status = 'stopped';
      console.log('[MirrorRuntime] Stopped');
    } catch (error) {
      throw new Error(`Failed to stop MirrorRuntime: ${error}`);
    }
  }

  getStatus(): RuntimeStatus {
    return this.status;
  }

  getConstitution(): Constitution {
    return this.constitution;
  }

  getConversationEngine(): ConversationEngine {
    return this.conversationEngine;
  }

  getCapabilityRouter(): CapabilityRouter {
    return this.capabilityRouter;
  }

  getPlanner(): Planner {
    return this.planner;
  }

  getPersonalityEngine(): PersonalityEngine {
    return this.personalityEngine;
  }

  getReflectionEngine(): ReflectionEngine {
    return this.reflectionEngine;
  }

  getChromaBridge(): ChromaBridgeCapability {
    return this.chromaBridge;
  }

  async getLocalModelStatus(): Promise<LocalModelStatus | { status: 'disabled' }> {
    if (this.config.enableLocalModel === false) return { status: 'disabled' };
    return this.localModelClient.health();
  }

  async ask(input: string): Promise<MirrorAskResult> {
    if (this.status !== 'ready') {
      throw new Error(`Cannot ask: runtime is ${this.status}.`);
    }

    const evaluation = this.chromaBridge.evaluate(input, this.userId);
    const graphRead = this.config.enableCodexGraphRead === false
      ? null
      : await this.codexClient.translateGraph(input);
    const translation = composeTranslation(evaluation, graphRead);
    const persisted = this.config.enablePersistence === false
      ? null
      : await this.codexClient.saveEvaluation(evaluation, translation, graphRead);

    return { evaluation, translation, persisted };
  }

  async translateBrailleMath(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot translate Braille math: runtime is ${this.status}.`);
    const notation = String(request.input || '');
    const governance = this.chromaBridge.evaluateNotation(notation);
    const translation = await this.codexClient.translateBrailleMath(request);
    return { ...translation, governance: { chromaBridge: governance.boundary, codex: translation.boundary } };
  }

  async compileBrailleRuntime(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot compile Braille Runtime instruction: runtime is ${this.status}.`);
    const result = await this.codexClient.requestJson('/api/v1/foundation/braille-runtime/compile', { method: 'POST', body: request });
    if (result.status >= 400) return result;
    const governance = this.chromaBridge.evaluateNotation(String(result.body.executableBraille || ''));
    return {
      status: result.status,
      body: { ...result.body, governance: { chromaBridge: governance.boundary, codex: result.body.boundary } }
    };
  }

  async assembleBrailleRuntime(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot assemble Braille Runtime module: runtime is ${this.status}.`);
    const result = await this.codexClient.requestJson('/api/v1/foundation/braille-runtime/assemble', { method: 'POST', body: request });
    if (result.status >= 400) return result;
    const governance = this.chromaBridge.evaluateNotation(String(result.body.compiledInstruction?.executableBraille || ''));
    return {
      status: result.status,
      body: { ...result.body, governance: { chromaBridge: governance.boundary, codex: result.body.boundary } }
    };
  }

  async runLanguageLoop(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot run language loop: runtime is ${this.status}.`);
    const result = await this.codexClient.requestJson('/api/v1/foundation/language-loop', { method: 'POST', body: request });
    if (result.status >= 400) return result;
    const governance = this.chromaBridge.evaluateNotation(String(result.body.encoding?.ueb || ''));
    return {
      status: result.status,
      body: { ...result.body, governance: { chromaBridge: governance.boundary, codex: result.body.boundary } }
    };
  }

  async respondWithLocalModel(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot reach local Qwen: runtime is ${this.status}.`);
    if (this.config.enableLocalModel === false) throw httpError(503, 'Local model integration is disabled.');
    const text = String(request.input || '').trim();
    if (!text) throw httpError(400, 'input is required.');
    if ([...text].length > 2_000) throw httpError(413, 'Local AI input must be 2000 Unicode code points or fewer.');

    const languageLoop = await this.runLanguageLoop({ text });
    if (languageLoop.status >= 400) return languageLoop;
    const local = await this.localModelClient.respond(LOCAL_REASONING_SYSTEM, compactReasoningContext(languageLoop.body));

    return {
      status: 200,
      body: {
        engine: 'mirror_local_qwen',
        model: { provider: local.provider, name: local.model, local: true },
        response: { language: 'english', text: local.text },
        trace: {
          english: languageLoop.body.canonicalEnglish,
          braille: languageLoop.body.encoding?.ueb,
          numericSequence: languageLoop.body.encoding?.numericSequence || [],
          cellCount: languageLoop.body.encoding?.cells?.length || 0,
          roundTripExact: languageLoop.body.decoding?.roundTripExact === true,
          graphSource: languageLoop.body.meaning?.approvedGraph?.sourceLayer || 'unresolved'
        },
        evidence: languageLoop.body.meaning,
        governance: languageLoop.body.governance,
        timings: local.timings,
        boundary: {
          mode: 'local_reasoning_over_reversible_signal',
          semanticMutationAllowed: false,
          graphMutationAllowed: false,
          sourceMutationAllowed: false,
          reason: 'Local Qwen reasons over a compact copy of the verified signal and evidence. It does not directly modify semantic memory, graph data, or source code.'
        }
      }
    };
  }

  async codexRequest(path: string, options?: { method?: string; body?: Record<string, unknown>; userToken?: string }) {
    if (this.status !== 'ready') throw new Error(`Cannot reach Codex: runtime is ${this.status}.`);
    return this.codexClient.requestJson(path, options);
  }
}

function compactReasoningContext(loop: Record<string, any>) {
  const numericSequence = Array.isArray(loop.encoding?.numericSequence) ? loop.encoding.numericSequence : [];
  const graph = loop.meaning?.approvedGraph || { sourceLayer: 'unresolved', nodes: [], routes: [] };
  const wordNet = loop.meaning?.wordNet || { matchedWords: [], unresolvedWords: [] };
  return {
    task: 'Respond to the user in English using bounded relational evidence.',
    userEnglish: loop.canonicalEnglish,
    signal: {
      notation: loop.encoding?.notation,
      braille: String(loop.encoding?.ueb || '').slice(0, 512),
      numericSequence: numericSequence.slice(0, 512),
      totalCells: numericSequence.length,
      completeSequenceIncluded: numericSequence.length <= 512,
      roundTripExact: loop.decoding?.roundTripExact === true
    },
    foundation: {
      words: (loop.processing?.foundation?.wordCounts || []).slice(0, 24),
      signatureIds: (loop.processing?.foundation?.signatureIds || []).slice(0, 24)
    },
    relationships: {
      sourceLayer: graph.sourceLayer,
      nodes: (graph.nodes || []).slice(0, 12).map((node: Record<string, unknown>) => ({ id: node.id, label: node.label, family: node.family })),
      routes: (graph.routes || []).slice(0, 24).map((route: Record<string, any>) => ({
        id: route.id,
        source: route.source?.label || route.source,
        target: route.target?.label || route.target,
        type: route.relationshipType || route.type
      })),
      wordNet: (wordNet.matchedWords || []).slice(0, 12).map((item: Record<string, unknown>) => ({ word: item.word, senses: item.senses }))
    }
  };
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function composeTranslation(
  evaluation: ReturnType<ChromaBridgeCapability['evaluate']>,
  graphRead: CodexGraphRead | null
): EmotionalTranslation {
  const graphLanding = graphRead?.colorClimateLanding;
  if (!graphLanding) {
    return {
      source: 'chromabridge_fallback',
      ...evaluation.translation,
      matchedNodes: graphRead?.matchedNodes || [],
      supportedRoutes: graphRead?.supportedRoutes || [],
      evidence: graphRead?.evidence || evaluation.evidence,
      boundary: {
        chromaBridge: evaluation.boundary.reason,
        codex: graphRead?.boundary || null
      }
    };
  }

  const family = graphLanding.family || graphLanding.label;
  return {
    source: 'codex_graph',
    climateName: graphLanding.family
      ? `${graphLanding.label} · ${graphLanding.family}`
      : graphLanding.label,
    primaryClimate: {
      id: graphLanding.id,
      label: graphLanding.label,
      family,
      color: graphLanding.color
    },
    companionClimates: evaluation.translation.primaryClimate
      ? [evaluation.translation.primaryClimate, ...evaluation.translation.companionClimates]
      : [],
    relationalRead: `The stored relational graph lands at ${graphLanding.label}${graphLanding.family ? ` in the ${graphLanding.family} family` : ''}. ${evaluation.translation.relationalRead}`,
    connectionStrength: graphRead.connectionStrength,
    matchedNodes: graphRead.matchedNodes,
    supportedRoutes: graphRead.supportedRoutes,
    evidence: graphRead.evidence,
    boundary: {
      chromaBridge: evaluation.boundary.reason,
      codex: graphRead.boundary
    }
  };
}
