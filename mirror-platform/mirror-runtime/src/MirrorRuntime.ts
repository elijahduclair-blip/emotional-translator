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
