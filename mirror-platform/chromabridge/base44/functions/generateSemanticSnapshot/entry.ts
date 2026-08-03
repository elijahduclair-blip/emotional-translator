import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  reduceConceptEvents,
  projectionFromRecord,
  type ConceptEvent,
  type PersistentConceptProjection,
} from "../../shared/conceptEvents.ts";
import {
  buildSemanticSnapshot,
  type InteractionContext,
} from "../../shared/semanticSnapshot.ts";

/**
 * Semantic Snapshot Generator
 *
 * Loads all persistent concepts for a profile, reduces their event streams
 * to get authoritative projections, and builds a SemanticSnapshot.
 *
 * The snapshot is the mediator boundary — downstream consumers (LLM, UI)
 * read the snapshot, not the graph.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { profile_id, context } = body as { profile_id: string; context?: InteractionContext };

    if (!profile_id) {
      return Response.json({ error: "profile_id is required" }, { status: 400 });
    }

    // ── Fetch all persistent concepts for this profile ────────────────
    const concepts = await base44.asServiceRole.entities.PersistentConcept.filter({
      profile_id,
    });

    // ── Build projections from event streams ──────────────────────────
    const projections: PersistentConceptProjection[] = [];

    for (const concept of concepts) {
      const events = await base44.asServiceRole.entities.ConceptEvent.filter({
        concept_id: concept.id,
      });

      if (events.length === 0) {
        // No events — use the stored concept as seed (legacy or pre-event concept)
        projections.push(projectionFromRecord(concept));
      } else {
        // Reduce events to get the authoritative projection
        const seed = projectionFromRecord(concept);
        const proj = reduceConceptEvents(concept.id, events as ConceptEvent[], seed);
        if (proj) projections.push(proj);
      }
    }

    // ── Build the snapshot ───────────────────────────────────────────
    const snapshot = buildSemanticSnapshot(profile_id, projections, context);

    return Response.json({ snapshot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}