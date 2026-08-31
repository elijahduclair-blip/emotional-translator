import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDialogueExamples, parseCodexRollout } from './prepare_codex_history_training.mjs';

function record(payload, timestamp = '2026-08-16T00:00:00.000Z') {
  return JSON.stringify({ type: 'response_item', timestamp, payload });
}

test('parses only attributed person turns and final Codex answers', () => {
  const source = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'thread-1' } }),
    record({ type: 'message', id: 'u1', role: 'user', content: [{ type: 'input_text', text: '<in-app-browser-context>ignore</in-app-browser-context>\nRed is momentum.' }] }),
    record({ type: 'message', id: 'a0', role: 'assistant', phase: 'commentary', content: [{ type: 'output_text', text: 'Working...' }] }),
    record({ type: 'message', id: 'a1', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text: 'Red can carry movement in this context.' }] }),
    JSON.stringify({ type: 'function_call_output', payload: { output: 'tool noise' } })
  ].join('\n');

  const parsed = parseCodexRollout(source);
  assert.equal(parsed.threadId, 'thread-1');
  assert.deepEqual(parsed.messages.map(item => [item.role, item.content]), [
    ['user', 'Red is momentum.'],
    ['assistant', 'Red can carry movement in this context.']
  ]);
});

test('keeps developmental dialogue as demonstrations with non-mutation boundaries', () => {
  const examples = buildDialogueExamples([
    { id: 'u1', role: 'user', content: 'Colors help ARI translate the relationship.', createdAt: '2026-08-16T00:00:00.000Z' },
    { id: 'a1', role: 'assistant', content: 'They can trace direction without becoming a fixed identity label.', createdAt: '2026-08-16T00:00:01.000Z' }
  ]);

  assert.equal(examples.length, 1);
  assert.equal(examples[0].metadata.demonstrationOnly, true);
  assert.equal(examples[0].metadata.factualAuthority, false);
  assert.equal(examples[0].metadata.graphMutationAllowed, false);
  assert.equal(examples[0].metadata.semanticAuthority, false);
});

test('excludes operational and credential-bearing exchanges from model weights', () => {
  const examples = buildDialogueExamples([
    { id: 'u1', role: 'user', content: 'Train ARI on the conversation.', createdAt: '2026-08-16T00:00:00.000Z' },
    { id: 'a1', role: 'assistant', content: 'Implemented. 100 backend tests passed.', createdAt: '2026-08-16T00:00:01.000Z' },
    { id: 'u2', role: 'user', content: 'My API token is hidden.', createdAt: '2026-08-16T00:00:02.000Z' },
    { id: 'a2', role: 'assistant', content: 'ARI should learn this language pattern.', createdAt: '2026-08-16T00:00:03.000Z' }
  ]);

  assert.equal(examples.length, 0);
});
