export type RuntimeStatus = 'idle' | 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped';

export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

export interface ConstitutionalLaws {
  honesty: boolean;
  consent: boolean;
  provenance: boolean;
  epistemicDiscipline: boolean;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  timestamp: Date;
  authorityId?: string;
}

export interface SemanticCommit {
  type: 'authorized-commit';
  authority: {
    id: string;
    conversationId: string;
    userDecisionId: string;
    actor: string;
    evidence: string;
  };
  targetId: string;
  delta: string;
}

export interface MirrorRuntimeConfig {
  userId: string;
  constitutionPath?: string;
  enablePersistence?: boolean;
  enableCodexGraphRead?: boolean;
  codexApiUrl?: string;
  codexServiceToken?: string;
}

export interface CodexGraphRead {
  input: string;
  sourceLayer: 'approved_graph' | 'chromabridge_knowledge' | 'unresolved';
  matchedNodes: Array<{
    id: string;
    label: string;
    type: string;
    family: string | null;
    hexColor: string | null;
    semanticCode?: string | null;
    fixedSpace?: {
      anchor: string;
      degreeOfVision: number;
      decimalAddress: string;
      addressDepth: number;
      placementBasis: 'fixed_anchor' | 'hierarchy' | 'coordinate_fallback';
    } | null;
  }>;
  supportedRoutes: Array<Record<string, unknown>>;
  colorClimateLanding: {
    id: string;
    label: string;
    family: string | null;
    color: string | null;
  } | null;
  connectionStrength: string;
  evidence: {
    nodeCount: number;
    routeCount: number;
    confidenceBasis: string;
    sourceDocuments?: string[];
  };
  knowledgeLayer?: {
    source: 'chromabridge_pdf_knowledge';
    consulted: boolean;
    nodeCount: number;
    routeCount: number;
    truncated: boolean;
    sourceDocuments: string[];
  };
  boundary: string;
}

export interface EmotionalTranslation {
  source: 'codex_graph' | 'chromabridge_fallback';
  climateName: string;
  primaryClimate: {
    id?: string;
    label?: string;
    family: string;
    color: string | null;
    cues?: string[];
  } | null;
  companionClimates: Array<{
    family: string;
    color: string | null;
    cues?: string[];
  }>;
  relationalRead: string;
  connectionStrength: string;
  matchedNodes: CodexGraphRead['matchedNodes'];
  supportedRoutes: CodexGraphRead['supportedRoutes'];
  evidence: CodexGraphRead['evidence'] | import('@mirror-platform/chromabridge-sdk').ChromaBridgeEvaluation['evidence'];
  boundary: {
    chromaBridge: string;
    codex: string | null;
  };
}

export interface MirrorAskResult {
  evaluation: import('@mirror-platform/chromabridge-sdk').ChromaBridgeEvaluation;
  translation: EmotionalTranslation;
  persisted: {
    id: string;
    evaluationId: string;
    status: 'recorded';
    createdAt: string;
  } | null;
}

export interface CapabilityMetadata {
  name: string;
  version: string;
  enabled: boolean;
}
