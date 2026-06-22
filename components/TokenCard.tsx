'use client';

interface TokenCardProps {
  symbol: string;
  name: string;
  index: number;
}

const COLORS = [
  'from-blue-500 to-blue-700',
  'from-purple-500 to-purple-700',
  'from-green-500 to-green-700',
  'from-orange-500 to-orange-700',
  'from-pink-500 to-pink-700',
  'from-teal-500 to-teal-700',
  'from-red-500 to-red-700',
  'from-indigo-500 to-indigo-700',
];

export default function TokenCard({ symbol, name, index }: TokenCardProps) {
  const gradient = COLORS[index % COLORS.length];
  return (
    <div className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2">
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}>
        {symbol.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-200">{symbol}</div>
        <div className="text-xs text-gray-500 truncate max-w-[120px]">{name}</div>
      </div>
    </div>
  );
}