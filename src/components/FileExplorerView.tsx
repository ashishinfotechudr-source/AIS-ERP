import React from 'react';
import { Check, Copy, Download, FileCode2, Folder, Search } from 'lucide-react';
import type { PackageFileEntry } from '../utils/phpPackageBuilder';

interface FileWithSize extends PackageFileEntry {
  sizeBytes: number;
}

interface FileExplorerViewProps {
  files: FileWithSize[];
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({ files }) => {
  const [selectedPath, setSelectedPath] = React.useState<string>('api/index.php');
  const [search, setSearch] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.alignedTables.some((t) => t.toLowerCase().includes(q))
    );
  }, [files, search]);

  const activeFile =
    files.find((f) => f.path === selectedPath) || filtered[0] || files[0] || null;

  const copyContent = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const downloadSingle = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const categories: Array<{ id: PackageFileEntry['category']; label: string }> = [
    { id: 'root', label: 'Root Entry & Setup' },
    { id: 'config', label: 'config/' },
    { id: 'sql', label: 'sql/' },
    { id: 'includes', label: 'includes/' },
    { id: 'api', label: 'api/' },
    { id: 'storage', label: 'storage/' },
  ];

  const displayLines = React.useMemo(() => {
    if (!activeFile) return '';
    if (activeFile.path === 'index.html' && activeFile.content.length > 40000) {
      const head = activeFile.content.slice(0, 14000);
      const bridgeIdx = activeFile.content.indexOf('const IN_GAS = true');
      const bridgeSlice =
        bridgeIdx > 0 ? activeFile.content.slice(Math.max(0, bridgeIdx - 200), bridgeIdx + 2400) : '';
      return (
        head +
        '\n\n/* ... (Full 900 KB compiled React Procurement Suite preserved verbatim in ZIP) ... */\n\n' +
        bridgeSlice
      );
    }
    return activeFile.content;
  }, [activeFile]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files or SQL tables…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100">
          {categories.map((cat) => {
            const items = filtered.filter((f) => f.category === cat.id);
            if (!items.length) return null;
            return (
              <div key={cat.id} className="py-2">
                <div className="px-3 py-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cat.label}</span>
                </div>
                {items.map((f) => {
                  const isActive = activeFile?.path === f.path;
                  return (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => setSelectedPath(f.path)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileCode2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        />
                        <span className="font-mono truncate">{f.path}</span>
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {(f.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No package files matched your filter.
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
        {activeFile ? (
          <>
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-semibold text-slate-900">
                    {activeFile.path}
                  </h3>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {(activeFile.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{activeFile.description}</p>
                {activeFile.alignedTables.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium">Aligned SQL:</span>
                    {activeFile.alignedTables.slice(0, 6).map((t) => (
                      <code
                        key={t}
                        className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono"
                      >
                        {t}
                      </code>
                    ))}
                    {activeFile.alignedTables.length > 6 && (
                      <span className="text-slate-500 font-mono">
                        +{activeFile.alignedTables.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyContent}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={downloadSingle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save File
                </button>
              </div>
            </div>

            <pre className="p-5 text-xs font-mono text-slate-800 overflow-auto max-h-[600px] leading-relaxed bg-white">
              {displayLines}
            </pre>
          </>
        ) : null}
      </div>
    </div>
  );
};
