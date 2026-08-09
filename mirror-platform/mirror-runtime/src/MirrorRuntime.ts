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
import crypto from 'node:crypto';

const LOCAL_REASONING_SYSTEM = [
  'You are the local reasoning engine for Mirror Platform.',
  'Respond in clear English to the userEnglish field.',
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
  'You are the imagination stage for Mirror Platform.',
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
    this.alignmentModelClient = new AlignmentModelClient(
      config.alignmentModelUrl || process.env.ALIGNMENT_MODEL_URL || 'http://127.0.0.1:11435'
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

  async getAlignmentModelStatus(): Promise<AlignmentModelStatus | { status: 'disabled' }> {
    if (this.config.enableAlignmentModel === false) return { status: 'disabled' };
    return this.alignmentModelClient.health();
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
    const result = await this.codexClient.requestJson('/api/v1/foundation/language-loop', { method: 'POST', body: request });
    if (result.status >= 400) return result;
    const governance = this.chromaBridge.evaluateNotation(String(result.body.encoding?.ueb || ''));
    return {
      status: result.status,
      body: { ...result.body, governance: { chromaBridge: governance.boundary, codex: result.body.boundary } }
    };
  }

  async respondWithLocalModel(request: Record<string, unknown>, userToken?: string) {
    if (this.status !== 'ready') throw new Error(`Cannot reach local Qwen: runtime is ${this.status}.`);
    if (this.config.enableLocalModel === false) throw httpError(503, 'Local model integration is disabled.');
    const text = String(request.input || '').trim();
    if (!text) throw httpError(400, 'input is required.');
    if ([...text].length > 2_000) throw httpError(413, 'Local AI input must be 2000 Unicode code points or fewer.');

    const languageLoop = await this.runLanguageLoop({ text });
    if (languageLoop.status >= 400) return languageLoop;
    const relationalGraph = await this.resolveLocalRelationalGraph(text, languageLoop.body, userToken);
    const learnedAlignment = await this.consultLearnedAlignment(relationalGraph);
    const reasoningLoop = {
      ...languageLoop.body,
      meaning: {
        ...languageLoop.body.meaning,
        relationalGraph,
        learnedAlignment
      }
    };
    const activeConversationAdapter = await this.resolveActiveConversationAdapter();
    let conversationAdapterFallback = false;
    let local;
    try {
      local = await this.localModelClient.respond(LOCAL_REASONING_SYSTEM, compactReasoningContext(reasoningLoop), activeConversationAdapter?.ollamaModelName);
    } catch (error) {
      if (!activeConversationAdapter) throw error;
      conversationAdapterFallback = true;
      local = await this.localModelClient.respond(LOCAL_REASONING_SYSTEM, compactReasoningContext(reasoningLoop));
    }
    const relationalEvidence = summarizeRelationalEvidence(relationalGraph);
    const feedbackContext = {
      interactionId: crypto.randomUUID(),
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

    return {
      status: 200,
      body: {
        engine: 'mirror_local_qwen',
        model: { provider: local.provider, name: local.model, local: true },
        response: { language: 'english', text: local.text },
        relationalEvidence,
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
          }
        },
        evidence: reasoningLoop.meaning,
        governance: languageLoop.body.governance,
        timings: local.timings,
        boundary: {
          mode: 'local_reasoning_over_reversible_signal_and_verified_alignment',
          semanticMutationAllowed: false,
          graphMutationAllowed: false,
          sourceMutationAllowed: false,
          reason: 'Local Qwen reasons over a compact copy of the verified signal, relational evidence, and any contract-verified learned boundary. It does not directly modify semantic memory, graph data, or source code.'
        }
      }
    };
  }

  async proposeLocalInvention(request: Record<string, unknown>, userToken: string) {
    if (this.status !== 'ready') throw new Error(`Cannot reach local Qwen: runtime is ${this.status}.`);
    if (this.config.enableLocalModel === false) throw httpError(503, 'Local model integration is disabled.');
    const text = String(request.input || '').trim();
    if (!text) throw httpError(400, 'input is required.');
    if ([...text].length > 2_000) throw httpError(413, 'Invention input must be 2000 Unicode code points or fewer.');
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
      const overlay = await this.codexClient.requestJson(`/api/v1/local-ai/user-graph?text=${encodeURIComponent(text)}`, { userToken });
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
}

function compactReasoningContext(loop: Record<string, any>) {
  const numericSequence = Array.isArray(loop.encoding?.numericSequence) ? loop.encoding.numericSequence : [];
  const graph = loop.meaning?.relationalGraph || loop.meaning?.approvedGraph || { sourceLayer: 'unresolved', nodes: [], routes: [] };
  const nodes = Array.isArray(graph.matchedNodes) ? graph.matchedNodes : graph.nodes || [];
  const routes = Array.isArray(graph.supportedRoutes) ? graph.supportedRoutes : graph.routes || [];
  const wordNet = loop.meaning?.wordNet || { matchedWords: [], unresolvedWords: [] };
  const learnedAlignment = loop.meaning?.learnedAlignment || { consulted: false, status: 'not_applicable', contractVerified: false };
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
