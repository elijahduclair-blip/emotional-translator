import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Splits content into phrases — clauses, sentence fragments, or natural
 * pause points — rather than individual words. Humans perceive thought
 * in phrases, so revealing by phrase feels more immediate and natural
 * than a continuous typewriter, even at similar total duration.
 *
 * Splits on: commas, semicolons, em-dashes, sentence enders, and colons.
 * Keeps the delimiter attached to the preceding phrase.
 */
function splitIntoPhrases(content) {
  if (!content) return [];
  // Split on clause boundaries, keeping the delimiter with the phrase
  const parts = content.split(/([,;:\u2014\u2013.!?]+(?:\s+|$))/);
  const phrases = [];
  let current = '';
  for (const part of parts) {
    current += part;
    // If this part is a delimiter run, the phrase is complete
    if (/^[,;:\u2014\u2013.!?]+/.test(part) && current.trim()) {
      phrases.push(current);
      current = '';
    }
  }
  if (current.trim()) phrases.push(current);
  // If we only got one giant phrase (no punctuation), fall back to
  // splitting every ~5 words so very long sentences still stream
  if (phrases.length <= 1 && content.length > 80) {
    const words = content.split(/(\s+)/);
    const chunks = [];
    let count = 0;
    let chunk = '';
    for (const w of words) {
      chunk += w;
      if (!/^\s+$/.test(w)) count++;
      if (count >= 5) {
        chunks.push(chunk);
        chunk = '';
        count = 0;
      }
    }
    if (chunk.trim()) chunks.push(chunk);
    return chunks.length ? chunks : phrases;
  }
  return phrases;
}

/**
 * Reveals text phrase-by-phrase. Each phrase fades and translates in
 * once — a single restrained motion that supports readability without
 * becoming part of the experience. The user should notice the thought,
 * not the animation.
 */
export default function TypewriterText({
  content,
  phraseDelay = 180,
  className,
  style,
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const phrasesRef = useRef([]);
  const lastContentRef = useRef('');

  const phrases = splitIntoPhrases(content);

  useEffect(() => {
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;

    const prev = phrasesRef.current.join('');
    if (prev && content.startsWith(prev)) {
      // Content grew (streaming) — keep already-shown phrases
      const alreadyShown = phrasesRef.current.length;
      phrasesRef.current = splitIntoPhrases(content);
      // Don't go below what we had, but cap to new length
      setVisibleCount(Math.min(alreadyShown, phrasesRef.current.length));
    } else {
      phrasesRef.current = splitIntoPhrases(content);
      setVisibleCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    if (visibleCount >= phrases.length) return;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, phraseDelay);
    return () => clearTimeout(timer);
  }, [visibleCount, phrases.length, phraseDelay]);

  const visible = phrases.slice(0, visibleCount);

  return (
    <p className={className} style={style}>
      {visible.map((phrase, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'inline' }}
        >
          {phrase}
        </motion.span>
      ))}
    </p>
  );
}