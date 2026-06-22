import { getCache, setCache } from './cache';

const HELIUS_BASE = 'https://mainnet.helius-rpc.com';
const DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface HolderAccount {
  address: string;
  uiAmount: number;
}

async function fetchHeliusHolders(
  mint: string,
  apiKey: string
): Promise<HolderAccount[]> {
  const url = `${HELIUS_BASE}/?api-key=${apiKey}`;
  const holders: HolderAccount[] = [];

  const body = {
    jsonrpc: '2.0',
    id: 'holder-scan',
    method: 'getProgramAccounts',
    params: [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      {
        encoding: 'jsonParsed',
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`Helius getProgramAccounts failed: ${res.status}`);
      return [];
    }

    const json = await res.json();

    if (json.error) {
      console.warn(`Helius error: ${JSON.stringify(json.error)}`);
      return [];
    }

    for (const acct of json.result ?? []) {
      const info = acct.account?.data?.parsed?.info;
      if (!info) continue;
      const amount = parseFloat(info.tokenAmount?.uiAmount ?? '0');
      if (amount > 0) {
        holders.push({
          address: info.owner,
          uiAmount: amount,
        });
      }
    }
  } catch (e) {
    console.warn(`Helius fetch error for ${mint}:`, e);
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
): Promise<{ address: string; balance: number }[]> {
  const cacheKey = `holders:${mint}`;
  const cached = getCache<{ address: string; balance: number }[]>(cacheKey);
  if (cached) return cached;

  await delay(DELAY_MS);
  const holders = await fetchHeliusHolders(mint, heliusKey);

  const result = holders.map((h) => ({
    address: h.address,
    balance: h.uiAmount,
  }));

  setCache(cacheKey, result);
  return result;
}

export async function scanOverlap(
  tokens: { mint: string; symbol: string }[],
  heliusKey: string
): Promise<ScanResult> {
  const allHolders: Map<string, { address: string; balance: number }[]> =
    new Map();

  for (const token of tokens) {
    const holders = await fetchHoldersForToken(token.mint, heliusKey);
    allHolders.set(token.mint, holders);
  }

  // Build wallet->tokens map
  const walletMap = new Map<
    string,
    { mint: string; symbol: string; balance: number }[]
  >();

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