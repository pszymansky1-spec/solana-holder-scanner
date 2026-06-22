export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
}

// Minimal — just shows the address since both Jupiter & Birdeye are unreliable
export async function getTokenInfo(mint: string): Promise<TokenInfo> {
  return {
    address: mint,
    symbol: mint.slice(0, 4),
    name: mint.slice(0, 8) + '...',
  };
}