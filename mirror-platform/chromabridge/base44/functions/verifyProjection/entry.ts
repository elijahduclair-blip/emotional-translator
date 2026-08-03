import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  verifyProjection,
  projectionFromRecord,
  type PersistentConceptProjection,
} from "../../shared/conceptEvents.ts";

/**
 * Projection Integrity Verifier
 *
 * The core invariant:
 *   reduceConceptEvents(eventStream, null) === storedProjection
 *
 * This function loads a concept's event stream, reduces it from a null
 * seed (pure replay), and compares the derived projection with the
 * stored PersistentConcept record. Any field that diverges is reported
 * as a ProjectionDifference.
 *
 * READ-ONLY. Does NOT repair — corruption is reported, not concealed.
 *
 * Usage:
 *   POST { "concept_id": "..." }
 *   POST { "profile_id": "..." }  — verifies all concepts for a profile
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { concept_id, profile_id } = body as {
      concept_id?: string;
      profile_id?: string;
    };

    if (!concept_id && !profile_id) {
      return Response.json(
        { error: "concept_id or profile_id is required" },
        { status: 400 }
      );
    }

    // ── Collect concept IDs to verify ────────────────────────────────
    let conceptIds: string[] = [];

    if (concept_id) {
      conceptIds = [concept_id];
    } else {
      const concepts = await base44.asServiceRole.entities.PersistentConcept.filter({
        profile_id,
      });
      conceptIds = concepts.map((c: any) => c.id);
    }

    // ── Verify each concept ──────────────────────────────────────────
    const results = [];

    for (const cid of conceptIds) {
      const concept = await base44.asServiceRole.entities.PersistentConcept.get(cid);
      if (!concept) {
        results.push({
          conceptId: cid,
          valid: false,
          error: "Concept not found",
          differences: [],
          checkedAt: new Date().toISOString(),
        });
        continue;
      }

      const events = await base44.asServiceRole.entities.ConceptEvent.filter({
        concept_id: cid,
      });

      const storedProjection: PersistentConceptProjection = projectionFromRecord(concept);
      const result = verifyProjection(storedProjection, events);
      results.push(result);
    }

    // ── Summary ──────────────────────────────────────────────────────
    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;
    const totalDifferences = results.reduce(
      (sum, r) => sum + (r.differences?.length || 0),
      0
    );

    return Response.json({
      verifiedAt: new Date().toISOString(),
      totalConcepts: results.length,
      valid: validCount,
      invalid: invalidCount,
      totalDifferences,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}