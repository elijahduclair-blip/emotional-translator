import crypto from 'node:crypto';

export type AriTeamMemberId = 'ARI' | 'LEA' | 'CORA' | 'CARA' | 'MIRA' | 'VERA' | 'FEN' | 'AURA';
export type AriToolExecution = 'server' | 'client';
export type AriToolStatus = 'completed' | 'rejected' | 'failed';

export interface AriTeamMember {
  id: AriTeamMemberId;
  expandedName: string;
  role: string;
  coordinator: boolean;
}

export interface AriToolDefinition {
  id: string;
  owner: Exclude<AriTeamMemberId, 'ARI'>;
  name: string;
  description: string;
  execution: AriToolExecution;
  permissions: {
    reads: string[];
    writes: string[];
    requiresAuthenticatedAccount: boolean;
    requiresOwnerConfirmation: boolean;
    consentMode?: string;
  };
}

export interface AriToolTask<TInput = Record<string, unknown>> {
  interactionId: string;
  requestedBy: 'ARI';
  toolId: string;
  objective: string;
  input: TInput;
  authorization: {
    authenticatedAccount: boolean;
    ownerConfirmed: boolean;
    requestedReads: string[];
    requestedWrites: string[];
  };
}

export interface AriToolEvidence {
  sourceLayer: string;
  summary: string;
  itemCount?: number;
}

export interface AriToolReceipt {
  version: 'ari-tool-receipt.v1';
  id: string;
  taskId: string;
  interactionId: string;
  requestedBy: 'ARI';
  toolId: string;
  teamMember: Exclude<AriTeamMemberId, 'ARI'>;
  status: AriToolStatus;
  objective: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  access: {
    readScopes: string[];
    writeScopes: string[];
    authenticatedAccountUsed: boolean;
    ownerConfirmationUsed: boolean;
  };
  evidence: AriToolEvidence | null;
  error: string | null;
  boundary: {
    taskInputStored: false;
    crossPersonAccessAllowed: false;
    sharedGraphMutationAllowed: false;
    colorAtlasMutationAllowed: false;
    sourceMutationAllowed: false;
  };
}

export interface AriToolResult<TOutput> {
  output: TOutput;
  evidence: AriToolEvidence;
}

export interface AriToolInvocation<TOutput> {
  output: TOutput | null;
  receipt: AriToolReceipt;
}

type AriToolHandler = (input: any, task: AriToolTask<any>) => Promise<AriToolResult<any>> | AriToolResult<any>;

export const ARI_TEAM: AriTeamMember[] = [
  { id: 'ARI', expandedName: 'Accountable Relational Intelligence', role: 'Coordinator, translator, and final voice', coordinator: true },
  { id: 'LEA', expandedName: 'Language Evidence Assistant', role: 'Candidate wording and bounded information', coordinator: false },
  { id: 'CORA', expandedName: 'Comparison and Ordered Relationship Analyst', role: 'Structural comparison and recurring-pattern receipts', coordinator: false },
  { id: 'CARA', expandedName: 'Color Association and Relationship Analyst', role: 'Color Atlas and relational graph reading', coordinator: false },
  { id: 'MIRA', expandedName: 'Memory, Interaction, and Record Archivist', role: 'Account-scoped ordered transcript and provenance', coordinator: false },
  { id: 'VERA', expandedName: 'Verification and Relational Authority', role: 'Boundary, evidence, and permission verification', coordinator: false },
  { id: 'FEN', expandedName: 'Foundation Encoding Navigator', role: 'English, Braille, numeric, and structural tracing', coordinator: false },
  { id: 'AURA', expandedName: 'Audio Understanding and Recording Assistant', role: 'Consent-bound browser microphone and speech transcription', coordinator: false }
];

