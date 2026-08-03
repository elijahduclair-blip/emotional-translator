/**
 * Concept Event Model — Event-sourced state for PersistentConcepts.
 *
 * The event stream is the authoritative source of truth.
 * The current projection is derived by reducing events.
 * The semantic snapshot is derived from projections.
 *
 * Three representations:
 *   1. Event history  — what happened to the state?
 *   2. Projection     — what is the state now?
 *   3. Snapshot       — what does this consumer need to know now?
 *
 * Integrity contract:
 *   reduceConceptEvents(eventStream, null) === storedProjection
 *
 * Write contract:
 *   The write path and the replay path use the SAME reducer.
 *   No function may set semantic fields on a PersistentConcept directly.
 *   All semantic state flows through reduceConceptEvents.
 *
 * Field classification:
 *   Event-derived semantic state:
 *     confidence, stability, salience, lifecycle_status, epistemic_condition,
 *     supporting_hypothesis_ids, active_conflict_ids, competing_concept_ids,
 *     pending_transition_ids, pending_transition_types,
 *     superseded_by_concept_id, supersedes_concept_ids,
 *     confidence_history (cached trajectory), valid_from
 *
 *   Event-established identity (immutable after promotion):
 *     proposition, category, profile_id, color_node_id
 *
 *   Operational metadata (not semantic):
 *     last_stream_version
 */

// ── Canonical Type Definitions ─────────────────────────────────────

export type ConceptLifecycleStatus =
  | "emerging"
  | "active"
  | "transitioning"
  | "superseded"
  | "archived";

export type ConceptEpistemicCondition =
  | "stable"
  | "evolving"
  | "contested"
  | "transitioning"
  | "uncertain";

export type PendingTransitionType =
  | "split"
  | "merge"
  | "supersede"
  | "archive"
  | "clarify";

export type ConceptEventType =
  | "promoted"
  | "confidence_adjusted"
  | "stability_adjusted"
  | "salience_adjusted"
  | "conflict_opened"
  | "conflict_resolved"
  | "split"
  | "merged"
  | "superseded"
  | "archived"
  | "clarify"
  | "hold_uncertainty"
  | "legacy_concept_baselined"
  | "legacy_supersession_linked";

export interface ConceptEvent {
  id: string;
  concept_id: string;
  profile_id: string;
  event_type: ConceptEventType;
  schema_version: string;
  payload: Record<string, any>;
  stream_version?: number;
  decision_id?: string;
  policy_version?: string;
  rationale_codes: string[];
  evidence_ids: string[];
  hypothesis_ids: string[];
  idempotency_key: string;
  applied_at: string;
  created_date: string;
}

// ── Projection Types ───────────────────────────────────────────────

export interface ConfidenceSample {
  value: number;
  timestamp: string;
  cause: string;
  evidence_id?: string;
}

export interface PersistentConceptProjection {
  id: string;
  proposition: string;
  category: string;
  confidence: number;
  stability: number;
  salience: number;
  lifecycle_status: ConceptLifecycleStatus;
  epistemic_condition: ConceptEpistemicCondition;
  supporting_hypothesis_ids: string[];
  active_conflict_ids: string[];
  competing_concept_ids: string[];
  confidence_history: ConfidenceSample[];
  pending_transition_ids: string[];
  pending_transition_types: PendingTransitionType[];
  superseded_by_concept_id?: string;
  supersedes_concept_ids: string[];
  valid_from: string;
  profile_id: string;
  color_node_id?: string;
  last_stream_version: number;
}

// ── Constants ──────────────────────────────────────────────────────

export const STABLE_STABILITY_THRESHOLD = 0.75;
export const STABLE_CONFIDENCE_THRESHOLD = 0.75;
const NUMERIC_TOLERANCE = 0.001;

const STRUCTURAL_TRANSITION_TYPES: PendingTransitionType[] = [
  "split",
  "merge",
  "supersede",
  "archive",
];

// ── Derivation ─────────────────────────────────────────────────────

/**
 * Derive the epistemic condition from the projection state.
 *
 * Precedence (highest to lowest):
 *   transitioning > contested > evolving > stable > uncertain
 *
 * - transitioning: a structural change (split/merge/supersede/archive) is pending
 * - contested: active conflicts exist
 * - evolving: confidence is trending (rising/falling/volatile)
 * - stable: both stability and confidence exceed thresholds
 * - uncertain: none of the above
 */
