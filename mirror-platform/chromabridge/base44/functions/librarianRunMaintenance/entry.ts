import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAINTENANCE_DIRECTIVE = `Run your full automated graph maintenance routine on the GLOBAL shared canonical substrate (ColorNode + TrajectoryEdge). This substrate is identical for all users. Do NOT personalize to any user. Do NOT read or modify UserProfiles. Do NOT touch PersonalNodes — those are each user's personal library, owned by the PersonaAgent and off-limits to you. Your domain is the global ColorNode + TrajectoryEdge graph only.

Execute each duty in order:

1. ACCURACY AUDIT — Scan for semantic drift: coordinates that don't match name/hex, shades misplaced relative to their base anchor, broken or nonsensical parent chains. Fix them to restore canonical coherence — fidelity to the tier hierarchy and coordinate semantics, NOT to any user's profile.

2. ORPHAN REPAIR — Find 'shade' and 'bridge' nodes with empty parents arrays and re-link them to their nearest appropriate parent by coordinate proximity and global semantic label consistency. Flag any that cannot be linked with the semantic label "needs-review".

3. DEDUPLICATION — Detect near-duplicate nodes and merge them. Prefer the node with cleaner parentage and a stronger semantic label set. Copy over parents/synonyms/opposites, then delete the redundant record.

4. HIERARCHY TIDY — Verify parent chains are acyclic and tiered correctly (bridge(base-shade) → base → bridge(base-shade) → shade → bridge(shade-words) → words).

5. BRIDGE REINFORCEMENT — Scan for gaps in the tier hierarchy. For each base anchor with shade descendants but no BaseShade bridge, create one (bridge_transition='base-shade'). For each shade with word descendants but no ShadeWord bridge, create one (bridge_transition='shade-words'). Do not create redundant bridges if one already exists for the same source-target pair.

6. LABEL CURATION — Append canonical semantic_labels to nodes that lack them, derived from the node's relationship to its tier and neighbors. Never overwrite existing meaningful labels unless they contradict canonical placement.

7. ADDRESS DISSONANCE RE-INDEX — Sort your re-index queue by address_dissonance DESCENDING (highest drift first — those cause cascading drift in downstream addresses sharing the same prefix). For each node: recompute inherited_address from current coordinates + nearest base anchor in its parents, then recompute address_dissonance (should trend toward 0). If address_dissonance is extremely high (> 200), investigate whether the node's coordinates or its parent anchor assignment is the source of drift before blindly re-indexing.

8. SILENT PRUNING (GLOBAL FORGETTING) — Nodes not accessed for a long time (last_accessed_at older than 1 week from now, or null/never) should be silently archived: set memory_status to 'archived'. NEVER archive nodes where: (a) tier is 'base', (b) favorite is true. Archived nodes are NOT deleted — they resurface when searched or re-activated.

SCOPE BOUNDARY: Do NOT manage trait bridges — those now live in PersonalNode (each user's personal library), not the global ColorNode. Do NOT read or write the legacy is_trait / trait_profile_id / trait_associations / persona_node_id fields. Do NOT read UserProfiles. If a task would require personalizing to a user, skip it — that is the PersonaAgent's role, not yours.

Never delete 'base' tier anchor nodes. Preserve floating-point precision (round only when reporting, never when storing). Make changes in focused batches. End with a summary stating what the global substrate looks like now (bridges reinforced, merged count, re-indexed count, nodes archived, total nodes remaining, max dissonance remaining, global substrate status).`;

Deno.serve(async (req) => {
  let conversationId = null;
  let roundsCompleted = 0;
  try {
    const base44 = createClientFromRequest(req);

    // Open a fresh LibrarianAgent conversation for this maintenance run.
    const conversation = await base44.asServiceRole.agents.createConversation({
      agent_name: 'LibrarianAgent',
      metadata: {
        name: 'Auto: Global Substrate Maintenance',
        description: 'Scheduled librarian task — global ColorNode/TrajectoryEdge audit and repair',
        origin: 'librarian_auto_maintenance',
      },
    });
    conversationId = conversation.id;

    await base44.asServiceRole.agents.addMessage(conversation, {
      role: 'user',
      content: MAINTENANCE_DIRECTIVE,
    });

    const MAX_ROUNDS = 3;
    const ROUND_TIMEOUT_MS = 90000;
    const POLL_INTERVAL_MS = 5000;

    const waitForReply = async () => {
      const deadline = Date.now() + ROUND_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const updated = await base44.asServiceRole.agents.getConversation(conversation.id);
        const msgs = updated.messages || [];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && last.content) {
          return last.content;
        }
      }
      return null;
    };

    let summary = await waitForReply();

    for (let round = 1; summary && round < MAX_ROUNDS; round++) {
      const lower = summary.toLowerCase();

      if (lower.includes('continue') || lower.includes('left to do')) {
        await base44.asServiceRole.agents.addMessage(conversation, {
          role: 'user',
          content: 'continue',
        });
        const next = await waitForReply();
        if (!next) break;
        summary = next;
        roundsCompleted = round + 1;
      } else {
        roundsCompleted = round;
        break;
      }
    }

    if (!summary) roundsCompleted = 0;

    // Snapshot current global substrate size for the maintenance log.
    let nodeCount = 0;
    let edgeCount = 0;
    try {
      const nodeSample = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
      nodeCount = nodeSample?.length || 0;
    } catch { /* keep zero */ }
    try {
      const edgeSample = await base44.asServiceRole.entities.TrajectoryEdge.list('-created_date', 500);
      edgeCount = edgeSample?.length || 0;
    } catch { /* keep zero */ }

    try {
      await base44.asServiceRole.entities.MaintenanceLog.create({
        run_at: new Date().toISOString(),
        trigger: 'scheduled',
        status: summary ? 'success' : 'partial',
        summary: summary || 'Maintenance dispatched — Librarian did not report back within the timeout.',
        conversation_id: conversationId || '',
        node_count: nodeCount,
        edge_count: edgeCount,
        rounds_completed: roundsCompleted,
      });
    } catch { /* logging is best-effort; never fail the run because of it */ }

    return Response.json({
      success: true,
      conversation_id: conversationId,
      summary: summary || 'Maintenance dispatched — Librarian did not report back within the timeout.',
      node_count: nodeCount,
      edge_count: edgeCount,
      rounds_completed: roundsCompleted,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.MaintenanceLog.create({
        run_at: new Date().toISOString(),
        trigger: 'scheduled',
        status: 'failed',
        summary: error.message,
        conversation_id: conversationId || '',
        node_count: 0,
        edge_count: 0,
        rounds_completed: roundsCompleted,
      });
    } catch { /* best-effort */ }

    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});