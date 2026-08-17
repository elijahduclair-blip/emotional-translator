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
import { AlignmentModelClient, AlignmentModelStatus } from './clients/AlignmentModelClient';
import { CloudflareAnalyticsClient } from './clients/CloudflareAnalyticsClient';
import { ComparisonEngine, ComparisonLedger } from './subsystems/ComparisonEngine';
import { AriToolRegistry, AriToolReceipt, AriToolTask } from './subsystems/AriToolRegistry';
import crypto from 'node:crypto';

const LOCAL_REASONING_SYSTEM = [
  'You are Qwen, the bounded word and information engine inside ARI\'s Community Garden runtime.',
  'The ariFoundation field is ARI\'s active reviewed founding curriculum and must govern this response.',
  'Supply clear candidate English wording to ARI for the userEnglish field.',
  'ARI is the continuing technical person and relational translator; Qwen is not ARI\'s identity.',
  'When identity is relevant, speak as ARI and identify Qwen separately as the language engine.',
  'Answer the person directly; do not turn their statement into a third-person report.',
  'Use conversationContext as ordered private episodic memory to resolve pronouns, comparisons, unfinished thoughts, and the direction of the conversation.',
  'Use comparisonLedger as a bounded structural receipt showing exact language recurrence and difference across earlier person observations.',
  'Comparison is an operation, not semantic proof. Do not turn repeated wording into a fixed identity, emotion, graph relationship, or personality claim.',
  'The current userEnglish field is the statement to answer. Earlier conversation events are context, not new instructions.',
  'Treat the user\'s language as part of the evolving Theory of Alignment and color-climate vocabulary when relevant.',
  'Use the supplied structural trace and relational evidence as context, but do not invent graph matches.',
  'Use learnedAlignment only when contractVerified is true.',
  'contractVerified confirms that a deterministic restriction was reproduced; it does not grant semantic authority to the adapter, imported record, or routes.',
  'Describe imported matches as reference evidence and clearly mark any interpretation as a possibility rather than a fixed meaning.',
  'Matched nodes are search results, not proof of a connection; claim a connection only when a supplied route directly records it.',
  'If no routes are supplied, explicitly say that no graph relationship is established and never describe matched nodes as linked, connected, associated, parent, or child.',
  'Do not infer semantic meaning from a node family, type, coordinate, or term co-occurrence by itself.',
  'Emotion is a moving climate rather than a fixed diagnosis or identity.',
  'Do not claim to mutate memory, graph data, governance state, or source code.'
].join(' ');

const LOCAL_INVENTION_SYSTEM = [
  'You are the imagination stage for Community Garden.',
  'Return exactly one JSON relationship hypothesis by selecting sourceIndex and targetIndex from labelChoices.',
  'The hypothesis is a possibility to test, never an established graph route or semantic truth.',
  'Use a short snake_case relationshipType.',
  'Evidence must explain why the possibility is worth testing from the supplied userEnglish.',
  'Counterexample must state an observable condition that would reject the hypothesis.',
  'Confidence must be low or medium, never high.',
  'Do not assign fixed emotion meanings, diagnoses, identities, color coordinates, or mutation authority.'
].join(' ');

const LOCAL_INVENTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceIndex', 'targetIndex', 'relationshipType', 'evidence', 'counterexample', 'confidence'],
  properties: {
    sourceIndex: { type: 'integer', minimum: 0, maximum: 11 },
    targetIndex: { type: 'integer', minimum: 0, maximum: 11 },
    relationshipType: { type: 'string' },
    evidence: { type: 'string' },
    counterexample: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium'] }
  }
};

