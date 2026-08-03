import fs from 'node:fs';

const file = 'data/color-synonyms.json';
const raw = fs.readFileSync(file, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xfeff;
const data = JSON.parse(hasBom ? raw.slice(1) : raw);

data.emotionTranslator = data.emotionTranslator || {};
data.emotionTranslator.phraseCuePolicy = 'phrase cues route natural emotional language to existing emotion_word nodes; they are not color evidence';

const cues = [
  ['i feel happy', 'joy', 'first-person feeling phrase points to joy'],
  ['feeling happy', 'joy', 'feeling phrase points to joy'],
  ['excited', 'joy', 'excited routes through joy as a bright positive feeling'],
  ['delighted', 'joy', 'delighted routes through joy as a bright positive feeling'],
  ['on edge', 'fear', 'on edge routes through fear as alert unease'],
  ['scared', 'fear', 'scared routes through fear'],
  ['worried', 'fear', 'worried routes through fear as uncertainty or threat'],
  ['anxious', 'fear', 'anxious routes through fear as unease'],
  ['heartbroken', 'sad', 'heartbroken routes through sadness and loss'],
  ['broken heart', 'sad', 'broken heart routes through sadness and loss'],
  ['grief', 'sad', 'grief routes through sadness and loss'],
  ['lonely', 'sad', 'lonely routes through sadness as low emotional energy'],
  ['in love', 'love', 'in love routes through love'],
  ['romantic', 'love', 'romantic routes through love'],
  ['peaceful', 'peace', 'peaceful routes through peace'],
  ['at peace', 'peace', 'at peace routes through peace'],
  ['calm down', 'calm', 'calm down routes through calm'],
  ['safe', 'trust', 'safe routes through trust as safety and reliability'],
  ['confident', 'trust', 'confident routes through trust'],
  ['hopeful', 'hope', 'hopeful routes through hope'],
  ['warning', 'danger', 'warning routes through danger'],
  ['threatened', 'danger', 'threatened routes through danger'],
  ['furious', 'anger', 'furious routes through anger'],
  ['mad', 'anger', 'mad routes through anger']
];

const existing = new Map((data.emotionTranslator.phraseCues || []).map(item => [item.cue, item]));
cues.forEach(([cue, emotion, evidence]) => {
  existing.set(cue, {
    cue,
    emotion,
    targetNodeId: `emotion-${emotion}`,
    confidence: 'medium',
    evidence,
    basis: 'emotional phrase cue'
  });
});

data.emotionTranslator.phraseCues = [...existing.values()].sort((a, b) => a.cue.localeCompare(b.cue));

const text = `${JSON.stringify(data, null, 4)}\n`;
fs.writeFileSync(file, hasBom ? `\ufeff${text}` : text, 'utf8');
