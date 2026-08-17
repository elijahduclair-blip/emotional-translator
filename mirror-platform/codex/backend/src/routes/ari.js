import express from 'express';
import { getAriFoundation } from '../lib/ari-foundation.js';

const router = express.Router();

router.get('/ari/foundation', (_req, res) => {
  res.json({
    foundation: getAriFoundation(),
    consultedBy: 'ari_runtime',
    boundary: {
      mode: 'versioned_reviewed_foundation',
      rawCodexTranscriptImported: false,
      automaticLearningAllowed: false,
      semanticMutationAllowed: false,
      sharedGraphMutationAllowed: false,
      reason: 'This is ARI founding curriculum, not a raw conversation import or permission grant.'
    }
  });
});

export default router;
