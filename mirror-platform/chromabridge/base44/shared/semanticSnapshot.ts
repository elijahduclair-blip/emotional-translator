/**
 * Semantic Snapshot types and builder.
 *
 * The snapshot is a projection derived from persistent concepts,
 * their event histories, active conflicts, and pending transitions.
 *
 * The LLM never queries the graph directly — it reads the snapshot.
 * This is the mediator boundary that decouples state governance
 * from every downstream consumer.
 */

import type {
  PersistentConceptProjection,
  ConceptEpistemicCondition,
} from "./conceptEvents.ts";
import { computeTrend } from "./conceptEvents.ts";

// ── Semantic Origin (mixture, not a point) ─────────────────────────

export interface SemanticOriginComponent {
  conceptId: string;
  proposition: string;
  coordinates: [number, number, number];
  weight: number;
  confidence: number;
  status: ConceptEpistemicCondition;
  contextIds?: string[];
}

export interface SemanticTension {
  conceptAId: string;
  conceptBId: string;
  severity: number;
  relationship: "contradictory" | "context_dependent" | "transitional" | "complementary" | "unresolved";
}

export interface SemanticOrigin {
  components: SemanticOriginComponent[];
  tensions: SemanticTension[];
  projection?: {
    centroid: [number, number, number];
    dispersion: number;
    modalityCount: number;
  };
}

// ── Snapshot Types ─────────────────────────────────────────────────

export interface WeightedConcept {
  conceptId: string;
  proposition: string;
  category: string;
  confidence: number;
  weight: number;
  status: ConceptEpistemicCondition;
}

export interface ActiveConflict {
  conceptAId: string;
  conceptBId: string;
  severity: number;
  relationship: string;
}

export interface ClarificationPrompt {
  conceptId: string;
  prompt: string;
  urgency: number;
}

export interface ConceptTrend {
  conceptId: string;
  proposition: string;
  trend: "rising" | "falling" | "stable" | "volatile";
  rateOfChange: number;
  recentConfidence: number;
}

export interface EpistemicSummary {
  overallStability: number;
  unresolvedTension: number;
  evidenceCoverage: number;
  recentChangeRate: number;
}

export interface SemanticSnapshot {
  version: string;
  generatedAt: string;
  profileId: string;
  activeIdentity: SemanticOrigin;
  activeGoals: WeightedConcept[];
  activePreferences: WeightedConcept[];
  activeRelationships: WeightedConcept[];
  conflicts: ActiveConflict[];
  pendingClarifications: ClarificationPrompt[];
  evolvingConcepts: ConceptTrend[];
  epistemicSummary: EpistemicSummary;
}

// ── Interaction Context ────────────────────────────────────────────

export interface InteractionContext {
  domain?: "work" | "creative" | "relationships" | "health" | "general";
  activeGoalIds?: string[];
  relationshipIds?: string[];
  temporalWindow?: {
    start?: string;
    end?: string;
  };
}

// ── Transition Directive Types ─────────────────────────────────────

export type TransitionDirectiveType =
  | "no_change"
  | "strengthen"
  | "weaken"
  | "split"
  | "merge"
  | "supersede"
  | "archive"
  | "clarify"
  | "hold_uncertainty";

export interface DirectiveMetadata {
  decisionId: string;
  policyVersion: string;
  rationaleCodes: string[];
  evidenceIds: string[];
  hypothesisIds: string[];
  expectedConceptVersion: number;
  generatedAt: string;
}

export interface TransitionDirective {
  type: TransitionDirectiveType;
  conceptId: string;
  metadata: DirectiveMetadata;
  payload?: Record<string, any>;
}

export interface ReconciliationResult {
  conceptId: string;
  triggeringHypothesisId: string;
  relation: "supports" | "contradicts" | "new";
  conflictSeverity: number;
  competingConceptIds: string[];
  proposedAction: TransitionDirectiveType;
  reasoning: string;
}

// ── Snapshot Builder ──────────────────────────────────────────────

/**
 * Build a SemanticSnapshot from a set of concept projections.
 * This is the key projection function — it transforms internal state
 * into the interface every downstream consumer reads.
 */