export const DEFAULT_ARI_TOOLS: AriToolDefinition[] = [
  {
    id: 'lea.compose-candidate-language', owner: 'LEA', name: 'Compose candidate language',
    description: 'Ask the local Qwen engine for an open natural-language candidate before ARI applies closed Garden validation.', execution: 'server',
    permissions: {
      reads: ['current_statement', 'conversation_context', 'personal_ari_branch', 'repair_instruction'],
      writes: [], requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'cora.compare-ordered-language', owner: 'CORA', name: 'Compare ordered language',
    description: 'Compare the current statement with supplied earlier observations without declaring semantic meaning.', execution: 'server',
    permissions: {
      reads: ['current_statement', 'supplied_observations'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'cara.read-relational-graph', owner: 'CARA', name: 'Read relational graph',
    description: 'Read bounded approved, imported-reference, and authorized personal-overlay relationships.', execution: 'server',
    permissions: {
      reads: ['approved_graph', 'chromabridge_knowledge', 'personal_graph'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'cara.place-personal-relationship', owner: 'CARA', name: 'Place personal relationship',
    description: 'Place an explicitly confirmed relationship only in the authenticated owner private graph.', execution: 'server',
    permissions: {
      reads: ['personal_graph'], writes: ['personal_graph'],
      requiresAuthenticatedAccount: true, requiresOwnerConfirmation: true
    }
  },
  {
    id: 'mira.read-private-context', owner: 'MIRA', name: 'Read private conversation context',
    description: 'Read a bounded window of the authenticated person ordered transcript, attributed developmental archive, and relevant private journal files.', execution: 'server',
    permissions: {
      reads: ['private_transcript', 'private_developmental_archive', 'private_journal_files'], writes: [],
      requiresAuthenticatedAccount: true, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'mira.append-private-transcript', owner: 'MIRA', name: 'Append private transcript event',
    description: 'Append one interaction event to the authenticated person private audit transcript.', execution: 'server',
    permissions: {
      reads: ['current_interaction'], writes: ['private_transcript'],
      requiresAuthenticatedAccount: true, requiresOwnerConfirmation: false,
      consentMode: 'authenticated cultivation transcript'
    }
  },
  {
    id: 'vera.verify-relational-boundary', owner: 'VERA', name: 'Verify relational boundary',
    description: 'Check imported evidence and governance constraints without granting semantic or mutation authority.', execution: 'server',
    permissions: {
      reads: ['relational_evidence', 'governance_contract'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'vera.validate-candidate-language', owner: 'VERA', name: 'Validate candidate language',
    description: 'Apply ARI closed output rules after open language composition and return unsupported candidates for repair.', execution: 'server',
    permissions: {
      reads: ['candidate_language', 'current_statement', 'conversation_context', 'governance_contract', 'relational_evidence'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'fen.trace-language', owner: 'FEN', name: 'Trace language structure',
    description: 'Create the reversible English, UEB, numeric, and ordered structural trace.', execution: 'server',
    permissions: {
      reads: ['current_statement'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'fen.build-bridge', owner: 'FEN', name: 'Build BRIGDE structure',
    description: 'Build reusable groups from independent six-position dots and connect ordered occurrences without assigning semantic meaning.', execution: 'server',
    permissions: {
      reads: ['current_statement'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'fen.expand-acronyms', owner: 'FEN', name: 'Expand open acronym graph',
    description: 'Treat every word as an open acronym, inspect a finite degree of vision, and preserve the unresolved frontier for continued expansion.', execution: 'server',
    permissions: {
      reads: ['current_statement'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: false
    }
  },
  {
    id: 'aura.capture-speech', owner: 'AURA', name: 'Capture speech locally',
    description: 'Use browser speech recognition while the visible microphone control is enabled; raw audio is not stored.', execution: 'client',
    permissions: {
      reads: ['microphone_stream'], writes: [],
      requiresAuthenticatedAccount: false, requiresOwnerConfirmation: true,
      consentMode: 'browser permission plus visible off control'
    }
  }
];

export class AriToolRegistry {
  private definitions = new Map<string, AriToolDefinition>();
  private handlers = new Map<string, AriToolHandler>();

  constructor(definitions: AriToolDefinition[] = DEFAULT_ARI_TOOLS) {
    definitions.forEach(definition => this.register(definition));
  }

  register(definition: AriToolDefinition): void {
    if (!/^[a-z]+(?:[.-][a-z]+)*$/.test(definition.id)) throw new Error(`Invalid ARI tool id: ${definition.id}`);
    if (this.definitions.has(definition.id)) throw new Error(`ARI tool is already registered: ${definition.id}`);
    this.definitions.set(definition.id, cloneDefinition(definition));
  }

  bind(toolId: string, handler: AriToolHandler): void {
    const definition = this.definitions.get(toolId);
    if (!definition) throw new Error(`Cannot bind unknown ARI tool: ${toolId}`);
    if (definition.execution !== 'server') throw new Error(`Client-managed ARI tool cannot receive a server handler: ${toolId}`);
    this.handlers.set(toolId, handler);
  }

  snapshot() {
    const tools = [...this.definitions.values()]
      .map(definition => ({
        ...cloneDefinition(definition),
        status: definition.execution === 'client' ? 'client_managed' : this.handlers.has(definition.id) ? 'ready' : 'unavailable'
      }))
      .sort((left, right) => left.owner.localeCompare(right.owner) || left.id.localeCompare(right.id));
    return {
      version: 'ari-tool-registry.v1' as const,
      coordinator: 'ARI' as const,
      team: ARI_TEAM.map(member => ({ ...member })),
      tools,
      counts: {
        members: ARI_TEAM.length,
        tools: tools.length,
        ready: tools.filter(tool => tool.status === 'ready').length,
        clientManaged: tools.filter(tool => tool.status === 'client_managed').length,
        unavailable: tools.filter(tool => tool.status === 'unavailable').length
      },
      boundary: registryBoundary()
    };
  }

  async invoke<TOutput = Record<string, unknown>>(task: AriToolTask): Promise<AriToolInvocation<TOutput>> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const taskId = crypto.randomUUID();
    const definition = this.definitions.get(task.toolId);
    const rejection = this.validateTask(task, definition);
    if (rejection || !definition) {
      return {
        output: null,
        receipt: this.receipt(task, definition?.owner || 'VERA', 'rejected', taskId, started, startedAt, null, rejection || 'Unknown ARI tool.')
      };
    }

    const handler = this.handlers.get(task.toolId);
    if (!handler) {
      return {
        output: null,
        receipt: this.receipt(task, definition.owner, 'rejected', taskId, started, startedAt, null,
          definition.execution === 'client' ? 'This tool is controlled by the browser and cannot be invoked by the server.' : 'This tool is not available.')
      };
    }

    try {
      const result = await handler(task.input, task);
      return {
        output: result.output as TOutput,
        receipt: this.receipt(task, definition.owner, 'completed', taskId, started, startedAt, result.evidence, null)
      };
    } catch {
      return {
        output: null,
        receipt: this.receipt(task, definition.owner, 'failed', taskId, started, startedAt, null,
          `${definition.owner} tool execution failed.`)
      };
    }
  }

  private validateTask(task: AriToolTask, definition?: AriToolDefinition): string | null {
    if (task.requestedBy !== 'ARI') return 'Only ARI may coordinate support tools.';
    if (!definition) return `Unknown ARI tool: ${task.toolId}`;
    if (!String(task.interactionId || '').trim()) return 'An interaction id is required.';
    if (!String(task.objective || '').trim()) return 'A bounded objective is required.';
    if (definition.permissions.requiresAuthenticatedAccount && !task.authorization.authenticatedAccount) {
      return `${definition.owner} requires an authenticated account for this tool.`;
    }
    if (definition.permissions.requiresOwnerConfirmation && !task.authorization.ownerConfirmed) {
      return `${definition.owner} requires explicit owner confirmation for this tool.`;
    }
    const unsupportedRead = task.authorization.requestedReads.find(scope => !definition.permissions.reads.includes(scope));
    if (unsupportedRead) return `${definition.owner} cannot read scope: ${unsupportedRead}`;
    const unsupportedWrite = task.authorization.requestedWrites.find(scope => !definition.permissions.writes.includes(scope));
    if (unsupportedWrite) return `${definition.owner} cannot write scope: ${unsupportedWrite}`;
    if (definition.permissions.writes.length && task.authorization.requestedWrites.length === 0) {
      return `${definition.owner} must receive an explicit write scope for this tool.`;
    }
    return null;
  }

  private receipt(
    task: AriToolTask,
    owner: Exclude<AriTeamMemberId, 'ARI'>,
    status: AriToolStatus,
    taskId: string,
    started: number,
    startedAt: string,
    evidence: AriToolEvidence | null,
    error: string | null
  ): AriToolReceipt {
    return {
      version: 'ari-tool-receipt.v1',
      id: crypto.randomUUID(),
      taskId,
      interactionId: String(task.interactionId || '').slice(0, 120),
      requestedBy: 'ARI',
      toolId: String(task.toolId || '').slice(0, 120),
      teamMember: owner,
      status,
      objective: String(task.objective || '').slice(0, 240),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - started),
      access: {
        readScopes: uniqueScopes(task.authorization?.requestedReads),
        writeScopes: uniqueScopes(task.authorization?.requestedWrites),
        authenticatedAccountUsed: task.authorization?.authenticatedAccount === true,
        ownerConfirmationUsed: task.authorization?.ownerConfirmed === true
      },
      evidence,
      error,
      boundary: registryBoundary()
    };
  }
}

function cloneDefinition(definition: AriToolDefinition): AriToolDefinition {
  return {
    ...definition,
    permissions: {
      ...definition.permissions,
      reads: uniqueScopes(definition.permissions.reads),
      writes: uniqueScopes(definition.permissions.writes)
    }
  };
}

function uniqueScopes(scopes: unknown): string[] {
  return [...new Set((Array.isArray(scopes) ? scopes : []).map(scope => String(scope || '').trim()).filter(Boolean))].sort();
}

function registryBoundary() {
  return {
    taskInputStored: false as const,
    crossPersonAccessAllowed: false as const,
    sharedGraphMutationAllowed: false as const,
    colorAtlasMutationAllowed: false as const,
    sourceMutationAllowed: false as const
  };
}