export function deriveEpistemicCondition(
  proj: PersistentConceptProjection
): ConceptEpistemicCondition {
  // 1. Structural transition pending
  const hasStructural = (proj.pending_transition_types || []).some((t) =>
    STRUCTURAL_TRANSITION_TYPES.includes(t)
  );
  if (hasStructural) {
    return "transitioning";
  }

  // 2. Active conflicts
  if ((proj.active_conflict_ids || []).length > 0) {
    return "contested";
  }

  // 3. Meaningful confidence trend
  const { trend } = computeTrend(proj.confidence_history || []);
  if (trend === "rising" || trend === "falling" || trend === "volatile") {
    return "evolving";
  }

  // 4. Stable
  if (
    proj.stability >= STABLE_STABILITY_THRESHOLD &&
    proj.confidence >= STABLE_CONFIDENCE_THRESHOLD
  ) {
    return "stable";
  }

  // 5. Default
  return "uncertain";
}

// ── Reducer ────────────────────────────────────────────────────────

/**
 * Reduce a concept's event stream into the current projection.
 *
 * Pure function — same events always produce the same projection.
 * Events are sorted by stream_version (fallback to applied_at).
 *
 * If seed is null, the projection is built entirely from the event stream
 * (must start with a "promoted" or "legacy_concept_baselined" event).
 * If seed is provided, events are applied on top of it (incremental mode).
 *
 * After all events are applied, epistemic_condition is derived.
 */
export function reduceConceptEvents(
  conceptId: string,
  events: ConceptEvent[],
  seed?: PersistentConceptProjection | null
): PersistentConceptProjection | null {
  const sorted = [...events].sort(
    (a, b) =>
      (a.stream_version || 0) - (b.stream_version || 0) ||
      new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  );

  let proj: PersistentConceptProjection | null = seed ? { ...seed } : null;

  for (const event of sorted) {
    proj = applyEvent(proj, event, conceptId, event.profile_id);
    if (proj) {
      proj.last_stream_version =
        event.stream_version || (proj.last_stream_version || 0) + 1;
    }
  }

  // Derive epistemic condition from final state
  if (proj) {
    proj.epistemic_condition = deriveEpistemicCondition(proj);
  }

  return proj;
}

