'use client';

import { useState, useMemo } from 'react';

interface WalletOverlap {
  wallet: string;
  tokens: { mint: string; symbol: string; balance: number }[];
  count: number;
}

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
}

type SortKey = 'count' | 'wallet';
type SortDir = 'asc' | 'desc';

interface ResultsTableProps {
  wallets: WalletOverlap[];
  tokenInfos: TokenInfo[];
  onExport: () => void;
}

const COLORS = [
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'bg-green-500/20 text-green-300 border-green-500/30',
  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'bg-red-500/20 text-red-300 border-red-500/30',
  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
];

function badgeColor(index: number) {
  return COLORS[index % COLORS.length];
}

function sortWallets(wallets: WalletOverlap[], key: SortKey, dir: SortDir): WalletOverlap[] {
  return [...wallets].sort((a, b) => {
    let cmp: number;
    if (key === 'count') cmp = a.count - b.count;
    else cmp = a.wallet.localeCompare(b.wallet);
    return dir === 'desc' ? -cmp : cmp;
  });
}

export default function ResultsTable({ wallets, tokenInfos, onExport }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => sortWallets(wallets, sortKey, sortDir),
    [wallets, sortKey, sortDir]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">
          Overlapping Wallets — {wallets.length} found
        </h3>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th
                className="text-left px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-gray-200 transition-colors"
                onClick={() => toggleSort('wallet')}
              >
                Wallet{sortArrow('wallet')}
              </th>
              <th
                className="text-center px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-gray-200 transition-colors"
                onClick={() => toggleSort('count')}
              >
                Tokens{sortArrow('count')}
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Held Tokens
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {sorted.map((w) => (
              <tr key={w.wallet} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={`https://solscan.io/account/${w.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-mono text-xs transition-colors"
                  >
                    {w.wallet.slice(0, 6)}...{w.wallet.slice(-6)}
                  </a>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-700 text-gray-200 text-xs font-bold">
                    {w.count}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {w.tokens.map((t) => {
                      const idx = tokenInfos.findIndex((ti) => ti.mint === t.mint);
                      return (
                        <span
                          key={t.mint}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeColor(idx)}`}
                        >
                          {t.symbol}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {wallets.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No overlapping wallets found — these tokens may not share common holders
        </div>
      )}
    </div>
  );
}