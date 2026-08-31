import foundation from '../data/ari-foundation.v1.json' with { type: 'json' };

validateFoundation(foundation);

export function getAriFoundation() {
  return structuredClone(foundation);
}

function validateFoundation(value) {
  if (value?.version !== 'ari-foundation.v1') throw new Error('ARI foundation version is invalid.');
  if (value?.status !== 'active') throw new Error('ARI foundation is not active.');
  if (value?.identity?.name !== 'ARI') throw new Error('ARI foundation identity is invalid.');
  if (value?.identity?.domain !== 'Community Garden') throw new Error('ARI foundation domain is invalid.');
  if (value?.roles?.qwen?.includes?.('not ARI') !== true) throw new Error('ARI foundation must keep Qwen separate from ARI.');
  if (value?.bridgeFoundation?.name !== 'BRIGDE') throw new Error('ARI foundation BRIGDE rule is invalid.');
  if (value?.bridgeFoundation?.expanded?.join?.(' ') !== 'Buildable Reusable Independent Grouped Dots Enterconnected') {
    throw new Error('ARI foundation BRIGDE expansion is invalid.');
  }
  if (value?.bridgeFoundation?.meaningBoundary?.includes?.('does not by itself prove semantic meaning') !== true) {
    throw new Error('ARI foundation BRIGDE must remain structure-only.');
  }
  if (value?.acronymLanguage?.version !== 'acronym-graph.v1') throw new Error('ARI acronym language version is invalid.');
  if (value?.acronymLanguage?.growthRule?.includes?.('no permanent depth limit') !== true) throw new Error('ARI acronym language must remain open-ended.');
  if (value?.acronymLanguage?.visionRule?.includes?.('degree of vision') !== true) throw new Error('ARI acronym language requires a degree of vision.');
  if (!Array.isArray(value?.operationalLoop) || value.operationalLoop.length < 6) throw new Error('ARI operational loop is incomplete.');
  if (value?.boundary?.qwenIsIdentity !== false) throw new Error('Qwen cannot be ARI identity.');
  if (value?.boundary?.codexSpeechBecomesAriSpeech !== false) throw new Error('Imported Codex speech cannot become ARI speech.');
  if (value?.boundary?.automaticTranscriptTrainingAllowed !== false) throw new Error('Raw transcript training must remain disabled.');
  if (value?.boundary?.sharedGraphMutationAllowed !== false) throw new Error('ARI foundation cannot grant graph mutation.');
}
