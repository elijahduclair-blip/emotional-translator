import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createGardenPublicGateway } from '../public-gateway';

describe('Garden Entrance public gateway', () => {
  it('exposes only the public entrance and strips protected runtime fields', async () => {
    let receivedHeaders: Record<string, string | string[] | undefined> | undefined;
    const runtime = createServer(async (request, response) => {
      if (request.url === '/garden/identity') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-entrance.v1', name: 'Community Garden', kind: 'public_cultivation_interface',
          purpose: 'Grow useful fruit for people.', cultivationCycle: ['receive', 'return'],
          protectedRoots: ['service credentials'], adaptation: { immediate: 'current seed', personal: 'private', shared: 'governed' },
          boundary: { reason: 'Protected roots.' }, secretRuntimeToken: 'must-not-cross'
        }));
        return;
      }
      if (request.url === '/garden/fruit') {
        receivedHeaders = request.headers;
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-entrance.v1', seed: { received: true, codePointCount: [...body.input].length },
          fruit: { language: 'english', text: 'A bounded public harvest.' },
          cultivation: { stages: ['received', 'translated', 'composed'], graphSource: 'approved_graph', relationshipNotice: 'One route.', personalContextConsulted: true },
          model: { name: 'internal-model' }, trace: { private: true }, feedback: { receipt: 'private' }, timings: { total: 1 }
        }));
        return;
      }
      response.writeHead(404).end();
    });
    await listen(runtime);
    const runtimeAddress = runtime.address();
    if (!runtimeAddress || typeof runtimeAddress === 'string') throw new Error('Runtime stub did not bind.');

    const gateway = createGardenPublicGateway({ runtimeOrigin: `http://127.0.0.1:${runtimeAddress.port}`, rateLimitMax: 1 });
    await listen(gateway);
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') throw new Error('Gateway did not bind.');
    const origin = `http://127.0.0.1:${gatewayAddress.port}`;

    try {
      const page = await fetch(`${origin}/`);
      expect(page.status).toBe(200);
      expect(page.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
      const html = await page.text();
      expect(html).toContain('Public Garden Entrance');
      expect(html).toContain('Plant information.');
      expect(html).toContain('Personal Profile Portal');
      expect(html).toContain('My profile');
      expect(html).toContain('id="profileLoginForm"');
      expect(html).toContain('id="profileSignupForm"');
      expect(html).toContain('id="seed" maxlength="10000"');
      expect(html).toContain('id="personalSeed" maxlength="10000"');
      expect(html).toContain('Create my account');
      expect(html).toContain("fetch('/api/v1/me/account'");
      expect(html).toContain("fetch('/api/v1/me/account/verify'");
      expect(html).toContain("fetch('/api/v1/me/session'");
      expect(html).toContain("fetch('/api/v1/me/cultivate'");
      expect(html).toContain("fetch('/api/v1/me/garden'");
      expect(html).not.toContain('Governance');
      expect(html).not.toContain('Administrator');

      const identity = await fetch(`${origin}/garden/identity`);
      const identityBody = await identity.json() as Record<string, any>;
      expect(identity.status).toBe(200);
      expect(identityBody.name).toBe('Community Garden');
      expect(identityBody.boundary.graphMutationAllowed).toBe(false);
      expect(identityBody).not.toHaveProperty('secretRuntimeToken');

      const internalAccount = await fetch(`${origin}/account/me`);
      const internalLocalAi = await fetch(`${origin}/local-ai/respond`, { method: 'POST' });
      const internalApi = await fetch(`${origin}/api/health`);
      expect(internalAccount.status).toBe(404);
      expect(internalLocalAi.status).toBe(404);
      expect(internalApi.status).toBe(404);

      const missingHeader = await fetch(`${origin}/garden/fruit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'visitor seed' })
      });
      expect(missingHeader.status).toBe(403);

      const fruit = await fetch(`${origin}/garden/fruit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'public-entrance',
          cookie: 'mirror_session=must-not-forward', authorization: 'Bearer must-not-forward'
        },
        body: JSON.stringify({ input: 'visitor seed' })
      });
      const fruitBody = await fruit.json() as Record<string, any>;
      expect(fruit.status).toBe(200);
      expect(fruit.headers.get('ratelimit-limit')).toBe('1');
      expect(fruitBody.fruit.text).toBe('A bounded public harvest.');
      expect(fruitBody.cultivation).toEqual(expect.objectContaining({ personalContextConsulted: false, persisted: false, sharedGraphMutated: false }));
      expect(fruitBody.boundary.graphMutationAllowed).toBe(false);
      expect(fruitBody).not.toHaveProperty('model');
      expect(fruitBody).not.toHaveProperty('trace');
      expect(fruitBody).not.toHaveProperty('feedback');
      expect(fruitBody).not.toHaveProperty('timings');
      expect(receivedHeaders?.cookie).toBeUndefined();
      expect(receivedHeaders?.authorization).toBeUndefined();
      expect(receivedHeaders?.['x-mirror-request']).toBe('same-origin');

      const limited = await fetch(`${origin}/garden/fruit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'public-entrance' },
        body: JSON.stringify({ input: 'another seed' })
      });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();

      const health = await fetch(`${origin}/health`);
      const healthBody = await health.json() as Record<string, unknown>;
      expect(healthBody).toEqual({ status: 'ready', entrance: 'open', version: 'garden-entrance.v1' });
      expect(healthBody).not.toHaveProperty('localModel');
    } finally {
      await Promise.all([close(gateway), close(runtime)]);
    }
  });

  it('separates two owner-scoped person APIs from the anonymous community API', async () => {
    let communityHeaders: Record<string, string | string[] | undefined> | undefined;
    let personalHeaders: Record<string, string | string[] | undefined> | undefined;
    let gardenHeaders: Record<string, string | string[] | undefined> | undefined;
    let sessionHeaders: Record<string, string | string[] | undefined> | undefined;
    let signupHeaders: Record<string, string | string[] | undefined> | undefined;
    let signupBody: Record<string, unknown> | undefined;

    const runtime = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));

      if (request.url === '/api/v1/me/session' && request.method === 'POST') {
        response.writeHead(200, {
          'content-type': 'application/json',
          'set-cookie': 'mirror_session=signed-person-token; HttpOnly; SameSite=Strict; Path=/'
        });
        response.end(JSON.stringify({ user: { id: 'person-1', username: 'gardener', email: 'person@example.com', role: 'user' }, token: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account' && request.method === 'POST') {
        signupHeaders = request.headers;
        signupBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Check your email to verify the account.', internalToken: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account/verify' && request.method === 'POST') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ verified: true, internal: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account/resend-verification' && request.method === 'POST') {
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'If the account can receive this request, an email has been sent.' }));
        return;
      }
      if (request.url === '/api/v1/me/session' && request.method === 'GET') {
        sessionHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ user: { id: 'person-1', username: 'gardener', role: 'user' }, internal: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/session' && request.method === 'DELETE') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ signedOut: true }));
        return;
      }
      if (request.url === '/api/v1/community/cultivate' && request.method === 'POST') {
        communityHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-api.v1', seed: { received: true, codePointCount: 14 },
          fruit: { language: 'english', text: 'Shared fruit.' },
          cultivation: { stages: ['received', 'composed'], graphSource: 'approved_graph', relationshipNotice: 'Shared route.' },
          model: { name: 'private-model' }, trace: { private: true }
        }));
        return;
      }
      if (request.url === '/api/v1/me/cultivate' && request.method === 'POST') {
        personalHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-api.v1', seed: { received: true, codePointCount: 13 },
          fruit: { language: 'english', text: 'Personal fruit.' },
          cultivation: { stages: ['received', 'composed'], graphSource: 'user_graph', relationshipNotice: 'Private route.' },
          model: { name: 'private-model' }, feedback: { receipt: 'private' }
        }));
        return;
      }
      if (request.url === '/api/v1/me/garden' && request.method === 'GET') {
        gardenHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          garden: {
            consulted: true,
            relationships: [{ id: 'r1', source: 'mist', target: 'revision', relationshipType: 'personal_association', confidence: 'medium', evidence: 'Reviewed.', counterexample: 'Not always.', sourceFeedbackId: 'must-not-cross' }],
            relationshipCount: 1,
            truncated: false
          },
          internalUserId: 'must-not-cross'
        }));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
    await listen(runtime);
    const runtimeAddress = runtime.address();
    if (!runtimeAddress || typeof runtimeAddress === 'string') throw new Error('Runtime stub did not bind.');

    const gateway = createGardenPublicGateway({
      runtimeOrigin: `http://127.0.0.1:${runtimeAddress.port}`,
      rateLimitMax: 20,
      authRateLimitMax: 5
    });
    await listen(gateway);
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') throw new Error('Gateway did not bind.');
    const origin = `http://127.0.0.1:${gatewayAddress.port}`;

    try {
      const catalog = await fetch(`${origin}/api/v1`);
      const catalogBody = await catalog.json() as Record<string, any>;
      expect(catalog.status).toBe(200);
      expect(catalogBody.entrances.person.cultivate).toBe('/api/v1/me/cultivate');
      expect(catalogBody.entrances.person.createAccount).toBe('/api/v1/me/account');
      expect(catalogBody.entrances.people.cultivate).toBe('/api/v1/community/cultivate');
      expect(catalogBody.boundary.crossPersonAccessAllowed).toBe(false);

      const anonymousPersonal = await fetch(`${origin}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ input: 'private seed' })
      });
      expect(anonymousPersonal.status).toBe(401);

      const signup = await fetch(`${origin}/api/v1/me/account`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'personal-entrance',
          cookie: 'mirror_session=discard', authorization: 'Bearer discard'
        },
        body: JSON.stringify({ username: 'gardener', email: 'person@example.com', password: 'Example2026' })
      });
      const signupResult = await signup.json() as Record<string, unknown>;
      expect(signup.status).toBe(202);
      expect(signupResult).toEqual({ message: 'Check your email to verify the account.' });
      expect(signupBody).toEqual({ username: 'gardener', email: 'person@example.com', password: 'Example2026' });
      expect(signupHeaders?.cookie).toBeUndefined();
      expect(signupHeaders?.authorization).toBeUndefined();

      const verification = await fetch(`${origin}/api/v1/me/account/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ token: 'single-use-token' })
      });
      expect(verification.status).toBe(200);
      expect(await verification.json()).toEqual({ verified: true, message: 'Email verified. You may sign in.' });

      const resend = await fetch(`${origin}/api/v1/me/account/resend-verification`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ email: 'person@example.com' })
      });
      expect(resend.status).toBe(202);

      const login = await fetch(`${origin}/api/v1/me/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ email: 'person@example.com', password: 'example-password' })
      });
      const loginBody = await login.json() as Record<string, any>;
      const session = login.headers.get('set-cookie')?.split(';')[0];
      expect(login.status).toBe(200);
      expect(session).toBe('mirror_session=signed-person-token');
      expect(login.headers.get('set-cookie')).toContain('HttpOnly');
      expect(login.headers.get('set-cookie')).toContain('Secure');
      expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
      expect(loginBody.user.username).toBe('gardener');
      expect(loginBody).not.toHaveProperty('token');

      const sessionRead = await fetch(`${origin}/api/v1/me/session`, {
        headers: { cookie: `other=discard; ${session}`, authorization: 'Bearer discard' }
      });
      const sessionBody = await sessionRead.json() as Record<string, any>;
      expect(sessionRead.status).toBe(200);
      expect(sessionBody.authenticated).toBe(true);
      expect(sessionBody).not.toHaveProperty('internal');
      expect(sessionHeaders?.cookie).toBe(session);
      expect(sessionHeaders?.authorization).toBeUndefined();

      const community = await fetch(`${origin}/api/v1/community/cultivate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'community-api',
          cookie: session!, authorization: 'Bearer discard'
        },
        body: JSON.stringify({ input: 'community seed' })
      });
      const communityBody = await community.json() as Record<string, any>;
      expect(community.status).toBe(200);
      expect(communityBody.fruit.text).toBe('Shared fruit.');
      expect(communityBody.cultivation.personalContextConsulted).toBe(false);
      expect(communityBody.boundary.mode).toBe('community_api_read_only');
      expect(communityBody).not.toHaveProperty('model');
      expect(communityHeaders?.cookie).toBeUndefined();
      expect(communityHeaders?.authorization).toBeUndefined();

      const personal = await fetch(`${origin}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'personal-entrance',
          cookie: `other=discard; ${session}`, authorization: 'Bearer discard'
        },
        body: JSON.stringify({ input: 'personal seed' })
      });
      const personalBody = await personal.json() as Record<string, any>;
      expect(personal.status).toBe(200);
      expect(personalBody.fruit.text).toBe('Personal fruit.');
      expect(personalBody.cultivation.personalContextConsulted).toBe(true);
      expect(personalBody.cultivation.persisted).toBe(false);
      expect(personalBody.boundary.crossPersonAccessAllowed).toBe(false);
      expect(personalBody).not.toHaveProperty('model');
      expect(personalBody).not.toHaveProperty('feedback');
      expect(personalHeaders?.cookie).toBe(session);
      expect(personalHeaders?.authorization).toBeUndefined();

      const garden = await fetch(`${origin}/api/v1/me/garden`, { headers: { cookie: session! } });
      const gardenBody = await garden.json() as Record<string, any>;
      expect(garden.status).toBe(200);
      expect(gardenBody.garden.relationships[0]).toEqual(expect.objectContaining({ source: 'mist', target: 'revision' }));
      expect(gardenBody.garden.relationships[0]).not.toHaveProperty('sourceFeedbackId');
      expect(gardenBody).not.toHaveProperty('internalUserId');
      expect(gardenHeaders?.cookie).toBe(session);
      expect(gardenBody.boundary.crossPersonAccessAllowed).toBe(false);

      const logout = await fetch(`${origin}/api/v1/me/session`, {
        method: 'DELETE', headers: { 'x-garden-request': 'personal-entrance', cookie: session! }
      });
      expect(logout.status).toBe(200);
      expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');

      expect((await fetch(`${origin}/account/me`)).status).toBe(404);
      expect((await fetch(`${origin}/local-ai/user-graph`)).status).toBe(404);
    } finally {
      await Promise.all([close(gateway), close(runtime)]);
    }
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()));
}
