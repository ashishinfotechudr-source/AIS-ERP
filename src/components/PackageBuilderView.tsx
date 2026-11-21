import React from 'react';
import { Check, Copy, Download, Server, ShieldCheck } from 'lucide-react';
import type { PhpHostConfig } from '../utils/phpTemplates';

interface PackageBuilderViewProps {
  config: PhpHostConfig;
  onChange: (next: PhpHostConfig) => void;
  onDownloadZip: () => void;
  downloading: boolean;
  fileCount: number;
  tableCount: number;
  totalBytes: number;
  configPhpPreview: string;
}

export const PackageBuilderView: React.FC<PackageBuilderViewProps> = ({
  config,
  onChange,
  onDownloadZip,
  downloading,
  fileCount,
  tableCount,
  totalBytes,
  configPhpPreview,
}) => {
  const [copied, setCopied] = React.useState(false);

  const update = <K extends keyof PhpHostConfig>(key: K, val: PhpHostConfig[K]) => {
    onChange({ ...config, [key]: val });
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configPhpPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Package Files
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {fileCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">PHP, HTML, SQL, .htaccess</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Aligned SQL Tables
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {tableCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">9 platform + 18 domain tables</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Adapted Bundle Size
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {(totalBytes / 1024).toFixed(0)} KB
          </div>
          <div className="mt-1 text-xs text-slate-500">Uncompressed source</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Runtime Target
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900">
            PHP 8+ / MySQL
          </div>
          <div className="mt-1 text-xs text-slate-500">Zero Google Apps Script deps</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Website Host &amp; Database Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Baked directly into <code className="text-slate-700">config/config.php</code> and{' '}
                <code className="text-slate-700">sql/schema.sql</code> inside your ZIP archive.
              </p>
            </div>
            <Server className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Application Title
              </label>
              <input
                type="text"
                value={config.appTitle}
                onChange={(e) => update('appTitle', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="Vendor, Procurement & Payment Suite"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Database Host
              </label>
              <input
                type="text"
                value={config.dbHost}
                onChange={(e) => update('dbHost', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="localhost"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Database Port
              </label>
              <input
                type="text"
                value={config.dbPort}
                onChange={(e) => update('dbPort', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="3306"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                MySQL Database Name
              </label>
              <input
                type="text"
                value={config.dbName}
                onChange={(e) => update('dbName', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="vendor_suite_db"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                SQL Table Prefix
              </label>
              <input
                type="text"
                value={config.tablePrefix}
                onChange={(e) => update('tablePrefix', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="vs_"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Database Username
              </label>
              <input
                type="text"
                value={config.dbUser}
                onChange={(e) => update('dbUser', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="db_user"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Database Password
              </label>
              <input
                type="password"
                value={config.dbPass}
                onChange={(e) => update('dbPass', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                placeholder="Leave blank to fill after upload"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Session TTL (seconds)
              </label>
              <input
                type="number"
                min={600}
                value={config.sessionTtl}
                onChange={(e) => update('sessionTtl', Number(e.target.value) || 21600)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Max Upload Limit (MB)
              </label>
              <input
                type="number"
                min={2}
                max={50}
                value={config.maxUploadMb}
                onChange={(e) => update('maxUploadMb', Number(e.target.value) || 18)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>PDO prepared statements &amp; bcrypt password hashing included</span>
            </div>
            <button
              type="button"
              onClick={onDownloadZip}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Building ZIP…' : 'Download Website ZIP'}
            </button>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              Upload &amp; Integration Steps
            </h2>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded w-6 h-6 flex items-center justify-center shrink-0">
                  1
                </span>
                <span>
                  Download <strong className="text-slate-900">vendor-suite-php-package.zip</strong> and upload it to your website directory (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">public_html/</code>) via cPanel or FTP, then extract.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded w-6 h-6 flex items-center justify-center shrink-0">
                  2
                </span>
                <span>
                  Create your MySQL database (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{config.dbName || 'vendor_suite_db'}</code>) and verify credentials in <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">config/config.php</code>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded w-6 h-6 flex items-center justify-center shrink-0">
                  3
                </span>
                <span>
                  Open <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/install.php</code> in your browser. It creates all <strong className="text-slate-900 tabular-nums">{tableCount}</strong> aligned tables from <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">sql/schema.sql</code> and displays your 8-character Setup Code.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded w-6 h-6 flex items-center justify-center shrink-0">
                  4
                </span>
                <span>
                  Launch <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">index.php</code>, enter your Setup Code to register the first Administrator account, and optionally delete <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">install.php</code>.
                </span>
              </li>
            </ol>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <span className="text-xs font-mono font-medium text-slate-700">
                config/config.php
              </span>
              <button
                type="button"
                onClick={copyConfig}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-800 overflow-x-auto max-h-64 leading-relaxed bg-white">
              {configPhpPreview}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
