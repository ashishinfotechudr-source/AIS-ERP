import React from 'react';
import { Check, Copy, Database, Download, Search } from 'lucide-react';
import { SCHEMA_TABLES, sanitizeTablePrefix, type AlignedTableSpec } from '../utils/schemaDefinition';

interface SchemaAlignmentViewProps {
  tables: Array<Omit<AlignedTableSpec, 'ddl'> & { ddl?: (prefix: string) => string }>;
  tablePrefix: string;
  schemaSql: string;
}

export const SchemaAlignmentView: React.FC<SchemaAlignmentViewProps> = ({
  tables,
  tablePrefix,
  schemaSql,
}) => {
  const [filterCat, setFilterCat] = React.useState<'all' | 'platform' | 'domain'>('all');
  const [query, setQuery] = React.useState('');
  const [selectedTable, setSelectedTable] = React.useState<string>('vendors');
  const [showRawSql, setShowRawSql] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const prefix = sanitizeTablePrefix(tablePrefix);

  const filteredTables = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tables.filter((t) => {
      if (filterCat !== 'all' && t.category !== filterCat) return false;
      if (!q) return true;
      return (
        t.tableName.toLowerCase().includes(q) ||
        t.phpModule.toLowerCase().includes(q) ||
        (t.clientKey || '').toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [tables, filterCat, query]);

  const activeSpec =
    tables.find((t) => t.tableName === selectedTable) || filteredTables[0] || tables[0];

  const activeDdl = React.useMemo(() => {
    if (!activeSpec) return '';
    if (typeof activeSpec.ddl === 'function') {
      return activeSpec.ddl(prefix);
    }
    const spec = SCHEMA_TABLES.find((s) => s.tableName === activeSpec.tableName);
    return spec ? spec.ddl(prefix) : '';
  }, [activeSpec, prefix]);

  const platformCount = React.useMemo(
    () => tables.filter((t) => t.category === 'platform').length,
    [tables]
  );
  const domainCount = React.useMemo(
    () => tables.filter((t) => t.category === 'domain').length,
    [tables]
  );

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const downloadSql = () => {
    const blob = new Blob([schemaSql], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-slate-300 rounded-md overflow-hidden text-xs font-medium">
            {(['all', 'platform', 'domain'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 capitalize cursor-pointer ${
                  filterCat === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat === 'all'
                  ? `All (${tables.length})`
                  : cat === 'platform'
                    ? `Core Platform (${platformCount})`
                    : `Domain Entities (${domainCount})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search table, key, or PHP file…"
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md w-64 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRawSql((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            {showRawSql ? 'Show Table Matrix' : 'View Full schema.sql'}
          </button>
          <button
            type="button"
            onClick={copySql}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied SQL' : 'Copy SQL'}
          </button>
          <button
            type="button"
            onClick={downloadSql}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            schema.sql
          </button>
        </div>
      </div>

      {showRawSql ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-mono text-slate-700">
            sql/schema.sql (Prefix: {prefix})
          </div>
          <pre className="p-5 text-xs font-mono text-slate-800 overflow-auto max-h-[620px] leading-relaxed">
            {schemaSql}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">SQL Table</th>
                    <th className="py-2.5 px-3">Client Key</th>
                    <th className="py-2.5 px-3">Aligned PHP File</th>
                    <th className="py-2.5 px-3 text-right">Cols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTables.map((t) => {
                    const active = activeSpec?.tableName === t.tableName;
                    return (
                      <tr
                        key={t.tableName}
                        onClick={() => setSelectedTable(t.tableName)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-medium whitespace-nowrap">
                          {prefix}
                          {t.tableName}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-mono whitespace-nowrap ${
                            active ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {t.clientKey || '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-mono ${
                            active ? 'text-slate-200' : 'text-slate-600'
                          }`}
                        >
                          {t.phpModule}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                            active ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {t.columns.length}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                        No SQL tables matched your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
            {activeSpec && (
              <>
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-mono text-sm font-semibold text-slate-900">
                      {prefix}
                      {activeSpec.tableName}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                      {activeSpec.category === 'platform' ? 'Core Table' : 'Relational Mirror'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">{activeSpec.description}</p>
                  <div className="mt-2 text-[11px] font-mono text-slate-500">
                    Module: {activeSpec.phpModule}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 px-3">Column</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3 text-right">Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeSpec.columns.map((c) => (
                        <tr key={c.name}>
                          <td className="py-2 px-3 font-mono text-slate-900">{c.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{c.type}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {c.key ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 border border-slate-200 rounded">
                                {c.key}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    DDL Statement
                  </div>
                  <pre className="text-[11px] font-mono text-slate-800 overflow-x-auto max-h-48 leading-relaxed bg-white p-3 border border-slate-200 rounded">
                    {activeDdl}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
