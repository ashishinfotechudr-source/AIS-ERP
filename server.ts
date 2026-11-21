import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { transformIndexHtml } from './src/utils/htmlTransformer.js';
import { buildPhpPackageZip, generatePhpPackageFiles } from './src/utils/phpPackageBuilder.js';
import { DEFAULT_PHP_HOST_CONFIG, type PhpHostConfig } from './src/utils/phpTemplates.js';
import { PreviewRpcBackend } from './src/utils/previewBackend.js';
import { SCHEMA_TABLES } from './src/utils/schemaDefinition.js';

const PORT = 3000;
const SOURCE_HTML_PATH = path.resolve(process.cwd(), 'public/assets/aistudio/Index_b2a69b7b.html');
const PREVIEW_DATA_DIR = path.resolve(process.cwd(), '.preview-data');

function readSourceHtml(): string {
  return fs.readFileSync(SOURCE_HTML_PATH, 'utf8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const previewBackend = new PreviewRpcBackend(PREVIEW_DATA_DIR);

  // Return PHP package manifest & aligned SQL schema definitions
  app.post('/api/package/inspect', (req, res) => {
    try {
      const cfg: Partial<PhpHostConfig> = req.body || {};
      const sourceHtml = readSourceHtml();
      const files = generatePhpPackageFiles(cfg, sourceHtml).map((f) => ({
        ...f,
        sizeBytes: Buffer.byteLength(f.content, 'utf8'),
      }));
      res.json({ ok: true, files, tables: SCHEMA_TABLES });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Failed to inspect package' });
    }
  });

  // Generate and stream downloadable .zip archive
  app.post('/api/package/download', async (req, res) => {
    try {
      const cfg: Partial<PhpHostConfig> = {
        ...DEFAULT_PHP_HOST_CONFIG,
        ...(req.body || {}),
      };
      const sourceHtml = readSourceHtml();
      const zipBytes = await buildPhpPackageZip(cfg, sourceHtml);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="vendor-suite-php-package.zip"');
      res.setHeader('Content-Length', String(zipBytes.byteLength));
      res.send(Buffer.from(zipBytes));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Failed to build ZIP archive' });
    }
  });

  // Live Preview status & reset endpoints
  app.get('/api/preview/info', (_req, res) => {
    res.json({ ok: true, ...previewBackend.getInfo() });
  });

  app.post('/api/preview/reset', (_req, res) => {
    const info = previewBackend.reset();
    res.json({ ok: true, ...info, ...previewBackend.getInfo() });
  });

  // Serve transformed self-hosted index.html wired to Express /live-app/api/index.php
  app.get(['/live-app', '/live-app/'], (_req, res) => {
    try {
      const sourceHtml = readSourceHtml();
      const transformed = transformIndexHtml(sourceHtml, {
        apiEndpoint: '/live-app/api/index.php',
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(transformed);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Could not render preview HTML.');
    }
  });

  // Serve preview uploaded logos safely inside PREVIEW_DATA_DIR/uploads
  app.get('/live-app/uploads/:file', (req, res) => {
    const baseDir = path.resolve(PREVIEW_DATA_DIR, 'uploads');
    const resolved = path.resolve(baseDir, path.basename(req.params.file));
    if (!resolved.startsWith(baseDir + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).end();
      return;
    }
    res.sendFile(resolved);
  });

  // Preview RPC endpoint matching PHP api/index.php contract
  app.post('/live-app/api/index.php', (req, res) => {
    try {
      const { fn, token, args } = req.body || {};
      if (!fn || typeof fn !== 'string') {
        throw new Error('Invalid RPC call.');
      }
      let effectiveToken = String(token || '');
      if (!effectiveToken && req.headers.authorization?.startsWith('Bearer ')) {
        effectiveToken = req.headers.authorization.slice(7).trim();
      }
      const data = previewBackend.dispatch(fn, effectiveToken, Array.isArray(args) ? args : []);
      res.json({ ok: true, data });
    } catch (err: any) {
      const msg = String(err?.message || 'Backend error');
      const status = msg.startsWith('AUTH:') ? 401 : msg.startsWith('PERM:') ? 403 : 400;
      res.status(status).json({ ok: false, error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
