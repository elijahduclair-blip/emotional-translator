import fs from 'node:fs/promises';
import path from 'node:path';

const options = parseArgs(process.argv.slice(2));
for (const required of ['version', 'phase', 'report']) if (!options[required]) throw new Error(`--${required} is required.`);
const apiUrl = String(process.env.CODEX_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const serviceToken = process.env.RUNTIME_SERVICE_TOKEN;
if (!serviceToken) throw new Error('RUNTIME_SERVICE_TOKEN is required.');
const report = JSON.parse(await fs.readFile(path.resolve(options.report), 'utf8'));
const body = { phase: options.phase, report };
if (options.phase === 'training') {
  body.artifactPath = options.artifact;
  body.artifactSha256 = options.sha256;
}
const response = await fetch(`${apiUrl}/api/v1/local-ai/training/versions/${encodeURIComponent(options.version)}/report`, {
  method: 'POST', headers: { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || `Report failed with HTTP ${response.status}.`);
console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) values[args[index].replace(/^--/, '')] = args[index + 1];
  return values;
}
