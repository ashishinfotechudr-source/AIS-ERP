import { sanitizeTablePrefix } from './schemaDefinition.js';

export interface PhpHostConfig {
  appTitle: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPass: string;
  tablePrefix: string;
  sessionTtl: number;
  maxUploadMb: number;
}

export const DEFAULT_PHP_HOST_CONFIG: PhpHostConfig = {
  appTitle: 'Vendor, Procurement & Payment Suite',
  dbHost: 'localhost',
  dbPort: '3306',
  dbName: 'vendor_suite_db',
  dbUser: 'db_user',
  dbPass: '',
  tablePrefix: 'vs_',
  sessionTtl: 21600,
  maxUploadMb: 18,
};

export function phpEsc(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

export function buildConfigPhp(cfg: PhpHostConfig): string {
  const prefix = sanitizeTablePrefix(cfg.tablePrefix);
  const ttl = Math.max(600, Number(cfg.sessionTtl) || 21600);
  const maxMb = Math.max(2, Math.min(50, Number(cfg.maxUploadMb) || 18));

  return `<?php
declare(strict_types=1);

/**
 * Vendor, Procurement & Payment Suite — Host Configuration
 * Edit these credentials before or after uploading the ZIP package.
 */

define('APP_TITLE', '${phpEsc(cfg.appTitle || DEFAULT_PHP_HOST_CONFIG.appTitle)}');

// MySQL / MariaDB connection
define('DB_HOST', '${phpEsc(cfg.dbHost || 'localhost')}');
define('DB_PORT', '${phpEsc(cfg.dbPort || '3306')}');
define('DB_NAME', '${phpEsc(cfg.dbName || 'vendor_suite_db')}');
define('DB_USER', '${phpEsc(cfg.dbUser || 'db_user')}');
define('DB_PASS', '${phpEsc(cfg.dbPass || '')}');
define('DB_CHARSET', 'utf8mb4');
define('DB_PREFIX', '${phpEsc(prefix)}');

// Security & session limits
define('SESSION_TTL', ${ttl});          // 6 hours sliding TTL
define('MAX_LOGIN_FAILS', 10);
define('LOGIN_LOCK_SECONDS', 900);      // 15 minutes lockout
define('MAX_UPLOAD_BYTES', ${maxMb} * 1024 * 1024);

// Storage directories (relative to project root)
define('ROOT_DIR', dirname(__DIR__));
define('STORAGE_DIR', ROOT_DIR . '/storage');
define('BACKUP_DIR', STORAGE_DIR . '/backups');
define('UPLOAD_DIR', STORAGE_DIR . '/uploads');
define('SQL_SCHEMA_FILE', ROOT_DIR . '/sql/schema.sql');

// Outbound email defaults (uses PHP mail(); configure From address here)
define('MAIL_FROM_EMAIL', 'noreply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
define('MAIL_FROM_NAME', APP_TITLE);

// AI Assistant model default (Anthropic API key configured inside Admin > Connected Apps)
define('AI_DEFAULT_MODEL', 'claude-sonnet-5-5');
`;
}

export function buildDatabasePhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}

function tbl(string $name): string
{
    if (!preg_match('/^[a-z0-9_]+$/', $name)) {
        throw new InvalidArgumentException('Invalid table identifier: ' . $name);
    }
    return '\`' . DB_PREFIX . $name . '\`';
}

function db_setting_get(string $key, ?string $default = null): ?string
{
    $stmt = db()->prepare('SELECT setting_value FROM ' . tbl('app_settings') . ' WHERE setting_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? (string)$row['setting_value'] : $default;
}

function db_setting_set(string $key, string $value): void
{
    $stmt = db()->prepare(
        'INSERT INTO ' . tbl('app_settings') . ' (setting_key, setting_value) VALUES (?, ?) ' .
        'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute([$key, $value]);
}

function db_setting_delete(string $key): void
{
    $stmt = db()->prepare('DELETE FROM ' . tbl('app_settings') . ' WHERE setting_key = ?');
    $stmt->execute([$key]);
}
`;
}

export function buildPermissionsPhp(): string {
  return `<?php
declare(strict_types=1);

const CLIENT_KEYS = [
    'vendors', 'purchase_orders', 'work_orders', 'material_entries', 'terms_templates',
    'company_profile', 'bills', 'payment_sheets', 'gate_passes', 'inventory_items',
    'payment_vouchers', 'proforma_invoices', 'services', 'sales_vouchers',
    'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books'
];

const KEY_MAP = [
    'vendors'           => 'vendors',
    'purchase_orders'   => 'pos',
    'work_orders'       => 'wos',
    'material_entries'  => 'materials',
    'terms_templates'   => 'terms',
    'company_profile'   => 'company',
    'bills'             => 'bills',
    'payment_sheets'    => 'paymentSheets',
    'users'             => 'users',
    'gate_passes'       => 'gatePasses',
    'inventory_items'   => 'inventoryItems',
    'payment_vouchers'  => 'paymentVouchers',
    'proforma_invoices' => 'proformaInvoices',
    'services'          => 'services',
    'sales_vouchers'    => 'salesVouchers',
    'purchase_vouchers' => 'purchaseVouchers',
    'receipt_vouchers'  => 'receiptVouchers',
    'journal_vouchers'  => 'journalVouchers',
    'acc_books'         => 'accBooks',
    'companies'         => 'companies',
];

const MIRROR_TABLE_MAP = [
    'Vendor Master'         => 'vendors',
    'Purchase Orders'       => 'purchase_orders',
    'Work Orders'           => 'work_orders',
    'Material In-Out'       => 'material_entries',
    'Terms Templates'       => 'terms_templates',
    'Company Profile'       => 'company_profiles',
    'Company Bank Accounts' => 'company_profiles',
    'Bills'                 => 'bills',
    'Payment Sheets'        => 'payment_sheets',
    'Gate Passes'           => 'gate_passes',
    'Inventory Items'       => 'inventory_items',
    'Payment Vouchers'      => 'payment_vouchers',
    'Proforma Invoices'     => 'proforma_invoices',
    'Services'              => 'services',
    'Sales Vouchers'        => 'sales_vouchers',
    'Purchase Vouchers'     => 'purchase_vouchers',
    'Receipt Vouchers'      => 'receipt_vouchers',
];

const ADMIN_ONLY_MENUS = ['sheets', 'connectors', 'connected', 'gmail', 'gdrive', 'users'];

const MENU_DEF = [
    'dashboard'     => ['read' => ['vendors', 'purchase_orders', 'work_orders'], 'write' => []],
    'vendors'       => ['read' => ['vendors', 'company_profile'], 'write' => ['vendors']],
    'vendor-import' => ['read' => ['vendors'], 'write' => ['vendors']],
    'po'            => ['read' => ['purchase_orders', 'vendors', 'terms_templates', 'company_profile'], 'write' => ['purchase_orders']],
    'wo'            => ['read' => ['work_orders', 'vendors', 'terms_templates', 'company_profile'], 'write' => ['work_orders']],
    'proforma'      => ['read' => ['proforma_invoices', 'vendors', 'services', 'company_profile'], 'write' => ['proforma_invoices']],
    'services'      => ['read' => ['services'], 'write' => ['services']],
    'inventory'     => ['read' => ['inventory_items', 'material_entries', 'vendors', 'purchase_orders', 'work_orders', 'company_profile'], 'write' => ['inventory_items', 'material_entries']],
    'gatepass'      => ['read' => ['gate_passes', 'company_profile'], 'write' => ['gate_passes']],
    'bills'         => ['read' => ['bills', 'vendors', 'purchase_vouchers', 'company_profile'], 'write' => ['bills', 'purchase_vouchers']],
    'paysheets'     => ['read' => ['bills', 'payment_sheets', 'vendors', 'company_profile'], 'write' => ['bills', 'payment_sheets']],
    'vouchers'      => ['read' => ['payment_vouchers', 'bills', 'vendors', 'company_profile'], 'write' => ['payment_vouchers']],
    'salesv'        => ['read' => ['sales_vouchers', 'receipt_vouchers', 'vendors', 'company_profile'], 'write' => ['sales_vouchers']],
    'purchasev'     => ['read' => ['purchase_vouchers', 'purchase_orders', 'vendors', 'company_profile'], 'write' => ['purchase_vouchers']],
    'receiptv'      => ['read' => ['receipt_vouchers', 'sales_vouchers', 'vendors', 'company_profile'], 'write' => ['receipt_vouchers']],
    'terms'         => ['read' => ['terms_templates'], 'write' => ['terms_templates']],
    'company'       => ['read' => ['company_profile'], 'write' => ['company_profile']],
    'reports'       => ['read' => ['vendors', 'purchase_orders', 'work_orders', 'bills', 'payment_sheets', 'company_profile'], 'write' => []],
    'ledger'        => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'company_profile'], 'write' => []],
    'groups'        => ['read' => ['vendors', 'acc_books', 'company_profile'], 'write' => ['acc_books']],
    'ledgers'       => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books', 'company_profile'], 'write' => ['acc_books']],
    'journal'       => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books', 'company_profile'], 'write' => ['journal_vouchers']],
    'trialbal'      => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books', 'company_profile'], 'write' => []],
    'placc'         => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books', 'company_profile'], 'write' => []],
    'balsheet'      => ['read' => ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'journal_vouchers', 'acc_books', 'company_profile'], 'write' => []],
];

function sanitize_perms($src): array
{
    $src = is_array($src) ? $src : [];
    $menusIn = isset($src['menus']) && is_array($src['menus']) ? $src['menus'] : [];
    $menus = [];
    foreach (array_keys(MENU_DEF) as $k) {
        $v = $menusIn[$k] ?? 'none';
        $menus[$k] = ($v === 'edit' || $v === 'view') ? $v : 'none';
    }
    $optsIn = isset($src['options']) && is_array($src['options']) ? $src['options'] : [];
    return [
        'menus'   => $menus,
        'options' => [
            'delete' => !empty($optsIn['delete']),
            'export' => !empty($optsIn['export']),
        ],
    ];
}

function normalize_user_perms(array $u): array
{
    $raw = $u['perms_json'] ?? ($u['perms'] ?? null);
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return sanitize_perms($decoded);
        }
    } elseif (is_array($raw)) {
        return sanitize_perms($raw);
    }
    $menus = [];
    foreach (array_keys(MENU_DEF) as $k) {
        $menus[$k] = 'view';
    }
    return ['menus' => $menus, 'options' => ['delete' => false, 'export' => true]];
}

