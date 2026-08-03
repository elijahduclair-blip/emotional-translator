import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = body?.query;
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    // Open a fresh LibrarianAgent conversation to answer the consult.
    const conv = await base44.asServiceRole.agents.createConversation({
      agent_name: 'LibrarianAgent',
      metadata: {
        name: 'Persona Consult',
        description: 'Inter-agent consult from PersonaAgent',
        origin: 'persona_consult',
      },
    });

    await base44.asServiceRole.agents.addMessage(conv, {
      role: 'user',
      content: query,
    });

    // Poll for the Librarian's assistant reply (up to ~60s).
    const deadline = Date.now() + 60000;
    let reply = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const updated = await base44.asServiceRole.agents.getConversation(conv.id);
      const msgs = updated.messages || [];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant' && last.content) {
        reply = last.content;
        break;
      }
    }

    if (!reply) {
      return Response.json(
        { error: 'Librarian did not respond in time', conversation_id: conv.id },
        { status: 504 }
      );
    }

    return Response.json({ reply, conversation_id: conv.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});