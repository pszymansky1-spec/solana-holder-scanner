import { type NextRequest } from 'next/server';
import { scanOverlap } from '@/lib/holders';
import { getTokenInfo } from '@/lib/tokens';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { tokens } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length < 2) {
      return Response.json(
        { error: 'Provide at least 2 token mint addresses' },
        { status: 400 }
      );
    }

    const heliusKey = process.env.HELIUS_API_KEY!;
    if (!heliusKey) {
      return Response.json(
        { error: 'HELIUS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Resolve token metadata
    const tokenInfos = await Promise.all(
      tokens.map(async (mint: string) => {
        const info = await getTokenInfo(mint);
        return { mint, symbol: info.symbol, name: info.name };
      })
    );

    const result = await scanOverlap(
      tokenInfos.map((t) => ({ mint: t.mint, symbol: t.symbol })),
      heliusKey
    );

    return Response.json({
      wallets: result.wallets,
      tokensScanned: result.tokensScanned,
      totalHolders: result.totalHolders,
      tokenInfos,
    });
  } catch (e: any) {
    console.error('Scan error:', e);
    return Response.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}