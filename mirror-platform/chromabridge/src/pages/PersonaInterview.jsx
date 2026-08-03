import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Send, ArrowLeft } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';

const AGENT_NAME = 'PersonaAgent';

const seedMessage = (profile) => {
  const parts = [
    profile.birthday && `Birthday: ${profile.birthday}`,
    profile.fav_colors?.length && `Favorite colors: ${(profile.fav_colors || []).join(', ')}`,
    profile.fav_shapes?.length && `Favorite shapes: ${(profile.fav_shapes || []).join(', ')}`,
    profile.archetype && `Archetype lens: ${profile.archetype}`,
  ].filter(Boolean);
  return `I've just completed my initial profile survey. Here's what I chose:\n${parts.join('\n')}\n\nPlease begin my follow-up interview based on my archetype lens, and refine my semantic origin.`;
};

export default function PersonaInterview() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const seededRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const profiles = await base44.entities.UserProfile.list('-created_date', 1);
        if (!profiles.length) {
          setError('No profile found yet. Complete the intro survey first.');
          setLoading(false);
          return;
        }
        const p = profiles[0];
        setProfile(p);

        // Resume an existing conversation for this agent, or create one
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv;
        if (existing && existing.length > 0) {
          conv = existing[0];
          conv = await base44.agents.getConversation(conv.id);
          setConversation(conv);
          setMessages(conv.messages || []);
          // If the conversation is empty (no user message yet), seed it
          if (!(conv.messages || []).some(m => m.role === 'user')) {
            await seedAndStart(conv, p);
          }
        } else {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: 'Persona Interview', description: `Follow-up for ${p.archetype || 'user'}` },
          });
          setConversation(conv);
          await seedAndStart(conv, p);
        }
      } catch (e) {
        setError(e.message || 'Failed to start interview.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const seedAndStart = async (conv, p) => {
    if (seededRef.current) return;
    seededRef.current = true;
    setSending(true);
    try {
      await base44.agents.addMessage(conv, { role: 'user', content: seedMessage(p) });
      const fresh = await base44.agents.getConversation(conv.id);
      setConversation(fresh);
      setMessages(fresh.messages || []);
    } catch (e) {
      setError(e.message || 'Failed to start interview.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
      const fresh = await base44.agents.getConversation(conversation.id);
      setConversation(fresh);
      setMessages(fresh.messages || []);
    } catch (e) {
      setError(e.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="safe-top flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <button onClick={() => navigate('/persona-dashboard')} className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">PersonaAgent</h1>
          <p className="text-xs text-white/40">
            {profile?.archetype ? `Interviewing as ${profile.archetype}` : 'Follow-up interview'}
          </p>
        </div>
      </header>

      {error && (
        <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          {!profile && <Button variant="ghost" size="sm" onClick={() => navigate('/intro-profile')} className="text-red-300 hover:text-red-200">Go to survey</Button>}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}
      </div>

      <div className="border-t border-white/5 px-5 py-4 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type your answer…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={loading || sending}
            className="bg-card border-border"
          />
          <Button onClick={handleSend} disabled={!input.trim() || sending} className="bg-indigo-500 hover:bg-indigo-600 text-white">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}