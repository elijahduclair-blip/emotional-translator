const runtimeUrl = process.env.MIRROR_RUNTIME_URL || 'http://127.0.0.1:3100';
const input = process.argv.slice(2).join(' ') || 'I feel pulled between ember motion and silver revision.';

const response = await fetch(`${runtimeUrl}/ask`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ input })
});

const body = await response.json();
console.log(JSON.stringify(body, null, 2));
if (!response.ok) process.exitCode = 1;
