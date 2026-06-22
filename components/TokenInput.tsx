'use client';

import { useState } from 'react';

interface TokenInputProps {
  tokens: string[];
  onAdd: (mint: string) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

export default function TokenInput({ tokens, onAdd, onRemove, onClear }: TokenInputProps) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Support comma-separated and newline-separated
    const mints = trimmed
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s));

    for (const mint of mints) {
      onAdd(mint);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste token mint addresses (one per line, or comma-separated)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
        />
        <button
          onClick={handleAdd}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
        >
          Add
        </button>
      </div>

      {tokens.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {tokens.length} token{tokens.length > 1 ? 's' : ''} added
            </span>
            <button
              onClick={onClear}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((mint, i) => (
              <div
                key={`${mint}-${i}`}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-gray-200 font-mono text-xs">
                  {mint.slice(0, 8)}...{mint.slice(-6)}
                </span>
                <button
                  onClick={() => onRemove(i)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}