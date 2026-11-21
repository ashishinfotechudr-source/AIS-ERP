import JSZip from 'jszip';
import { transformIndexHtml } from './htmlTransformer.js';
import {
  buildApiAuthPhp,
  buildApiCompaniesPhp,
  buildApiDataPhp,
  buildApiIndexPhp,
  buildApiOtherModulesPhp,
  buildApiUsersPhp,
  buildAuthPhp,
  buildBackupPhp,
  buildBackupsHtaccess,
  buildCompanyPhp,
  buildConfigPhp,
  buildDatabasePhp,
  buildIndexPhp,
  buildInstallPhp,
  buildMirrorSyncPhp,
  buildPermissionsPhp,
  buildReadmeMd,
  buildRootHtaccess,
  buildUploadsHtaccess,
  DEFAULT_PHP_HOST_CONFIG,
  type PhpHostConfig,
} from './phpTemplates.js';
import { generateSchemaSql, sanitizeTablePrefix } from './schemaDefinition.js';

export interface PackageFileEntry {
  path: string;
  content: string;
  category: 'root' | 'config' | 'sql' | 'includes' | 'api' | 'storage';
  alignedTables: string[];
  description: string;
}

export function generatePhpPackageFiles(
  partialConfig: Partial<PhpHostConfig> = {},
  sourceHtml: string
): PackageFileEntry[] {
  const cfg: PhpHostConfig = {
    ...DEFAULT_PHP_HOST_CONFIG,
    ...partialConfig,
    tablePrefix: sanitizeTablePrefix(partialConfig.tablePrefix ?? DEFAULT_PHP_HOST_CONFIG.tablePrefix),
  };
  const p = cfg.tablePrefix;
  const otherApi = buildApiOtherModulesPhp();

  const adaptedHtml = transformIndexHtml(sourceHtml, {
    apiEndpoint: 'api/index.php',
    appTitle: cfg.appTitle,
  });

  const files: PackageFileEntry[] = [
    {
      path: 'index.php',
      content: buildIndexPhp(),
      category: 'root',
      alignedTables: [`${p}users`],
      description: 'Web entry point: verifies schema readiness and serves index.html (or redirects to install.php).',
    },
    {
      path: 'index.html',
      content: adaptedHtml,
      category: 'root',
      alignedTables: [`${p}company_data`],
      description: 'Adapted Vendor, Procurement & Payment Suite SPA bridged to api/index.php via HTTP POST.',
    },
    {
      path: 'install.php',
      content: buildInstallPhp(),
      category: 'root',
      alignedTables: [`${p}app_settings`, `${p}users`, `${p}companies`],
      description: 'Browser 1-click installer that executes sql/schema.sql and displays the one-time SETUP_CODE.',
    },
    {
      path: '.htaccess',
      content: buildRootHtaccess(),
      category: 'root',
      alignedTables: [],
      description: 'Apache rules forwarding Authorization headers and blocking web access to config/includes/sql/backups.',
    },
    {
      path: 'README.md',
      content: buildReadmeMd(cfg),
      category: 'root',
      alignedTables: [],
      description: 'Deployment instructions for cPanel, FTP, or VPS zip upload and SQL integration.',
    },
    {
      path: 'config/config.php',
      content: buildConfigPhp(cfg),
      category: 'config',
      alignedTables: [],
      description: 'Database credentials, table prefix, session TTL, and upload size configuration.',
    },
    {
      path: 'config/database.php',
      content: buildDatabasePhp(),
      category: 'config',
      alignedTables: [`${p}app_settings`],
      description: 'PDO MySQL/MariaDB singleton connection with prepared statements and prefix helper tbl().',
    },
    {
      path: 'sql/schema.sql',
      content: generateSchemaSql(p),
      category: 'sql',
      alignedTables: [`${p}users`, `${p}companies`, `${p}company_data`, `${p}vendors`, `${p}purchase_orders`, `${p}bills`],
      description: 'Complete InnoDB SQL schema defining 9 platform tables and 18 aligned domain tables.',
    },
    {
      path: 'includes/permissions.php',
      content: buildPermissionsPhp(),
      category: 'includes',
      alignedTables: [`${p}users`],
      description: 'Role & per-menu View/Edit/Delete/Export RBAC matrix and gstApiKey secret redaction.',
    },
    {
      path: 'includes/auth.php',
      content: buildAuthPhp(),
      category: 'includes',
      alignedTables: [`${p}users`, `${p}user_sessions`, `${p}login_attempts`, `${p}audit_logs`],
      description: 'Password verification (bcrypt + legacy SHA-256 backup support), sliding sessions, and audit logs.',
    },
    {
      path: 'includes/company.php',
      content: buildCompanyPhp(),
      category: 'includes',
      alignedTables: [`${p}companies`],
      description: 'Multi-company isolation, access checks, and soft-delete registry helpers.',
    },
    {
      path: 'includes/mirror_sync.php',
      content: buildMirrorSyncPhp(),
      category: 'includes',
      alignedTables: [
        `${p}vendors`,
        `${p}purchase_orders`,
        `${p}work_orders`,
        `${p}bills`,
        `${p}payment_sheets`,
        `${p}payment_vouchers`,
        `${p}sales_vouchers`,
        `${p}purchase_vouchers`,
        `${p}receipt_vouchers`,
        `${p}journal_vouchers`,
        `${p}proforma_invoices`,
        `${p}services`,
        `${p}inventory_items`,
        `${p}material_entries`,
        `${p}gate_passes`,
        `${p}terms_templates`,
        `${p}company_profiles`,
        `${p}acc_books`,
      ],
      description: 'Transactional sync mirroring every CLIENT_KEY write into its aligned relational SQL table.',
    },
    {
      path: 'includes/backup.php',
      content: buildBackupPhp(),
      category: 'includes',
      alignedTables: [`${p}backups`, `${p}company_data`, `${p}users`],
      description: 'Full JSON snapshot generator & atomic restore helper storing snapshots in storage/backups/.',
    },
    {
      path: 'api/index.php',
      content: buildApiIndexPhp(),
      category: 'api',
      alignedTables: [],
      description: 'Unified JSON RPC dispatcher routing all frontend calls to modular api/*.php handlers.',
    },
    {
      path: 'api/auth.php',
      content: buildApiAuthPhp(),
      category: 'api',
      alignedTables: [`${p}users`, `${p}user_sessions`, `${p}login_attempts`, `${p}app_settings`],
      description: 'First-admin bootstrap, sign-in, session resume, sign-out, and password change endpoints.',
    },
    {
      path: 'api/data.php',
      content: buildApiDataPhp(),
      category: 'api',
      alignedTables: [`${p}company_data`, `${p}vendors`, `${p}purchase_orders`, `${p}bills`],
      description: 'appBoot, appEnter, dbGetAll, and optimistic-revision dbSetMany with relational SQL sync.',
    },
    {
      path: 'api/companies.php',
      content: buildApiCompaniesPhp(),
      category: 'api',
      alignedTables: [`${p}companies`, `${p}company_data`, `${p}company_profiles`],
      description: 'Multi-company CRUD (create with optional vendor/terms copy, rename, soft-delete, restore).',
    },
    {
      path: 'api/users.php',
      content: buildApiUsersPhp(),
      category: 'api',
      alignedTables: [`${p}users`, `${p}audit_logs`],
      description: 'Administrator user directory, RBAC permissions editor, and audit log feed.',
    },
    {
      path: 'api/backups.php',
      content: otherApi['api/backups.php'],
      category: 'api',
      alignedTables: [`${p}backups`, `${p}company_data`],
      description: 'Server backup creation, status check, list, and restore endpoints.',
    },
    {
      path: 'api/sync.php',
      content: otherApi['api/sync.php'],
      category: 'api',
      alignedTables: [`${p}vendors`, `${p}purchase_orders`, `${p}bills`],
      description: 'Table verification, status ping, and relational table push/pull inspection endpoints.',
    },
    {
      path: 'api/upload.php',
      content: otherApi['api/upload.php'],
      category: 'api',
      alignedTables: [`${p}company_profiles`],
      description: 'Validates and stores uploaded company logos safely inside storage/uploads/<company_id>/.',
    },
    {
      path: 'api/mail.php',
      content: otherApi['api/mail.php'],
      category: 'api',
      alignedTables: [`${p}email_logs`, `${p}app_settings`],
      description: 'Connector toggle state, outbound document email delivery, and audit logging.',
    },
    {
      path: 'api/ai.php',
      content: otherApi['api/ai.php'],
      category: 'api',
      alignedTables: [`${p}app_settings`],
      description: 'Optional server-side AI assistant configuration and read-only proxy.',
    },
    {
      path: 'storage/uploads/.htaccess',
      content: buildUploadsHtaccess(),
      category: 'storage',
      alignedTables: [],
      description: 'Disables PHP/CGI script execution inside public uploaded assets directory.',
    },
    {
      path: 'storage/backups/.htaccess',
      content: buildBackupsHtaccess(),
      category: 'storage',
      alignedTables: [],
      description: 'Blocks direct HTTP downloads of server JSON backups.',
    },
  ];

  return files;
}

export async function buildPhpPackageZip(
  partialConfig: Partial<PhpHostConfig> = {},
  sourceHtml: string
): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder('vendor-suite')!;
  const files = generatePhpPackageFiles(partialConfig, sourceHtml);

  for (const f of files) {
    root.file(f.path, f.content);
  }
  root.file('storage/uploads/.gitkeep', '');
  root.file('storage/backups/.gitkeep', '');

  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
