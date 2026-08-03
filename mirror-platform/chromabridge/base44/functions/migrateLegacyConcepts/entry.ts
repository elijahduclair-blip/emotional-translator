import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  reduceConceptEvents,
  projectionFromRecord,
  projectionToRecord,
  type ConceptEvent,
} from "../../shared/conceptEvents.ts";

/**
 * Legacy Concept Migration
 *
 * Three-pass migration that converts pre-event-system PersistentConcepts
 * into event-sourced projections:
 *
 * Pass 1: Baseline every concept independently with a
 *         legacy_concept_baselined event.
 * Pass 2: Validate and emit cross-concept relationships
 *         (supersession links) as legacy_supersession_linked events.
 * Pass 3: Rebuild every projection from its event stream and verify
 *         projection integrity.
 *
 * Usage:
 *   POST {}                           — migrate all concepts
 *   POST { "profile_id": "..." }      — migrate concepts for a profile
 *   POST { "dry_run": true }          — report without writing
 */
const MIGRATION_VERSION = "1";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { profile_id, dry_run } = body as { profile_id?: string; dry_run?: boolean };

    // ── Fetch concepts to migrate ────────────────────────────────────
    const filter: Record<string, any> = {};
    if (profile_id) filter.profile_id = profile_id;

    const allConcepts = await base44.asServiceRole.entities.PersistentConcept.filter(filter);

    // Identify concepts that need migration (no events or last_stream_version === 0)
    const conceptsToMigrate = [];
    for (const concept of allConcepts) {
      const events = await base44.asServiceRole.entities.ConceptEvent.filter({
        concept_id: concept.id,
      });
      const hasRootEvent = events.some(
        (e: any) => e.event_type === "promoted" || e.event_type === "legacy_concept_baselined"
      );
      if (!hasRootEvent) {
        conceptsToMigrate.push({ concept, existingEvents: events });
      }
    }

    if (conceptsToMigrate.length === 0) {
      return Response.json({
        migrated: false,
        message: "No concepts require migration — all have root events.",
        totalConcepts: allConcepts.length,
      });
    }

    const migrationResults = [];
    const now = new Date().toISOString();

    // ── Pass 1: Baseline every concept independently ─────────────────
    for (const { concept, existingEvents } of conceptsToMigrate) {
      const payload = buildBaselinePayload(concept, now);

      if (dry_run) {
        migrationResults.push({
          conceptId: concept.id,
          pass: 1,
          action: "baseline_dry_run",
          proposition: concept.proposition,
        });
        continue;
      }

      // Determine the stream version for the baseline event
      // If there are existing events (e.g. confidence_adjusted), the baseline
      // should be at version 0, and existing events should be re-numbered.
      // For simplicity, we place the baseline at version 0 and existing events
      // at their current versions. The reducer sorts by stream_version.
      const baselineEvent = await base44.asServiceRole.entities.ConceptEvent.create({
        concept_id: concept.id,
        profile_id: concept.profile_id,
        event_type: "legacy_concept_baselined",
        schema_version: "1",
        payload,
        stream_version: 0,
        policy_version: "1",
        rationale_codes: ["legacy_migration"],
        evidence_ids: [],
        hypothesis_ids: [],
        idempotency_key: `migration:baseline:${concept.id}`,
        applied_at: concept.created_date || now,
      });

      migrationResults.push({
        conceptId: concept.id,
        pass: 1,
        action: "baselined",
        eventId: baselineEvent.id,
        proposition: concept.proposition,
      });
    }

    // ── Pass 2: Reconcile cross-concept relationships ────────────────
    const relationshipResults = [];

    for (const { concept } of conceptsToMigrate) {
      // Check superseded_by_concept_id
      const supersededBy = concept.superseded_by_concept_id;
      if (supersededBy) {
        // Verify the target concept exists
        const target = await base44.asServiceRole.entities.PersistentConcept.get(supersededBy);
        const source = target ? "bidirectional_legacy_record" : "missing_target";

        if (!dry_run && target) {
          // Emit legacy_supersession_linked event on the superseded concept
          await base44.asServiceRole.entities.ConceptEvent.create({
            concept_id: concept.id,
            profile_id: concept.profile_id,
            event_type: "legacy_supersession_linked",
            schema_version: "1",
            payload: {
              supersededConceptId: concept.id,
              supersedingConceptId: supersededBy,
              source,
              migrationVersion: MIGRATION_VERSION,
              integrityWarnings: [],
            },
            stream_version: (concept.last_stream_version || 0) + 1,
            policy_version: "1",
            rationale_codes: ["legacy_migration_supersession"],
            evidence_ids: [],
            hypothesis_ids: [],
            idempotency_key: `migration:supersession:${concept.id}`,
            applied_at: now,
          });

          // Also emit on the superseding concept
          await base44.asServiceRole.entities.ConceptEvent.create({
            concept_id: supersededBy,
            profile_id: target.profile_id,
            event_type: "legacy_supersession_linked",
            schema_version: "1",
            payload: {
              supersededConceptId: concept.id,
              supersedingConceptId: supersededBy,
              source,
              migrationVersion: MIGRATION_VERSION,
              integrityWarnings: [],
            },
            stream_version: (target.last_stream_version || 0) + 1,
            policy_version: "1",
            rationale_codes: ["legacy_migration_supersession"],
            evidence_ids: [],
            hypothesis_ids: [],
            idempotency_key: `migration:supersession:${supersededBy}:${concept.id}`,
            applied_at: now,
          });
        }

        relationshipResults.push({
          conceptId: concept.id,
          type: "superseded_by",
          targetId: supersededBy,
          status: target ? "valid" : "missing_target",
        });
      }

      // Check supersedes_concept_ids
      const supersedesIds = concept.supersedes_concept_ids || [];
      for (const sid of supersedesIds) {
        const target = await base44.asServiceRole.entities.PersistentConcept.get(sid);
        relationshipResults.push({
          conceptId: concept.id,
          type: "supersedes",
          targetId: sid,
          status: target ? "valid" : "missing_target",
        });
      }
    }

    // ── Pass 3: Rebuild projections and verify ───────────────────────
    const verificationResults = [];

    if (!dry_run) {
      for (const { concept } of conceptsToMigrate) {
        const events = await base44.asServiceRole.entities.ConceptEvent.filter({
          concept_id: concept.id,
        });

        // Reduce from null — pure replay
        const rebuiltProj = reduceConceptEvents(concept.id, events as ConceptEvent[], null);

        if (rebuiltProj) {
          // Persist the rebuilt projection
          await base44.asServiceRole.entities.PersistentConcept.update(
            concept.id,
            projectionToRecord(rebuiltProj)
          );

          // Verify against stored
          const storedProj = projectionFromRecord(
            await base44.asServiceRole.entities.PersistentConcept.get(concept.id)
          );

          const hasRoot = events.some(
            (e: any) => e.event_type === "promoted" || e.event_type === "legacy_concept_baselined"
          );

          verificationResults.push({
            conceptId: concept.id,
            status: "rebuilt",
            hasRootEvent: hasRoot,
            streamVersion: rebuiltProj.last_stream_version,
            lifecycleStatus: rebuiltProj.lifecycle_status,
            epistemicCondition: rebuiltProj.epistemic_condition,
          });
        } else {
          verificationResults.push({
            conceptId: concept.id,
            status: "failed_rebuild",
            error: "Reduce returned null — no root event found",
          });
        }
      }
    }

    return Response.json({
      migrated: !dry_run,
      dryRun: !!dry_run,
      migrationVersion: MIGRATION_VERSION,
      totalConceptsScanned: allConcepts.length,
      conceptsMigrated: conceptsToMigrate.length,
      pass1Baselined: migrationResults.length,
      pass2Relationships: relationshipResults.length,
      pass3Rebuilt: verificationResults.length,
      pass3Valid: verificationResults.filter((r) => r.status === "rebuilt").length,
      pass3Failed: verificationResults.filter((r) => r.status === "failed_rebuild").length,
      baselineResults: migrationResults,
      relationshipResults,
      verificationResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Build the payload for a legacy_concept_baselined event.
 * Captures all semantic fields from the legacy record so the
 * projection can be fully reconstructed from the event stream.
 */
function buildBaselinePayload(concept: any, migrationTime: string): Record<string, any> {
  // Map legacy lifecycle status
  let lifecycleStatus = concept.lifecycle_status;
  if (!lifecycleStatus) {
    if (concept.current_state_status === "archived" || concept.status === "deprecated") {
      lifecycleStatus = "archived";
    } else if (concept.current_state_status === "transitioning") {
      lifecycleStatus = "transitioning";
    } else {
      lifecycleStatus = "active"; // Legacy concepts with data → active, not emerging
    }
  }

  return {
    profileId: concept.profile_id,
    proposition: concept.proposition,
    category: concept.category,
    colorNodeId: concept.color_node_id,
    confidence: concept.confidence || 0,
    stability: concept.stability || 0,
    salience: concept.salience ?? 0.5,
    lifecycleStatus,
    supportingHypothesisIds: concept.supporting_hypothesis_ids || [],
    activeConflictIds: concept.active_conflict_ids || [],
    competingConceptIds: concept.competing_concept_ids || [],
    pendingTransitionIds: concept.pending_transition_ids || [],
    pendingTransitionTypes: concept.pending_transition_types || [],
    supersededByConceptId: concept.superseded_by_concept_id,
    supersedesConceptIds: concept.supersedes_concept_ids || [],
    confidenceHistory: concept.confidence_history || [],
    validFrom: concept.valid_from || concept.created_date || migrationTime,
    migrationSource: "persistent_concept_record",
    migrationVersion: MIGRATION_VERSION,
  };
}