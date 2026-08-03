import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { createAccessToken } from '../src/auth/tokens.js';
import { query, pool } from '../src/db/pool.js';

dotenv.config();
const PORT = 3110;
const API = `http://127.0.0.1:${PORT}/api/v1`;
let server;

test('module lifecycle persists, reviews, activates once, and creates only a graph proposal', async () => {
  await startServer();
  const suffix = crypto.randomUUID().slice(0, 8);
  const admin = await installUser(`brt-admin-${suffix}`, 'admin');
  const author = await installUser(`brt-author-${suffix}`, 'user');
  const source = `brt-source-${suffix}`;
  const target = `brt-target-${suffix}`;
  let moduleId;
  let graphProposalId;
  await installNode(source, source);
  await installNode(target, target);

  try {
    const submitted = await request('/foundation/braille-runtime/modules', author, {
      method: 'POST',
      body: {
        input: `When pattern ${suffix} count >= 3, then propose a route.`,
        observedValue: 4,
        proposalDecision: 'approved'
      }
    });
    assert.equal(submitted.status, 201);
    moduleId = submitted.body.module.id;
    assert.equal(submitted.body.module.status, 'assembled');

    const isolated = await request('/foundation/braille-runtime/modules', author);
    assert.equal(isolated.status, 403);

    const reviewed = await request(`/foundation/braille-runtime/modules/${moduleId}/review`, admin, {
      method: 'POST', body: { decision: 'approved', reviewNote: 'Bounded template and provenance verified.' }
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.module.status, 'reviewed');
    assert.equal(reviewed.body.activation.singleUse, true);
    const initialActivationToken = reviewed.body.activation.token;
    const stored = await query('SELECT activation_token_hash,activation_token_used_at FROM braille_runtime_modules WHERE id=$1', [moduleId]);
    assert.notEqual(stored.rows[0].activation_token_hash, initialActivationToken);
    assert.equal(stored.rows[0].activation_token_hash.length, 64);
    assert.equal(stored.rows[0].activation_token_used_at, null);

    const invalid = await request(`/foundation/braille-runtime/modules/${moduleId}/activate`, admin, {
      method: 'POST', body: { activationToken: 'invalid-token', parameters: {} }
    });
    assert.equal(invalid.status, 403);

    await query("UPDATE braille_runtime_modules SET activation_token_expires_at=NOW() - INTERVAL '1 minute' WHERE id=$1", [moduleId]);
    const expired = await request(`/foundation/braille-runtime/modules/${moduleId}/activate`, admin, {
      method: 'POST', body: { activationToken: initialActivationToken, parameters: {} }
    });
    assert.equal(expired.status, 410);
    const authority = await request(`/foundation/braille-runtime/modules/${moduleId}/authority`, admin, {
      method: 'POST', body: { reason: 'Replace expired authority after a fresh review check.' }
    });
    assert.equal(authority.status, 200);
    assert.equal(authority.body.activation.singleUse, true);
    const activationToken = authority.body.activation.token;
    assert.notEqual(activationToken, initialActivationToken);

    const activated = await request(`/foundation/braille-runtime/modules/${moduleId}/activate`, admin, {
      method: 'POST',
      body: {
        activationToken,
        parameters: {
          sourceNodeId: source,
          targetNodeId: target,
          relationshipType: 'supports',
          confidence: 'medium',
          evidence: 'The governed condition was met in the bounded compiler.',
          counterexample: 'Reject if the source and target lack an approved relational basis.'
        }
      }
    });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.idempotent, false);
    assert.equal(activated.body.module.status, 'activated');
    assert.equal(activated.body.result.status, 'proposed');
    graphProposalId = activated.body.result.graphProposalId;

    const retried = await request(`/foundation/braille-runtime/modules/${moduleId}/activate`, admin, {
      method: 'POST', body: { activationToken, parameters: {} }
    });
    assert.equal(retried.status, 200);
    assert.equal(retried.body.idempotent, true);
    assert.equal(retried.body.result.graphProposalId, graphProposalId);

    const proposals = await query('SELECT operation,status,payload FROM graph_proposals WHERE id=$1', [graphProposalId]);
    assert.equal(proposals.rows[0].operation, 'create_relationship');
    assert.equal(proposals.rows[0].status, 'proposed');
    assert.equal(proposals.rows[0].payload.relationship.source, source);
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM edges WHERE id=$1', [`${source}->${target}:supports`])).rows[0].count, 0);

    const events = await request(`/foundation/braille-runtime/modules/${moduleId}/events`, admin);
    assert.deepEqual(events.body.events.map(item => item.event_type), ['assembled', 'reviewed', 'authority_issued', 'activated']);

    const graphReviewed = await request(`/graph/proposals/${graphProposalId}/review`, admin, {
      method: 'PATCH', body: { decision: 'reviewed', reviewNote: 'Route endpoints and falsification evidence verified.' }
    });
    assert.equal(graphReviewed.status, 200);
    const graphApproved = await request(`/graph/proposals/${graphProposalId}/approve`, admin, { method: 'POST', body: {} });
    assert.equal(graphApproved.status, 200);
    assert.equal(graphApproved.body.status, 'approved');
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM edges WHERE id=$1', [`${source}->${target}:supports`])).rows[0].count, 1);

    const languageLoop = await fetch(`${API}/foundation/language-loop`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `${source} moves.` })
    });
    const languageBody = await languageLoop.json();
    assert.equal(languageLoop.status, 200);
    assert.equal(languageBody.decoding.roundTripExact, true);
    assert.equal(languageBody.meaning.approvedGraph.sourceLayer, 'approved_graph');
    assert.ok(languageBody.meaning.approvedGraph.nodes.some(node => node.id === source));
    assert.ok(languageBody.meaning.approvedGraph.routes.some(route => route.id === `${source}->${target}:supports`));
  } finally {
    if (moduleId) await query('DELETE FROM braille_runtime_modules WHERE id=$1', [moduleId]);
    await query("DELETE FROM graph_history WHERE entity_id=$1", [`${source}->${target}:supports`]);
    await query('DELETE FROM edges WHERE id=$1', [`${source}->${target}:supports`]);
    if (graphProposalId) await query('DELETE FROM graph_proposals WHERE id=$1', [graphProposalId]);
    await query('DELETE FROM nodes WHERE id=$1 OR id=$2', [source, target]);
    await query('DELETE FROM users WHERE id=$1 OR id=$2', [admin.id, author.id]);
  }
});

test.after(async () => { server?.kill(); await pool.end(); });

async function request(path, user, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers: { authorization: `Bearer ${createAccessToken(user)}`, 'content-type': 'application/json' },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

async function installUser(username, role) {
  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO users (id,username,email,password_hash,role,email_verified_at,signup_source,token_version,must_change_password)
     VALUES ($1,$2,$3,'test-only',$4,NOW(),'legacy',1,FALSE)
     RETURNING id,username,email,role,token_version,must_change_password`,
    [id, username, `${username}@local.test`, role]
  );
  return result.rows[0];
}

async function installNode(id, label) {
  await query(
    `INSERT INTO nodes (id,label,type,metadata) VALUES ($1,$2,'theme',$3)`,
    [id, label, { boundary: 'Integration-test node; not semantic evidence.' }]
  );
}

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Braille Runtime governance API did not start.');
}
