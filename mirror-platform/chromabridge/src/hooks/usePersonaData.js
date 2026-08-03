import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

async function fetchAllProfiles() {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.UserProfile.filter({}, '-created_date', 500, skip);
    all.push(...batch);
    if (batch.length < 500) break;
    skip += 500;
  }
  return all;
}

/**
 * react-query-backed data loading for the Persona Dashboard.
 * Fetches profiles, domains, and active nodes in parallel and caches
 * the result so re-mounts don't trigger redundant API calls.
 */
export function usePersonaData() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['persona-dashboard'],
    queryFn: async () => {
      const [profiles, domains, activeNodes] = await Promise.all([
        fetchAllProfiles(),
        base44.entities.Domain.list('-created_date', 100).catch(() => []),
        base44.entities.ColorNode.filter({ memory_status: 'active' }, '-access_count', 200).catch(() => []),
      ]);
      return { profiles, domains, activeNodes };
    },
    staleTime: 30_000,
  });

  return {
    profiles: data?.profiles ?? null,
    domains: data?.domains ?? [],
    activeNodes: data?.activeNodes ?? [],
    loading: isLoading,
    refetch,
  };
}