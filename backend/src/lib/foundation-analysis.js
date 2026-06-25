function tokenizeText(value) {
  return String(value || '')
    .split(/[^a-z0-9-]+/i)
    .map(term => term.trim().toLowerCase())
    .filter(term => Boolean(term) && /[a-z0-9]/i.test(term));
}

function countWords(tokens) {
  const counts = new Map();
  tokens.forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function countCoOccurrences(tokens, windowSize = 2) {
  const pairCounts = new Map();
  for (let index = 0; index < tokens.length; index += 1) {
    const left = tokens[index];
    const end = Math.min(tokens.length, index + Math.max(2, windowSize));
    for (let offset = index + 1; offset < end; offset += 1) {
      const right = tokens[offset];
      if (!left || !right || left === right) continue;
      const [word, related] = [left, right].sort((a, b) => a.localeCompare(b));
      const key = `${word}||${related}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
  }
  return [...pairCounts.entries()]
    .map(([key, count]) => {
      const [word, related] = key.split('||');
      return { word, related, count };
    })
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word) || a.related.localeCompare(b.related));
}

function buildPareto(wordCounts, totalWords) {
  let runningCount = 0;
  return wordCounts.map((item, index) => {
    runningCount += item.count;
    return {
      word: item.word,
      count: item.count,
      rank: index + 1,
      share: totalWords ? item.count / totalWords : 0,
      cumulativeCount: runningCount,
      cumulativeShare: totalWords ? runningCount / totalWords : 0
    };
  });
}

function detectPatterns({ wordCounts, coOccurrences, pareto, totalWords, distinctWords }) {
  const patterns = [];
  const topWord = wordCounts[0];
  if (topWord && topWord.count > 1) {
    patterns.push({
      type: 'repeated_word',
      label: 'Repeated word',
      evidence: `${topWord.word} appears ${topWord.count} times.`,
      word: topWord.word,
      count: topWord.count
    });
  }

  const topPair = coOccurrences[0];
  if (topPair && topPair.count > 1) {
    patterns.push({
      type: 'repeated_cooccurrence',
      label: 'Repeated co-occurrence',
      evidence: `${topPair.word} appears near ${topPair.related} ${topPair.count} times.`,
      word: topPair.word,
      related: topPair.related,
      count: topPair.count
    });
  }

  const concentrationCutoff = Math.max(1, Math.ceil(wordCounts.length * 0.2));
  const concentrationSlice = pareto[Math.min(concentrationCutoff - 1, Math.max(0, pareto.length - 1))];
  if (concentrationSlice && concentrationSlice.cumulativeShare >= 0.5) {
    patterns.push({
      type: 'pareto_concentration',
      label: 'Concentrated vocabulary',
      evidence: `Top ${concentrationCutoff} words account for ${(concentrationSlice.cumulativeShare * 100).toFixed(1)}% of all words.`,
      topWordCount: concentrationCutoff,
      cumulativeShare: concentrationSlice.cumulativeShare
    });
  }

  if (totalWords && distinctWords && distinctWords / totalWords <= 0.5) {
    patterns.push({
      type: 'repetition_density',
      label: 'High repetition density',
      evidence: `${distinctWords} distinct words across ${totalWords} total words suggests repeated reuse.`,
      distinctWords,
      totalWords
    });
  }

  return patterns;
}

export function analyzeFoundationText(text, options = {}) {
  const normalizedText = String(text || '').trim();
  const windowSize = Math.min(Math.max(Number.parseInt(options.windowSize, 10) || 2, 2), 8);
  const tokens = tokenizeText(normalizedText);
  const totalWords = tokens.length;
  const wordCountsBase = countWords(tokens);
  const distinctWords = wordCountsBase.length;
  const wordCounts = wordCountsBase.map((item, index) => ({
    ...item,
    rank: index + 1,
    share: totalWords ? item.count / totalWords : 0
  }));
  const coOccurrencesBase = countCoOccurrences(tokens, windowSize);
  const totalCoOccurrences = coOccurrencesBase.reduce((sum, item) => sum + item.count, 0);
  const coOccurrences = coOccurrencesBase.map((item, index) => ({
    ...item,
    rank: index + 1,
    share: totalCoOccurrences ? item.count / totalCoOccurrences : 0
  }));
  const pareto = buildPareto(wordCountsBase, totalWords);
  const patterns = detectPatterns({ wordCounts, coOccurrences, pareto, totalWords, distinctWords });

  return {
    stats: {
      totalWords,
      distinctWords,
      totalCoOccurrences,
      windowSize
    },
    wordCounts,
    coOccurrences,
    pareto,
    patterns
  };
}

export { tokenizeText };
