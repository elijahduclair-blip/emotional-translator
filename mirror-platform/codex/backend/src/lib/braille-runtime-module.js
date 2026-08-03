import crypto from 'crypto';
import { BRAILLE_RUNTIME_VERSION, compileBrailleRuntimeInstruction } from './braille-runtime-language.js';

const MODULE_VERSION = '0.1.0';

const MODULE_TEMPLATES = Object.freeze({
  propose_route: template('route_proposal_v1', 'proposal.route.prepare', 'route'),
  propose_relationship: template('relationship_proposal_v1', 'proposal.relationship.prepare', 'relationship'),
  propose_rule: template('rule_proposal_v1', 'proposal.rule.prepare', 'rule'),
  record_evidence: template('evidence_draft_v1', 'evidence.record.prepare', 'evidence'),
  evaluate_pattern: template('pattern_evaluation_v1', 'foundation.pattern.evaluate', 'pattern_evaluation')
});

export const BRAILLE_MODULE_BOUNDARY = Object.freeze({
  mode: 'predefined_module_only',
  sourceMutationAllowed: false,
  generatedCodeExecutionAllowed: false,
  externalMutationAllowed: false,
  graphMutationAllowed: false,
  proposalDraftCreated: true,
  commitRequiresAdminReview: true,
  reason: 'Assembly selects a frozen runtime template and creates an inspectable draft. It cannot generate JavaScript, modify source, persist evidence, or commit a graph change.'
});

export function assembleBrailleRuntimeModule(input, observedValue, proposalDecision) {
  if (proposalDecision !== 'approved') {
    throw httpError(409, 'Explicit proposalDecision "approved" is required to assemble a runtime module.');
  }

  const compiled = compileBrailleRuntimeInstruction(input, observedValue);
  if (compiled.proposal.status !== 'proposed') {
    throw httpError(409, `Only a met proposal can be assembled; current status is ${compiled.proposal.status}.`);
  }

  const selected = MODULE_TEMPLATES[compiled.instruction.action];
  if (!selected) throw httpError(422, 'No predefined runtime module exists for this action.');

  const moduleId = `brm_${crypto.createHash('sha256')
    .update(`${BRAILLE_RUNTIME_VERSION}|${MODULE_VERSION}|${compiled.sortKey}|${selected.id}`)
    .digest('hex').slice(0, 24)}`;
  const condition = compiled.instruction.condition;
  const evidenceRef = {
    moduleId,
    brailleRuntimeVersion: BRAILLE_RUNTIME_VERSION,
    sortKey: compiled.sortKey,
    cellCount: compiled.sortableCells.length
  };

  return {
    engine: 'braille_runtime_module_assembler',
    version: MODULE_VERSION,
    module: {
      id: moduleId,
      format: 'mirror_runtime_module/v1',
      templateId: selected.id,
      entrypoint: selected.entrypoint,
      state: 'assembled_for_review',
      parameters: {
        metric: condition.metric,
        comparator: condition.operator,
        threshold: Number(condition.value),
        observedValue: compiled.evaluation.observedValue
      },
      steps: selected.steps,
      capabilities: selected.capabilities
    },
    execution: {
      status: 'assembled',
      handler: selected.entrypoint,
      output: {
        type: selected.outputType,
        status: 'ready_for_review',
        action: compiled.instruction.action,
        conditionMet: true,
        evidenceRef
      }
    },
    approval: {
      decision: 'approved',
      scope: 'assemble_predefined_module',
      doesNotAuthorizeCommit: true
    },
    compiledInstruction: {
      originalEnglish: compiled.originalEnglish,
      canonicalEnglish: compiled.canonicalEnglish,
      executableBraille: compiled.executableBraille,
      sortKey: compiled.sortKey,
      action: compiled.instruction.action
    },
    boundary: BRAILLE_MODULE_BOUNDARY
  };
}

function template(id, entrypoint, outputType) {
  return Object.freeze({
    id,
    entrypoint,
    outputType,
    capabilities: Object.freeze(['read_compiled_condition', 'create_review_draft']),
    steps: Object.freeze([
      Object.freeze({ operation: 'verify_compiled_condition' }),
      Object.freeze({ operation: 'select_predefined_handler', handler: entrypoint }),
      Object.freeze({ operation: 'create_review_draft', outputType }),
      Object.freeze({ operation: 'stop_before_external_mutation' })
    ])
  });
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
