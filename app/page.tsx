'use client';

import { useState, useEffect, useCallback } from 'react';
import TokenInput from '@/components/TokenInput';
import TokenCard from '@/components/TokenCard';
import ProgressBar from '@/components/ProgressBar';
import ResultsTable from '@/components/ResultsTable';

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
}

interface WalletOverlap {
  wallet: string;
  tokens: { mint: string; symbol: string; balance: number }[];
  count: number;
}

interface ScanResult {
  wallets: WalletOverlap[];
  tokensScanned: number;
  totalHolders: number;
  tokenInfos: TokenInfo[];
}

const LS_KEY = 'holder-scanner-recent';

export default function Home() {
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokenMetas, setTokenMetas] = useState<Map<string, TokenInfo>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[][]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setRecentScans(JSON.parse(stored));
    } catch {}
  }, []);

  const saveRecentScan = (tokens: string[]) => {
    const updated = [tokens, ...recentScans.filter(
      (s) => JSON.stringify(s) !== JSON.stringify(tokens)
    )].slice(0, 5);
    setRecentScans(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const fetchTokenMeta = useCallback(async (mint: string) => {
    if (tokenMetas.has(mint)) return;
    try {
      const res = await fetch(`/api/token-info?mint=${mint}`);
      if (res.ok) {
        const data = await res.json();
        setTokenMetas((prev) => new Map(prev).set(mint, { ...data, mint }));
      }
    } catch {}
  }, [tokenMetas]);

  useEffect(() => {
    for (const mint of tokens) {
      fetchTokenMeta(mint);
    }
  }, [tokens, fetchTokenMeta]);

  const handleAdd = (mint: string) => {
    const normalized = mint.trim();
    if (!normalized || tokens.includes(normalized)) return;
    setTokens((prev) => [...prev, normalized]);
  };

  const handleRemove = (index: number) => {
    setTokens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => setTokens([]);

  const handleScan = async () => {
    if (tokens.length < 2) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setProgress({ current: 1, total: tokens.length });

    try {
      const res = await fetch('/api/holders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      setProgress({ current: tokens.length, total: tokens.length });

      const data = await res.json();
      setResult(data);
      saveRecentScan(tokens);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setScanning(false);
    }
  };

  const handleExport = async () => {
    if (!result || result.wallets.length === 0) return;
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallets: result.wallets,
          tokens: result.tokenInfos,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'holder-overlap.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Export failed: ' + e.message);
    }
  };

  const handleRecentscan = (mints: string[]) => {
    setTokens(mints);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Solana Holder Overlap Scanner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Find wallets that hold multiple tokens — enter 2+ mint addresses
          </p>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 mb-6 space-y-4">
          <TokenInput
            tokens={tokens}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onClear={handleClear}
          />

          {tokens.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tokens.map((mint, i) => {
                const meta = tokenMetas.get(mint);
                return (
                  <TokenCard
                    key={`${mint}-${i}`}
                    symbol={meta?.symbol ?? mint.slice(0, 4)}
                    name={meta?.name ?? mint.slice(0, 8) + '...'}
                    index={i}
                  />
                );
              })}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || tokens.length < 2}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
          >
            {scanning
              ? 'Scanning...'
              : tokens.length < 2
              ? `Add ${2 - tokens.length} more token${tokens.length === 1 ? '' : 's'} to scan`
              : 'Find Overlapping Wallets'}
          </button>

          {scanning && (
            <ProgressBar
              current={progress.current}
              total={progress.total}
              status="Fetching holder data..."
            />
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && !scanning && (
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Scanned {result.tokensScanned} tokens</span>
              <span className="text-gray-600">|</span>
              <span>{result.totalHolders.toLocaleString()} total unique holders</span>
              <span className="text-gray-600">|</span>
              <span className="text-blue-400">{result.wallets.length} overlapping wallets</span>
            </div>
          )}
        </div>

        {recentScans.length > 0 && !result && !scanning && (
          <div className="mb-6">
            <h3 className="text-sm text-gray-500 mb-2">Recent scans</h3>
            <div className="flex flex-wrap gap-2">
              {recentScans.map((scan, i) => (
                <button
                  key={i}
                  onClick={() => handleRecentscan(scan)}
                  className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors font-mono"
                >
                  {scan.map((m) => m.slice(0, 4)).join(', ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && !scanning && result.wallets.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <ResultsTable
              wallets={result.wallets}
              tokenInfos={result.tokenInfos}
              onExport={handleExport}
            />
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-600">
          Data from Helius
        </div>
      </div>
    </main>
  );
}