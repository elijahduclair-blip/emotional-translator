export interface ChromaBridgeEvaluation {
  id: string;
  fingerprint: string;
  input: string;
  userId: string | null;
  kind: 'evaluated_observation';
  status: 'proposed';
  climateSignals: ClimateSignal[];
  translation: ChromaBridgeTranslation;
  evidence: {
    source: 'mirror_runtime_user_input';
    observation: string;
  };
  boundary: {
    mode: 'proposal_only';
    semanticMutationAllowed: false;
    reason: string;
  };
  evaluatedAt: string;
}

export interface ClimateSignal {
  family: string;
  color: string;
  cues: string[];
}

export interface ChromaBridgeTranslation {
  climateName: string;
  primaryClimate: ClimateSignal | null;
  companionClimates: ClimateSignal[];
  relationalRead: string;
  connectionStrength: 'strong' | 'medium' | 'unresolved';
}

export function evaluate(input: {
  text: string;
  userId?: string;
}): ChromaBridgeEvaluation;
