import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { transformIndexHtml } from './htmlTransformer.js';
import { buildPhpPackageZip, generatePhpPackageFiles } from './phpPackageBuilder.js';
import { PreviewRpcBackend } from './previewBackend.js';
import { CLIENT_KEYS, generateSchemaSql, SCHEMA_TABLES } from './schemaDefinition.js';

const SOURCE_HTML_PATH = path.resolve(process.cwd(), 'public/assets/aistudio/Index_b2a69b7b.html');
const SOURCE_HTML = fs.readFileSync(SOURCE_HTML_PATH, 'utf8');

test('transformIndexHtml replaces GAS runtime checks with PHP HTTP fetch bridge', () => {
  const transformed = transformIndexHtml(SOURCE_HTML, {
    apiEndpoint: 'api/index.php',
    appTitle: 'Acme <Procurement> & Suite',
  });

  assert.ok(transformed.includes('const IN_GAS = true, GAS_INTERNAL_URL = "api/sync.php"'));
  assert.ok(transformed.includes('PHP_API_ENDPOINT = "api/index.php"'));
  assert.ok(transformed.includes('fetch(PHP_API_ENDPOINT'));
  assert.ok(transformed.includes('<title>Acme &lt;Procurement&gt; &amp; Suite</title>'));
  assert.ok(!transformed.includes('google.script.run.withSuccessHandler'));
  assert.ok(transformed.includes('install.php'));
});

test('all 18 CLIENT_KEYS align with SCHEMA_TABLES, DDL SQL, and includes/mirror_sync.php', () => {
  const schemaSql = generateSchemaSql('custom_');
  const files = generatePhpPackageFiles({ tablePrefix: 'custom_' }, SOURCE_HTML);
  const mirrorSync = files.find((f) => f.path === 'includes/mirror_sync.php')?.content || '';

  for (const key of CLIENT_KEYS) {
    const spec = SCHEMA_TABLES.find((t) => t.clientKey === key);
    assert.ok(spec, `Missing aligned SCHEMA_TABLES spec for clientKey "${key}"`);
    assert.ok(
      schemaSql.includes(`\`custom_${spec.tableName}\``),
      `Missing CREATE TABLE for custom_${spec.tableName}`
    );
    if (key !== 'company_profile' && key !== 'acc_books') {
      assert.ok(
        mirrorSync.includes(`case '${key}':`),
        `Missing relational mirror sync handler for "${key}"`
      );
    }
  }
});

test('buildPhpPackageZip creates a valid uploadable ZIP archive with escaped config.php', async () => {
  const zipBytes = await buildPhpPackageZip(
    {
      dbHost: '127.0.0.1',
      dbName: 'prod_vendor_db',
      dbUser: 'prod_user',
      dbPass: "p@ss'with\\quote",
      tablePrefix: 'vp_',
    },
    SOURCE_HTML
  );

  const loaded = await JSZip.loadAsync(zipBytes);
  const expectedPaths = [
    'vendor-suite/index.php',
    'vendor-suite/index.html',
    'vendor-suite/install.php',
    'vendor-suite/.htaccess',
    'vendor-suite/README.md',
    'vendor-suite/config/config.php',
    'vendor-suite/config/database.php',
    'vendor-suite/sql/schema.sql',
    'vendor-suite/includes/auth.php',
    'vendor-suite/includes/permissions.php',
    'vendor-suite/includes/company.php',
    'vendor-suite/includes/mirror_sync.php',
    'vendor-suite/includes/backup.php',
    'vendor-suite/api/index.php',
    'vendor-suite/api/auth.php',
    'vendor-suite/api/data.php',
    'vendor-suite/api/companies.php',
    'vendor-suite/api/users.php',
    'vendor-suite/api/backups.php',
    'vendor-suite/api/sync.php',
    'vendor-suite/api/upload.php',
    'vendor-suite/api/mail.php',
    'vendor-suite/api/ai.php',
    'vendor-suite/storage/uploads/.htaccess',
    'vendor-suite/storage/backups/.htaccess',
  ];

  for (const p of expectedPaths) {
    const entry = loaded.file(p);
    assert.ok(entry, `Expected ZIP entry missing: ${p}`);
  }

  const configPhp = await loaded.file('vendor-suite/config/config.php')!.async('string');
  assert.ok(configPhp.includes("define('DB_NAME', 'prod_vendor_db');"));
  assert.ok(configPhp.includes("define('DB_PREFIX', 'vp_');"));
  assert.ok(configPhp.includes("define('DB_PASS', 'p@ss\\'with\\\\quote');"));

  const sql = await loaded.file('vendor-suite/sql/schema.sql')!.async('string');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS `vp_vendors`'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS `vp_purchase_orders`'));
});

test('PreviewRpcBackend handles setup, login, persistence, and revision conflicts', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-preview-test-'));
  try {
    const backend = new PreviewRpcBackend(tmpDir);
    const info = backend.getInfo();
    assert.equal(info.hasUsers, false);
    assert.ok(info.setupCode && info.setupCode.length === 8);

    assert.throws(
      () => backend.dispatch('authSetupFirstAdmin', '', ['Admin', 'admin@acme.com', 'password123', 'WRONGCODE']),
      /setup code is not correct/i
    );

    const setupRes = backend.dispatch('authSetupFirstAdmin', '', [
      'Admin User',
      'admin@acme.com',
      'password123',
      info.setupCode,
    ]);
    assert.ok(setupRes.token);
    assert.equal(setupRes.user.role, 'Admin');

    const enter = backend.dispatch('appEnter', `${setupRes.token}~co_main`, ['co_main']);
    assert.equal(enter.coId, 'co_main');

    const vendorsPayload = JSON.stringify([{ id: 'v1', vendorName: 'Apex Steel Works', status: 'Active' }]);
    const write1 = backend.dispatch('dbSetMany', `${setupRes.token}~co_main`, [
      { vendors: vendorsPayload },
      { vendors: 0 },
      false,
    ]);
    assert.equal(write1.conflicts.length, 0);
    assert.equal(write1.revs.vendors, 1);

    // Outdated revision triggers conflict detection cleanly
    const writeConflict = backend.dispatch('dbSetMany', `${setupRes.token}~co_main`, [
      { vendors: '[]' },
      { vendors: 0 },
      false,
    ]);
    assert.deepEqual(writeConflict.conflicts, ['vendors']);

    const readAll = backend.dispatch('dbGetAll', `${setupRes.token}~co_main`, []);
    assert.equal(readAll.data.vendors, vendorsPayload);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
