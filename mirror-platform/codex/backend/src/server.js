import { logRuntimeMetrics } from './engine/metrics.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db/pool.js';
import { errorHandler } from './middleware/errorHandler.js';
import graphRouter from './routes/graph.js';
import themesRouter from './routes/themes.js';
import emotionsRouter from './routes/emotions.js';
import commonWordsRouter from './routes/common-words.js';
import usersRouter from './routes/users.js';
import translateRouter from './routes/translate.js';
import authRouter from './routes/auth.js';
import researchRouter from './routes/research.js';
import aiRouter from './routes/ai.js';
import foundationRouter from './routes/foundation.js';
import runtimeRouter from './routes/runtime.js';
import wordNetRouter from './routes/wordnet.js';
import brailleMathRouter from './routes/braille-math.js';
import brailleRuntimeGovernanceRouter from './routes/braille-runtime-governance.js';
import localAiFeedbackRouter from './routes/local-ai-feedback.js';
import { limitPublicAnalysis, validateProductionConfig } from './middleware/public-api.js';

dotenv.config();
validateProductionConfig();

const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:4173,http://127.0.0.1:4174')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

// Middleware
app.use(express.json({ limit: '64kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOriginAllowed(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed.');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use('/api/v1/foundation/analyze', limitPublicAnalysis);
app.use('/api/v1/foundation/letters', limitPublicAnalysis);
app.use('/api/v1/foundation/language-loop', limitPublicAnalysis);
app.use('/api/v1/foundation/training', limitPublicAnalysis);
app.use('/api/v1/foundation/braille-runtime', limitPublicAnalysis);
app.use('/api/v1/translate', limitPublicAnalysis);

// Health check
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Emotional Translator API online',
    measurementRule: 'This system measures influence, not meaning.',
    measurableUnit: 'activationWeight',
    routes: {
      health: '/api/health',
      foundation: '/api/v1/foundation/analyze',
      foundationLetters: '/api/v1/foundation/letters/analyze',
      languageLoop: '/api/v1/foundation/language-loop',
      trainingDataset: '/api/v1/foundation/training/dataset',
      colorAtlasTrainingDataset: '/api/v1/foundation/training/color-atlas',
      brailleRuntime: {
        compile: '/api/v1/foundation/braille-runtime/compile',
        assemble: '/api/v1/foundation/braille-runtime/assemble'
      },
      wordNet: '/api/v1/wordnet/lookup?term=gold',
      translate: '/api/v1/translate'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1', graphRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', themesRouter);
app.use('/api/v1', emotionsRouter);
app.use('/api/v1', commonWordsRouter);
app.use('/api/v1', usersRouter);
app.use('/api/v1', translateRouter);
app.use('/api/v1', researchRouter);
app.use('/api/v1', aiRouter);
app.use('/api/v1', foundationRouter);
app.use('/api/v1', wordNetRouter);
app.use('/api/v1', brailleMathRouter);
app.use('/api/v1', brailleRuntimeGovernanceRouter);
app.use('/api/v1', runtimeRouter);
app.use('/api/v1', localAiFeedbackRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Color Translator API running on port ${PORT}`);
  console.log('Phase 2 features enabled:');
  console.log('  Graph governance (/api/v1/graph/proposals)');
  console.log('  AI translator (/api/v1/translate)');
  console.log('  Foundation analysis (/api/v1/foundation/analyze)');
  console.log('  Ordered letter accountability (/api/v1/foundation/letters)');
  console.log('  Reversible language loop (/api/v1/foundation/language-loop)');
  console.log('  Verified local-AI training dataset (/api/v1/foundation/training/dataset)');
  console.log('  ChromaBridge color-atlas training dataset (/api/v1/foundation/training/color-atlas)');
  console.log('  Braille Runtime Language (/api/v1/foundation/braille-runtime/compile, /assemble)');
  console.log('  WordNet lexical lookup (/api/v1/wordnet/lookup)');
  console.log('  Braille mathematics (/api/v1/braille/math)');
  console.log('  Database backups (npm run backup)');
  console.log('  Signed account authentication (/api/v1/auth)');
  console.log('  Governed research inbox (/api/v1/research)');
  console.log('  Read-only ChatGPT tool contract (/api/v1/ai)');

  logRuntimeMetrics();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

function corsOriginAllowed(origin) {
  return CORS_ORIGINS.some(allowed => {
    if (allowed === origin) return true;
    if (!allowed.includes('*')) return false;
    const pattern = `^${allowed.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`;
    return new RegExp(pattern).test(origin);
  });
}