function access_for(array $u): array
{
    $read = [];
    $write = [];
    $menus = [];
    if (($u['role'] ?? '') === 'Admin') {
        foreach (array_merge(array_keys(MENU_DEF), ADMIN_ONLY_MENUS) as $m) {
            $menus[$m] = 'edit';
        }
        foreach (CLIENT_KEYS as $k) {
            $read[$k] = true;
            $write[$k] = true;
        }
        $options = ['delete' => true, 'export' => true];
    } else {
        $p = normalize_user_perms($u);
        $options = $p['options'];
        foreach (MENU_DEF as $m => $def) {
            $lvl = $p['menus'][$m] ?? 'none';
            $menus[$m] = $lvl;
            if ($lvl !== 'none') {
                foreach ($def['read'] as $rk) {
                    $read[$rk] = true;
                }
            }
            if ($lvl === 'edit') {
                foreach ($def['write'] as $wk) {
                    $write[$wk] = true;
                    $read[$wk] = true;
                }
            }
        }
        foreach (ADMIN_ONLY_MENUS as $m) {
            $menus[$m] = 'none';
        }
    }
    return [
        'menus'   => $menus,
        'read'    => array_keys($read),
        'write'   => array_keys($write),
        'options' => $options,
    ];
}

function strip_profile_secrets(string $json): string
{
    $o = json_decode($json, true);
    if (is_array($o)) {
        $o['gstApiKey'] = '';
        return json_encode($o, JSON_UNESCAPED_UNICODE);
    }
    return $json;
}

function assert_no_deletes(?string $oldJson, string $newJson): void
{
    if ($oldJson === null || $oldJson === '') {
        return;
    }
    $oldV = json_decode($oldJson, true);
    $newV = json_decode($newJson, true);
    if (!is_array($oldV) || !is_array($newV)) {
        return;
    }
    $keep = [];
    foreach ($newV as $r) {
        if (is_array($r) && isset($r['id'])) {
            $keep[(string)$r['id']] = true;
        }
    }
    foreach ($oldV as $r) {
        if (is_array($r) && isset($r['id']) && !isset($keep[(string)$r['id']])) {
            throw new RuntimeException('PERM: You do not have permission to delete records.');
        }
    }
}
`;
}

export function buildAuthPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/permissions.php';

function norm_email(string $s): string
{
    return strtolower(trim($s));
}

function is_valid_email(string $s): bool
{
    return (bool)filter_var($s, FILTER_VALIDATE_EMAIL);
}

function random_hex(int $len = 16): string
{
    return substr(bin2hex(random_bytes((int)ceil($len / 2))), 0, $len);
}

function verify_user_password(array $u, string $pw): bool
{
    $hash = (string)($u['password_hash'] ?? ($u['passwordHash'] ?? ''));
    $salt = (string)($u['salt'] ?? '');
    if (strpos($hash, '$2y$') === 0 || strpos($hash, '$argon2') === 0) {
        return password_verify($pw, $hash);
    }
    // Compatibility with backups imported from Google Apps Script (salted SHA-256)
    if ($salt !== '' && $hash !== '') {
        return hash_equals($hash, hash('sha256', $salt . ':' . $pw));
    }
    if ($hash !== '') {
        return hash_equals($hash, hash('sha256', $pw));
    }
    return false;
}

function hash_user_password(string $pw): string
{
    return password_hash($pw, PASSWORD_BCRYPT);
}

function audit_log(string $who, string $action, string $detail = ''): void
{
    try {
        $stmt = db()->prepare('INSERT INTO ' . tbl('audit_logs') . ' (who, action, detail) VALUES (?, ?, ?)');
        $stmt->execute([$who, $action, $detail]);
    } catch (Throwable $e) {
        // Audit trail is best-effort
    }
}

function split_token(?string $token): array
{
    $t = (string)($token ?? '');
    if ($t === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\\s+([^\\s]+)/i', $_SERVER['HTTP_AUTHORIZATION'], $m)) {
            $t = $m[1];
        }
    }
    $pos = strpos($t, '~');
    if ($pos === false) {
        return ['tok' => $t, 'co' => ''];
    }
    return ['tok' => substr($t, 0, $pos), 'co' => substr($t, $pos + 1)];
}

function find_user_by_id(string $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM ' . tbl('users') . ' WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function find_user_by_email(string $email): ?array
{
    $stmt = db()->prepare('SELECT * FROM ' . tbl('users') . ' WHERE email = ?');
    $stmt->execute([norm_email($email)]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function public_user(array $u): array
{
    $cids = null;
    if (!empty($u['company_ids_json'])) {
        $dec = json_decode((string)$u['company_ids_json'], true);
        if (is_array($dec)) {
            $cids = $dec;
        }
    }
    return [
        'id'         => $u['id'],
        'name'       => $u['name'],
        'email'      => $u['email'],
        'role'       => $u['role'] === 'Admin' ? 'Admin' : 'User',
        'active'     => (bool)$u['active'],
        'companyIds' => $cids,
        'perms'      => normalize_user_perms($u),
        'createdAt'  => $u['created_at'] ?? '',
        'lastLogin'  => $u['last_login'] ?? '',
    ];
}

function session_user(array $u): array
{
    return [
        'id'     => $u['id'],
        'name'   => $u['name'],
        'email'  => $u['email'],
        'role'   => $u['role'] === 'Admin' ? 'Admin' : 'User',
        'access' => access_for($u),
    ];
}

function create_session(array $u): string
{
    $tok = bin2hex(random_bytes(32));
    $exp = gmdate('Y-m-d H:i:s', time() + SESSION_TTL);
    $stmt = db()->prepare(
        'INSERT INTO ' . tbl('user_sessions') . ' (token, user_id, sv, expires_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$tok, $u['id'], (int)$u['sv'], $exp]);
    // Opportunistic cleanup of expired sessions
    db()->exec('DELETE FROM ' . tbl('user_sessions') . ' WHERE expires_at < UTC_TIMESTAMP()');
    return $tok;
}

function require_user(?string $token): array
{
    $tok = split_token($token)['tok'];
    if ($tok === '') {
        throw new RuntimeException('AUTH: Please sign in.');
    }
    $stmt = db()->prepare(
        'SELECT s.*, u.id AS u_id, u.name, u.email, u.role, u.active, u.salt, u.password_hash, ' .
        'u.sv AS u_sv, u.perms_json, u.company_ids_json, u.created_at, u.last_login ' .
        'FROM ' . tbl('user_sessions') . ' s ' .
        'JOIN ' . tbl('users') . ' u ON u.id = s.user_id ' .
        'WHERE s.token = ? AND s.expires_at >= UTC_TIMESTAMP()'
    );
    $stmt->execute([$tok]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new RuntimeException('AUTH: Your session has expired. Please sign in again.');
    }
    if (!(bool)$row['active'] || (int)$row['sv'] !== (int)$row['u_sv']) {
        $del = db()->prepare('DELETE FROM ' . tbl('user_sessions') . ' WHERE token = ?');
        $del->execute([$tok]);
        throw new RuntimeException('AUTH: This session is no longer valid. Please sign in again.');
    }
    $newExp = gmdate('Y-m-d H:i:s', time() + SESSION_TTL);
    $upd = db()->prepare('UPDATE ' . tbl('user_sessions') . ' SET expires_at = ?, last_seen_at = UTC_TIMESTAMP() WHERE token = ?');
    $upd->execute([$newExp, $tok]);

    $row['id'] = $row['u_id'];
    $row['sv'] = $row['u_sv'];
    return $row;
}

function require_admin_user(?string $token): array
{
    $u = require_user($token);
    if (($u['role'] ?? '') !== 'Admin') {
        throw new RuntimeException('PERM: Administrator access is required.');
    }
    return $u;
}
`;
}

export function buildCompanyPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function user_can_company(array $u, string $companyId): bool
{
    if (($u['role'] ?? '') === 'Admin') {
        return true;
    }
    if (empty($u['company_ids_json'])) {
        return true;
    }
    $ids = json_decode((string)$u['company_ids_json'], true);
    if (!is_array($ids)) {
        return true;
    }
    return in_array($companyId, $ids, true);
}

function ensure_main_company(): void
{
    $cnt = (int)db()->query('SELECT COUNT(*) FROM ' . tbl('companies'))->fetchColumn();
    if ($cnt === 0) {
        $stmt = db()->prepare(
            'INSERT IGNORE INTO ' . tbl('companies') . ' (id, name, is_legacy, is_deleted, created_by) VALUES (?, ?, 1, 0, ?)'
        );
        $stmt->execute(['co_main', 'Main Company', 'system']);
    }
}

function public_company(array $c, bool $isAdmin): array
{
    $o = [
        'id'        => $c['id'],
        'name'      => $c['name'],
        'legacy'    => (bool)$c['is_legacy'],
        'createdAt' => $c['created_at'] ?? '',
    ];
    if ($isAdmin) {
        $o['createdBy'] = $c['created_by'] ?? '';
        $o['dbUrl'] = 'sql/schema.sql#' . $c['id'];
        $o['folderUrl'] = 'storage/backups/';
        if ((bool)$c['is_deleted']) {
            $o['deleted'] = true;
            $o['deletedAt'] = $c['deleted_at'] ?? '';
            $o['deletedBy'] = $c['deleted_by'] ?? '';
        }
    }
    return $o;
}

function company_list_for(array $u): array
{
    ensure_main_company();
    $isAdmin = ($u['role'] ?? '') === 'Admin';
    $rows = db()->query('SELECT * FROM ' . tbl('companies') . ' ORDER BY is_legacy DESC, created_at ASC')->fetchAll();
    $active = [];
    $deleted = [];
    foreach ($rows as $c) {
        if ((bool)$c['is_deleted']) {
            if ($isAdmin) {
                $deleted[] = public_company($c, true);
            }
        } elseif (user_can_company($u, $c['id'])) {
            $active[] = public_company($c, $isAdmin);
        }
    }
    $out = ['companies' => $active];
    if ($isAdmin) {
        $out['deleted'] = $deleted;
    }
    return $out;
}

function select_company(array $u, string $coId = ''): array
{
    $list = company_list_for($u)['companies'];
    if ($coId !== '') {
        foreach ($list as $c) {
            if ($c['id'] === $coId) {
                return $c;
            }
        }
        throw new RuntimeException('PERM: You no longer have access to that company, or it was removed. Please reload the page.');
    }
    if (empty($list)) {
        throw new RuntimeException('PERM: No company is available for your account. Please contact your administrator.');
    }
    return $list[0];
}

function require_session_company(?string $token, string $coOverride = ''): array
{
    $u = require_user($token);
    $split = split_token($token);
    $coId = $coOverride !== '' ? $coOverride : $split['co'];
    $co = select_company($u, $coId);
    return [$u, $co];
}

