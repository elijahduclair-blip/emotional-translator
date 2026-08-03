import { analyzeFoundationText } from './foundation-analysis.js';
import { analyzeLetterAccountability } from './letter-accountability.js';
import { brailleToCellRecords, transcribeEnglishToUeb, transcribeUebToEnglish } from './braille-runtime-language.js';
import { buildWordNetEvidence } from './wordnet-evidence.js';

export const LANGUAGE_LOOP_VERSION = '1.0.0';

export function runStructuralLanguageLoop(text) {
  const originalEnglish = String(text || '');
  if (!originalEnglish.trim()) throw httpError(400, 'text is required.');
  if ([...originalEnglish].length > 2_000) throw httpError(413, 'Language-loop text must be 2000 Unicode code points or fewer.');
  const canonicalEnglish = originalEnglish.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const ueb = transcribeEnglishToUeb(canonicalEnglish);
  const cells = brailleToCellRecords(ueb);
  const decodedEnglish = transcribeUebToEnglish(ueb);
  const foundation = analyzeFoundationText(canonicalEnglish, { includeWordNet: false });
  const accountability = analyzeLetterAccountability(canonicalEnglish);
  const terms = foundation.wordCounts.map(item => item.word).slice(0, 12);

  return {
    engine: 'reversible_language_loop',
    version: LANGUAGE_LOOP_VERSION,
    originalEnglish,
    canonicalEnglish,
    encoding: {
      notation: 'ueb_grade_1_bounded',
      ueb,
      cells,
      numericSequence: cells.map(cell => cell.mask),
      binarySequence: cells.map(cell => cell.bits)
    },
    processing: {
      cellFrequencies: cellFrequencies(cells),
      transitions: cellTransitions(cells),
      foundation: {
        stats: foundation.stats,
        wordCounts: foundation.wordCounts,
        coOccurrences: foundation.coOccurrences,
        patterns: foundation.patterns,
        signatureIds: accountability.wordSequence.map(item => item.signatureId)
      }
    },
    lexicalEvidence: buildWordNetEvidence(terms),
    terms,
    decoding: {
      notation: 'ueb_grade_1_bounded',
      ueb,
      english: decodedEnglish,
      roundTripExact: decodedEnglish === canonicalEnglish
    },
    boundary: {
      mode: 'reversible_signal_with_relational_evidence',
      encodingCreatesMeaning: false,
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      reason: 'Braille and binary preserve the received signal. WordNet, context, and approved graph relationships provide bounded evidence about what the signal refers to.'
    }
  };
}

function cellFrequencies(cells) {
  const counts = new Map();
  for (const cell of cells) {
    const current = counts.get(cell.mask) || { mask: cell.mask, bits: cell.bits, unicode: cell.unicode, count: 0, positions: [] };
    current.count += 1;
    current.positions.push(cell.index);
    counts.set(cell.mask, current);
  }
  return [...counts.values()].sort((left, right) => left.mask - right.mask);
}

function cellTransitions(cells) {
  return cells.slice(0, -1).map((cell, index) => ({
    fromPosition: cell.index,
    toPosition: cells[index + 1].index,
    fromMask: cell.mask,
    toMask: cells[index + 1].mask
  }));
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