function applyEvent(
  proj: PersistentConceptProjection | null,
  event: ConceptEvent,
  conceptId: string,
  profileId: string
): PersistentConceptProjection | null {
  const p = event.payload || {};

  switch (event.event_type) {
    case "promoted": {
      const initialConfidence = p.initialConfidence ?? p.initial_confidence ?? 0;
      return {
        id: conceptId,
        proposition: p.proposition || "",
        category: p.category || "preference",
        confidence: initialConfidence,
        stability: p.initialStability ?? p.initial_stability ?? 0,
        salience: p.initialSalience ?? p.initial_salience ?? 0.5,
        lifecycle_status: (p.initialLifecycleStatus as ConceptLifecycleStatus) || "emerging",
        epistemic_condition: "uncertain", // derived after all events
        supporting_hypothesis_ids: p.sourceHypothesisIds ?? p.hypothesisIds ?? p.hypothesis_ids ?? [],
        active_conflict_ids: p.initialConflictIds ?? [],
        competing_concept_ids: p.competingConceptIds ?? p.competing_concept_ids ?? [],
        confidence_history: [
          {
            value: initialConfidence,
            timestamp: event.applied_at,
            cause: "promoted",
          },
        ],
        pending_transition_ids: [],
        pending_transition_types: [],
        supersedes_concept_ids: [],
        valid_from: p.validFrom || event.applied_at,
        profile_id: p.profileId || profileId,
        color_node_id: p.colorNodeId ?? p.color_node_id,
        last_stream_version: 0,
      };
    }

    case "confidence_adjusted": {
      if (!proj) return proj;
      const previousValue = p.previousValue ?? p.old_confidence ?? proj.confidence;
      const newValue = p.newValue ?? p.new_confidence ?? proj.confidence;
      proj.confidence = newValue;
      proj.confidence_history.push({
        value: newValue,
        timestamp: event.applied_at,
        cause: p.causeType || p.cause || "adjusted",
        evidence_id: (p.evidenceIds && p.evidenceIds[0]) || p.evidence_id,
      });
      // Stability is NOT modified here — it changes only via stability_adjusted events
      return proj;
    }

    case "stability_adjusted": {
      if (!proj) return proj;
      const newValue = p.newValue ?? p.new_stability ?? proj.stability;
      proj.stability = newValue;
      return proj;
    }

    case "salience_adjusted": {
      if (!proj) return proj;
      const newValue = p.newValue ?? p.new_salience ?? proj.salience;
      proj.salience = newValue;
      return proj;
    }

    case "conflict_opened": {
      if (!proj) return proj;
      const conflictId = p.conflict_id || `conflict-${event.id}`;
      if (!proj.active_conflict_ids.includes(conflictId)) {
        proj.active_conflict_ids.push(conflictId);
      }
      if (p.conflicting_concept_id && !proj.competing_concept_ids.includes(p.conflicting_concept_id)) {
        proj.competing_concept_ids.push(p.conflicting_concept_id);
      }
      return proj;
    }

    case "conflict_resolved": {
      if (!proj) return proj;
      const conflictId = p.conflict_id;
      if (conflictId) {
        proj.active_conflict_ids = proj.active_conflict_ids.filter((id) => id !== conflictId);
      }
      return proj;
    }

    case "split": {
      if (!proj) return proj;
      const tid = p.transition_id || `split-${event.id}`;
      if (!proj.pending_transition_ids.includes(tid)) {
        proj.pending_transition_ids.push(tid);
        proj.pending_transition_types.push("split");
      }
      proj.lifecycle_status = "transitioning";
      return proj;
    }

    case "merged": {
      if (!proj) return proj;
      if (p.target_concept_id && !proj.competing_concept_ids.includes(p.target_concept_id)) {
        proj.competing_concept_ids.push(p.target_concept_id);
      }
      proj.lifecycle_status = "archived";
      return proj;
    }

    case "superseded": {
      if (!proj) return proj;
      proj.superseded_by_concept_id = p.new_concept_id || p.newConceptId;
      proj.lifecycle_status = "superseded";
      return proj;
    }

    case "archived": {
      if (!proj) return proj;
      proj.lifecycle_status = "archived";
      return proj;
    }

    case "clarify": {
      if (!proj) return proj;
      const tid = p.transition_id || `clarify-${event.id}`;
      if (!proj.pending_transition_ids.includes(tid)) {
        proj.pending_transition_ids.push(tid);
        proj.pending_transition_types.push("clarify");
      }
      // Clarify does NOT change lifecycle_status — it is not a structural transition
      return proj;
    }

    case "hold_uncertainty": {
      if (!proj) return proj;
      const competing = p.competing_concept_ids || p.competingConceptIds || [];
      for (const id of competing) {
        if (!proj.competing_concept_ids.includes(id)) {
          proj.competing_concept_ids.push(id);
        }
      }
      return proj;
    }

    case "legacy_concept_baselined": {
      return {
        id: conceptId,
        proposition: p.proposition || "",
        category: p.category || "preference",
        confidence: p.confidence ?? 0,
        stability: p.stability ?? 0,
        salience: p.salience ?? 0.5,
        lifecycle_status: (p.lifecycleStatus as ConceptLifecycleStatus) || "emerging",
        epistemic_condition: "uncertain", // derived after all events
        supporting_hypothesis_ids: p.supportingHypothesisIds ?? [],
        active_conflict_ids: p.activeConflictIds ?? [],
        competing_concept_ids: p.competingConceptIds ?? [],
        confidence_history: p.confidenceHistory ?? [
          {
            value: p.confidence ?? 0,
            timestamp: event.applied_at,
            cause: "legacy_baselined",
          },
        ],
        pending_transition_ids: p.pendingTransitionIds ?? [],
        pending_transition_types: (p.pendingTransitionTypes ?? []) as PendingTransitionType[],
        superseded_by_concept_id: p.supersededByConceptId,
        supersedes_concept_ids: p.supersedesConceptIds ?? [],
        valid_from: p.validFrom || event.applied_at,
        profile_id: p.profileId || profileId,
        color_node_id: p.colorNodeId,
        last_stream_version: 0,
      };
    }

    case "legacy_supersession_linked": {
      if (!proj) return proj;
      const supersededId = p.supersededConceptId;
      const supersedingId = p.supersedingConceptId;
      if (supersededId === conceptId && supersedingId) {
        proj.superseded_by_concept_id = supersedingId;
      }
      if (supersedingId === conceptId && supersededId) {
        if (!proj.supersedes_concept_ids.includes(supersededId)) {
          proj.supersedes_concept_ids.push(supersededId);
        }
      }
      return proj;
    }

    default:
      return proj;
  }
}

