import { getCache, setCache } from './cache';

const DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface HolderResult {
  address: string;
  balance: number;
}

/** Try multiple RPC endpoints in order */
const RPCS = [
  (key: string) => `https://mainnet.helius-rpc.com/?api-key=${key}`,
  () => 'https://api.mainnet-beta.solana.com',
  () => 'https://solana-mainnet.g.alchemy.com/v2/demo',
  () => 'https://rpc.ankr.com/solana',
];

async function rpcCall(method: string, params: any[], apiKey: string): Promise<any> {
  for (const rpcFn of RPCS) {
    const url = rpcFn(apiKey);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error) continue;
      return json.result;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchHoldersViaGetTokenLargestAccounts(
  mint: string,
  apiKey: string
): Promise<HolderResult[]> {
  const result = await rpcCall('getTokenLargestAccounts', [mint], apiKey);
  if (!result?.value) return [];

  const owners: HolderResult[] = [];
  for (const acct of result.value) {
    // Get the owner of this token account
    const acctInfo = await rpcCall(
      'getAccountInfo',
      [acct.address, { encoding: 'jsonParsed' }],
      apiKey
    );
    const owner = acctInfo?.value?.data?.parsed?.info?.owner;
    if (owner) {
      owners.push({ address: owner, balance: parseFloat(acct.uiAmount ?? '0') });
    }
  }
  return owners;
}

async function fetchHoldersViaGetProgramAccounts(
  mint: string,
  apiKey: string
): Promise<HolderResult[]> {
  const result = await rpcCall('getProgramAccounts', [
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    {
      encoding: 'jsonParsed',
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mint } },
      ],
    },
  ], apiKey);

  if (!result || !Array.isArray(result)) return [];

  const holders: HolderResult[] = [];
  for (const acct of result) {
    const info = acct.account?.data?.parsed?.info;
    if (!info) continue;
    const amount = parseFloat(info.tokenAmount?.uiAmount ?? '0');
    if (amount > 0) {
      holders.push({ address: info.owner, balance: amount });
    }
  }
  return holders;
}

export interface WalletOverlap {
  wallet: string;
  tokens: { mint: string; symbol: string; balance: number }[];
  count: number;
}

export interface ScanResult {
  wallets: WalletOverlap[];
  tokensScanned: number;
  totalHolders: number;
}

async function fetchHoldersForToken(
  mint: string,
  heliusKey: string
): Promise<HolderResult[]> {
  const cacheKey = `holders:${mint}`;
  const cached = getCache<HolderResult[]>(cacheKey);
  if (cached) return cached;

  await delay(DELAY_MS);

  // Try getTokenLargestAccounts first (works on most RPCs)
  let holders = await fetchHoldersViaGetTokenLargestAccounts(mint, heliusKey);

  // Fallback to getProgramAccounts
  if (holders.length === 0) {
    await delay(DELAY_MS);
    holders = await fetchHoldersViaGetProgramAccounts(mint, heliusKey);
  }

  setCache(cacheKey, holders);
  return holders;
}

export async function scanOverlap(
  tokens: { mint: string; symbol: string }[],
  heliusKey: string
): Promise<ScanResult> {
  const allHolders: Map<string, HolderResult[]> = new Map();

  for (const token of tokens) {
    const holders = await fetchHoldersForToken(token.mint, heliusKey);
    allHolders.set(token.mint, holders);
  }

  // Build wallet->tokens map
  const walletMap = new Map<string, { mint: string; symbol: string; balance: number }[]>();

  for (const token of tokens) {
    const holders = allHolders.get(token.mint) ?? [];
    for (const h of holders) {
      const entry = walletMap.get(h.address) ?? [];
      entry.push({ mint: token.mint, symbol: token.symbol, balance: h.balance });
      walletMap.set(h.address, entry);
    }
  }

  // Filter to wallets holding at least 2 tokens
  const overlapping: WalletOverlap[] = [];
  for (const [wallet, heldTokens] of walletMap) {
    if (heldTokens.length >= 2) {
      overlapping.push({
        wallet,
        tokens: heldTokens,
        count: heldTokens.length,
      });
    }
  }

  overlapping.sort((a, b) => b.count - a.count);

  const totalHolders = new Set<string>();
  for (const holders of allHolders.values()) {
    for (const h of holders) {
      totalHolders.add(h.address);
    }
  }

  return {
    wallets: overlapping,
    tokensScanned: tokens.length,
    totalHolders: totalHolders.size,
  };
}