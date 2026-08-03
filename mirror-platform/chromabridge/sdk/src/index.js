const { createHash, randomUUID } = require('node:crypto');

const NATURAL_CLIMATES = [
  ['obsidian', '#171923', ['obsidian', 'shadow', 'exposure', 'reinvention']],
  ['ember', '#c65d32', ['ember', 'amber', 'pressure', 'motion', 'release']],
  ['rose', '#b85c7d', ['rose', 'intimacy', 'attachment', 'connection']],
  ['midnight', '#223a5e', ['midnight', 'ocean', 'blue', 'atmosphere', 'reflection']],
  ['green', '#4f6f52', ['green', 'sage', 'pine', 'endurance', 'regulation']],
  ['silver', '#a7adb4', ['silver', 'mist', 'fog', 'revision', 'ambiguity']]
];

function evaluate(input) {
  const text = requireInput(input?.text);
  const normalized = text.toLowerCase();
  const climateSignals = NATURAL_CLIMATES
    .map(([family, color, cues]) => ({
      family,
      color,
      cues: cues.filter(cue => normalized.includes(cue))
    }))
    .filter(signal => signal.cues.length > 0);
  const translation = translateSignals(climateSignals);

  return {
    id: randomUUID(),
    fingerprint: createHash('sha256').update(normalized).digest('hex'),
    input: text,
    userId: optionalText(input?.userId),
    kind: 'evaluated_observation',
    status: 'proposed',
    climateSignals,
    translation,
    evidence: {
      source: 'mirror_runtime_user_input',
      observation: text
    },
    boundary: {
      mode: 'proposal_only',
      semanticMutationAllowed: false,
      reason: 'Evaluation is evidence and a proposal; durable meaning requires explicit constitutional authorization.'
    },
    evaluatedAt: new Date().toISOString()
  };
}

function translateSignals(climateSignals) {
  if (!climateSignals.length) {
    return {
      climateName: 'Unresolved climate',
      primaryClimate: null,
      companionClimates: [],
      relationalRead: 'The feeling is present before a stable color signal. It remains open atmosphere rather than being forced into a fixed label.',
      connectionStrength: 'unresolved'
    };
  }

  const [primary, ...companions] = climateSignals;
  const primaryName = titleCase(primary.family);
  const cueText = naturalList(primary.cues);
  const companionText = companions
    .map(signal => `${titleCase(signal.family)} appears through ${naturalList(signal.cues)}`)
    .join('; ');

  return {
    climateName: companions.length
      ? `${primaryName} beside ${companions.map(signal => titleCase(signal.family)).join(' and ')}`
      : `${primaryName} climate`,
    primaryClimate: primary,
    companionClimates: companions,
    relationalRead: companions.length
      ? `${primaryName} is moving through ${cueText}, while ${companionText}. These climates coexist; none is treated as a permanent identity.`
      : `${primaryName} is the clearest current signal through ${cueText}. It describes a moving emotional climate, not a permanent identity.`,
    connectionStrength: companions.length > 1 ? 'strong' : 'medium'
  };
}

function requireInput(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('ChromaBridge.evaluate requires non-empty text.');
  }
  if (value.length > 4000) {
    throw new RangeError('ChromaBridge.evaluate accepts at most 4000 characters.');
  }
  return value.trim();
}

function optionalText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function naturalList(values) {
  if (values.length < 2) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

module.exports = { evaluate };