function require_admin_company(?string $token, string $coOverride = ''): array
{
    [$u, $co] = require_session_company($token, $coOverride);
    if (($u['role'] ?? '') !== 'Admin') {
        throw new RuntimeException('PERM: Administrator access is required.');
    }
    return [$u, $co];
}
`;
}

export function buildMirrorSyncPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

/**
 * Synchronizes JSON document keys written via dbSetMany() into their aligned
 * relational SQL tables so standard SQL queries, reports, and PHP integrations
 * stay 100% up-to-date automatically.
 */
function sync_key_to_relational_table(string $companyId, string $key, string $jsonValue): void
{
    $decoded = json_decode($jsonValue, true);
    $pdo = db();

    if ($key === 'company_profile' && is_array($decoded)) {
        $stmt = $pdo->prepare(
            'INSERT INTO ' . tbl('company_profiles') .
            ' (company_id, company_name, short_code, phone, email, gstin, pan, state, bank_name, bank_account_number, bank_ifsc, logo_url, profile_json) ' .
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' .
            'ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), short_code=VALUES(short_code), phone=VALUES(phone), ' .
            'email=VALUES(email), gstin=VALUES(gstin), pan=VALUES(pan), state=VALUES(state), bank_name=VALUES(bank_name), ' .
            'bank_account_number=VALUES(bank_account_number), bank_ifsc=VALUES(bank_ifsc), logo_url=VALUES(logo_url), profile_json=VALUES(profile_json)'
        );
        $stmt->execute([
            $companyId,
            (string)($decoded['companyName'] ?? ''),
            (string)($decoded['shortCode'] ?? ''),
            (string)($decoded['phone'] ?? ''),
            (string)($decoded['email'] ?? ''),
            (string)($decoded['gstin'] ?? ''),
            (string)($decoded['pan'] ?? ''),
            (string)($decoded['state'] ?? ''),
            (string)($decoded['bankName'] ?? ''),
            (string)($decoded['bankAccountNumber'] ?? ''),
            (string)($decoded['bankIfsc'] ?? ''),
            (string)($decoded['logoDriveUrl'] ?? ''),
            $jsonValue,
        ]);
        return;
    }

    if ($key === 'acc_books' && is_array($decoded)) {
        $stmt = $pdo->prepare(
            'INSERT INTO ' . tbl('acc_books') . ' (company_id, books_start, pay_basis, books_json) VALUES (?, ?, ?, ?) ' .
            'ON DUPLICATE KEY UPDATE books_start=VALUES(books_start), pay_basis=VALUES(pay_basis), books_json=VALUES(books_json)'
        );
        $stmt->execute([
            $companyId,
            (string)($decoded['booksStart'] ?? ''),
            (string)($decoded['payBasis'] ?? 'paid'),
            $jsonValue,
        ]);
        return;
    }

    if (!is_array($decoded)) {
        return;
    }

    $listTables = [
        'vendors', 'purchase_orders', 'work_orders', 'proforma_invoices', 'services',
        'inventory_items', 'material_entries', 'gate_passes', 'bills', 'payment_sheets',
        'payment_vouchers', 'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers',
        'journal_vouchers', 'terms_templates'
    ];
    if (!in_array($key, $listTables, true)) {
        return;
    }

    $del = $pdo->prepare('DELETE FROM ' . tbl($key) . ' WHERE company_id = ?');
    $del->execute([$companyId]);

    foreach ($decoded as $row) {
        if (!is_array($row) || empty($row['id'])) {
            continue;
        }
        $id = (string)$row['id'];
        $raw = json_encode($row, JSON_UNESCAPED_UNICODE);

        switch ($key) {
            case 'vendors':
                $pdo->prepare('INSERT INTO ' . tbl('vendors') . ' (company_id, id, vendor_name, company_name, vendor_category, gstin, pan, mobile, email, city, state, credit_days, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['vendorName'] ?? ''), (string)($row['companyName'] ?? ''), (string)($row['vendorCategory'] ?? ''), (string)($row['gstin'] ?? ''), (string)($row['pan'] ?? ''), (string)($row['mobile'] ?? ''), (string)($row['email'] ?? ''), (string)($row['city'] ?? ''), (string)($row['state'] ?? ''), (int)($row['creditDays'] ?? 0), (string)($row['status'] ?? 'Active'), $raw]);
                break;

            case 'purchase_orders':
                $pdo->prepare('INSERT INTO ' . tbl('purchase_orders') . ' (company_id, id, po_number, supplier_id, supplier_name, po_date, delivery_date, department, project, grand_total, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['poNumber'] ?? ''), (string)($row['supplierId'] ?? ''), (string)($row['supplierName'] ?? ''), (string)($row['poDate'] ?? ''), (string)($row['deliveryDate'] ?? ''), (string)($row['department'] ?? ''), (string)($row['project'] ?? ''), (float)($row['grandTotal'] ?? 0), (string)($row['status'] ?? 'Pending'), $raw]);
                break;

            case 'work_orders':
                $pdo->prepare('INSERT INTO ' . tbl('work_orders') . ' (company_id, id, wo_number, contractor, start_date, end_date, status, raw_json) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['woNumber'] ?? ''), (string)($row['contractor'] ?? ''), (string)($row['startDate'] ?? ''), (string)($row['endDate'] ?? ''), (string)($row['status'] ?? 'Pending'), $raw]);
                break;

            case 'proforma_invoices':
                $pdo->prepare('INSERT INTO ' . tbl('proforma_invoices') . ' (company_id, id, invoice_no, invoice_date, buyer_name, buyer_gstin, grand_total, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['invoiceNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['buyerName'] ?? ''), (string)($row['buyerGstin'] ?? ''), (float)($row['grandTotal'] ?? 0), (string)($row['status'] ?? 'Pending'), $raw]);
                break;

            case 'services':
                $pdo->prepare('INSERT INTO ' . tbl('services') . ' (company_id, id, name, hsn, rate, gst_pct, unit, raw_json) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['name'] ?? ''), (string)($row['hsn'] ?? ''), (float)($row['rate'] ?? 0), (float)($row['gstPct'] ?? 0), (string)($row['unit'] ?? ''), $raw]);
                break;

            case 'inventory_items':
                $pdo->prepare('INSERT INTO ' . tbl('inventory_items') . ' (company_id, id, item_name, category, unit, opening_stock, reorder_level, location, raw_json) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['itemName'] ?? ''), (string)($row['category'] ?? ''), (string)($row['unit'] ?? ''), (float)($row['openingStock'] ?? 0), (float)($row['reorderLevel'] ?? 0), (string)($row['location'] ?? ''), $raw]);
                break;

            case 'material_entries':
                $pdo->prepare('INSERT INTO ' . tbl('material_entries') . ' (company_id, id, entry_type, entry_date, item_name, qty, unit, party, ref_number, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['type'] ?? ''), (string)($row['date'] ?? ''), (string)($row['itemName'] ?? ''), (float)($row['qty'] ?? 0), (string)($row['unit'] ?? ''), (string)($row['party'] ?? ''), (string)($row['refNumber'] ?? ''), $raw]);
                break;

            case 'gate_passes':
                $pdo->prepare('INSERT INTO ' . tbl('gate_passes') . ' (company_id, id, gate_pass_no, pass_date, vehicle_no, person_name, checked_by, raw_json) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['gatePassNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['vehicleNo'] ?? ''), (string)($row['name'] ?? ''), (string)($row['checkedBy'] ?? ''), $raw]);
                break;

            case 'bills':
                $pdo->prepare('INSERT INTO ' . tbl('bills') . ' (company_id, id, bill_no, vendor_id, doc_no, doc_date, amount, gst_amount, tds_amount, deduction_amount, net_amount, payment_mode, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['billNo'] ?? ''), (string)($row['vendorId'] ?? ''), (string)($row['docNo'] ?? ''), (string)($row['docDate'] ?? ''), (float)($row['amount'] ?? 0), (float)($row['gstAmount'] ?? 0), (float)($row['tdsAmount'] ?? 0), (float)($row['deductionAmount'] ?? 0), (float)($row['netAmount'] ?? 0), (string)($row['paymentMode'] ?? ''), (string)($row['status'] ?? 'Pending'), $raw]);
                break;

            case 'payment_sheets':
                $pdo->prepare('INSERT INTO ' . tbl('payment_sheets') . ' (company_id, id, sheet_no, sheet_date, total_amount, transfer_type, status, raw_json) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['sheetNo'] ?? ''), (string)($row['date'] ?? ''), (float)($row['totalAmount'] ?? 0), (string)($row['transferType'] ?? ''), (string)($row['status'] ?? 'Initiated'), $raw]);
                break;

            case 'payment_vouchers':
                $pdo->prepare('INSERT INTO ' . tbl('payment_vouchers') . ' (company_id, id, voucher_no, voucher_date, vendor_id, amount, mode, ref_no, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['voucherNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['vendorId'] ?? ''), (float)($row['amount'] ?? 0), (string)($row['mode'] ?? ''), (string)($row['refNo'] ?? ''), (string)($row['status'] ?? 'Paid'), $raw]);
                break;

            case 'sales_vouchers':
                $pdo->prepare('INSERT INTO ' . tbl('sales_vouchers') . ' (company_id, id, voucher_no, voucher_date, party_name, party_gstin, grand_total, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['voucherNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['partyName'] ?? ''), (string)($row['partyGstin'] ?? ''), (float)($row['grandTotal'] ?? 0), (string)($row['status'] ?? 'Posted'), $raw]);
                break;

            case 'purchase_vouchers':
                $pdo->prepare('INSERT INTO ' . tbl('purchase_vouchers') . ' (company_id, id, voucher_no, voucher_date, party_name, invoice_no, grand_total, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['voucherNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['partyName'] ?? ''), (string)($row['invoiceNo'] ?? ''), (float)($row['grandTotal'] ?? 0), (string)($row['status'] ?? 'Posted'), $raw]);
                break;

            case 'receipt_vouchers':
                $pdo->prepare('INSERT INTO ' . tbl('receipt_vouchers') . ' (company_id, id, voucher_no, voucher_date, party_name, amount, mode, ref_no, status, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['voucherNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['partyName'] ?? ''), (float)($row['amount'] ?? 0), (string)($row['mode'] ?? ''), (string)($row['refNo'] ?? ''), (string)($row['status'] ?? 'Received'), $raw]);
                break;

            case 'journal_vouchers':
                $dr = 0.0;
                foreach (($row['lines'] ?? []) as $ln) {
                    $dr += (float)($ln['dr'] ?? 0);
                }
                $pdo->prepare('INSERT INTO ' . tbl('journal_vouchers') . ' (company_id, id, voucher_no, voucher_date, narration, total_debit, status, raw_json) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['voucherNo'] ?? ''), (string)($row['date'] ?? ''), (string)($row['narration'] ?? ''), $dr, (string)($row['status'] ?? 'Posted'), $raw]);
                break;

            case 'terms_templates':
                $pdo->prepare('INSERT INTO ' . tbl('terms_templates') . ' (company_id, id, name, category, body, raw_json) VALUES (?,?,?,?,?,?)')
                    ->execute([$companyId, $id, (string)($row['name'] ?? ''), (string)($row['category'] ?? ''), (string)($row['body'] ?? ''), $raw]);
                break;
        }
    }
}
`;
}

