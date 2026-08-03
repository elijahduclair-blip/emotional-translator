import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const conversation = await base44.asServiceRole.agents.createConversation({
      agent_name: 'LibrarianAgent',
      metadata: {
        name: 'Auto: Unlinked Nodes Organizer',
        description: 'Scheduled librarian task to organize unlinked nodes',
      },
    });

    await base44.asServiceRole.agents.addMessage(conversation, {
      role: 'user',
      content: 'Find all ColorNodes that have empty parents arrays and no TrajectoryEdge connections — these are orphaned/unlinked nodes. For each one: re-link it to its nearest appropriate parent by coordinate proximity and semantic label overlap. If a node cannot be linked to any parent, flag it with the semantic label "needs-review". Report a summary of what you organized when done.',
    });

    return Response.json({
      success: true,
      conversation_id: conversation.id,
      message: 'Librarian agent tasked with organizing unlinked nodes',
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});