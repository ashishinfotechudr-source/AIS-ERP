import React from 'react';
import { Database, Download, FolderTree, Package, Play } from 'lucide-react';
import { FileExplorerView } from './components/FileExplorerView';
import { LivePreviewView } from './components/LivePreviewView';
import { PackageBuilderView } from './components/PackageBuilderView';
import { SchemaAlignmentView } from './components/SchemaAlignmentView';
import type { PackageFileEntry } from './utils/phpPackageBuilder';
import {
  buildConfigPhp,
  DEFAULT_PHP_HOST_CONFIG,
  type PhpHostConfig,
} from './utils/phpTemplates';
import type { AlignedTableSpec } from './utils/schemaDefinition';

type TabId = 'export' | 'files' | 'schema' | 'preview';

interface InspectedFile extends PackageFileEntry {
  sizeBytes: number;
}

export default function App() {
  const [tab, setTab] = React.useState<TabId>('export');
  const [config, setConfig] = React.useState<PhpHostConfig>(DEFAULT_PHP_HOST_CONFIG);
  const [files, setFiles] = React.useState<InspectedFile[]>([]);
  const [tables, setTables] = React.useState<AlignedTableSpec[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch('/api/package/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const json = await resp.json();
        if (!active) return;
        if (json.ok) {
          setFiles(json.files || []);
          setTables(json.tables || []);
          setError('');
        } else {
          setError(json.error || 'Failed to inspect package');
        }
      } catch (err: any) {
        if (active) setError(err?.message || 'Network error');
      } finally {
        if (active) setLoading(false);
      }
    }, 140);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [config]);

  const handleDownloadZip = async () => {
    setDownloading(true);
    setError('');
    try {
      const resp = await fetch('/api/package/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!resp.ok) {
        throw new Error('Could not generate ZIP archive');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vendor-suite-php-package.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to download ZIP');
    } finally {
      setDownloading(false);
    }
  };

  const totalBytes = React.useMemo(
    () => files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0),
    [files]
  );

  const schemaSql = React.useMemo(
    () => files.find((f) => f.path === 'sql/schema.sql')?.content || '',
    [files]
  );

  const configPhpPreview = React.useMemo(() => buildConfigPhp(config), [config]);

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'export', label: 'Package & Export', icon: <Package className="w-4 h-4" /> },
    { id: 'files', label: 'File Structure', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'schema', label: 'Database Schema', icon: <Database className="w-4 h-4" /> },
    { id: 'preview', label: 'Live App Preview', icon: <Play className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 bg-white sticky top-0 h-screen shrink-0">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-sm font-bold tracking-tight text-slate-900">
            Vendor Suite Host Builder
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            PHP 8 + HTML + Aligned MySQL
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="flex justify-between">
            <span>Package files</span>
            <span className="font-mono tabular-nums text-slate-700">{files.length}</span>
          </div>
          <div className="flex justify-between">
            <span>SQL tables</span>
            <span className="font-mono tabular-nums text-slate-700">{tables.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Prefix</span>
            <span className="font-mono text-slate-700">{config.tablePrefix || 'vs_'}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-500 truncate">Vendor Suite</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 truncate">
              {navItems.find((n) => n.id === tab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Live Preview
            </button>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Preparing ZIP…' : 'Download .zip'}
            </button>
          </div>
        </header>

        <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex gap-1.5 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="h-96 bg-white border border-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {tab === 'export' && (
                <PackageBuilderView
                  config={config}
                  onChange={setConfig}
                  onDownloadZip={handleDownloadZip}
                  downloading={downloading}
                  fileCount={files.length}
                  tableCount={tables.length}
                  totalBytes={totalBytes}
                  configPhpPreview={configPhpPreview}
                />
              )}
              {tab === 'files' && <FileExplorerView files={files} />}
              {tab === 'schema' && (
                <SchemaAlignmentView
                  tables={tables}
                  tablePrefix={config.tablePrefix}
                  schemaSql={schemaSql}
                />
              )}
              {tab === 'preview' && <LivePreviewView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
