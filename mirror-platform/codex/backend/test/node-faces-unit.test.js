import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNodeMetadataWithFaces } from '../src/lib/node-faces.js';

test('node faces backfill legacy metadata into verification structure', () => {
  const metadata = normalizeNodeMetadataWithFaces({
    definition: 'Fear is anticipation of threat.',
    evidence: 'Increased heart rate under perceived danger.',
    emotionalLogic: 'Protection and vigilance rise before action.',
    boundary: 'Relational context, not diagnosis.'
  });

  assert.equal(metadata.faces.verification.definition, 'Fear is anticipation of threat.');
  assert.equal(metadata.faces.verification.evidence, 'Increased heart rate under perceived danger.');
  assert.equal(metadata.faces.verification.function, 'Protection and vigilance rise before action.');
  assert.equal(metadata.faceSummary.verification.availableCount, 3);
  assert.equal(metadata.faceSummary.status, 'partial');
});

test('node faces report textured status when texture faces exist', () => {
  const metadata = normalizeNodeMetadataWithFaces({
    definition: 'Fog is partial signal.',
    faces: {
      verification: {
        evidence: 'Visibility drops while contour remains.',
        prediction: 'Uncertainty-related routes should strengthen.'
      },
      texture: {
        sight: 'blurred edges',
        touch: 'cool dampness'
      }
    }
  });

  assert.equal(metadata.faceSummary.verification.availableCount, 3);
  assert.equal(metadata.faceSummary.texture.availableCount, 2);
  assert.equal(metadata.faceSummary.status, 'textured');
  assert.equal(metadata.faces.texture.sight, 'blurred edges');
});
