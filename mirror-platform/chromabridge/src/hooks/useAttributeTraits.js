import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Given a UserProfile, resolves semantic trait mappings for the profile's
 * favorite shapes, colors, and birthday-derived season using the Librarian's
 * semantic anchor system.
 *
 * Returns { traits: { [attributeValue]: string[] }, loading, error }
 */
export function useAttributeTraits(profile) {
  const [traits, setTraits] = useState({});
  const [shapeTraits, setShapeTraits] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!profile) return;

    const season = seasonOf(profile.birthday);
    const attributes = [];

    for (const shape of profile.fav_shapes || []) {
      attributes.push({ type: 'shape', value: shape });
    }
    for (const color of profile.fav_colors || []) {
      attributes.push({ type: 'color', value: color });
    }
    if (season) {
      attributes.push({ type: 'season', value: season });
    }
    if (profile.archetype) {
      attributes.push({ type: 'archetype', value: profile.archetype });
    }

    if (attributes.length === 0) {
      setTraits({});
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('resolveAttributeTraits', { attributes });
      setTraits(res.data.mappings || {});
      setShapeTraits(res.data.shapeTraits || {});
    } catch (e) {
      setError(e.message || 'Failed to resolve traits.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return { traits, shapeTraits, loading, error };
}

function seasonOf(dateStr) {
  if (!dateStr) return '';
  const m = new Date(dateStr).getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Autumn';
  return 'Winter';
}