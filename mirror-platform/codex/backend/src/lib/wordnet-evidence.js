import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORDNET_PATH = path.resolve(__dirname, '../../../data/wordnet-foundation.json');

let cachedLexicon;

function loadLexicon() {
  if (cachedLexicon !== undefined) return cachedLexicon;

  try {
    cachedLexicon = JSON.parse(fs.readFileSync(WORDNET_PATH, 'utf8'));
  } catch {
    cachedLexicon = null;
  }

  return cachedLexicon;
}

function uniqueTokens(tokens) {
  const seen = new Set();
  return tokens.filter(token => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function candidateForms(word) {
  const forms = [word];
  if (word.endsWith('ies') && word.length > 4) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('s') && word.length > 3) forms.push(word.slice(0, -1));
  if (word.endsWith('ing') && word.length > 5) forms.push(word.slice(0, -3));
  if (word.endsWith('ed') && word.length > 4) forms.push(word.slice(0, -2));
  return [...new Set(forms)];
}

function lookupEntry(entries, word) {
  for (const form of candidateForms(word)) {
    if (entries[form]) return { lookup: form, entry: entries[form] };
  }
  return null;
}

export function buildWordNetEvidence(tokens) {
  const words = uniqueTokens(tokens);
  const lexicon = loadLexicon();

  if (!lexicon?.entries) {
    return {
      engine: 'wordnet',
      version: '0.0.0',
      status: 'not_configured',
      boundary: 'WordNet evidence is unavailable. Foundation can still return counts, co-occurrences, Pareto order, and repeated patterns.',
      stats: {
        totalTermsChecked: words.length,
        matchedWords: 0,
        unresolvedWords: words.length
      },
      matchedWords: [],
      unresolvedWords: words
    };
  }

  const matchedWords = [];
  const unresolvedWords = [];

  words.forEach(word => {
    const match = lookupEntry(lexicon.entries, word);
    if (!match) {
      unresolvedWords.push(word);
      return;
    }

    matchedWords.push({
      word,
      lookup: match.lookup,
      senses: match.entry.senses || []
    });
  });

  return {
    engine: 'wordnet',
    version: lexicon.version || '0.1.0',
    status: lexicon.status || 'local_seed',
    boundary: lexicon.boundary || 'WordNet evidence is lexical evidence only. It does not assign color, route activation, climate, or meaning.',
    stats: {
      totalTermsChecked: words.length,
      matchedWords: matchedWords.length,
      unresolvedWords: unresolvedWords.length
    },
    matchedWords,
    unresolvedWords
  };
}