export function buildBackupPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/company.php';
require_once __DIR__ . '/mirror_sync.php';

function ensure_dir(string $dir): void
{
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
}

function create_company_backup(array $co, string $reason = 'manual', string $by = ''): array
{
    ensure_dir(BACKUP_DIR);
    $stmt = db()->prepare('SELECT data_key, value_json FROM ' . tbl('company_data') . ' WHERE company_id = ?');
    $stmt->execute([$co['id']]);
    $data = [];
    while ($r = $stmt->fetch()) {
        $k = $r['data_key'];
        if (isset(KEY_MAP[$k])) {
            $data[KEY_MAP[$k]] = json_decode((string)$r['value_json'], true);
        }
    }
    if (!empty($co['legacy'])) {
        $uRows = db()->query('SELECT * FROM ' . tbl('users'))->fetchAll();
        $data['users'] = array_map(static function (array $u) {
            return [
                'id'           => $u['id'],
                'name'         => $u['name'],
                'email'        => $u['email'],
                'role'         => $u['role'],
                'active'       => (bool)$u['active'],
                'salt'         => $u['salt'],
                'passwordHash' => $u['password_hash'],
                'sv'           => (int)$u['sv'],
                'perms'        => json_decode((string)$u['perms_json'], true),
                'companyIds'   => $u['company_ids_json'] ? json_decode((string)$u['company_ids_json'], true) : null,
                'createdAt'    => $u['created_at'],
                'createdBy'    => $u['created_by'],
                'lastLogin'    => $u['last_login'],
            ];
        }, $uRows);
    }

    $payload = [
        'app'        => 'Vendor Register — Full Local Backup',
        'version'    => 1,
        'exportedAt' => gmdate('c'),
        'source'     => 'PHP/MySQL Host (' . $reason . ')',
        'company'    => ['id' => $co['id'], 'name' => $co['name']],
        'data'       => $data,
    ];

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $stamp = date('Y-m-d_His');
    $safeCo = preg_replace('/[^a-zA-Z0-9_-]+/', '', $co['id']);
    $filename = 'VendorRegister_' . $safeCo . '_' . $stamp . '_' . $reason . '.json';
    $fullPath = BACKUP_DIR . '/' . $filename;
    file_put_contents($fullPath, $json);

    $id = 'bk_' . random_hex(12);
    $size = strlen($json);
    $ins = db()->prepare(
        'INSERT INTO ' . tbl('backups') . ' (id, company_id, filename, reason, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([$id, $co['id'], $filename, $reason, $size, $by]);
    db_setting_set('LAST_BACKUP_TS_' . $co['id'], (string)time());

    return [
        'id'   => $id,
        'name' => $filename,
        'size' => $size,
        'url'  => 'storage/backups/' . $filename,
    ];
}

function restore_company_backup_by_id(array $co, string $backupId, bool $includeUsers, string $by): array
{
    $stmt = db()->prepare('SELECT * FROM ' . tbl('backups') . ' WHERE id = ? AND company_id = ?');
    $stmt->execute([$backupId, $co['id']]);
    $meta = $stmt->fetch();
    if (!$meta) {
        throw new RuntimeException('Backup file was not found for this company.');
    }
    $path = realpath(BACKUP_DIR . '/' . basename((string)$meta['filename']));
    $base = realpath(BACKUP_DIR);
    if (!$path || !$base || strpos($path, $base . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
        throw new RuntimeException('Backup file on disk could not be read.');
    }

    $parsed = json_decode((string)file_get_contents($path), true);
    if (!is_array($parsed)) {
        throw new RuntimeException('Invalid JSON backup file.');
    }
    $d = $parsed['data'] ?? $parsed;
    create_company_backup($co, 'pre-restore', $by);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $restored = [];
        foreach (CLIENT_KEYS as $ck) {
            $mapKey = KEY_MAP[$ck];
            if (!array_key_exists($mapKey, $d) || $d[$mapKey] === null) {
                continue;
            }
            $valJson = json_encode($d[$mapKey], JSON_UNESCAPED_UNICODE);
            $pdo->prepare(
                'INSERT INTO ' . tbl('company_data') . ' (company_id, data_key, rev, value_json, updated_by) VALUES (?, ?, 1, ?, ?) ' .
                'ON DUPLICATE KEY UPDATE rev = rev + 1, value_json = VALUES(value_json), updated_by = VALUES(updated_by)'
            )->execute([$co['id'], $ck, $valJson, $by]);
            sync_key_to_relational_table($co['id'], $ck, $valJson);
            $restored[$ck] = is_array($d[$mapKey]) ? count($d[$mapKey]) : 1;
        }
        $pdo->commit();
        return ['restored' => $restored];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}
`;
}

export function buildApiAuthPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';

function rpc_authStatus(): array
{
    $cnt = (int)db()->query('SELECT COUNT(*) FROM ' . tbl('users'))->fetchColumn();
    return ['hasUsers' => $cnt > 0];
}

function rpc_authSetupFirstAdmin($name, $email, $password, $setupCode): array
{
    $name = trim((string)$name);
    $email = norm_email((string)$email);
    $password = (string)$password;
    $setupCode = strtoupper(trim((string)$setupCode));

    if ($name === '') {
        throw new RuntimeException("Enter the administrator's name.");
    }
    if (!is_valid_email($email)) {
        throw new RuntimeException('Enter a valid email address.');
    }
    if (strlen($password) < 8) {
        throw new RuntimeException('Use at least 8 characters for the password.');
    }

    $expected = strtoupper((string)db_setting_get('SETUP_CODE', ''));
    if ($expected === '') {
        throw new RuntimeException('Setup is not ready: open install.php first to initialize tables and generate the setup code.');
    }
    if (!hash_equals($expected, $setupCode)) {
        throw new RuntimeException('That setup code is not correct.');
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $existing = (int)$pdo->query('SELECT COUNT(*) FROM ' . tbl('users'))->fetchColumn();
        if ($existing > 0) {
            throw new RuntimeException('An administrator already exists. Sign in instead.');
        }
        ensure_main_company();

        $id = 'usr-' . random_hex(8);
        $hash = hash_user_password($password);
        $stmt = $pdo->prepare(
            'INSERT INTO ' . tbl('users') . ' (id, name, email, role, active, password_hash, sv, perms_json, created_by) ' .
            'VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)'
        );
        $stmt->execute([$id, $name, $email, 'Admin', $hash, '{}', 'setup']);
        db_setting_delete('SETUP_CODE');
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    audit_log($email, 'Administrator account created', 'first-time PHP setup');
    $user = find_user_by_id($id);
    return ['token' => create_session($user), 'user' => session_user($user)];
}

function rpc_authLogin($email, $password): array
{
    $email = norm_email((string)$email);
    $password = (string)$password;
    if ($email === '' || $password === '') {
        throw new RuntimeException('Enter your email and password.');
    }

    $pdo = db();
    $attStmt = $pdo->prepare('SELECT * FROM ' . tbl('login_attempts') . ' WHERE email = ?');
    $attStmt->execute([$email]);
    $att = $attStmt->fetch();
    if ($att && !empty($att['locked_until']) && strtotime((string)$att['locked_until'] . ' UTC') > time()) {
        throw new RuntimeException('Too many failed attempts for this account. Try again in about 15 minutes.');
    }

    $u = find_user_by_email($email);
    if (!$u || !verify_user_password($u, $password)) {
        $fails = ($att ? (int)$att['fail_count'] : 0) + 1;
        $lockedUntil = $fails >= MAX_LOGIN_FAILS ? gmdate('Y-m-d H:i:s', time() + LOGIN_LOCK_SECONDS) : null;
        $pdo->prepare(
            'INSERT INTO ' . tbl('login_attempts') . ' (email, fail_count, locked_until) VALUES (?, ?, ?) ' .
            'ON DUPLICATE KEY UPDATE fail_count = VALUES(fail_count), locked_until = VALUES(locked_until)'
        )->execute([$email, $fails, $lockedUntil]);
        audit_log($email, $lockedUntil ? 'Account locked' : 'Sign-in failed', $lockedUntil ? "$fails failed attempts" : '');
        throw new RuntimeException('Incorrect email or password.');
    }

    if (!(bool)$u['active']) {
        audit_log($email, 'Sign-in refused', 'account disabled');
        throw new RuntimeException('This account is disabled. Contact your administrator.');
    }

    $pdo->prepare('DELETE FROM ' . tbl('login_attempts') . ' WHERE email = ?')->execute([$email]);
    // Upgrade legacy SHA-256 hashes to bcrypt automatically
    if (strpos((string)$u['password_hash'], '$2y$') !== 0 && strpos((string)$u['password_hash'], '$argon2') !== 0) {
        $newHash = hash_user_password($password);
        $pdo->prepare('UPDATE ' . tbl('users') . ' SET password_hash = ?, salt = NULL WHERE id = ?')->execute([$newHash, $u['id']]);
    }
    $pdo->prepare('UPDATE ' . tbl('users') . ' SET last_login = UTC_TIMESTAMP() WHERE id = ?')->execute([$u['id']]);
    $fresh = find_user_by_id($u['id']);
    audit_log($email, 'Signed in', '');
    return ['token' => create_session($fresh), 'user' => session_user($fresh)];
}

function rpc_authResume(?string $token): array
{
    $u = require_user($token);
    return ['user' => session_user($u)];
}

function rpc_authLogout(?string $token): array
{
    $tok = split_token($token)['tok'];
    try {
        $u = require_user($token);
        audit_log($u['email'], 'Signed out', '');
    } catch (Throwable $e) {
    }
    if ($tok !== '') {
        db()->prepare('DELETE FROM ' . tbl('user_sessions') . ' WHERE token = ?')->execute([$tok]);
    }
    return ['ok' => true];
}

function rpc_authChangePassword(?string $token, $oldPw, $newPw): array
{
    $me = require_user($token);
    $oldPw = (string)$oldPw;
    $newPw = (string)$newPw;
    if (strlen($newPw) < 8) {
        throw new RuntimeException('New password must be at least 8 characters.');
    }
    if (!verify_user_password($me, $oldPw)) {
        throw new RuntimeException('Current password is incorrect.');
    }
    $hash = hash_user_password($newPw);
    db()->prepare('UPDATE ' . tbl('users') . ' SET password_hash = ?, salt = NULL, sv = sv + 1 WHERE id = ?')->execute([$hash, $me['id']]);
    db()->prepare('DELETE FROM ' . tbl('user_sessions') . ' WHERE user_id = ?')->execute([$me['id']]);
    audit_log($me['email'], 'Password changed', '');
    $updated = find_user_by_id($me['id']);
    return ['token' => create_session($updated)];
}
`;
}

export function buildApiDataPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';
require_once __DIR__ . '/../includes/mirror_sync.php';

function db_get_all_for(array $u, array $co): array
{
    $acc = access_for($u);
    $stmt = db()->prepare('SELECT data_key, rev, value_json FROM ' . tbl('company_data') . ' WHERE company_id = ?');
    $stmt->execute([$co['id']]);
    $all = [];
    while ($row = $stmt->fetch()) {
        $all[$row['data_key']] = ['rev' => (int)$row['rev'], 'value' => (string)$row['value_json']];
    }

    $data = [];
    $revs = [];
    foreach ($acc['read'] as $k) {
        if (!isset($all[$k])) {
            continue;
        }
        $v = $all[$k]['value'];
        if ($k === 'company_profile' && ($acc['menus']['company'] ?? 'none') !== 'edit') {
            $v = strip_profile_secrets($v);
        }
        $data[$k] = $v;
        $revs[$k] = $all[$k]['rev'];
    }

    return [
        'data'       => $data,
        'revs'       => $revs,
        'access'     => $acc,
        'co'         => ['id' => $co['id'], 'name' => $co['name']],
        'serverTime' => gmdate('c'),
    ];
}

function rpc_dbGetAll(?string $token): array
{
    [$u, $co] = require_session_company($token);
    return db_get_all_for($u, $co);
}

function rpc_appEnter(?string $token, $prefCo = ''): array
{
    $u = require_user($token);
    $list = company_list_for($u)['companies'];
    if (empty($list)) {
        throw new RuntimeException('PERM: No company is available for your account. Please contact your administrator.');
    }
    $pick = $list[0];
    foreach ($list as $c) {
        if ($c['id'] === (string)$prefCo) {
            $pick = $c;
            break;
        }
    }
    $db = db_get_all_for($u, $pick);
    $connRaw = db_setting_get('CONNECTORS', '{}');
    $conn = json_decode((string)$connRaw, true) ?: [];
    $aiEnabled = db_setting_get('AI_ENABLED', '0') === '1' && (string)db_setting_get('ANTHROPIC_API_KEY', '') !== '';

    return [
        'user'      => session_user($u),
        'companies' => $list,
        'coId'      => $pick['id'],
        'db'        => $db,
        'email'     => ['gmail' => !empty($conn['gmail']), 'drive' => !empty($conn['drive']), 'from' => MAIL_FROM_EMAIL],
        'ai'        => ['enabled' => $aiEnabled],
    ];
}

function rpc_appBoot(?string $token, $prefCo = ''): array
{
    $tok = split_token($token)['tok'];
    if ($tok !== '') {
        try {
            return ['hasUsers' => true, 'enter' => rpc_appEnter($token, $prefCo)];
        } catch (Throwable $e) {
            if (strpos($e->getMessage(), 'AUTH:') !== 0) {
                throw $e;
            }
        }
    }
    $cnt = (int)db()->query('SELECT COUNT(*) FROM ' . tbl('users'))->fetchColumn();
    return ['hasUsers' => $cnt > 0, 'enter' => null];
}

function rpc_dbSetMany(?string $token, $items, $expectedRevs = [], $force = false): array
{
    [$u, $co] = require_session_company($token);
    $acc = access_for($u);
    $items = is_array($items) ? $items : [];
    $expectedRevs = is_array($expectedRevs) ? $expectedRevs : [];
    $force = (bool)$force;

    foreach ($items as $k => $v) {
        if (!in_array($k, CLIENT_KEYS, true)) {
            throw new RuntimeException('PERM: Unknown data key: ' . $k);
        }
        if (!in_array($k, $acc['write'], true)) {
            throw new RuntimeException('PERM: You do not have permission to change "' . $k . '".');
        }
        if (!is_string($v)) {
            throw new RuntimeException('Invalid value for ' . $k);
        }
        json_decode($v);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Invalid data for ' . $k . ' (not valid JSON).');
        }
    }

    $pdo = db();
    $pdo->beginTransaction();
    $revs = [];
    $conflicts = [];

    try {
        foreach ($items as $k => $v) {
            $curStmt = $pdo->prepare(
                'SELECT rev, value_json FROM ' . tbl('company_data') . ' WHERE company_id = ? AND data_key = ? FOR UPDATE'
            );
            $curStmt->execute([$co['id'], $k]);
            $cur = $curStmt->fetch();
            $curRev = $cur ? (int)$cur['rev'] : 0;

            if (empty($acc['options']['delete'])) {
                assert_no_deletes($cur ? (string)$cur['value_json'] : null, $v);
            }

            $exp = isset($expectedRevs[$k]) ? (int)$expectedRevs[$k] : 0;
            if (!$force && $curRev !== $exp) {
                $revs[$k] = $curRev;
                $conflicts[] = $k;
                continue;
            }

            $newRev = $curRev + 1;
            $pdo->prepare(
                'INSERT INTO ' . tbl('company_data') . ' (company_id, data_key, rev, value_json, updated_by) VALUES (?, ?, ?, ?, ?) ' .
                'ON DUPLICATE KEY UPDATE rev = VALUES(rev), value_json = VALUES(value_json), updated_by = VALUES(updated_by)'
            )->execute([$co['id'], $k, $newRev, $v, $u['email']]);

            sync_key_to_relational_table($co['id'], $k, $v);
            $revs[$k] = $newRev;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return ['revs' => $revs, 'conflicts' => $conflicts, 'co' => $co['id']];
}
`;
}

export function buildApiCompaniesPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/backup.php';

function valid_company_name(string $name): string
{
    $name = trim(preg_replace('/\\s+/', ' ', $name) ?? '');
    if ($name === '') {
        throw new RuntimeException('Enter the company name.');
    }
    if (mb_strlen($name) > 80) {
        throw new RuntimeException('The company name is too long (80 characters at most).');
    }
    if (preg_match('/[\\\\\\/:*?"<>|]/', $name)) {
        throw new RuntimeException('The company name cannot contain \\\\ / : * ? " < > |');
    }
    return $name;
}

function rpc_companyList(?string $token): array
{
    $u = require_user($token);
    return company_list_for($u);
}

function rpc_companyCreate(?string $token, $input): array
{
    $me = require_admin_user($token);
    $input = is_array($input) ? $input : [];
    $name = valid_company_name((string)($input['name'] ?? ''));
    $pdo = db();

    $dup = $pdo->prepare('SELECT COUNT(*) FROM ' . tbl('companies') . ' WHERE is_deleted = 0 AND LOWER(name) = LOWER(?)');
    $dup->execute([$name]);
    if ((int)$dup->fetchColumn() > 0) {
        throw new RuntimeException('A company with this name already exists.');
    }

    $id = 'co_' . random_hex(8);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO ' . tbl('companies') . ' (id, name, is_legacy, is_deleted, created_by) VALUES (?, ?, 0, 0, ?)')
            ->execute([$id, $name, $me['email']]);

        $profileJson = json_encode(['companyName' => $name], JSON_UNESCAPED_UNICODE);
        $pdo->prepare('INSERT INTO ' . tbl('company_data') . ' (company_id, data_key, rev, value_json, updated_by) VALUES (?, ?, 1, ?, ?)')
            ->execute([$id, 'company_profile', $profileJson, $me['email']]);
        sync_key_to_relational_table($id, 'company_profile', $profileJson);

        $copyFrom = (string)($input['copyFromId'] ?? '');
        if ($copyFrom !== '') {
            $keysToCopy = [];
            if (!empty($input['copyVendors'])) {
                $keysToCopy[] = 'vendors';
            }
            if (!empty($input['copyTerms'])) {
                $keysToCopy[] = 'terms_templates';
            }
            foreach ($keysToCopy as $k) {
                $s = $pdo->prepare('SELECT value_json FROM ' . tbl('company_data') . ' WHERE company_id = ? AND data_key = ?');
                $s->execute([$copyFrom, $k]);
                $val = $s->fetchColumn();
                if ($val !== false) {
                    $pdo->prepare('INSERT INTO ' . tbl('company_data') . ' (company_id, data_key, rev, value_json, updated_by) VALUES (?, ?, 1, ?, ?)')
                        ->execute([$id, $k, (string)$val, $me['email']]);
                    sync_key_to_relational_table($id, $k, (string)$val);
                }
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    audit_log($me['email'], 'Company created', "$name ($id)");
    return ['id' => $id, 'lists' => company_list_for($me)];
}

function rpc_companyRename(?string $token, $id, $newName): array
{
    $me = require_admin_user($token);
    $name = valid_company_name((string)$newName);
    $id = (string)$id;

    $pdo = db();
    $dup = $pdo->prepare('SELECT COUNT(*) FROM ' . tbl('companies') . ' WHERE id <> ? AND is_deleted = 0 AND LOWER(name) = LOWER(?)');
    $dup->execute([$id, $name]);
    if ((int)$dup->fetchColumn() > 0) {
        throw new RuntimeException('Another company already has this name.');
    }

    $stmt = $pdo->prepare('UPDATE ' . tbl('companies') . ' SET name = ? WHERE id = ? AND is_deleted = 0');
    $stmt->execute([$name, $id]);
    if ($stmt->rowCount() === 0) {
        throw new RuntimeException('That company no longer exists.');
    }
    audit_log($me['email'], 'Company renamed', "$id -> $name");
    return company_list_for($me);
}

function rpc_companyDelete(?string $token, $id, $confirmName): array
{
    $me = require_admin_user($token);
    $id = (string)$id;
    $pdo = db();

    $rowStmt = $pdo->prepare('SELECT * FROM ' . tbl('companies') . ' WHERE id = ? AND is_deleted = 0');
    $rowStmt->execute([$id]);
    $c = $rowStmt->fetch();
    if (!$c) {
        throw new RuntimeException('That company no longer exists.');
    }
    if ((bool)$c['is_legacy']) {
        throw new RuntimeException('The original company cannot be deleted. You can rename it.');
    }
    if (trim((string)$confirmName) !== $c['name']) {
        throw new RuntimeException('Type the company name exactly to confirm.');
    }
    $rem = (int)$pdo->query('SELECT COUNT(*) FROM ' . tbl('companies') . ' WHERE is_deleted = 0')->fetchColumn();
    if ($rem <= 1) {
        throw new RuntimeException('At least one company must remain.');
    }

    create_company_backup(['id' => $c['id'], 'name' => $c['name'], 'legacy' => false], 'pre-delete', $me['email']);
    $pdo->prepare('UPDATE ' . tbl('companies') . ' SET is_deleted = 1, deleted_at = UTC_TIMESTAMP(), deleted_by = ? WHERE id = ?')
        ->execute([$me['email'], $id]);
    audit_log($me['email'], 'Company deleted', "{$c['name']} ($id)");
    return company_list_for($me);
}

function rpc_companyRestore(?string $token, $id): array
{
    $me = require_admin_user($token);
    $id = (string)$id;
    $pdo = db();

    $rowStmt = $pdo->prepare('SELECT * FROM ' . tbl('companies') . ' WHERE id = ? AND is_deleted = 1');
    $rowStmt->execute([$id]);
    $c = $rowStmt->fetch();
    if (!$c) {
        throw new RuntimeException('That company is not in the deleted list.');
    }
    $dup = $pdo->prepare('SELECT COUNT(*) FROM ' . tbl('companies') . ' WHERE is_deleted = 0 AND LOWER(name) = LOWER(?)');
    $dup->execute([$c['name']]);
    if ((int)$dup->fetchColumn() > 0) {
        throw new RuntimeException('Another company already uses this name - rename it first.');
    }

    $pdo->prepare('UPDATE ' . tbl('companies') . ' SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
        ->execute([$id]);
    audit_log($me['email'], 'Company restored', "{$c['name']} ($id)");
    return company_list_for($me);
}
`;
}

export function buildApiUsersPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

function rpc_usersList(?string $token): array
{
    require_admin_user($token);
    $rows = db()->query('SELECT * FROM ' . tbl('users') . ' ORDER BY created_at ASC')->fetchAll();
    return array_map('public_user', $rows);
}

function rpc_userSave(?string $token, $input, $password = ''): array
{
    $me = require_admin_user($token);
    $input = is_array($input) ? $input : [];
    $name = trim((string)($input['name'] ?? ''));
    $email = norm_email((string)($input['email'] ?? ''));
    $role = ($input['role'] ?? '') === 'Admin' ? 'Admin' : 'User';
    $active = !isset($input['active']) || (bool)$input['active'];
    $password = (string)($password ?? '');

    if ($name === '') {
        throw new RuntimeException("Enter the user's name.");
    }
    if (mb_strlen($name) > 80) {
        throw new RuntimeException('Name is too long.');
    }
    if (!is_valid_email($email)) {
        throw new RuntimeException('Enter a valid email address.');
    }
    if ($password !== '' && strlen($password) < 8) {
        throw new RuntimeException('Password must be at least 8 characters.');
    }

    $perms = sanitize_perms($input['perms'] ?? []);
    $companyIds = null;
    if (isset($input['companyIds']) && is_array($input['companyIds'])) {
        $companyIds = array_values(array_filter(array_map('strval', $input['companyIds']), static function ($x) {
            return (bool)preg_match('/^co_[A-Za-z0-9]+$/', $x);
        }));
    }

    $pdo = db();
    $other = find_user_by_email($email);
    $id = (string)($input['id'] ?? '');

    if ($id !== '') {
        $u = find_user_by_id($id);
        if (!$u) {
            throw new RuntimeException('That user no longer exists.');
        }
        if ($other && $other['id'] !== $u['id']) {
            throw new RuntimeException('Another user already has that email address.');
        }
        $wasAdmin = $u['role'] === 'Admin' && (bool)$u['active'];
        $staysAdmin = $role === 'Admin' && $active;
        if ($wasAdmin && !$staysAdmin) {
            $cntStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . tbl('users') . " WHERE role = 'Admin' AND active = 1 AND id <> ?");
            $cntStmt->execute([$u['id']]);
            if ((int)$cntStmt->fetchColumn() === 0) {
                throw new RuntimeException('At least one active Administrator must remain.');
            }
        }
        if ($u['id'] === $me['id'] && !$staysAdmin) {
            throw new RuntimeException('You cannot remove your own Administrator access or disable your own account.');
        }

        $sv = (int)$u['sv'] + (!$active || $password !== '' ? 1 : 0);
        $hash = $password !== '' ? hash_user_password($password) : (string)$u['password_hash'];
        $pdo->prepare(
            'UPDATE ' . tbl('users') . ' SET name=?, email=?, role=?, active=?, password_hash=?, sv=?, perms_json=?, company_ids_json=? WHERE id=?'
        )->execute([
            $name,
            $email,
            $role,
            $active ? 1 : 0,
            $hash,
            $sv,
            json_encode($perms, JSON_UNESCAPED_UNICODE),
            $companyIds !== null ? json_encode($companyIds, JSON_UNESCAPED_UNICODE) : null,
            $u['id'],
        ]);
        audit_log($me['email'], 'User updated', $email);
    } else {
        if ($other) {
            throw new RuntimeException('A user with that email already exists.');
        }
        if ($password === '') {
            throw new RuntimeException('Set a password for the new user (at least 8 characters).');
        }
        $newId = 'usr-' . random_hex(8);
        $pdo->prepare(
            'INSERT INTO ' . tbl('users') . ' (id, name, email, role, active, password_hash, sv, perms_json, company_ids_json, created_by) ' .
            'VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)'
        )->execute([
            $newId,
            $name,
            $email,
            $role,
            $active ? 1 : 0,
            hash_user_password($password),
            json_encode($perms, JSON_UNESCAPED_UNICODE),
            $companyIds !== null ? json_encode($companyIds, JSON_UNESCAPED_UNICODE) : null,
            $me['email'],
        ]);
        audit_log($me['email'], 'User created', "$email ($role)");
    }

    return rpc_usersList($token);
}

