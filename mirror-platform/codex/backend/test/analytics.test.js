import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnalyticsEvent } from '../src/routes/analytics.js';

test('analytics events retain operational metadata and discard content', () => {
  const event = normalizeAnalyticsEvent({
    eventType: 'cultivation', entrance: 'personal_entrance', statusCode: 200,
    durationMs: 842, success: true, sourceLayer: 'approved_graph',
    personalContextConsulted: true, input: 'private seed', message: 'private response'
  });

  assert.deepEqual(event, {
    eventType: 'cultivation', room: null, service: null, entrance: 'personal_entrance',
    statusCode: 200, durationMs: 842, success: true,
    metadata: { personalContextConsulted: true, sourceLayer: 'approved_graph' }
  });
  assert.equal('input' in event, false);
  assert.equal('message' in event, false);
});

test('analytics events reject unknown rooms and services', () => {
  assert.throws(() => normalizeAnalyticsEvent({ eventType: 'page_view', room: '/admin_phpinfo.php' }), /Unsupported analytics room/);
  assert.throws(() => normalizeAnalyticsEvent({ eventType: 'error', service: 'untrusted_upstream' }), /Unsupported analytics service/);
});
