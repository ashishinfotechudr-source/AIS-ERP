import React from 'react';
import { Check, Copy, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';

interface PreviewInfo {
  hasUsers: boolean;
  setupCode: string | null;
  companiesCount: number;
  vendorCount: number;
  poCount: number;
}

export const LivePreviewView: React.FC = () => {
  const [info, setInfo] = React.useState<PreviewInfo | null>(null);
  const [frameKey, setFrameKey] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const loadInfo = React.useCallback(async () => {
    try {
      const resp = await fetch('/api/preview/info');
      const json = await resp.json();
      if (json.ok) {
        setInfo(json);
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    loadInfo();
  }, [loadInfo, frameKey]);

  const copyCode = async () => {
    if (!info?.setupCode) return;
    try {
      await navigator.clipboard.writeText(info.setupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const resetPreview = async () => {
    setResetting(true);
    try {
      await fetch('/api/preview/reset', { method: 'POST' });
      try {
        localStorage.removeItem('vms:session_token');
        localStorage.removeItem('vms:has_users');
      } catch {
        // ignore
      }
      setFrameKey((k) => k + 1);
      await loadInfo();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Live Adapted App Preview (<code className="font-mono text-xs">/live-app</code>)
            </h2>
            {info && !info.hasUsers && info.setupCode && (
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 text-xs text-amber-900">
                <span>First-time Setup Code:</span>
                <code className="font-mono font-bold tracking-wider">{info.setupCode}</code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-medium cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Running the transformed <code className="text-slate-700">index.html</code> bridged to{' '}
            <code className="text-slate-700">api/index.php</code> endpoints without Google Apps Script.
            {info && (
              <span className="ml-2 font-mono tabular-nums text-slate-700">
                Companies: {info.companiesCount} · Vendors: {info.vendorCount} · POs: {info.poCount}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFrameKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
          <button
            type="button"
            onClick={resetPreview}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {resetting ? 'Resetting…' : 'Reset Preview DB'}
          </button>
          <a
            href="/live-app"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full Screen
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <iframe
          key={frameKey}
          src="/live-app"
          title="Vendor Procurement Suite Live Preview"
          className="w-full h-[760px] border-0 bg-white"
        />
      </div>
    </div>
  );
};
