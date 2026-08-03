import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { motion } from 'framer-motion';
import TypewriterText from '@/components/TypewriterText';

const AGENT_NAME = 'PersonaAgent';

export default function Mirror() {
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const seededRef = useRef(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv;
        if (existing && existing.length > 0) {
          conv = await base44.agents.getConversation(existing[0].id);
        } else {
          // New user — check whether they already have a profile
          let hasProfile = false;
          try {
            const profiles = await base44.entities.UserProfile.list();
            hasProfile = Array.isArray(profiles) && profiles.length > 0;
          } catch {
          }

          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: 'Mirror', description: 'Personal persona dialogue' },
          });

          if (hasProfile) {
            await base44.agents.addMessage(conv, {
              role: 'user',
              content: "I'm here. Speak to me — ask me a question, or reflect on something with me.",
            });
          } else {
            await base44.agents.addMessage(conv, {
              role: 'user',
              content: "I'm a new arrival. Guide me through the introductory questions to build my profile — ask about my birthday, my favorite colors, the shapes that resonate with me, and the archetype lens I want to explore through. Ask one question at a time, then use my answers to create my UserProfile.",
            });
          }
          conv = await base44.agents.getConversation(conv.id);
        }
        setConversation(conv);
        setMessages(conv.messages || []);
      } catch {
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
      const fresh = await base44.agents.getConversation(conversation.id);
      setMessages(fresh.messages || []);
    } catch {
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const visibleMessages = messages.filter(m => m.content);

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Conversation — Luminous Thread */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-6 py-16 flex flex-col justify-end"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-2xl w-full mx-auto flex flex-col items-start">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                fontFamily: "'EB Garamond', serif",
                color: '#FFFFFF',
                fontSize: '1.45rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textShadow: '0 0 15px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.15)',
              }}
            >
              breathing…
            </motion.div>
          ) : (
            visibleMessages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 1.2,
                    ease: [0.22, 1, 0.36, 1],
                    delay: i * 0.08,
                  }}
                  className="w-full flex flex-col items-start"
                  style={{ marginBottom: '3.5rem' }}
                >
                  {isUser ? (
                    <p
                      className="text-left whitespace-pre-wrap"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        color: 'rgba(255,255,255,0.18)',
                        fontSize: '0.8rem',
                        fontWeight: 400,
                        lineHeight: 1.6,
                        letterSpacing: '0.18em',
                        maxWidth: '42rem',
                        margin: '0',
                      }}
                    >
                      {m.content}
                    </p>
                  ) : (
                    <TypewriterText
                      content={m.content}
                      wordDelay={200}
                      className="text-left whitespace-pre-wrap"
                      style={{
                        fontFamily: "'EB Garamond', serif",
                        color: '#FFFFFF',
                        fontSize: '1.45rem',
                        fontWeight: 600,
                        lineHeight: 2.15,
                        letterSpacing: '0.1em',
                        textShadow: '0 0 15px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.15)',
                        maxWidth: '42rem',
                        margin: '0',
                      }}
                    />
                  )}
                </motion.div>
              );
            })
          )}
          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                fontFamily: "'EB Garamond', serif",
                color: '#FFFFFF',
                fontSize: '1.2rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textShadow: '0 0 15px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.15)',
                marginTop: '1.5rem',
              }}
            >
              breathing…
            </motion.div>
          )}
        </div>
      </div>

      {/* Input — invisible until focused */}
      <div
        className="relative h-14 flex items-center justify-center"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          spellCheck={false}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          className="bg-transparent outline-none border-0 text-center"
          style={{
            color: 'rgba(255,255,255,0.55)',
            caretColor: 'rgba(255,255,255,0.85)',
            width: '70%',
            height: '1.2em',
            fontSize: '1.1em',
            padding: 0,
          }}
        />
      </div>
    </div>
  );
}