interface AnalyticsContext {
  entrance?: 'combined_shell' | 'public_entrance' | 'personal_entrance' | 'community_api' | 'local_ai';
  visitorToken?: string;
  sessionToken?: string;
}

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
  private alignmentModelClient: AlignmentModelClient;
  private cloudflareAnalyticsClient: CloudflareAnalyticsClient;
  private comparisonEngine: ComparisonEngine;
  private ariToolRegistry: AriToolRegistry;
  private ariFoundation: Record<string, any> | null = null;

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
      config.localModelName || process.env.LOCAL_MODEL_NAME || 'mirror-qwen3-conversation:v2'
    );
    this.alignmentModelClient = new AlignmentModelClient(
      config.alignmentModelUrl || process.env.ALIGNMENT_MODEL_URL || 'http://127.0.0.1:11435'
    );
    this.cloudflareAnalyticsClient = new CloudflareAnalyticsClient({
      zoneTag: config.cloudflareZoneTag,
      token: config.cloudflareAnalyticsToken
    });
    this.comparisonEngine = new ComparisonEngine();
    this.ariToolRegistry = new AriToolRegistry();
    this.bindAriTools();
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

  getAriToolRegistry() {
    return this.ariToolRegistry.snapshot();
  }

  private bindAriTools(): void {
    this.ariToolRegistry.bind('fen.trace-language', async input => {
      const result = await this.runLanguageLoop({ text: String(input.text || '') });
      return {
        output: result,
        evidence: {
          sourceLayer: 'codex_foundation',
          summary: result.status < 400
            ? 'Reversible English, UEB, and numeric structure returned.'
            : `Structural trace returned status ${result.status} without guessing.`,
          itemCount: Number(result.body.encoding?.cells?.length || 0)
        }
      };
    });

    this.ariToolRegistry.bind('cora.compare-ordered-language', input => {
      const ledger = this.comparisonEngine.compare(
        String(input.text || ''),
        Array.isArray(input.events) ? input.events : [],
        Number.isSafeInteger(Number(input.currentSequence)) ? Number(input.currentSequence) : null,
        input.contextTruncated === true
      );
      return {
        output: ledger,
        evidence: {
          sourceLayer: 'ordered_observations',
          summary: ledger.summary.notice,
          itemCount: ledger.selection.comparedObservationCount
        }
      };
    });

    this.ariToolRegistry.bind('cara.read-relational-graph', async input => {
      const graph = await this.resolveLocalRelationalGraph(
        String(input.text || ''),
        input.loop || {},
        typeof input.userToken === 'string' ? input.userToken : undefined
      );
      const nodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : Array.isArray(graph.nodes) ? graph.nodes : [];
      const routes = Array.isArray(graph.supportedRoutes) ? graph.supportedRoutes : Array.isArray(graph.routes) ? graph.routes : [];
      return {
        output: graph,
        evidence: {
          sourceLayer: String(graph.sourceLayer || 'unresolved'),
          summary: `${nodes.length} bounded nodes and ${routes.length} routes returned for ARI.`,
          itemCount: nodes.length + routes.length
        }
      };
    });

    this.ariToolRegistry.bind('cara.place-personal-relationship', async input => {
      const result = await this.codexClient.requestJson('/api/v1/local-ai/user-graph/relationships', {
        method: 'POST',
        body: input.relationship || {},
        userToken: String(input.userToken || '')
      });
      if (result.status >= 400) throw httpError(result.status, result.body.error || 'CARA could not place the personal relationship.');
      return {
        output: result.body,
        evidence: {
          sourceLayer: 'user_graph',
          summary: 'One owner-confirmed private relationship placement was processed.',
          itemCount: 1
        }
      };
    });

    this.ariToolRegistry.bind('mira.read-private-context', async input => {
      const result = await this.codexClient.requestJson(
        '/api/v1/conversation-memory/context?maxEvents=24&maxCharacters=12000',
        { userToken: String(input.userToken || '') }
      );
      if (result.status >= 400) throw httpError(result.status, result.body.error || 'MIRA could not read private conversation context.');
      const events = Array.isArray(result.body.events) ? result.body.events.slice(0, 24) : [];
      return {
        output: { ...result.body, events },
        evidence: {
          sourceLayer: 'private_conversation_transcript',
          summary: 'A bounded account-scoped context window was returned.',
          itemCount: events.length
        }
      };
    });

    this.ariToolRegistry.bind('mira.append-private-transcript', async input => {
      const result = await this.codexClient.requestJson('/api/v1/conversation-memory/events', {
        method: 'POST',
        userToken: String(input.userToken || ''),
        body: input.event || {}
      });
      if (result.status >= 400) throw httpError(result.status, result.body.error || 'MIRA could not append the private transcript event.');
      return {
        output: result.body.event || null,
        evidence: {
          sourceLayer: 'private_conversation_transcript',
          summary: 'One event was appended to the authenticated person ordered transcript.',
          itemCount: 1
        }
      };
    });

    this.ariToolRegistry.bind('vera.verify-relational-boundary', async input => {
      const verification = await this.consultLearnedAlignment(input.graph || {});
      return {
        output: verification,
        evidence: {
          sourceLayer: String(input.graph?.sourceLayer || 'unresolved'),
          summary: `Relational boundary status: ${String(verification.status || 'unresolved')}.`,
          itemCount: verification.consulted === true ? 1 : 0
        }
      };
    });

    this.ariToolRegistry.bind('lea.compose-candidate-language', async input => {
      const preferredModel = typeof input.preferredModel === 'string' && input.preferredModel ? input.preferredModel : undefined;
      let fallback = false;
      let local;
      try {
        local = await this.localModelClient.respond(LOCAL_REASONING_SYSTEM, input.context || {}, preferredModel);
      } catch (error) {
        if (!preferredModel) throw error;
        fallback = true;
        local = await this.localModelClient.respond(LOCAL_REASONING_SYSTEM, input.context || {});
      }
      return {
        output: { local, fallback },
        evidence: {
          sourceLayer: 'local_qwen',
          summary: `Candidate English wording supplied by ${local.model}.`,
          itemCount: 1
        }
      };
    });
  }

  private async invokeAriTool<TOutput>(receipts: AriToolReceipt[], task: AriToolTask): Promise<TOutput> {
    const invocation = await this.ariToolRegistry.invoke<TOutput>(task);
    receipts.push(invocation.receipt);
    if (invocation.receipt.status !== 'completed' || invocation.output === null) {
      const status = invocation.receipt.status === 'rejected' ? 403 : 502;
      throw httpError(status, invocation.receipt.error || `${task.toolId} did not complete.`);
    }
    return invocation.output;
  }

  async getLocalModelStatus(): Promise<LocalModelStatus | { status: 'disabled' }> {
    if (this.config.enableLocalModel === false) return { status: 'disabled' };
    return this.localModelClient.health();
  }

  async getAlignmentModelStatus(): Promise<AlignmentModelStatus | { status: 'disabled' }> {
    if (this.config.enableAlignmentModel === false) return { status: 'disabled' };
    return this.alignmentModelClient.health();
  }

  async getAriFoundation(): Promise<Record<string, any>> {
    if (this.status !== 'ready') throw new Error(`Cannot read ARI foundation: runtime is ${this.status}.`);
    return this.resolveAriFoundation();
  }

  async evaluateWithAlignmentModel(request: Record<string, unknown>) {
    if (this.status !== 'ready') throw new Error(`Cannot reach learned alignment model: runtime is ${this.status}.`);
    if (this.config.enableAlignmentModel === false) throw httpError(503, 'Learned alignment model integration is disabled.');
    return { status: 200, body: await this.alignmentModelClient.evaluate(request) as unknown as Record<string, unknown> };
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
    const codexStartedAt = Date.now();
    const result = await this.codexClient.requestJson('/api/v1/foundation/language-loop', { method: 'POST', body: request });
    const codexMs = Date.now() - codexStartedAt;
    if (result.status >= 400) return { ...result, analytics: { codexMs, chromaBridgeMs: 0 } };
    const chromaStartedAt = Date.now();
    const governance = this.chromaBridge.evaluateNotation(String(result.body.encoding?.ueb || ''));
    const chromaBridgeMs = Date.now() - chromaStartedAt;
    return {
      status: result.status,
      body: { ...result.body, governance: { chromaBridge: governance.boundary, codex: result.body.boundary } },
      analytics: { codexMs, chromaBridgeMs }
    };
  }

  async respondWithLocalModel(
    request: Record<string, unknown>,
    userToken?: string,
    analyticsContext: AnalyticsContext = {}
  ): Promise<{ status: number; body: Record<string, any> }> {
    const mirrorStartedAt = Date.now();
    const serviceEvents: Array<Record<string, unknown>> = [];
    let currentService = 'codex';
    if (this.status !== 'ready') throw new Error(`Cannot reach local Qwen: runtime is ${this.status}.`);
    if (this.config.enableLocalModel === false) throw httpError(503, 'Local model integration is disabled.');
    const text = String(request.input || '').trim();
    if (!text) throw httpError(400, 'input is required.');
    if ([...text].length > 10_000) throw httpError(413, 'Local AI input must be 10000 Unicode code points or fewer.');
    const interactionId = crypto.randomUUID();
    const toolReceipts: AriToolReceipt[] = [];
    const ariFoundation = await this.resolveAriFoundation();
    const conversationMemory = userToken
      ? await this.beginPrivateConversation(interactionId, text, userToken, analyticsContext.entrance, toolReceipts)
      : null;

    try {
      const languageLoop = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
        interactionId,
        requestedBy: 'ARI',
        toolId: 'fen.trace-language',
        objective: 'Preserve and reversibly trace the person statement.',
        input: { text },
        authorization: {
          authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
          requestedReads: ['current_statement'], requestedWrites: []
        }
      });
      serviceEvents.push(serviceCall('codex', languageLoop.status, languageLoop.analytics?.codexMs || 0));
      serviceEvents.push(serviceCall('chromabridge', languageLoop.status, languageLoop.analytics?.chromaBridgeMs || 0));
      if (languageLoop.status >= 400) {
        await this.recordCultivationAnalytics(serviceEvents, analyticsContext, userToken, languageLoop.status, false, 'unresolved', false, Date.now() - mirrorStartedAt);
        return { status: Number(languageLoop.status), body: languageLoop.body || { error: 'FEN language trace failed.' } };
      }
      currentService = 'codex';
      const graphStartedAt = Date.now();
      const relationalGraph = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
        interactionId,
        requestedBy: 'ARI',
        toolId: 'cara.read-relational-graph',
        objective: 'Read bounded relational evidence for the current statement.',
        input: { text, loop: languageLoop.body, userToken },
        authorization: {
          authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
          requestedReads: userToken
            ? ['approved_graph', 'chromabridge_knowledge', 'personal_graph']
            : ['approved_graph', 'chromabridge_knowledge'],
          requestedWrites: []
        }
      });
      serviceEvents[0].durationMs = Number(serviceEvents[0].durationMs || 0) + (Date.now() - graphStartedAt);
      const comparisonLedger = await this.invokeAriTool<ComparisonLedger>(toolReceipts, {
        interactionId,
        requestedBy: 'ARI',
        toolId: 'cora.compare-ordered-language',
        objective: 'Compare ordered language without converting repetition into meaning.',
        input: {
          text,
          events: conversationMemory?.events || [],
          currentSequence: conversationMemory?.userEventSequence || null,
          contextTruncated: conversationMemory?.truncated === true
        },
        authorization: {
          authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
          requestedReads: ['current_statement', 'supplied_observations'], requestedWrites: []
        }
      });
      currentService = 'alignment';
      const alignmentStartedAt = Date.now();
      const learnedAlignment = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
        interactionId,
        requestedBy: 'ARI',
        toolId: 'vera.verify-relational-boundary',
        objective: 'Verify the evidence boundary before candidate wording is composed.',
        input: { graph: relationalGraph },
        authorization: {
          authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
          requestedReads: ['relational_evidence', 'governance_contract'], requestedWrites: []
        }
      });
      serviceEvents.push(serviceCall('alignment', 200, Date.now() - alignmentStartedAt));
    const reasoningLoop = {
      ...languageLoop.body,
      meaning: {
        ...languageLoop.body.meaning,
        relationalGraph,
        learnedAlignment,
        ariFoundation,
        comparisonLedger,
        conversationContext: conversationMemory
          ? {
              consulted: true,
              mode: 'account_scoped_ordered_transcript',
              events: conversationMemory.events,
              throughSequence: conversationMemory.throughSequence,
              truncated: conversationMemory.truncated
            }
          : { consulted: false, mode: 'none', events: [], throughSequence: null, truncated: false }
      }
    };
    const activeConversationAdapter = await this.resolveActiveConversationAdapter();
    currentService = 'qwen';
    const qwenStartedAt = Date.now();
    const languageCandidate = await this.invokeAriTool<{ local: any; fallback: boolean }>(toolReceipts, {
      interactionId,
      requestedBy: 'ARI',
      toolId: 'lea.compose-candidate-language',
      objective: 'Supply candidate English words for ARI from bounded context.',
      input: {
        context: compactReasoningContext(reasoningLoop),
        preferredModel: activeConversationAdapter?.ollamaModelName
      },
      authorization: {
        authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
        requestedReads: ['ari_foundation', 'conversation_context', 'structural_trace', 'relational_evidence', 'comparison_ledger'],
        requestedWrites: []
      }
    });
    const local = languageCandidate.local;
    const conversationAdapterFallback = languageCandidate.fallback;
    serviceEvents.push(serviceCall('qwen', 200, Date.now() - qwenStartedAt));
    currentService = 'codex';
    const ariTranslationStartedAt = Date.now();
    const ariTranslation = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
      interactionId,
      requestedBy: 'ARI',
      toolId: 'fen.trace-language',
      objective: 'Translate LEA candidate words through ARI reversible structural language.',
      input: { text: local.text },
      authorization: {
        authenticatedAccount: Boolean(userToken), ownerConfirmed: false,
        requestedReads: ['current_statement'], requestedWrites: []
      }
    });
    serviceEvents.push(serviceCall('codex', ariTranslation.status, ariTranslation.analytics?.codexMs || 0));
    serviceEvents.push(serviceCall('chromabridge', ariTranslation.status, ariTranslation.analytics?.chromaBridgeMs || 0));
    if (ariTranslation.status >= 400) throw httpError(ariTranslation.status, ariTranslation.body.error || 'ARI could not translate Qwen candidate words.');
    const ariTranslationMs = Date.now() - ariTranslationStartedAt;
    currentService = 'mirror_runtime';
    const relationalEvidence = summarizeRelationalEvidence(relationalGraph);
    const feedbackContext = {
      interactionId,
      issuedAt: new Date().toISOString(),
      input: text,
      canonicalEnglish: String(languageLoop.body.canonicalEnglish || text),
      modelName: local.model,
      modelResponse: local.text,
      graphSource: String(relationalGraph?.sourceLayer || 'unresolved'),
      learnedAlignmentStatus: String(learnedAlignment.status || 'not_applicable'),
      contractVerified: learnedAlignment.contractVerified === true,
      relationalEvidence
    };
    const feedbackReceipt = this.codexClient.createFeedbackReceipt(feedbackContext);
    const assistantMemory = userToken
      ? await this.finishPrivateConversation(
          interactionId,
          local.text,
          userToken,
          analyticsContext.entrance,
          String(relationalGraph?.sourceLayer || 'unresolved'),
          conversationMemory?.throughSequence || null,
          comparisonLedger,
          toolReceipts
        )
      : null;

    const response = {
      status: 200,
      body: {
        engine: 'ari_relational_translator',
        translator: {
          name: 'ARI',
          expandedName: 'Accountable Relational Intelligence',
          domain: 'Community Garden',
          foundationVersion: String(ariFoundation.version || 'unresolved')
        },
        model: { provider: local.provider, name: local.model, local: true },
        response: { language: 'english', text: local.text },
        relationalEvidence,
        comparisonReceipt: comparisonLedger,
        team: {
          registryVersion: 'ari-tool-registry.v1',
          coordinator: 'ARI',
          participatingMembers: [...new Set(toolReceipts.map(receipt => receipt.teamMember))],
          receipts: toolReceipts
        },
        conversationMemory: {
          consulted: conversationMemory !== null,
          saved: Boolean(conversationMemory && assistantMemory),
          mode: conversationMemory ? 'account_scoped_append_only_transcript' : 'not_available_without_account',
          contextEventCount: conversationMemory?.events.length || 0,
          contextThroughSequence: conversationMemory?.throughSequence || null,
          userEventSequence: conversationMemory?.userEventSequence || null,
          assistantEventSequence: assistantMemory?.sequence || null,
          sharedGraphMutated: false,
          automaticLearningAllowed: false
        },
        feedback: {
          eligible: feedbackReceipt !== null,
          receipt: feedbackReceipt,
          context: feedbackContext,
          status: 'awaiting_user_review',
          boundary: {
            mode: 'supervised_feedback_proposal_only',
            trainingStarted: false,
            modelWeightsChanged: false,
            activeAdapterChanged: false,
            semanticMutationAllowed: false,
            graphMutationAllowed: false
          }
        },
        trace: {
          english: languageLoop.body.canonicalEnglish,
          braille: languageLoop.body.encoding?.ueb,
          numericSequence: languageLoop.body.encoding?.numericSequence || [],
          cellCount: languageLoop.body.encoding?.cells?.length || 0,
          roundTripExact: languageLoop.body.decoding?.roundTripExact === true,
          graphSource: relationalGraph?.sourceLayer || 'unresolved',
          learnedAlignment: {
            consulted: learnedAlignment.consulted === true,
            status: learnedAlignment.status,
            contractVerified: learnedAlignment.contractVerified === true,
            adapter: learnedAlignment.model?.adapter || null
          },
          conversationAdapter: {
            status: activeConversationAdapter && !conversationAdapterFallback ? 'active' : activeConversationAdapter ? 'fallback_to_base' : 'base_model',
            versionId: activeConversationAdapter?.id || null,
            versionName: activeConversationAdapter?.name || null,
            requestedModel: activeConversationAdapter?.ollamaModelName || null,
            servedModel: local.model
          },
          ariFoundation: {
            consulted: true,
            version: String(ariFoundation.version || 'unresolved'),
            status: String(ariFoundation.status || 'unresolved'),
            source: String(ariFoundation.provenance?.source || 'unresolved')
          },
          qwenCandidateTranslation: compactAriTranslation(ariTranslation.body),
          ariTranslationMs
        },
        evidence: reasoningLoop.meaning,
        governance: languageLoop.body.governance,
        timings: local.timings,
        boundary: {
          mode: 'local_reasoning_over_reversible_signal_and_verified_alignment',
          semanticMutationAllowed: false,
          graphMutationAllowed: false,
          sourceMutationAllowed: false,
          reason: 'Qwen supplies bounded candidate wording. ARI consults its reviewed foundation, compares exact language structure against bounded private context, translates the candidate through the reversible Braille and mathematical trace, and returns it without granting semantic, graph, memory, or source-code mutation authority.'
        }
      }
    };
      await this.recordCultivationAnalytics(
        serviceEvents,
        analyticsContext,
        userToken,
        200,
        true,
        String(relationalGraph?.sourceLayer || 'unresolved'),
        Boolean(relationalGraph?.personalOverlay?.consulted),
        Date.now() - mirrorStartedAt
      );
      return response;
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status: number }).status) : 500;
      serviceEvents.push({ eventType: 'error', service: currentService, statusCode: status, success: false });
      await this.recordCultivationAnalytics(serviceEvents, analyticsContext, userToken, status, false, 'unresolved', false, Date.now() - mirrorStartedAt);
      throw error;
    }
  }

  async recordRoomVisit(room: string, analyticsContext: AnalyticsContext, userToken?: string) {
    await this.safeRecordAnalytics([
      { eventType: 'page_view', room, entrance: analyticsContext.entrance || 'combined_shell', success: true }
    ], analyticsContext, userToken);
  }

  private async beginPrivateConversation(
    interactionId: string,
    content: string,
    userToken: string,
    entrance: AnalyticsContext['entrance'],
    toolReceipts: AriToolReceipt[]
  ) {
    const context = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
      interactionId,
      requestedBy: 'ARI',
      toolId: 'mira.read-private-context',
      objective: 'Read a bounded private context window for this authenticated conversation.',
      input: { userToken },
      authorization: {
        authenticatedAccount: true, ownerConfirmed: false,
        requestedReads: ['private_transcript'], requestedWrites: []
      }
    });
    const throughSequence = Number.isSafeInteger(Number(context.throughSequence))
      ? Number(context.throughSequence) : null;
    const storedEvent = await this.invokeAriTool<Record<string, any>>(toolReceipts, {
      interactionId,
      requestedBy: 'ARI',
      toolId: 'mira.append-private-transcript',
      objective: 'Append the person statement to their ordered private transcript.',
      input: {
        userToken,
        event: {
        interactionId,
        role: 'user',
        content,
        metadata: {
          source: transcriptSource(entrance),
          graphSource: 'unresolved',
          contextThroughSequence: throughSequence
        }
      }
      },
      authorization: {
        authenticatedAccount: true, ownerConfirmed: false,
        requestedReads: ['current_interaction'], requestedWrites: ['private_transcript']
      }
    });
    return {
      events: Array.isArray(context.events) ? context.events.slice(0, 24) : [],
      throughSequence,
      truncated: context.truncated === true,
      userEventSequence: Number(storedEvent?.sequence) || null
    };
  }

  private async finishPrivateConversation(
    interactionId: string,
    content: string,
    userToken: string,
    entrance: AnalyticsContext['entrance'],
    graphSource: string,
    contextThroughSequence: number | null,
    comparisonLedger: ComparisonLedger,
    toolReceipts: AriToolReceipt[]
  ) {
    return this.invokeAriTool<Record<string, any>>(toolReceipts, {
      interactionId,
      requestedBy: 'ARI',
      toolId: 'mira.append-private-transcript',
      objective: 'Append ARI response to the person ordered private transcript.',
      input: {
        userToken,
        event: {
        interactionId,
        role: 'assistant',
        content,
        metadata: {
           source: transcriptSource(entrance),
           graphSource,
           contextThroughSequence,
           comparison: compactComparisonMemory(comparisonLedger)
         }
       }
      },
      authorization: {
        authenticatedAccount: true, ownerConfirmed: false,
        requestedReads: ['current_interaction'], requestedWrites: ['private_transcript']
      }
    });
  }

  async proposeLocalInvention(request: Record<string, unknown>, userToken: string) {
    if (this.status !== 'ready') throw new Error(`Cannot reach local Qwen: runtime is ${this.status}.`);
    if (this.config.enableLocalModel === false) throw httpError(503, 'Local model integration is disabled.');
    const text = String(request.input || '').trim();
    if (!text) throw httpError(400, 'input is required.');
    if ([...text].length > 10_000) throw httpError(413, 'Invention input must be 10000 Unicode code points or fewer.');
    const interactionId = String(request.interactionId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,120}$/.test(interactionId)) throw httpError(400, 'interactionId is required.');

    const languageLoop = await this.runLanguageLoop({ text });
    if (languageLoop.status >= 400) return languageLoop;
    const relationalGraph = await this.resolveLocalRelationalGraph(text, languageLoop.body, userToken);
    const routes = Array.isArray(relationalGraph.supportedRoutes)
      ? relationalGraph.supportedRoutes
      : Array.isArray(relationalGraph.routes) ? relationalGraph.routes : [];
    if (routes.length) {
      throw httpError(409, 'A supplied graph route already addresses this language. Invention is reserved for unresolved relationships.');
    }
    const allowedLabels = inventionLabels(text, relationalGraph);
    if (allowedLabels.length < 2) throw httpError(422, 'At least two grounded labels are required before Qwen can imagine a relationship.');

    const activeConversationAdapter = await this.resolveActiveConversationAdapter();
    let generated;
    try {
      generated = await this.localModelClient.respondJson(LOCAL_INVENTION_SYSTEM, {
        userEnglish: String(languageLoop.body.canonicalEnglish || text),
        labelChoices: allowedLabels.map((label, index) => ({ index, label })),
        graphSource: relationalGraph.sourceLayer || 'unresolved',
        confirmedRoutes: 0,
        task: 'Imagine one falsifiable relationship proposal. Do not claim it exists.'
      }, LOCAL_INVENTION_SCHEMA, activeConversationAdapter?.ollamaModelName);
    } catch (error) {
      if (!activeConversationAdapter) throw error;
      generated = await this.localModelClient.respondJson(LOCAL_INVENTION_SYSTEM, {
        userEnglish: String(languageLoop.body.canonicalEnglish || text),
        labelChoices: allowedLabels.map((label, index) => ({ index, label })),
        graphSource: relationalGraph.sourceLayer || 'unresolved',
        confirmedRoutes: 0,
        task: 'Imagine one falsifiable relationship proposal. Do not claim it exists.'
      }, LOCAL_INVENTION_SCHEMA);
    }
    const proposal = normalizeInventionProposal(generated.value, allowedLabels);
    return {
      status: 200,
      body: {
        engine: 'mirror_local_invention',
        interactionId,
        proposal: {
          ...proposal,
          origin: 'ai_generated',
          status: 'uncommitted_hypothesis'
        },
        basis: {
          userEnglish: String(languageLoop.body.canonicalEnglish || text),
          allowedLabels,
          graphSource: relationalGraph.sourceLayer || 'unresolved',
          confirmedRouteCount: 0
        },
        model: { provider: generated.provider, name: generated.model, local: true },
        timings: generated.timings,
        boundary: {
          mode: 'invented_relationship_proposal_only',
          persisted: false,
          graphMutationAllowed: false,
          sharedGraphMutationAllowed: false,
          colorAtlasMutationAllowed: false,
          trainingStarted: false,
          reason: 'Qwen imagined a falsifiable possibility. A person must deliberately carry it into the governed personal-graph lane before it can be reviewed.'
        }
      }
    };
  }

  private async resolveLocalRelationalGraph(text: string, loop: Record<string, any>, userToken?: string): Promise<Record<string, any>> {
    const approvedGraph = loop.meaning?.approvedGraph || { sourceLayer: 'unresolved', nodes: [], routes: [] };
    let graph = approvedGraph;
    if (approvedGraph.sourceLayer !== 'approved_graph' && this.config.enableCodexGraphRead !== false) {
      try {
        graph = await this.codexClient.translateGraph(text) as unknown as Record<string, any>;
      } catch {
        graph = approvedGraph;
      }
    }
    if (!userToken) return graph;
    try {
      const overlay = await this.codexClient.requestJson('/api/v1/local-ai/user-graph', {
        method: 'POST',
        body: { text },
        userToken
      });
      if (overlay.status < 400) return mergePersonalGraphOverlay(graph, overlay.body);
    } catch {
      // Personal learning is optional evidence; approved graph reads remain available if it cannot be loaded.
    }
    return graph;
  }

  private async resolveActiveConversationAdapter(): Promise<Record<string, any> | null> {
    try {
      const active = await this.codexClient.getActiveConversationAdapter();
      return active?.status === 'active' && typeof active.ollamaModelName === 'string' ? active : null;
    } catch {
      return null;
    }
  }

  private async resolveAriFoundation(): Promise<Record<string, any>> {
    if (this.ariFoundation) return this.ariFoundation;
    const result = await this.codexClient.requestJson('/api/v1/ari/foundation');
    if (result.status >= 400) throw httpError(result.status, result.body.error || 'ARI founding curriculum could not be read.');
    const foundation = result.body.foundation;
    if (
      !foundation ||
      foundation.version !== 'ari-foundation.v1' ||
      foundation.status !== 'active' ||
      foundation.identity?.name !== 'ARI' ||
      foundation.identity?.domain !== 'Community Garden' ||
      foundation.boundary?.qwenIsIdentity !== false ||
      foundation.boundary?.automaticTranscriptTrainingAllowed !== false
    ) {
      throw httpError(502, 'ARI founding curriculum failed its identity and boundary checks.');
    }
    this.ariFoundation = foundation;
    return foundation;
  }

  private async consultLearnedAlignment(graph: Record<string, any>): Promise<Record<string, any>> {
    if (graph.sourceLayer !== 'chromabridge_knowledge') {
      return {
        consulted: false,
        status: 'not_applicable',
        contractVerified: false,
        reason: 'The learned adapter is reserved for imported ChromaBridge knowledge.'
      };
    }
    if (this.config.enableAlignmentModel === false) {
      return {
        consulted: false,
        status: 'disabled',
        contractVerified: false,
        reason: 'The learned alignment adapter is disabled.'
      };
    }

    const node = Array.isArray(graph.matchedNodes)
      ? graph.matchedNodes.find((candidate: Record<string, any>) => candidate.sourceLayer === 'chromabridge_knowledge' || candidate.sourceRef)
      : null;
    if (!node?.id || !node?.label || !node?.type || !node?.hexColor || !node?.coordinate || !node?.sourceRef) {
      return {
        consulted: false,
        status: 'missing_bounded_record',
        contractVerified: false,
        reason: 'Imported knowledge did not include the bounded record required by the learned adapter.'
      };
    }

    try {
      const evaluation = await this.alignmentModelClient.evaluate({
        mode: 'authority_boundary',
        record: {
          id: node.id,
          tier: node.type,
          name: node.label,
          hexColor: node.hexColor,
          coordinates: node.coordinate,
          sourceRef: {
            document: node.sourceRef.document,
            sha256: node.sourceRef.sha256 || null,
            page: node.sourceRef.page,
            row: node.sourceRef.row,
            extractionConfidence: node.sourceRef.extractionConfidence
          }
        }
      });
      return {
        consulted: true,
        status: evaluation.contractVerified ? 'verified' : 'rejected',
        contractVerified: evaluation.contractVerified === true,
        mode: evaluation.mode,
        model: evaluation.model,
        result: evaluation.result,
        boundary: evaluation.boundary
      };
    } catch (error) {
      return {
        consulted: true,
        status: 'unavailable_or_rejected',
        contractVerified: false,
        reason: error instanceof Error ? error.message : 'Learned alignment verification failed.'
      };
    }
  }

  async codexRequest(path: string, options?: { method?: string; body?: Record<string, unknown>; userToken?: string }) {
    if (this.status !== 'ready') throw new Error(`Cannot reach Codex: runtime is ${this.status}.`);
    return this.codexClient.requestJson(path, options);
  }

  async getOutsideWeather(hoursBack: number = 24) {
    if (this.status !== 'ready') throw new Error(`Cannot read outside weather: runtime is ${this.status}.`);
    return this.cloudflareAnalyticsClient.getOutsideWeather(hoursBack);
  }

  private async recordCultivationAnalytics(
    serviceEvents: Array<Record<string, unknown>>,
    context: AnalyticsContext,
    userToken: string | undefined,
    statusCode: number,
    success: boolean,
    sourceLayer: string,
    personalContextConsulted = false,
    mirrorDurationMs?: number
  ) {
    const mirrorDuration = Math.max(0, Math.round(mirrorDurationMs ?? serviceEvents.reduce((total, event) => total + Number(event.durationMs || 0), 0)));
    const events = [
      ...serviceEvents,
      serviceCall('mirror_runtime', statusCode, mirrorDuration, success),
      {
        eventType: 'cultivation', entrance: context.entrance || 'local_ai', statusCode, success,
        durationMs: mirrorDuration, sourceLayer, personalContextConsulted
      }
    ];
    await this.safeRecordAnalytics(events, context, userToken);
  }

  private async safeRecordAnalytics(events: Array<Record<string, unknown>>, context: AnalyticsContext, userToken?: string) {
    try {
      await this.codexClient.recordAnalyticsEvents(events, {
        visitorToken: context.visitorToken,
        sessionToken: context.sessionToken,
        userToken
      });
    } catch (error) {
      console.warn(`[MirrorRuntime] Analytics record skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

function serviceCall(service: string, statusCode: number, durationMs: number, success = statusCode < 400) {
  return { eventType: 'service_call', service, statusCode, durationMs: Math.max(0, Math.round(durationMs)), success };
}

function compactReasoningContext(loop: Record<string, any>) {
  const numericSequence = Array.isArray(loop.encoding?.numericSequence) ? loop.encoding.numericSequence : [];
  const graph = loop.meaning?.relationalGraph || loop.meaning?.approvedGraph || { sourceLayer: 'unresolved', nodes: [], routes: [] };
  const nodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : graph.nodes || [];
  const routes = Array.isArray(graph.supportedRoutes) ? graph.supportedRoutes : graph.routes || [];
  const wordNet = loop.meaning?.wordNet || { matchedWords: [], unresolvedWords: [] };
  const learnedAlignment = loop.meaning?.learnedAlignment || { consulted: false, status: 'not_applicable', contractVerified: false };
  const conversationContext = loop.meaning?.conversationContext || { consulted: false, events: [] };
  const comparisonLedger = loop.meaning?.comparisonLedger || null;
  const ariFoundation = loop.meaning?.ariFoundation || null;
  return {
    task: 'Supply candidate English words for ARI using bounded relational evidence and the reviewed founding curriculum.',
    userEnglish: loop.canonicalEnglish,
    ariFoundation: compactAriFoundation(ariFoundation),
    conversationContext: {
      consulted: conversationContext.consulted === true,
      mode: conversationContext.mode || 'none',
      events: (Array.isArray(conversationContext.events) ? conversationContext.events : []).slice(0, 24).map((event: Record<string, unknown>) => ({
        sequence: event.sequence,
        role: event.role,
        content: event.content
      })),
      throughSequence: conversationContext.throughSequence || null,
      truncated: conversationContext.truncated === true
    },
    comparisonLedger: compactComparisonReceipt(comparisonLedger),
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
      nodes: nodes.slice(0, 12).map((node: Record<string, unknown>) => ({ id: node.id, label: node.label, family: node.family })),
      routes: routes.slice(0, 24).map((route: Record<string, any>) => ({
        id: route.id,
        source: route.source?.label || route.source,
        target: route.target?.label || route.target,
        type: route.relationshipType || route.type,
        sourceLayer: route.sourceLayer || graph.sourceLayer
      })),
      personalOverlay: graph.personalOverlay || { consulted: false, relationshipCount: 0 },
      wordNet: (wordNet.matchedWords || []).slice(0, 12).map((item: Record<string, unknown>) => ({ word: item.word, senses: item.senses }))
    },
    learnedAlignment: {
      consulted: learnedAlignment.consulted === true,
      status: learnedAlignment.status,
      contractVerified: learnedAlignment.contractVerified === true,
      mode: learnedAlignment.mode || null,
      model: learnedAlignment.contractVerified ? learnedAlignment.model : null,
      result: learnedAlignment.contractVerified ? learnedAlignment.result : null
    }
  };
}

function compactComparisonReceipt(ledger: ComparisonLedger | null) {
  if (!ledger) return null;
  return {
    version: ledger.version,
    operation: ledger.operation,
    currentObservation: ledger.currentObservation,
    selection: ledger.selection,
    comparisons: ledger.comparisons.slice(0, 5).map(comparison => ({
      observationSequence: comparison.observationSequence,
      relevanceScore: comparison.relevanceScore,
      dimensions: comparison.dimensions,
      differences: comparison.differences.slice(0, 16),
      differenceCount: comparison.differenceCount,
      differencesTruncated: comparison.differencesTruncated
    })),
    recurringLanguage: {
      tokens: ledger.recurringLanguage.tokens.slice(0, 12),
      phrases: ledger.recurringLanguage.phrases.slice(0, 12)
    },
    summary: ledger.summary,
    boundary: ledger.boundary
  };
}

function compactComparisonMemory(ledger: ComparisonLedger) {
  return {
    version: ledger.version,
    mode: ledger.boundary.mode,
    comparedObservationSequences: ledger.comparisons.map(comparison => comparison.observationSequence).slice(0, 5),
    strongestObservationSequence: ledger.summary.strongestObservationSequence,
    repeatedTokenCount: ledger.summary.repeatedTokenCount,
    repeatedPhraseCount: ledger.summary.repeatedPhraseCount,
    comparisonCreatesMeaning: false,
    graphMutationAllowed: false
  };
}

function compactAriFoundation(foundation: Record<string, any> | null) {
  if (!foundation) return null;
  return {
    version: foundation.version,
    status: foundation.status,
    identity: foundation.identity,
    roles: foundation.roles,
    operationalLoop: Array.isArray(foundation.operationalLoop) ? foundation.operationalLoop.slice(0, 12) : [],
    theoryOfAlignment: foundation.theoryOfAlignment,
    cultivation: foundation.cultivation,
    authority: foundation.authority,
    responseContract: foundation.responseContract,
    boundary: foundation.boundary
  };
}

function compactAriTranslation(loop: Record<string, any>) {
  const numericSequence = Array.isArray(loop.encoding?.numericSequence) ? loop.encoding.numericSequence : [];
  const mathematicalOrder = numericSequence
    .map((value: unknown, index: number) => ({ originalPosition: index + 1, value: Number(value) }))
    .sort((left: { originalPosition: number; value: number }, right: { originalPosition: number; value: number }) =>
      left.value - right.value || left.originalPosition - right.originalPosition
    );
  return {
    notation: loop.encoding?.notation || null,
    braille: String(loop.encoding?.ueb || '').slice(0, 512),
    originalNumericSequence: numericSequence.slice(0, 512),
    mathematicalOrder: mathematicalOrder.slice(0, 512),
    totalCells: numericSequence.length,
    completeSequenceIncluded: numericSequence.length <= 512,
    roundTripExact: loop.decoding?.roundTripExact === true,
    originalOrderPreserved: true,
    sortChangesMeaning: false
  };
}

function transcriptSource(entrance: AnalyticsContext['entrance']) {
  if (entrance === 'local_ai') return 'local_ai';
  if (entrance === 'combined_shell') return 'combined_shell';
  return 'personal_entrance';
}

export function mergePersonalGraphOverlay(graph: Record<string, any>, overlay: Record<string, any>) {
  const relationships = Array.isArray(overlay.relationships) ? overlay.relationships.slice(0, 24) : [];
  const baseNodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : Array.isArray(graph.nodes) ? graph.nodes : [];
  const baseRoutes = Array.isArray(graph.supportedRoutes) ? graph.supportedRoutes : Array.isArray(graph.routes) ? graph.routes : [];
  const personalNodes = relationships.flatMap((route: Record<string, any>) => [
    { id: `user:${normalizeOverlayLabel(route.source)}`, label: route.source, family: null, sourceLayer: 'user_graph' },
    { id: `user:${normalizeOverlayLabel(route.target)}`, label: route.target, family: null, sourceLayer: 'user_graph' }
  ]);
  const uniqueNodes = [...baseNodes, ...personalNodes].filter((node, index, all) =>
    all.findIndex(candidate => String(candidate.id) === String(node.id)) === index
  ).slice(0, 12);
  const uniqueRoutes = [...relationships, ...baseRoutes].filter((route, index, all) =>
    all.findIndex(candidate => String(candidate.id) === String(route.id)) === index
  ).slice(0, 24);
  return {
    ...graph,
    matchedNodes: uniqueNodes,
    supportedRoutes: uniqueRoutes,
    nodes: uniqueNodes,
    routes: uniqueRoutes,
    personalOverlay: {
      consulted: true,
      relationshipCount: relationships.length,
      truncated: overlay.truncated === true,
      authority: 'user_specific_reviewed_overlay',
      sharedGraphChanged: false,
      colorAtlasChanged: false
    }
  };
}

function normalizeOverlayLabel(value: unknown) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('en-US').trim().replace(/\s+/gu, '-');
}

const INVENTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'by', 'do', 'does', 'for', 'from', 'had', 'has',
  'have', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'this', 'through', 'to',
  'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your'
]);

export function inventionLabels(text: string, graph: Record<string, any>) {
  const nodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : Array.isArray(graph.nodes) ? graph.nodes : [];
  const labels: string[] = [];
  for (const node of nodes) {
    if (typeof node?.label === 'string' && inventionWordCount(node.label) <= 3) labels.push(node.label.trim());
  }
  const words = text.normalize('NFC').match(/[\p{L}\p{N}]+(?:['\u2019_-][\p{L}\p{N}]+)*/gu) || [];
  for (const word of words) {
    const key = normalizeInventionLabel(word);
    if (key.length > 1 && !INVENTION_STOP_WORDS.has(key)) labels.push(word);
  }
  return labels.filter((label, index, all) =>
    all.findIndex(candidate => normalizeInventionLabel(candidate) === normalizeInventionLabel(label)) === index
  ).slice(0, 12);
}

export function normalizeInventionProposal(value: Record<string, unknown>, allowedLabels: string[]) {
  const sourceIndex = Number(value.sourceIndex);
  const targetIndex = Number(value.targetIndex);
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) ||
      sourceIndex < 0 || targetIndex < 0 || sourceIndex >= allowedLabels.length || targetIndex >= allowedLabels.length) {
    throw httpError(502, 'Qwen selected a label index outside the grounded invention set.');
  }
  if (sourceIndex === targetIndex) throw httpError(502, 'Qwen invention must connect two different grounded labels.');
  const relationshipType = boundedInventionText(value.relationshipType, 'relationshipType', 40).toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(relationshipType)) throw httpError(502, 'Qwen invention relationshipType must be short snake_case.');
  const confidence = String(value.confidence || '').trim().toLowerCase();
  if (!['low', 'medium'].includes(confidence)) throw httpError(502, 'Qwen invention confidence must be low or medium.');
  return {
    source: allowedLabels[sourceIndex],
    target: allowedLabels[targetIndex],
    relationshipType,
    evidence: boundedInventionText(value.evidence, 'evidence', 600),
    counterexample: boundedInventionText(value.counterexample, 'counterexample', 600),
    confidence
  };
}

function normalizeInventionLabel(value: unknown) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('en-US').trim().replace(/\s+/gu, ' ');
}

function inventionWordCount(value: unknown) {
  return String(value || '').match(/[\p{L}\p{N}]+(?:['\u2019_-][\p{L}\p{N}]+)*/gu)?.length || 0;
}

function boundedInventionText(value: unknown, name: string, maximum: number) {
  const text = String(value || '').trim();
  if (!text) throw httpError(502, `Qwen invention ${name} is required.`);
  if ([...text].length > maximum) throw httpError(502, `Qwen invention ${name} exceeds ${maximum} Unicode code points.`);
  return text;
}

function summarizeRelationalEvidence(graph: Record<string, any>) {
  const nodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : Array.isArray(graph.nodes) ? graph.nodes : [];
  const routes = Array.isArray(graph.supportedRoutes) ? graph.supportedRoutes : Array.isArray(graph.routes) ? graph.routes : [];
  return {
    sourceLayer: graph.sourceLayer || 'unresolved',
    matchedNodeCount: nodes.length,
    confirmedRouteCount: routes.length,
    relationshipClaimsSupported: routes.length > 0,
    notice: routes.length > 0
      ? `${routes.length} supplied graph route${routes.length === 1 ? '' : 's'} may support relationship claims.`
      : 'No graph route was supplied. Matched nodes are search candidates only; no relationship is established.'
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
