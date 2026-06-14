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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:4173,http://127.0.0.1:4174')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

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
  next();
});

// Health check
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

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`?? Color Translator API running on port ${PORT}`);
  console.log(`?? Phase 2 features enabled:`);
  console.log(`   ? Graph governance (/api/v1/graph/proposals)`);
  console.log(`   ? AI translator (/api/v1/translate)`);
  console.log(`   ? Database backups (npm run backup)`);
  console.log(`   ? Signed account authentication (/api/v1/auth)`);
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