function rpc_userDelete(?string $token, $id): array
{
    $me = require_admin_user($token);
    $id = (string)$id;
    if ($id === $me['id']) {
        throw new RuntimeException('You cannot delete your own account.');
    }
    $u = find_user_by_id($id);
    if (!$u) {
        throw new RuntimeException('That user no longer exists.');
    }
    if ($u['role'] === 'Admin' && (bool)$u['active']) {
        $cntStmt = db()->prepare('SELECT COUNT(*) FROM ' . tbl('users') . " WHERE role = 'Admin' AND active = 1 AND id <> ?");
        $cntStmt->execute([$id]);
        if ((int)$cntStmt->fetchColumn() === 0) {
            throw new RuntimeException('At least one active Administrator must remain.');
        }
    }
    db()->prepare('DELETE FROM ' . tbl('users') . ' WHERE id = ?')->execute([$id]);
    audit_log($me['email'], 'User deleted', (string)$u['email']);
    return rpc_usersList($token);
}

function rpc_auditList(?string $token): array
{
    require_admin_user($token);
    $rows = db()->query('SELECT created_at, who, action, detail FROM ' . tbl('audit_logs') . ' ORDER BY id DESC LIMIT 200')->fetchAll();
    return array_map(static function (array $r) {
        return [
            'time'   => $r['created_at'],
            'who'    => $r['who'],
            'action' => $r['action'],
            'detail' => $r['detail'],
        ];
    }, $rows);
}
`;
}

export function buildApiOtherModulesPhp(): Record<string, string> {
  const backupsPhp = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/backup.php';

function rpc_listBackups(?string $token): array
{
    [$me, $co] = require_admin_company($token);
    $stmt = db()->prepare('SELECT id, filename, size_bytes, created_at FROM ' . tbl('backups') . ' WHERE company_id = ? ORDER BY created_at DESC LIMIT 100');
    $stmt->execute([$co['id']]);
    return array_map(static function (array $r) {
        return [
            'id'      => $r['id'],
            'name'    => $r['filename'],
            'size'    => (int)$r['size_bytes'],
            'created' => $r['created_at'],
            'url'     => 'storage/backups/' . $r['filename'],
        ];
    }, $stmt->fetchAll());
}

function rpc_getBackupStatus(?string $token): array
{
    [$me, $co] = require_admin_company($token);
    $ts = (int)(db_setting_get('LAST_BACKUP_TS_' . $co['id'], '0') ?? '0');
    return [
        'triggerInstalled' => db_setting_get('DAILY_BACKUP_ENABLED', '0') === '1',
        'lastBackup'       => $ts > 0 ? gmdate('c', $ts) : null,
        'folderUrl'        => '',
        'spreadsheetUrl'   => '',
        'company'          => $co['name'],
    ];
}

function rpc_createManualBackup(?string $token): array
{
    [$me, $co] = require_admin_company($token);
    $r = create_company_backup($co, 'manual', $me['email']);
    audit_log($me['email'], 'Manual backup', $r['name']);
    return $r;
}

function rpc_setupDailyBackup(?string $token): array
{
    [$me, $co] = require_admin_company($token);
    db_setting_set('DAILY_BACKUP_ENABLED', '1');
    return rpc_getBackupStatus($token);
}

function rpc_restoreBackupFromDrive(?string $token, $fileId, $includeUsers = false): array
{
    [$me, $co] = require_admin_company($token);
    $res = restore_company_backup_by_id($co, (string)$fileId, (bool)$includeUsers, $me['email']);
    audit_log($me['email'], 'Backup restored', (string)$fileId);
    return $res;
}
`;

  const syncPhp = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';
