import test from 'node:test';
import assert from 'node:assert/strict';
import {
  brailleToCellRecords,
  compileBrailleRuntimeInstruction,
  transcribeEnglishToUeb
} from '../src/lib/braille-runtime-language.js';
import { assembleBrailleRuntimeModule } from '../src/lib/braille-runtime-module.js';

test('bounded English is transcribed to UEB and exact six-bit masks', () => {
  assert.equal(transcribeEnglishToUeb('cat'), '⠉⠁⠞');
  assert.equal(transcribeEnglishToUeb('3.5'), '⠼⠉⠲⠑');
  assert.deepEqual(brailleToCellRecords('⠉⠁⠞').map(cell => cell.mask), [9, 1, 30]);
  assert.deepEqual(brailleToCellRecords('⠉').map(cell => cell.dots), [[1, 4]]);
});

test('conditional English compiles through UEB, Nemeth, and Foundation sorting', () => {
  const result = compileBrailleRuntimeInstruction('When pattern count >= 3, then propose a route.', 4);
  assert.equal(result.engine, 'braille_runtime_language');
  assert.equal(result.originalEnglish, 'When pattern count >= 3, then propose a route.');
  assert.equal(result.instruction.condition.metric, 'pattern count');
  assert.equal(result.instruction.condition.operator, '>=');
  assert.equal(result.instruction.condition.value, '3');
  assert.equal(result.instruction.action, 'propose_route');
  assert.equal(result.instruction.authority, 'proposal_only');
  assert.equal(result.evaluation.conditionMet, true);
  assert.equal(result.proposal.status, 'proposed');
  assert.ok(result.uebText.length > 0);
  assert.ok(result.nemethCondition.length > 0);
  assert.ok(result.executableBraille.includes('⠸⠩'));
  assert.ok(result.sortableCells.length > 0);
  assert.equal(result.sortedWith.layer, 'foundation');
  assert.equal(result.boundary.sourceMutationAllowed, false);
  assert.equal(result.boundary.generatedCodeExecutionAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
});

test('condition remains dormant when context does not satisfy the instruction', () => {
  const result = compileBrailleRuntimeInstruction('When pattern count >= 3, then propose a route.', 2);
  assert.equal(result.evaluation.conditionMet, false);
  assert.equal(result.proposal.status, 'not_triggered');
  assert.equal(result.proposal.sourceMutationAllowed, false);
});

test('compiler rejects arbitrary actions and unsupported text instead of executing code', () => {
  assert.throws(
    () => compileBrailleRuntimeInstruction('When pattern count >= 3, execute generated code.'),
    error => error.status === 422 && /Unsupported action/.test(error.message)
  );
  assert.throws(
    () => compileBrailleRuntimeInstruction('When pattern count >= 3, propose a route 🚀.'),
    error => error.status === 422
  );
});

test('a met and explicitly approved proposal selects a frozen runtime module', () => {
  const result = assembleBrailleRuntimeModule(
    'When pattern count >= 3, then propose a route.',
    4,
    'approved'
  );
  assert.equal(result.module.templateId, 'route_proposal_v1');
  assert.equal(result.module.entrypoint, 'proposal.route.prepare');
  assert.equal(result.module.state, 'assembled_for_review');
  assert.equal(result.execution.output.type, 'route');
  assert.equal(result.execution.output.status, 'ready_for_review');
  assert.equal(result.approval.doesNotAuthorizeCommit, true);
  assert.equal(result.boundary.sourceMutationAllowed, false);
  assert.equal(result.boundary.externalMutationAllowed, false);
  assert.equal(result.boundary.commitRequiresAdminReview, true);
  assert.ok(result.module.steps.every(step => !('code' in step)));
});

test('module assembly rejects missing approval and unmet conditions', () => {
  assert.throws(
    () => assembleBrailleRuntimeModule('When pattern count >= 3, then propose a route.', 4, 'pending'),
    error => error.status === 409 && /Explicit proposalDecision/.test(error.message)
  );
  assert.throws(
    () => assembleBrailleRuntimeModule('When pattern count >= 3, then propose a route.', 2, 'approved'),
    error => error.status === 409 && /not_triggered/.test(error.message)
  );
});
