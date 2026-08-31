import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

export class AriToolkit {
  constructor({ store, codexUrl = 'http://127.0.0.1:3000', fetcher = fetch }) {
    this.store = store;
    this.codexUrl = codexUrl.replace(/\/+$/, '');
    this.fetcher = fetcher;
  }

  definitions() {
    return [
      { id: 'journal.inspect', description: 'Inspect ARI\'s own recent events and lessons for this objective branch.', input: '{}' },
      { id: 'workspace.list', description: 'List artifacts in ARI\'s private runtime workspace.', input: '{}' },
      { id: 'workspace.read', description: 'Read one UTF-8 artifact from ARI\'s private runtime workspace.', input: '{"name":"artifact.md"}' },
      { id: 'workspace.write', description: 'Create or revise a UTF-8 artifact inside ARI\'s private runtime workspace.', input: '{"name":"artifact.md","content":"..."}' },
      { id: 'garden.foundation.trace', description: 'Trace supplied language through the Garden structural language loop without mutation.', input: '{"text":"..."}' },
      { id: 'garden.graph.read', description: 'Read compact relational graph evidence without mutating any graph.', input: '{"text":"..."}' }
    ];
  }

  async execute(toolId, input, objective) {
    if (toolId === 'journal.inspect') return {
      events: this.store.recentEvents(objective.ownerKey, 30),
      lessons: this.store.lessonsFor(objective.ownerKey, objective.id)
    };
    if (toolId === 'workspace.list') return readdirSync(this.store.workspacePath, { withFileTypes: true })
      .filter(item => item.isFile()).map(item => item.name).sort();
    if (toolId === 'workspace.read') {
      const path = workspaceFile(this.store.workspacePath, input.name);
      if (!existsSync(path)) throw new Error('Workspace artifact does not exist.');
      return { name: basename(path), content: readFileSync(path, 'utf8').slice(0, 64_000) };
    }
    if (toolId === 'workspace.write') {
      const path = workspaceFile(this.store.workspacePath, input.name);
      const content = String(input.content || '').normalize('NFC');
      if (!content) throw new Error('Workspace artifact content is required.');
      if (Buffer.byteLength(content) > 64 * 1024) throw new Error('Workspace artifact exceeds 64 KB.');
      writeFileSync(path, content, 'utf8');
      return { name: basename(path), bytes: Buffer.byteLength(content), stored: true };
    }
    if (toolId === 'garden.foundation.trace') {
      const body = await postJson(this.fetcher, `${this.codexUrl}/api/v1/foundation/language-loop`, { text: boundedText(input.text) });
      return {
        version: body.version, status: body.status, canonicalEnglish: body.decoding?.canonicalEnglish || body.input,
        notation: body.encoding?.notation, cellCount: body.encoding?.cells?.length || 0,
        roundTripExact: body.decoding?.roundTripExact === true,
        approvedGraph: body.meaning?.approvedGraph || null
      };
    }
    if (toolId === 'garden.graph.read') {
      const body = await postJson(this.fetcher, `${this.codexUrl}/api/v1/translate/graph-read`, { text: boundedText(input.text) });
      return {
        sourceLayer: body.sourceLayer, matchedNodes: (body.matchedNodes || []).slice(0, 12),
        supportedRoutes: (body.supportedRoutes || []).slice(0, 24), colorClimateLanding: body.colorClimateLanding || null,
        connectionStrength: body.connectionStrength, evidence: body.evidence, boundary: body.boundary
      };
    }
    throw new Error(`Tool is outside ARI's runtime interior: ${toolId}`);
  }
}

function workspaceFile(root, value) {
  const name = basename(String(value || '').trim());
  if (!name || name !== String(value || '').trim()) throw new Error('Workspace artifact name must be a single file name.');
  if (!['.md', '.txt', '.json'].includes(extname(name).toLowerCase())) throw new Error('Workspace artifacts must be .md, .txt, or .json files.');
  return join(root, name);
}

function boundedText(value) {
  const text = String(value || '').normalize('NFC').trim();
  if (!text) throw new Error('Tool text is required.');
  if ([...text].length > 10_000) throw new Error('Tool text exceeds 10,000 Unicode code points.');
  return text;
}

async function postJson(fetcher, url, body) {
  const response = await fetcher(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(30_000), body: JSON.stringify(body)
  });
  const raw = await response.text();
  let value;
  try { value = JSON.parse(raw || '{}'); } catch { throw new Error(`Garden returned unreadable data (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(value.error || `Garden tool failed with HTTP ${response.status}.`);
  return value;
}