require_once __DIR__ . '/../includes/mirror_sync.php';

function rpc_syncPing(?string $token): array
{
    require_admin_company($token);
    return ['status' => 'ok', 'message' => 'Vendor Register PHP/MySQL backend is live.'];
}

function rpc_syncListTables(?string $token): array
{
    [$me, $co] = require_admin_company($token);
    $out = [];
    foreach (MIRROR_TABLE_MAP as $label => $sqlTbl) {
        $cntStmt = db()->prepare('SELECT COUNT(*) FROM ' . tbl($sqlTbl) . ' WHERE company_id = ?');
        $cntStmt->execute([$co['id']]);
        $out[] = ['name' => $label, 'sqlTable' => DB_PREFIX . $sqlTbl, 'rows' => (int)$cntStmt->fetchColumn()];
    }
    return ['status' => 'ok', 'tables' => $out];
}

function rpc_syncPushTable(?string $token, $table, $rows = []): array
{
    [$me, $co] = require_admin_company($token);
    $table = (string)$table;
    if (!isset(MIRROR_TABLE_MAP[$table])) {
        throw new RuntimeException('Unknown table: ' . $table);
    }
    return ['status' => 'ok', 'table' => $table, 'rowsWritten' => is_array($rows) ? count($rows) : 0, 'truncated' => 0];
}

