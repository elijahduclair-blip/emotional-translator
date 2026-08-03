import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Library } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';

const AGENT_NAME = 'PersonaLibrarian';

const buildSeed = (profile) => {
  const colors = (profile.fav_colors || []).join(', ') || 'none';
  const shapes = (profile.fav_shapes || []).join(', ') || 'none';
  const labels = (profile.semantic_labels || []).join(', ') || 'none';
  return `A user is viewing their Persona Dashboard. Here is their profile context:\n\n` +
    `- Birthday: ${profile.birthday || 'unknown'}\n` +
    `- Archetype lens: ${profile.archetype || 'unknown'}\n` +
    `- Favorite colors: ${colors}\n` +
    `- Favorite shapes: ${shapes}\n` +
    `- Semantic origin (X,Y,Z): (${profile.semantic_origin_x ?? 0}, ${profile.semantic_origin_y ?? 0}, ${profile.semantic_origin_z ?? 0})\n` +
    `- Semantic labels: ${labels}\n\n` +
    `Engage this user conversationally. Ask ONE focused question to learn more about their intent, taste, or emotional climate — then use the ColorNode library to recommend 3–5 nodes that resonate with their profile. For each, explain briefly why it fits their colors, archetype, or semantic origin. Keep it warm and concise.`;
};

export default function PersonaLibrarianChat({ profile, deferMs = 0 }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const seededRef = useRef(null);
  const scrollRef = useRef(null);

  // Reset when profile changes
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setLoading(true);
    setError(null);
    seededRef.current = null;
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv;
        if (existing && existing.length > 0) {
          conv = await base44.agents.getConversation(existing[0].id);
        } else {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: 'Persona Recommendations', description: 'Profile-scoped node recommendations' }
          });
        }
        if (cancelled) return;
        setConversation(conv);
        setMessages(conv.messages || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to open the Librarian.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, deferMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profile?.id, deferMs]);

  // Seed once conversation is ready and not yet seeded for this profile
  useEffect(() => {
    if (!conversation || !profile || seededRef.current === profile.id) return;
    seededRef.current = profile.id;
    (async () => {
      try {
        await base44.agents.addMessage(conversation, { role: 'user', content: buildSeed(profile) });
      } catch (e) {
        setError(e.message || 'Failed to start the conversation.');
      }
    })();
  }, [conversation, profile]);

  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setSending(false);
    });
    return () => unsubscribe();
  }, [conversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content });
    } catch (e) {
      setError(e.message || 'Failed to send message.');
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#16161F] flex flex-col" style={{ height: '560px' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Library className="w-3.5 h-3.5 text-indigo-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Librarian</p>
          <p className="text-[11px] text-white/40">Asks questions & recommends nodes for this profile</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{error}</div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F4F1DE]">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#232323]" />
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Reply to the Librarian…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={loading || sending}
            className="bg-[#0E0E12] border-white/10 text-white text-sm"
          />
          <Button onClick={handleSend} disabled={!input.trim() || sending} className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}