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
  if (!Array.isArray(value?.operationalLoop) || value.operationalLoop.length < 6) throw new Error('ARI operational loop is incomplete.');
  if (value?.boundary?.qwenIsIdentity !== false) throw new Error('Qwen cannot be ARI identity.');
  if (value?.boundary?.automaticTranscriptTrainingAllowed !== false) throw new Error('Raw transcript training must remain disabled.');
  if (value?.boundary?.sharedGraphMutationAllowed !== false) throw new Error('ARI foundation cannot grant graph mutation.');
}