// ── Projection Conversion Helpers ──────────────────────────────────

/**
 * Convert a stored PersistentConcept DB record to a projection.
 * Handles both new fields (lifecycle_status, epistemic_condition) and
 * legacy fields (status, current_state_status) for backward compatibility.
 *
 * Always re-derives epistemic_condition to ensure it is fresh.
 */
export function projectionFromRecord(concept: any): PersistentConceptProjection {
  const lifecycleStatus = mapLegacyLifecycleStatus(
    concept.lifecycle_status,
    concept.status,
    concept.current_state_status
  );

  const proj: PersistentConceptProjection = {
    id: concept.id,
    proposition: concept.proposition || "",
    category: concept.category || "preference",
    confidence: concept.confidence ?? 0,
    stability: concept.stability ?? 0,
    salience: concept.salience ?? 0.5,
    lifecycle_status: lifecycleStatus,
    epistemic_condition: "uncertain", // derived below
    supporting_hypothesis_ids: concept.supporting_hypothesis_ids || [],
    active_conflict_ids: concept.active_conflict_ids || [],
    competing_concept_ids: concept.competing_concept_ids || [],
    confidence_history: concept.confidence_history || [],
    pending_transition_ids: concept.pending_transition_ids || [],
    pending_transition_types: (concept.pending_transition_types || []) as PendingTransitionType[],
    superseded_by_concept_id: concept.superseded_by_concept_id,
    supersedes_concept_ids: concept.supersedes_concept_ids || [],
    valid_from: concept.valid_from,
    profile_id: concept.profile_id,
    color_node_id: concept.color_node_id,
    last_stream_version: concept.last_stream_version || 0,
  };

  proj.epistemic_condition = deriveEpistemicCondition(proj);
  return proj;
}

/**
 * Convert a projection to the fields that should be persisted on a
 * PersistentConcept record. This is the single source of truth for
 * what gets written — ensures the write path and replay path
 * produce identical records.
 */
export function projectionToRecord(
  proj: PersistentConceptProjection
): Record<string, any> {
  return {
    proposition: proj.proposition,
    category: proj.category,
    confidence: proj.confidence,
    stability: proj.stability,
    salience: proj.salience,
    lifecycle_status: proj.lifecycle_status,
    epistemic_condition: proj.epistemic_condition,
    supporting_hypothesis_ids: proj.supporting_hypothesis_ids,
    active_conflict_ids: proj.active_conflict_ids,
    competing_concept_ids: proj.competing_concept_ids,
    confidence_history: proj.confidence_history,
    pending_transition_ids: proj.pending_transition_ids,
    pending_transition_types: proj.pending_transition_types,
    superseded_by_concept_id: proj.superseded_by_concept_id,
    supersedes_concept_ids: proj.supersedes_concept_ids,
    valid_from: proj.valid_from,
    profile_id: proj.profile_id,
    color_node_id: proj.color_node_id,
    last_stream_version: proj.last_stream_version,
  };
}

function mapLegacyLifecycleStatus(
  lifecycleStatus?: string,
  legacyStatus?: string,
  legacyCurrentStateStatus?: string
): ConceptLifecycleStatus {
  if (lifecycleStatus) return lifecycleStatus as ConceptLifecycleStatus;
  if (legacyCurrentStateStatus === "archived" || legacyStatus === "deprecated") return "archived";
  if (legacyCurrentStateStatus === "transitioning") return "transitioning";
  return "emerging";
}

// ── Utilities ──────────────────────────────────────────────────────

/**
 * Generate an idempotency key for an event.
 * Prevents duplicate event application from the same decision.
 */
export function makeIdempotencyKey(
  conceptId: string,
  eventType: ConceptEventType,
  decisionId?: string
): string {
  if (decisionId) return `${decisionId}:${conceptId}:${eventType}`;
  return `${conceptId}:${eventType}:${Date.now()}`;
}

/**
 * Compute the trend of a concept's confidence from its history.
 */
export function computeTrend(history: ConfidenceSample[]): {
  trend: "rising" | "falling" | "stable" | "volatile";
  rateOfChange: number;
} {
  if (!history || history.length < 2) return { trend: "stable", rateOfChange: 0 };

  const recent = history.slice(-5);
  const firstVal = recent[0].value;
  const lastVal = recent[recent.length - 1].value;
  const delta = lastVal - firstVal;

  const mean = recent.reduce((s, h) => s + h.value, 0) / recent.length;
  const variance = recent.reduce((s, h) => s + Math.pow(h.value - mean, 2), 0) / recent.length;

  if (variance > 0.02) return { trend: "volatile", rateOfChange: delta };
  if (Math.abs(delta) < 0.02) return { trend: "stable", rateOfChange: delta };
  return { trend: delta > 0 ? "rising" : "falling", rateOfChange: delta };
}

