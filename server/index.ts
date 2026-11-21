import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { voterRouter } from './routes/voter.js';
import { auditorRouter } from './routes/auditor.js';
import { ensureValidators, createGenesisBlock } from './lib/chain.js';
import { requireSameOrigin } from './lib/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use('/api', requireSameOrigin);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cryptora-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api/voter', voterRouter);
app.use('/api/auditor', auditorRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve the built SPA in production; in development Vite serves the client on :5173.
// The compiled entry lives in dist/server, so resolve the bundle from either the
// source root or the working directory rather than a single relative hop.
const clientDist =
  [path.resolve(root, 'client/dist'), path.resolve(process.cwd(), 'client/dist')].find((dir) =>
    fs.existsSync(path.join(dir, 'index.html')),
  ) ?? null;
if (clientDist) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      service: 'cryptora-api',
      hint: 'Client dev server runs on http://localhost:5173 (npm run dev)',
    });
  });
}

const port = Number(process.env.PORT) || 4000;

async function bootstrap() {
  await ensureValidators();
  await createGenesisBlock();
  app.listen(port, () => {
    console.log(`CRYPTORA API listening on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start CRYPTORA API', err);
  process.exit(1);
});