export function buildSemanticSnapshot(
  profileId: string,
  concepts: PersistentConceptProjection[],
  context?: InteractionContext
): SemanticSnapshot {
  const generatedAt = new Date().toISOString();

  // Filter out archived/superseded concepts
  const active = concepts.filter(
    (c) =>
      c.lifecycle_status !== "archived" && c.lifecycle_status !== "superseded"
  );

  // Partition by category
  const identities = active.filter((c) => c.category === "identity");
  const goals = active.filter((c) => c.category === "goal");
  const preferences = active.filter((c) => c.category === "preference");
  const relationships = active.filter((c) => c.category === "relationship");

  // Build the semantic origin (mixture of identity concepts)
  const activeIdentity = buildSemanticOrigin(identities, context);

  // Build weighted concept lists
  const totalWeight = (arr: PersistentConceptProjection[]) =>
    arr.reduce((s, c) => s + c.confidence, 0) || 1;

  const toWeighted = (arr: PersistentConceptProjection[]): WeightedConcept[] => {
    const tw = totalWeight(arr);
    return arr.map((c) => ({
      conceptId: c.id,
      proposition: c.proposition,
      category: c.category,
      confidence: c.confidence,
      weight: c.confidence / tw,
      status: c.epistemic_condition,
    }));
  };

  // Build conflicts from competing concept relationships
  const conflicts = buildConflicts(active);

  // Build clarifications from pending transitions
  const pendingClarifications = active
    .filter((c) => c.pending_transition_ids.length > 0)
    .map((c) => ({
      conceptId: c.id,
      prompt: `Clarify: Is "${c.proposition}" still relevant?`,
      urgency: c.pending_transition_ids.length > 1 ? 0.8 : 0.5,
    }));

  // Build evolving concepts from trend analysis
  const evolvingConcepts = active
    .map((c) => {
      const { trend, rateOfChange } = computeTrend(c.confidence_history);
      return {
        conceptId: c.id,
        proposition: c.proposition,
        trend,
        rateOfChange,
        recentConfidence: c.confidence,
      };
    })
    .filter((t) => t.trend !== "stable");

  // Build epistemic summary
  const epistemicSummary = buildEpistemicSummary(active, conflicts);

  return {
    version: "1",
    generatedAt,
    profileId,
    activeIdentity,
    activeGoals: toWeighted(goals),
    activePreferences: toWeighted(preferences),
    activeRelationships: toWeighted(relationships),
    conflicts,
    pendingClarifications,
    evolvingConcepts,
    epistemicSummary,
  };
}

function buildSemanticOrigin(
  identities: PersistentConceptProjection[],
  context?: InteractionContext
): SemanticOrigin {
  if (identities.length === 0) {
    return { components: [], tensions: [] };
  }

  // Apply context-conditioned reweighting
  const components = identities.map((c) => {
    let weight = c.confidence;

    if (context?.domain) {
      const contextAffinity = 0.5 + (1 - c.stability) * 0.5;
      weight = weight * (0.7 + contextAffinity * 0.3);
    }

    return {
      conceptId: c.id,
      proposition: c.proposition,
      coordinates: [0, 0, 0] as [number, number, number],
      weight,
      confidence: c.confidence,
      status: c.epistemic_condition,
    };
  });

  // Normalize weights
  const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
  components.forEach((c) => {
    c.weight = c.weight / totalWeight;
  });

  // Build tensions from competing concepts
  const tensions: SemanticTension[] = [];
  for (const c of identities) {
    for (const compId of c.competing_concept_ids) {
      const other = identities.find((o) => o.id === compId);
      if (other && c.id < compId) {
        const severity = Math.min(c.confidence, other.confidence);
        tensions.push({
          conceptAId: c.id,
          conceptBId: compId,
          severity,
          relationship: c.epistemic_condition === "contested" ? "contradictory" : "unresolved",
        });
      }
    }
  }

  // Compute optional centroid projection for visualization
  const centroid: [number, number, number] = [0, 0, 0];
  for (const c of components) {
    centroid[0] += c.coordinates[0] * c.weight;
    centroid[1] += c.coordinates[1] * c.weight;
    centroid[2] += c.coordinates[2] * c.weight;
  }

  let dispersion = 0;
  for (const c of components) {
    const dx = c.coordinates[0] - centroid[0];
    const dy = c.coordinates[1] - centroid[1];
    const dz = c.coordinates[2] - centroid[2];
    dispersion += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  dispersion = components.length > 0 ? dispersion / components.length : 0;

  return {
    components,
    tensions,
    projection: {
      centroid,
      dispersion,
      modalityCount: components.length,
    },
  };
}

function buildConflicts(concepts: PersistentConceptProjection[]): ActiveConflict[] {
  const conflicts: ActiveConflict[] = [];
  const seen = new Set<string>();

  for (const c of concepts) {
    for (const compId of c.competing_concept_ids) {
      const key = [c.id, compId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      const other = concepts.find((o) => o.id === compId);
      if (other) {
        conflicts.push({
          conceptAId: c.id,
          conceptBId: compId,
          severity: Math.min(c.confidence, other.confidence),
          relationship: c.epistemic_condition === "contested" ? "contradictory" : "unresolved",
        });
      }
    }
  }

  return conflicts;
}

function buildEpistemicSummary(
  concepts: PersistentConceptProjection[],
  conflicts: ActiveConflict[]
): EpistemicSummary {
  if (concepts.length === 0) {
    return {
      overallStability: 0,
      unresolvedTension: 0,
      evidenceCoverage: 0,
      recentChangeRate: 0,
    };
  }

  const avgStability = concepts.reduce((s, c) => s + c.stability, 0) / concepts.length;
  const totalTension = conflicts.reduce((s, c) => s + c.severity, 0);
  const contestedCount = concepts.filter((c) => c.epistemic_condition === "contested").length;

  const avgEvidence = concepts.reduce((s, c) => s + c.supporting_hypothesis_ids.length, 0) / concepts.length;
  const evidenceCoverage = Math.min(1, avgEvidence / 5);

  const recentChangeCount = concepts.filter((c) => {
    const { trend } = computeTrend(c.confidence_history);
    return trend !== "stable";
  }).length;
  const recentChangeRate = recentChangeCount / concepts.length;

  return {
    overallStability: avgStability,
    unresolvedTension: contestedCount > 0 ? totalTension / (contestedCount + 1) : 0,
    evidenceCoverage,
    recentChangeRate,
  };
}