import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const AGENT_NAME = 'LibrarianAgent';
const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;

async function fetchLibrarianState() {
  const pending = await base44.entities.DiscoveryCandidate.filter(
    { status: 'pending' }, '-created_date', 100, 0
  );
  const discoveryCount = pending.length;

  let recentActivity = false;
  try {
    const conversations = await base44.agents.listConversations({ agent_name: AGENT_NAME });
    if (conversations && conversations.length > 0) {
      const conv = conversations[0];
      const updated = new Date(conv.updated_date || conv.created_date || 0);
      if (!isNaN(updated.getTime())) {
        recentActivity = updated > new Date(Date.now() - RECENT_WINDOW_MS);
      }
    }
  } catch {
    // No conversation yet — stable mode
  }

  return { discoveryCount, recentActivity };
}

function deriveTheme({ discoveryCount, recentActivity }) {
  if (discoveryCount > 0) {
    return {
      mode: 'discovery',
      label: 'Discovering',
      insight: `${discoveryCount} pending ${discoveryCount === 1 ? 'candidate' : 'candidates'} awaiting review`,
      vars: {
        '--lb-bg': '155 18% 7%',
        '--lb-card': '155 14% 13%',
        '--lb-card-2': '155 12% 17%',
        '--lb-border': '150 18% 22%',
        '--lb-accent': '150 45% 50%',
        '--lb-text': '40 12% 88%',
        '--lb-text-muted': '150 8% 52%',
        '--lb-font-heading': "'EB Garamond', Georgia, 'Times New Roman', serif",
        '--lb-font-body': "'EB Garamond', Georgia, 'Times New Roman', serif",
      },
    };
  }

  if (recentActivity) {
    return {
      mode: 'audit',
      label: 'Auditing',
      insight: 'The Librarian is actively organizing the library',
      vars: {
        '--lb-bg': '230 22% 7%',
        '--lb-card': '230 16% 13%',
        '--lb-card-2': '230 14% 17%',
        '--lb-border': '230 20% 23%',
        '--lb-accent': '225 55% 65%',
        '--lb-text': '220 15% 88%',
        '--lb-text-muted': '230 10% 55%',
        '--lb-font-heading': "'EB Garamond', Georgia, 'Times New Roman', serif",
        '--lb-font-body': "'EB Garamond', Georgia, 'Times New Roman', serif",
      },
    };
  }

  return {
    mode: 'stable',
    label: 'Stable',
    insight: 'The library is clean and well-indexed',
    vars: {
      '--lb-bg': '30 10% 9%',
      '--lb-card': '32 8% 15%',
      '--lb-card-2': '34 8% 19%',
      '--lb-border': '32 6% 22%',
      '--lb-accent': '38 30% 60%',
      '--lb-text': '35 10% 87%',
      '--lb-text-muted': '32 6% 55%',
      '--lb-font-heading': "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
      '--lb-font-body': "'Inter', ui-sans-serif, system-ui, sans-serif",
    },
  };
}

export function useLibrarianTheme() {
  const { data, isLoading } = useQuery({
    queryKey: ['librarianState'],
    queryFn: fetchLibrarianState,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const state = data || { discoveryCount: 0, recentActivity: false };
  const theme = deriveTheme(state);
  return { theme, isLoading };
}