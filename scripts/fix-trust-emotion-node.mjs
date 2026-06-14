import fs from 'node:fs';

const file = 'data/color-synonyms.json';
const raw = fs.readFileSync(file, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xfeff;
const data = JSON.parse(hasBom ? raw.slice(1) : raw);

const trust = data.graph.nodes.find(node => node.id === 'emotion-trust');
if (trust) {
  trust.metadata = {
    emotionDefinition: 'confidence in reliability, truth, or safety',
    tone: 'steady',
    associationBasis: 'contextual emotional color association',
    definitionBasis: 'emotion input context, not strict color synonym',
    confidence: 'medium',
    aliases: []
  };
}

const hope = data.emotionWords?.mapped?.find(item => item.term === 'hope');
if (hope) hope.aliases = (hope.aliases || []).filter(alias => alias !== 'trust');

data.graph.nodes.forEach(node => {
  if (node.id === 'emotion-hope' && node.metadata?.aliases) {
    node.metadata.aliases = node.metadata.aliases.filter(alias => alias !== 'trust');
  }
});

data.graph.edges = data.graph.edges.filter(edge => edge.id !== 'emotion-trust-to-emotion-hope-emotion-association');

const text = `${JSON.stringify(data, null, 4)}\n`;
fs.writeFileSync(file, hasBom ? `\ufeff${text}` : text, 'utf8');
