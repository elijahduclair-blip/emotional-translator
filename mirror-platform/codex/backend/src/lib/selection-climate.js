import { readFileSync } from 'node:fs';

const DATA_URL = new URL('../../../data/color-synonyms.json', import.meta.url);
const RAW_DATA = JSON.parse(readFileSync(DATA_URL, 'utf8').replace(/^\uFEFF/, ''));
const RULES = RAW_DATA.selectionClimate || {};

export function analyzeSelectionClimate(input) {
  const selections = normalizeSelections(input);
  const matchedEntries = matchSelectionEntries(selections);
  const minimumMatches = Number(RULES.minimumMatches || 2);

  if (matchedEntries.length < minimumMatches) {
    return {
      systemName: RULES.systemName || RULES.name || 'Pattern Extraction System',
      inputMode: Array.isArray(input?.selections) ? 'selection_array' : 'selection_text',
      selections,
      matchedSelections: matchedEntries,
      extractedAttributes: [],
      patternStages: RULES.stages || [],
      unresolved: true,
      unresolvedReason: `Selection climate needs at least ${minimumMatches} supported selections.`,
      boundaryChecks: RULES.boundaryChecks || [],
      boundary: RULES.boundary || ''
    };
  }

  const attributeCounts = countAttributes(matchedEntries);
  const observablePatterns = evaluateRules(RULES.observableRules, attributeCounts);
  const inferredPreferences = evaluateRules(RULES.inferenceRules, attributeCounts);
  const repeatedClimates = repeatedClimateLabels(attributeCounts);
  const finalRead = firstMatchingFinalRead(attributeCounts);
  const environmentCondition = inferEnvironmentCondition(attributeCounts);
  const filterRead = inferFilterRead(attributeCounts);

  return {
    systemName: RULES.systemName || RULES.name || 'Pattern Extraction System',
    inputMode: Array.isArray(input?.selections) ? 'selection_array' : 'selection_text',
    selections,
    matchedSelections: matchedEntries.map(entry => ({
      id: entry.id,
      label: entry.label,
      observation: entry.observation,
      attributes: entry.attributes
    })),
    extractedAttributes: extractedAttributes(attributeCounts),
    patternStages: RULES.stages || [],
    observablePatterns,
    inferredPreferences,
    repeatedClimates,
    environmentCondition,
    filterRead,
    finalRead,
    connectionStrength: selectionConnectionStrength(matchedEntries, observablePatterns, inferredPreferences),
    unresolved: false,
    boundaryChecks: RULES.boundaryChecks || [],
    boundary: RULES.boundary || ''
  };
}

export function normalizeSelections(input) {
  if (Array.isArray(input?.selections)) {
    return uniqueStrings(input.selections.map(value => normalizeSelection(value)).filter(Boolean));
  }
  const text = String(input?.text || input || '');
  const normalized = normalizeSelection(text);
  if (/[,+\n]/.test(text)) {
    return uniqueStrings(
      text
        .split(/\r?\n|,|\+/)
        .map(value => normalizeSelection(value))
        .filter(Boolean)
    );
  }
  const matches = [];
  (RULES.entries || []).forEach(entry => {
    (entry.cues || []).forEach(cue => {
      const normalizedCue = normalizeSelection(cue);
      if (normalized.includes(normalizedCue)) matches.push(normalizedCue);
    });
  });
  return uniqueStrings(matches);
}

function normalizeSelection(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchSelectionEntries(selections) {
  const entries = RULES.entries || [];
  const matched = [];
  const seen = new Set();

  selections.forEach(selection => {
    entries.forEach(entry => {
      if (seen.has(entry.id)) return;
      const cues = (entry.cues || []).map(normalizeSelection);
      if (cues.includes(selection)) {
        matched.push(entry);
        seen.add(entry.id);
      }
    });
  });

  return matched;
}

function countAttributes(entries) {
  const counts = new Map();
  entries.forEach(entry => {
    (entry.attributes || []).forEach(attributeId => {
      counts.set(attributeId, (counts.get(attributeId) || 0) + 1);
    });
  });
  return counts;
}

function evaluateRules(rules = [], attributeCounts) {
  return rules
    .filter(rule => ruleMatches(rule, attributeCounts))
    .map(rule => rule.statement);
}

function ruleMatches(rule, attributeCounts) {
  const minimumCount = Number(rule.minimumCount || 1);
  const allOf = (rule.allOf || []).every(attributeId => (attributeCounts.get(attributeId) || 0) >= minimumCount);
  const anyTotal = (rule.anyOf || []).reduce((sum, attributeId) => sum + (attributeCounts.get(attributeId) || 0), 0);
  const anyOf = !rule.anyOf?.length || anyTotal >= minimumCount;

  if (rule.allOf?.length && rule.anyOf?.length) return allOf && anyOf;
  if (rule.allOf?.length) return allOf;
  if (rule.anyOf?.length) return anyOf;
  return false;
}

function repeatedClimateLabels(attributeCounts) {
  const attributesById = new Map((RULES.attributes || []).map(attribute => [attribute.id, attribute]));
  return [...attributeCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([attributeId]) => attributesById.get(attributeId)?.label)
    .filter(Boolean)
    .slice(0, 5);
}

function extractedAttributes(attributeCounts) {
  const attributesById = new Map((RULES.attributes || []).map(attribute => [attribute.id, attribute]));
  return [...attributeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([attributeId, count]) => {
      const attribute = attributesById.get(attributeId);
      if (!attribute) return null;
      return {
        id: attribute.id,
        label: attribute.label,
        group: attribute.group || null,
        count,
        description: attribute.description || ''
      };
    })
    .filter(Boolean);
}

function firstMatchingFinalRead(attributeCounts) {
  return (RULES.finalReads || []).find(rule => ruleMatches(rule, attributeCounts))?.statement
    || 'The pattern points to repeated preference structure rather than isolated label meaning.';
}

function inferEnvironmentCondition(attributeCounts) {
  const phrases = [];
  if ((attributeCounts.get('adaptive_structure') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    phrases.push('change without chaos');
    phrases.push('structure without rigidity');
  }
  if ((attributeCounts.get('growth') || 0) > 0 && (attributeCounts.get('regulation') || 0) > 0) {
    phrases.push('growth without overexpansion');
  }
  if ((attributeCounts.get('depth') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    phrases.push('feeling without emotional flooding');
  }
  return phrases.join(' | ');
}

function inferFilterRead(attributeCounts) {
  if ((attributeCounts.get('adaptive_structure') || 0) > 0 && (attributeCounts.get('regulation') || 0) > 0) {
    return 'How does a system remain coherent while changing?';
  }
  if ((attributeCounts.get('depth') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    return 'How is weight held without turning into spectacle?';
  }
  return 'What repeated preference pattern is appearing across the whole set?';
}

function selectionConnectionStrength(matchedEntries, observablePatterns, inferredPreferences) {
  if (matchedEntries.length >= 5 && observablePatterns.length >= 3 && inferredPreferences.length >= 2) return 'strong';
  if (matchedEntries.length >= 3 && observablePatterns.length >= 2) return 'medium';
  return 'weak';
}

function uniqueStrings(items) {
  return [...new Set(items)];
}

export function analyzePatternExtraction(input) {
  return analyzeSelectionClimate(input);
}

export const selectionClimateRules = RULES;
