import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, X } from 'lucide-react';

const AGENT_NAME = 'LibrarianAgent';

const buildPrompt = (query) =>
  `You are filtering the ColorNode library for the Data Explorer.\n\nUser intent: "${query}"\n\nUse the ColorNode read tool to examine the nodes, then select the ones that best match this semantic intent, accuracy, or relationship criteria.\n\nRespond with ONLY a JSON object (no prose, no markdown fences) in this exact shape:\n{"summary": "<one or two sentences explaining your selection>", "node_ids": ["<id1>", "<id2>", "..."]}\n\nIf nothing matches, return {"summary": "No matching nodes found.", "node_ids": []}.`;

const extractJson = (text) => {
  if (!text) return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed && Array.isArray(parsed.node_ids)) return parsed;
  } catch { /* fall through */ }
  return null;
};

export default function LibrarianSearchPanel({ nodes, onApply }) {
  const [conversation, setConversation] = useState(null);
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const askingRef = useRef(false);

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
            metadata: { name: 'Librarian Search', description: 'Data Explorer semantic filter' }
          });
        }
        setConversation(conv);
      } catch (e) {
        setError(e.message || 'Could not reach the Librarian.');
      }
    })();
  }, []);

  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = data.messages || [];
      if (!askingRef.current) return;
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant' && last.content) {
        const parsed = extractJson(last.content);
        if (parsed) {
          askingRef.current = false;
          setAsking(false);
          onApply(parsed.node_ids, parsed.summary);
        }
      }
    });
    return () => unsubscribe();
  }, [conversation, onApply]);

  const handleAsk = async () => {
    const text = query.trim();
    if (!text || !conversation || asking) return;
    setAsking(true);
    askingRef.current = true;
    setError(null);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: buildPrompt(text) });
    } catch (e) {
      askingRef.current = false;
      setAsking(false);
      setError(e.message || 'Failed to query the Librarian.');
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#16161F] p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-300" />
        <span className="text-sm font-medium text-white">Librarian Semantic Search</span>
        <span className="text-xs text-white/30">— describe intent, accuracy, or relationships</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder='e.g. "nodes near Hope that feel passive and warm"'
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
          disabled={asking || !conversation}
          className="bg-[#0E0E12] border-white/10"
        />
        <Button onClick={handleAsk} disabled={!query.trim() || asking || !conversation} className="bg-indigo-500 hover:bg-indigo-600 text-white">
          {asking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {asking ? 'Searching…' : 'Ask'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

export function LibrarianResultBanner({ summary, count, onClear }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 mb-4">
      <Sparkles className="w-4 h-4 text-indigo-300 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-indigo-200/80 mb-0.5">Librarian filtered to {count} node{count === 1 ? '' : 's'}</p>
        <p className="text-sm text-white/80">{summary}</p>
      </div>
      <button onClick={onClear} className="text-white/40 hover:text-white transition-colors mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}