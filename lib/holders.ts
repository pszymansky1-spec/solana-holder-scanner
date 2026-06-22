import { getCache, setCache } from './cache';

const DELAY_MS = 300;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface HolderResult {
  address: string;  // token account address
  owner: string;    // owner wallet address
  balance: number;
}

async function fetchFromHelius(method: string, params: any[], apiKey: string): Promise<any> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.error ? null : json.result;
}

async function fetchTopHolders(mint: string, apiKey: string): Promise<HolderResult[]> {
  const cacheKey = `holders:${mint}`;
  const cached = getCache<HolderResult[]>(cacheKey);
  if (cached) return cached;

  await delay(DELAY_MS);

  // getTokenLargestAccounts returns top token accounts (fast ~1s)
  const result = await fetchFromHelius('getTokenLargestAccounts', [mint], apiKey);
  if (!result?.value || result.value.length === 0) {
    setCache(cacheKey, []);
    return [];
  }

  // Fetch owner for each token account in parallel
  const holders: HolderResult[] = [];
  const batches = [];
  for (let i = 0; i < result.value.length; i += 5) {
    batches.push(result.value.slice(i, i + 5));
  }

  for (const batch of batches) {
    const ownerResults = await Promise.all(
      batch.map(async (acct: any) => {
        const acctInfo = await fetchFromHelius('getAccountInfo', [
          acct.address,
          { encoding: 'jsonParsed' },
        ], apiKey);
        const owner = acctInfo?.value?.data?.parsed?.info?.owner;
        if (owner) {
          return { address: acct.address, owner, balance: parseFloat(acct.uiAmount ?? '0') };
        }
        return null;
      })
    );
    for (const h of ownerResults) {
      if (h) holders.push(h);
    }
    if (batches.length > 1) await delay(200);
  }

  setCache(cacheKey, holders);
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

export async function scanOverlap(
  tokens: { mint: string; symbol: string }[],
  heliusKey: string
): Promise<ScanResult> {
  const allHolders: Map<string, HolderResult[]> = new Map();

  for (const token of tokens) {
    const holders = await fetchTopHolders(token.mint, heliusKey);
    allHolders.set(token.mint, holders);
  }

  // Build wallet->tokens map
  const walletMap = new Map<string, { mint: string; symbol: string; balance: number }[]>();

  for (const token of tokens) {
    const holders = allHolders.get(token.mint) ?? [];
    for (const h of holders) {
      const entry = walletMap.get(h.owner) ?? [];
      entry.push({ mint: token.mint, symbol: token.symbol, balance: h.balance });
      walletMap.set(h.owner, entry);
    }
  }

  // Filter to wallets holding at least 2 tokens
  const overlapping: WalletOverlap[] = [];
  for (const [wallet, heldTokens] of walletMap) {
    if (heldTokens.length >= 2) {
      overlapping.push({ wallet, tokens: heldTokens, count: heldTokens.length });
    }
  }

  overlapping.sort((a, b) => b.count - a.count);

  const totalHolders = new Set<string>();
  for (const holders of allHolders.values()) {
    for (const h of holders) {
      totalHolders.add(h.owner);
    }
  }

  return {
    wallets: overlapping,
    tokensScanned: tokens.length,
    totalHolders: totalHolders.size,
  };
}