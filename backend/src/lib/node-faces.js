export const VERIFICATION_FACE_KEYS = ['definition', 'evidence', 'function', 'origin', 'relationships', 'prediction'];
export const TEXTURE_FACE_KEYS = ['touch', 'sight', 'taste', 'smell', 'sound', 'effects'];

export function normalizeNodeMetadataWithFaces(metadata = {}) {
  const base = metadata && typeof metadata === 'object' ? structuredClone(metadata) : {};
  const rawFaces = base.faces && typeof base.faces === 'object' ? base.faces : {};
  const verificationInput = rawFaces.verification && typeof rawFaces.verification === 'object' ? rawFaces.verification : {};
  const textureInput = rawFaces.texture && typeof rawFaces.texture === 'object' ? rawFaces.texture : {};

  const verification = {
    definition: firstText(verificationInput.definition, base.definition, base.description),
    evidence: firstText(
      verificationInput.evidence,
      base.evidence,
      base.contextDefinition,
      base.emotionDefinition,
      base.associationBasis,
      base.definitionBasis
    ),
    function: firstText(verificationInput.function, base.function, base.emotionalLogic, base.plainRole),
    origin: firstText(verificationInput.origin, base.origin, base.source, base.sourceName, base.sourceUrl),
    relationships: firstText(verificationInput.relationships, base.relationships, base.relationshipSummary),
    prediction: firstText(verificationInput.prediction, base.prediction)
  };

  const texture = Object.fromEntries(
    TEXTURE_FACE_KEYS.map(key => [key, firstText(textureInput[key], base[key])])
  );

  const availableVerificationKeys = VERIFICATION_FACE_KEYS.filter(key => verification[key]);
  const missingVerificationKeys = VERIFICATION_FACE_KEYS.filter(key => !verification[key]);
  const availableTextureKeys = TEXTURE_FACE_KEYS.filter(key => texture[key]);
  const missingTextureKeys = TEXTURE_FACE_KEYS.filter(key => !texture[key]);

  return {
    ...base,
    faces: {
      verification,
      texture
    },
    faceSummary: {
      verification: {
        availableCount: availableVerificationKeys.length,
        missing: missingVerificationKeys,
        complete: availableVerificationKeys.length === VERIFICATION_FACE_KEYS.length
      },
      texture: {
        availableCount: availableTextureKeys.length,
        missing: missingTextureKeys
      },
      availableCount: availableVerificationKeys.length + availableTextureKeys.length,
      status: availableTextureKeys.length ? 'textured' : availableVerificationKeys.length === VERIFICATION_FACE_KEYS.length ? 'verified' : 'partial'
    }
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}
