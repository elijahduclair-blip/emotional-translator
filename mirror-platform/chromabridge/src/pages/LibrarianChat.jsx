import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Library, Loader2, Send, ArrowLeft } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';

const AGENT_NAME = 'LibrarianAgent';

const SUGGESTIONS = [
  'Audit the library for accuracy issues',
  'Find and repair orphaned shade nodes',
  'Detect and merge duplicate nodes',
  'Tidy the hierarchy — check for cycles'
];

export default function LibrarianChat() {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv;
        if (existing && existing.length > 0) {
          conv = await base44.agents.getConversation(existing[0].id);
        } else {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: 'Librarian', description: 'Node library organizer' }
          });
        }
        setConversation(conv);
        setMessages(conv.messages || []);
      } catch (e) {
        setError(e.message || 'Failed to open the library.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content });
      const fresh = await base44.agents.getConversation(conversation.id);
      setConversation(fresh);
      setMessages(fresh.messages || []);
    } catch (e) {
      setError(e.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const hasMessages = messages.some(m => m.role === 'user' || m.content);

  return (
    <div className="min-h-screen bg-[#0d140d] text-[#d4d4d4] flex flex-col">
      <header className="safe-top flex items-center gap-3 px-5 py-4 border-b border-[#4a544a]">
        <button onClick={() => navigate(-1)} className="text-[#4a544a] hover:text-[#c5b358] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#c5b358]/5 border border-[#c5b358]/40 flex items-center justify-center">
          <Library className="w-4 h-4 text-[#c5b358]" />
        </div>
        <div>
          <h1 className="text-sm font-heading font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>Librarian</h1>
          <p className="text-xs text-[#d4d4d4]/40">Audits & organizes the node library</p>
        </div>
      </header>

      {error && (
        <div className="px-5 py-3 bg-[#c5b358]/5 border-b border-[#c5b358]/20 text-[#c5b358] text-sm">
          {error}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#4a544a]" />
          </div>
        ) : !hasMessages ? (
          <div className="py-12 space-y-4">
            <p className="text-sm text-[#d4d4d4]/40 text-center">
              Ask the Librarian to audit, deduplicate, or re-index your nodes.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left px-4 py-3 rounded-lg border border-[#4a544a] bg-[#1a2a1a] hover:bg-[#c5b358]/10 hover:border-[#c5b358]/40 text-sm text-[#d4d4d4] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}
      </div>

      <div className="border-t border-[#4a544a] px-5 py-4 max-w-3xl w-full mx-auto bg-[#0d140d]">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ask the Librarian to organize…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={loading || sending}
            className="bg-[#1a2a1a] border-[#4a544a] text-[#d4d4d4]"
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || sending} className="rounded-full bg-[#c5b358] text-[#0d140d] hover:bg-[#c5b358]/80 border border-[#c5b358]/40">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}