// ── Projection Verification ─────────────────────────────────────────

export interface ProjectionDifference {
  path: string;
  expected: unknown;
  actual: unknown;
  severity: "warning" | "error";
}

export interface ProjectionVerificationResult {
  conceptId: string;
  valid: boolean;
  streamVersion: number;
  projectionVersion: number;
  expectedProjection: PersistentConceptProjection | null;
  storedProjection: PersistentConceptProjection;
  differences: ProjectionDifference[];
  checkedAt: string;
}

/**
 * Semantic fields that are derived from the event stream and must
 * match the stored projection. Fields not in this list are considered
 * operational metadata (id, created_date, last_stream_version) or
 * event-established identity and are not compared for drift.
 */
const SEMANTIC_FIELDS: (keyof PersistentConceptProjection)[] = [
  "proposition",
  "category",
  "confidence",
  "stability",
  "salience",
  "lifecycle_status",
  "epistemic_condition",
  "supporting_hypothesis_ids",
  "active_conflict_ids",
  "competing_concept_ids",
  "pending_transition_ids",
  "pending_transition_types",
  "superseded_by_concept_id",
  "supersedes_concept_ids",
  "valid_from",
];

/**
 * Verify that the stored projection matches the event stream.
 *
 * The core invariant:
 *   reduceConceptEvents(eventStream, null) === storedProjection
 *
 * This is a pure read-only function. It does NOT repair — corruption
 * is reported, not concealed.
 */
export function verifyProjection(
  storedConcept: PersistentConceptProjection,
  events: ConceptEvent[]
): ProjectionVerificationResult {
  const checkedAt = new Date().toISOString();

  const reducedProjection = reduceConceptEvents(storedConcept.id, events, null);

  const streamVersion = reducedProjection?.last_stream_version || 0;
  const projectionVersion = storedConcept.last_stream_version || 0;

  if (!reducedProjection) {
    return {
      conceptId: storedConcept.id,
      valid: false,
      streamVersion: events.length,
      projectionVersion,
      expectedProjection: null,
      storedProjection: storedConcept,
      differences: [
        {
          path: "event_stream",
          expected: "at least one root event (promoted or legacy_concept_baselined) to seed the projection",
          actual:
            events.length === 0
              ? "no events found"
              : `${events.length} events, but no root event`,
          severity: "warning",
        },
      ],
      checkedAt,
    };
  }

  const differences: ProjectionDifference[] = [];

  for (const field of SEMANTIC_FIELDS) {
    const expected = canonicalize(reducedProjection[field]);
    const actual = canonicalize(storedConcept[field]);

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      differences.push({
        path: field,
        expected: reducedProjection[field],
        actual: storedConcept[field],
        severity:
          field === "confidence" ||
          field === "lifecycle_status" ||
          field === "epistemic_condition"
            ? "error"
            : "warning",
      });
    }
  }

  // Compare confidence_history
  const expectedHistory = reducedProjection.confidence_history;
  const actualHistory = storedConcept.confidence_history || [];

  if (expectedHistory.length !== actualHistory.length) {
    differences.push({
      path: "confidence_history.length",
      expected: expectedHistory.length,
      actual: actualHistory.length,
      severity: "warning",
    });
  } else {
    for (let i = 0; i < expectedHistory.length; i++) {
      const exp = expectedHistory[i];
      const act = actualHistory[i];
      if (Math.abs((exp.value || 0) - (act.value || 0)) > NUMERIC_TOLERANCE) {
        differences.push({
          path: `confidence_history[${i}].value`,
          expected: exp.value,
          actual: act.value,
          severity: "error",
        });
      }
    }
  }

  if (streamVersion !== projectionVersion) {
    differences.push({
      path: "last_stream_version",
      expected: streamVersion,
      actual: projectionVersion,
      severity: "warning",
    });
  }

  return {
    conceptId: storedConcept.id,
    valid: differences.length === 0,
    streamVersion,
    projectionVersion,
    expectedProjection: reducedProjection,
    storedProjection: storedConcept,
    differences,
    checkedAt,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return [...value].sort();
    }
    return value.map(canonicalize);
  }
  return value;
}