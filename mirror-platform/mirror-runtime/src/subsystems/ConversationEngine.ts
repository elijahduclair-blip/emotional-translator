import { ConversationContext, SemanticCommit } from '../types';

export class ConversationEngine {
  private userId: string;
  private currentSession?: ConversationContext;
  private usedAuthorities = new Set<string>();

  constructor(userId: string) {
    this.userId = userId;
  }

  async start(): Promise<void> {
    console.log(`[ConversationEngine] Started for user: ${this.userId}`);
  }

  async stop(): Promise<void> {
    console.log('[ConversationEngine] Stopped');
  }

  createSession(sessionId: string): ConversationContext {
    this.currentSession = {
      sessionId,
      userId: this.userId,
      timestamp: new Date(),
    };
    return this.currentSession;
  }

  async commitSemanticChange(commit: SemanticCommit): Promise<void> {
    const { authority } = commit;

    if (!authority.conversationId || !authority.userDecisionId) {
      throw new Error('UnauthorizedSemanticCommitError: Missing provenance');
    }

    if (this.usedAuthorities.has(authority.id)) {
      throw new Error('AuthorityAlreadyConsumedError: Authority already used');
    }

    this.usedAuthorities.add(authority.id);
    console.log(`[ConversationEngine] Committed semantic change: ${commit.targetId}`);
  }

  getCurrentSession(): ConversationContext | undefined {
    return this.currentSession;
  }
}