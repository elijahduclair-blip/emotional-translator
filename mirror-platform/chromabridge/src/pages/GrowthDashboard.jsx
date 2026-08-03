import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import LibraryGrowthPanel from '@/components/growth/LibraryGrowthPanel';
import MirrorAdaptationPanel from '@/components/growth/MirrorAdaptationPanel';
import ConstitutionalPanel from '@/components/growth/ConstitutionalPanel';

export default function GrowthDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [discovery, setDiscovery] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const profiles = await base44.entities.UserProfile.filter({ created_by_id: user.id });
        const p = profiles && profiles.length > 0 ? profiles[0] : null;
        setProfile(p);
        const [n, d] = await Promise.all([
          base44.entities.PersonalNode.list('-created_date', 200),
          base44.entities.DiscoveryCandidate.list('-created_date', 200),
        ]);
        setNodes(n || []);
        setDiscovery(d || []);
        if (p) {
          const c = await base44.entities.PersistentConcept.filter({ profile_id: p.id }, '-created_date', 200);
          setConcepts(c || []);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Growth & Adaptation</h1>
          <p className="text-sm text-white/40 mt-1">
            Your personal library's expansion and how the Mirror is evolving within the four constitutional laws.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <LibraryGrowthPanel nodes={nodes} />
          </div>
          <MirrorAdaptationPanel profile={profile} nodes={nodes} />
        </div>

        <div className="mt-4">
          <ConstitutionalPanel concepts={concepts} discovery={discovery} nodes={nodes} />
        </div>
      </div>
    </div>
  );
}