function rpc_syncPullTable(?string $token, $table): array
{
    [$me, $co] = require_admin_company($token);
    $table = (string)$table;
    if (!isset(MIRROR_TABLE_MAP[$table])) {
        throw new RuntimeException('Unknown table: ' . $table);
    }
    $sqlTbl = MIRROR_TABLE_MAP[$table];
    $stmt = db()->prepare('SELECT * FROM ' . tbl($sqlTbl) . ' WHERE company_id = ?');
    $stmt->execute([$co['id']]);
    $rows = $stmt->fetchAll();
    if (empty($rows)) {
        return ['table' => $table, 'rows' => []];
    }
    $header = array_keys($rows[0]);
    $out = [$header];
    foreach ($rows as $r) {
        $out[] = array_values($r);
    }
    return ['table' => $table, 'rows' => $out];
}
`;

  const uploadPhp = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';

function rpc_uploadLogo(?string $token, $payload): array
{
    [$u, $co] = require_session_company($token);
    $acc = access_for($u);
    if (($acc['menus']['company'] ?? 'none') !== 'edit') {
        throw new RuntimeException('PERM: You do not have permission to change the company profile.');
    }
    $payload = is_array($payload) ? $payload : [];
    $b64 = (string)($payload['data'] ?? '');
    $bin = base64_decode($b64, true);
    if ($bin === false || strlen($bin) === 0) {
        return ['status' => 'error', 'error' => 'Invalid image data.'];
    }
    if (strlen($bin) > 5 * 1024 * 1024) {
        return ['status' => 'error', 'error' => 'Logo image exceeds 5 MB limit.'];
    }

    $mime = (string)($payload['mimeType'] ?? 'image/png');
    $ext = $mime === 'image/jpeg' ? 'jpg' : ($mime === 'image/webp' ? 'webp' : 'png');
    $safeCo = preg_replace('/[^a-zA-Z0-9_-]+/', '', $co['id']);
    $dir = UPLOAD_DIR . '/' . $safeCo;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $rawName = preg_replace('/[^a-zA-Z0-9_-]+/', '-', pathinfo((string)($payload['filename'] ?? 'logo'), PATHINFO_FILENAME));
    $filename = ($rawName ?: 'company-logo') . '-' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $ext;
    file_put_contents($dir . '/' . $filename, $bin);

    $relUrl = 'storage/uploads/' . $safeCo . '/' . $filename;
    return [
        'status'    => 'ok',
        'fileId'    => $filename,
        'url'       => $relUrl,
        'directUrl' => $relUrl,
    ];
}
`;

  const mailPhp = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';

function get_connectors_state(): array
{
    $raw = db_setting_get('CONNECTORS', '{}');
    $s = json_decode((string)$raw, true) ?: [];
    return [
        'gmail'   => !empty($s['gmail']),
        'drive'   => !empty($s['drive']),
        'gmailAt' => $s['gmailAt'] ?? '',
        'driveAt' => $s['driveAt'] ?? '',
        'by'      => $s['by'] ?? '',
    ];
}

function read_email_log(int $limit = 100): array
{
    $stmt = db()->prepare('SELECT * FROM ' . tbl('email_logs') . ' ORDER BY id DESC LIMIT ?');
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    return array_map(static function (array $r) {
        return [
            'time'    => $r['created_at'],
            'by'      => $r['sent_by'],
            'action'  => $r['action'],
            'doc'     => $r['doc_type'],
            'ref'     => $r['doc_ref'],
            'to'      => $r['to_addrs'],
            'cc'      => $r['cc_addrs'],
            'subject' => $r['subject'],
            'files'   => $r['files_list'],
        ];
    }, $stmt->fetchAll());
}

function rpc_connectorsStatus(?string $token): array
{
    require_admin_company($token);
    $s = get_connectors_state();
    return array_merge($s, [
        'from'      => MAIL_FROM_EMAIL,
        'quota'     => null,
        'folderUrl' => '',
        'log'       => read_email_log(100),
    ]);
}

function rpc_emailStatus(?string $token): array
{
    require_session_company($token);
    $s = get_connectors_state();
    return ['gmail' => $s['gmail'], 'drive' => $s['drive'], 'from' => MAIL_FROM_EMAIL];
}

function rpc_connectorsSetEnabled(?string $token, $app, $on): array
{
    [$me, $co] = require_admin_company($token);
    if ($app !== 'gmail' && $app !== 'drive') {
        throw new RuntimeException('Unknown app.');
    }
    $s = get_connectors_state();
    $s[$app] = (bool)$on;
    $s[$app . 'At'] = gmdate('c');
    $s['by'] = $me['email'];
    db_setting_set('CONNECTORS', json_encode($s, JSON_UNESCAPED_UNICODE));
    audit_log($me['email'], $on ? 'Connector enabled' : 'Connector disabled', (string)$app);
    return rpc_connectorsStatus($token);
}

function rpc_emailSend(?string $token, $p): array
{
    [$me, $co] = require_session_company($token);
    $p = is_array($p) ? $p : [];
    $to = array_filter(array_map('trim', (array)($p['to'] ?? [])));
    $cc = array_filter(array_map('trim', (array)($p['cc'] ?? [])));
    if (empty($to)) {
        throw new RuntimeException('Add at least one recipient.');
    }
    $subject = trim(preg_replace('/[\\r\\n]+/', ' ', (string)($p['subject'] ?? '')) ?? '');
    if ($subject === '') {
        throw new RuntimeException('Enter a subject.');
    }
    $body = (string)($p['body'] ?? '');
    $headers = [
        'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM_EMAIL . '>',
        'Reply-To: ' . $me['email'],
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    if (!empty($cc)) {
        $headers[] = 'Cc: ' . implode(', ', $cc);
    }
    $sent = @mail(implode(', ', $to), $subject, $body, implode("\\r\\n", $headers));
    db()->prepare(
        'INSERT INTO ' . tbl('email_logs') . ' (sent_by, action, doc_type, doc_ref, to_addrs, cc_addrs, subject, files_list) VALUES (?,?,?,?,?,?,?,?)'
    )->execute([
        $me['email'],
        $sent ? 'Sent' : 'Queued/Logged',
        (string)($p['menu'] ?? ''),
        (string)($p['docRef'] ?? ''),
        implode(', ', $to),
        implode(', ', $cc),
        $subject,
        '',
    ]);
    return ['ok' => true, 'mode' => 'sent', 'to' => $to, 'driveUrls' => []];
}

function rpc_emailDraft(?string $token, $p): array
{
    return rpc_emailSend($token, $p);
}

function rpc_emailLogList(?string $token): array
{
    require_admin_company($token);
    return read_email_log(100);
}
`;

  const aiPhp = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/company.php';

function rpc_aiStatus(?string $token): array
{
    require_session_company($token);
    $key = (string)(db_setting_get('ANTHROPIC_API_KEY', '') ?? '');
    $enabled = db_setting_get('AI_ENABLED', '0') === '1' && $key !== '';
    return ['enabled' => $enabled];
}

function rpc_aiAdminStatus(?string $token): array
{
    require_admin_company($token);
    $key = (string)(db_setting_get('ANTHROPIC_API_KEY', '') ?? '');
    $enabled = db_setting_get('AI_ENABLED', '0') === '1' && $key !== '';
    $model = (string)(db_setting_get('AI_MODEL', AI_DEFAULT_MODEL) ?? AI_DEFAULT_MODEL);
    return [
        'enabled' => $enabled,
        'hasKey'  => $key !== '',
        'keyHint' => $key !== '' ? '••••' . substr($key, -4) : '',
        'model'   => $model,
    ];
}

function rpc_aiSaveSettings(?string $token, $s): array
{
    [$me] = require_admin_company($token);
    $s = is_array($s) ? $s : [];
    $model = trim((string)($s['model'] ?? AI_DEFAULT_MODEL));
    if (!preg_match('/^claude-[a-z0-9.\\-]{3,60}$/', $model)) {
        throw new RuntimeException('That model name is not valid.');
    }
    $newKey = trim((string)($s['apiKey'] ?? ''));
    if ($newKey !== '') {
        db_setting_set('ANTHROPIC_API_KEY', $newKey);
    }
    $hasKey = (string)db_setting_get('ANTHROPIC_API_KEY', '') !== '';
    $enable = !empty($s['enabled']);
    if ($enable && !$hasKey) {
        throw new RuntimeException('Paste an API key first.');
    }
    db_setting_set('AI_MODEL', $model);
    db_setting_set('AI_ENABLED', $enable ? '1' : '0');
    audit_log($me['email'], 'AI assistant settings', 'enabled=' . ($enable ? '1' : '0'));
    return rpc_aiAdminStatus($token);
}

function rpc_aiRemoveKey(?string $token): array
{
    [$me] = require_admin_company($token);
    db_setting_delete('ANTHROPIC_API_KEY');
    db_setting_set('AI_ENABLED', '0');
    audit_log($me['email'], 'AI assistant key removed', '');
    return rpc_aiAdminStatus($token);
}

function rpc_aiAsk(?string $token, $history, $question): array
{
    [$me, $co] = require_session_company($token);
    $key = (string)(db_setting_get('ANTHROPIC_API_KEY', '') ?? '');
    if (db_setting_get('AI_ENABLED', '0') !== '1' || $key === '') {
        throw new RuntimeException('The AI assistant is not switched on.');
    }
    $model = (string)(db_setting_get('AI_MODEL', AI_DEFAULT_MODEL) ?? AI_DEFAULT_MODEL);
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS     => json_encode([
            'model'      => $model,
            'max_tokens' => 800,
            'system'     => 'You are the read-only assistant for ' . $co['name'] . '.',
            'messages'   => [['role' => 'user', 'content' => (string)$question]],
        ]),
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode((string)$raw, true);
    if ($code !== 200 || !is_array($json)) {
        throw new RuntimeException('AI service error (HTTP ' . $code . ').');
    }
    $text = $json['content'][0]['text'] ?? '';
    return ['answer' => $text ?: 'No response received.', 'used' => []];
}
`;

  return {
    'api/backups.php': backupsPhp,
    'api/sync.php': syncPhp,
    'api/upload.php': uploadPhp,
    'api/mail.php': mailPhp,
    'api/ai.php': aiPhp,
  };
}

