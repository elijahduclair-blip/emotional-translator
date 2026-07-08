const [, , baseArg] = process.argv;
const base = String(baseArg || 'http://localhost:3000/api').replace(/\/$/, '');

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { response, body };
}

async function run() {
  const checks = [];

  checks.push(await call('/health'));
  checks.push(await call('/v1/foundation/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'gold ritual gold icon memory' })
  }));
  checks.push(await call('/v1/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'gold' })
  }));

  const [health, foundation, translate] = checks;
  const summary = {
    base,
    health: {
      status: health.response.status,
      ok: health.response.ok,
      body: health.body
    },
    foundation: {
      status: foundation.response.status,
      ok: foundation.response.ok,
      body: foundation.body
    },
    translate: {
      status: translate.response.status,
      ok: translate.response.ok,
      body: translate.body
    }
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!health.response.ok || !foundation.response.ok || !translate.response.ok) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(JSON.stringify({
    base,
    error: error.message
  }, null, 2));
  process.exitCode = 1;
});