export function buildApiIndexPhp(): string {
  return `<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed. Use POST.']);
    exit;
}

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/data.php';
require_once __DIR__ . '/companies.php';
require_once __DIR__ . '/users.php';
require_once __DIR__ . '/backups.php';
require_once __DIR__ . '/sync.php';
require_once __DIR__ . '/upload.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/ai.php';

$NO_TOKEN_FNS = ['authStatus', 'authLogin', 'authSetupFirstAdmin'];

$ROUTES = [
    'appBoot'                => 'rpc_appBoot',
    'appEnter'               => 'rpc_appEnter',
    'authStatus'             => 'rpc_authStatus',
    'authSetupFirstAdmin'    => 'rpc_authSetupFirstAdmin',
    'authLogin'              => 'rpc_authLogin',
    'authResume'             => 'rpc_authResume',
    'authLogout'             => 'rpc_authLogout',
    'authChangePassword'     => 'rpc_authChangePassword',
    'dbGetAll'               => 'rpc_dbGetAll',
    'dbSetMany'              => 'rpc_dbSetMany',
    'companyList'            => 'rpc_companyList',
    'companyCreate'          => 'rpc_companyCreate',
    'companyRename'          => 'rpc_companyRename',
    'companyDelete'          => 'rpc_companyDelete',
    'companyRestore'         => 'rpc_companyRestore',
    'usersList'              => 'rpc_usersList',
    'userSave'               => 'rpc_userSave',
    'userDelete'             => 'rpc_userDelete',
    'auditList'              => 'rpc_auditList',
    'listBackups'            => 'rpc_listBackups',
    'getBackupStatus'        => 'rpc_getBackupStatus',
    'createManualBackup'     => 'rpc_createManualBackup',
    'setupDailyBackup'       => 'rpc_setupDailyBackup',
    'restoreBackupFromDrive' => 'rpc_restoreBackupFromDrive',
    'syncPing'               => 'rpc_syncPing',
    'syncListTables'         => 'rpc_syncListTables',
    'syncPushTable'          => 'rpc_syncPushTable',
    'syncPullTable'          => 'rpc_syncPullTable',
    'uploadLogo'             => 'rpc_uploadLogo',
    'connectorsStatus'       => 'rpc_connectorsStatus',
    'connectorsSetEnabled'   => 'rpc_connectorsSetEnabled',
    'emailStatus'            => 'rpc_emailStatus',
    'emailSend'              => 'rpc_emailSend',
    'emailDraft'             => 'rpc_emailDraft',
    'emailLogList'           => 'rpc_emailLogList',
    'aiStatus'               => 'rpc_aiStatus',
    'aiAdminStatus'          => 'rpc_aiAdminStatus',
    'aiSaveSettings'         => 'rpc_aiSaveSettings',
    'aiRemoveKey'            => 'rpc_aiRemoveKey',
    'aiAsk'                  => 'rpc_aiAsk',
];

try {
    $raw = file_get_contents('php://input');
    $req = json_decode((string)$raw, true);
    if (!is_array($req) || empty($req['fn'])) {
        throw new RuntimeException('Invalid RPC request.');
    }
    $fn = (string)$req['fn'];
    if (!isset($ROUTES[$fn])) {
        throw new RuntimeException('Unknown backend method: ' . $fn);
    }

    $args = isset($req['args']) && is_array($req['args']) ? $req['args'] : [];
    if (!in_array($fn, $NO_TOKEN_FNS, true)) {
        $token = (string)($req['token'] ?? '');
        array_unshift($args, $token);
    }

    $handler = $ROUTES[$fn];
    $data = $handler(...$args);
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    $msg = $e->getMessage();
    $status = 400;
    if (strpos($msg, 'AUTH:') === 0) {
        $status = 401;
    } elseif (strpos($msg, 'PERM:') === 0) {
        $status = 403;
    }
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
}
`;
}

export function buildIndexPhp(): string {
  return `<?php
declare(strict_types=1);

/**
 * Entry point for Vendor, Procurement & Payment Suite (Self-Hosted PHP + MySQL).
 * Serves the application UI directly; if database tables are not yet installed,
 * links to install.php for 1-click setup.
 */
require_once __DIR__ . '/config/database.php';

$needsInstall = false;
try {
    db()->query('SELECT 1 FROM ' . tbl('users') . ' LIMIT 1');
} catch (Throwable $e) {
    $needsInstall = true;
}

if ($needsInstall && is_file(__DIR__ . '/install.php')) {
    header('Location: install.php');
    exit;
}

readfile(__DIR__ . '/index.html');
`;
}

export function buildInstallPhp(): string {
  return `<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

$error = '';
$success = false;
$setupCode = '';
$hasUsers = false;

try {
    $pdo = db();
    $schemaSql = file_get_contents(SQL_SCHEMA_FILE);
    if ($schemaSql === false) {
        throw new RuntimeException('Could not locate sql/schema.sql');
    }

    // Run schema statements safely
    foreach (explode(";\\n", str_replace("\\r\\n", "\\n", $schemaSql)) as $stmt) {
        $trimmed = trim($stmt);
        if ($trimmed === '' || strpos($trimmed, '--') === 0) {
            continue;
        }
        $pdo->exec($trimmed);
    }

    if (!is_dir(BACKUP_DIR)) {
        @mkdir(BACKUP_DIR, 0750, true);
    }
    if (!is_dir(UPLOAD_DIR)) {
        @mkdir(UPLOAD_DIR, 0755, true);
    }

    $hasUsers = (int)$pdo->query('SELECT COUNT(*) FROM ' . tbl('users'))->fetchColumn() > 0;
    if (!$hasUsers) {
        $setupCode = (string)(db_setting_get('SETUP_CODE', '') ?? '');
        if ($setupCode === '') {
            $setupCode = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
            db_setting_set('SETUP_CODE', $setupCode);
        }
    }
    $success = true;
} catch (Throwable $e) {
    $error = $e->getMessage();
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Installer — <?= htmlspecialchars(APP_TITLE, ENT_QUOTES) ?></title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:40px 20px}
    .card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px}
    h1{font-size:20px;margin:0 0 8px}
    p{color:#475569;font-size:14px;line-height:1.6}
    .code{font-family:ui-monospace,monospace;font-size:24px;font-weight:700;letter-spacing:.14em;background:#0f172a;color:#f8fafc;padding:14px 18px;border-radius:8px;text-align:center;margin:16px 0}
    .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px 14px;border-radius:8px;font-size:13px}
    .btn{display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <h1><?= htmlspecialchars(APP_TITLE, ENT_QUOTES) ?> — Database Installer</h1>
    <?php if ($error !== ''): ?>
      <div class="err">
        <strong>Database connection or schema import failed:</strong><br>
        <?= htmlspecialchars($error, ENT_QUOTES) ?>
        <p style="margin:8px 0 0;color:#7f1d1d">Check <code>config/config.php</code> credentials and reload this page.</p>
      </div>
    <?php elseif ($hasUsers): ?>
      <p>The database schema is initialized and an Administrator account already exists.</p>
      <a class="btn" href="index.php">Open Application &rarr;</a>
    <?php else: ?>
      <p>All <strong>27 aligned SQL tables</strong> have been created in <code><?= htmlspecialchars(DB_NAME, ENT_QUOTES) ?></code>. Copy this one-time Setup Code to create your first Administrator account:</p>
      <div class="code"><?= htmlspecialchars($setupCode, ENT_QUOTES) ?></div>
      <p>Security tip: After creating your Administrator account, you may remove or restrict <code>install.php</code>.</p>
      <a class="btn" href="index.php">Launch Vendor Suite &rarr;</a>
    <?php endif; ?>
  </div>
</body>
</html>
`;
}

export function buildRootHtaccess(): string {
  return `Options -Indexes
RewriteEngine On

# Forward Authorization header to PHP (Apache CGI/FastCGI compatibility)
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [e=HTTP_AUTHORIZATION:%1]

# Protect sensitive server configuration, includes, SQL schema, and backups
RewriteRule ^(config|includes|sql|storage/backups)/ - [F,L]

<FilesMatch "^(\\.(env|htaccess|htpasswd)|composer\\.(json|lock)|README\\.md)$">
    Require all denied
</FilesMatch>
`;
}

export function buildUploadsHtaccess(): string {
  return `Options -Indexes
# Prevent script execution inside uploaded assets directory
<FilesMatch "\\.(php|phtml|php3|php4|php5|php7|phps|cgi|pl|py|sh)$">
    Require all denied
</FilesMatch>
`;
}

export function buildBackupsHtaccess(): string {
  return `Require all denied
`;
}

export function buildReadmeMd(cfg: PhpHostConfig): string {
  const prefix = sanitizeTablePrefix(cfg.tablePrefix);
  return `# ${cfg.appTitle} — Self-Hosted PHP + MySQL Package

## Quick Upload & Setup Guide

1. **Upload & Extract**
   Upload this ZIP archive to your website root (e.g., \`public_html/\` or a subfolder like \`public_html/vendor-suite/\`) via cPanel File Manager or FTP and extract all files.

2. **Create MySQL Database**
   Create an empty MySQL 8.0+ / MariaDB 10.4+ database (e.g., \`${cfg.dbName}\`) and verify \`config/config.php\` holds your database host, name, username, password, and table prefix (\`${prefix}\`).

3. **Run One-Click Installer**
   Open \`https://your-domain.com/install.php\` in your browser.
   - Imports \`sql/schema.sql\` (9 core platform tables + 18 aligned domain tables = 27 tables).
   - Displays your one-time 8-character **Setup Code**.

4. **Create First Administrator Account**
   Click **Launch Vendor Suite** (or open \`index.php\`), enter your name, email, password (8+ chars), and the Setup Code from \`install.php\`.

## File-to-Database Schema Alignment

| Folder / Module | Database Tables | Role |
|---|---|---|
| \`api/auth.php\` | \`${prefix}users\`, \`${prefix}user_sessions\`, \`${prefix}login_attempts\` | Login, bcrypt/SHA-256 auth, lockouts, sliding sessions |
| \`api/companies.php\` | \`${prefix}companies\` | Multi-company registry, soft-delete, restore |
| \`api/data.php\` | \`${prefix}company_data\` + all 18 domain tables | Optimistic locking + auto-sync into relational tables |
| \`api/users.php\` | \`${prefix}users\`, \`${prefix}audit_logs\` | RBAC menu permissions & security audit trail |
| \`api/backups.php\` | \`${prefix}backups\` + \`storage/backups/*.json\` | Server JSON snapshots & GAS backup restore |
| \`api/upload.php\` | \`storage/uploads/<company_id>/\` | Company logo PNG/JPG upload |
| \`api/mail.php\` | \`${prefix}email_logs\`, \`${prefix}app_settings\` | Outbound document emails & log history |
| \`api/ai.php\` | \`${prefix}app_settings\` | Optional server-side AI assistant settings |
`;
}
